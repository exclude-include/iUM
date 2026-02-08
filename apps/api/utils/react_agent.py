"""
ReAct Learning Agent for iUM
Reasoning + Acting pattern learning agent
"""
import os
import re
import json
import asyncio
from typing import Optional, Dict, Any, List, AsyncGenerator
from langchain_google_genai import ChatGoogleGenerativeAI
from utils.learning_tools import LearningToolkit, get_learning_toolkit
from utils.opik_config import track


REACT_SYSTEM_PROMPT = """You are the iUM learning agent.
You think step-by-step about the user's learning questions and use tools to provide the best possible answers.

## Available Tools
{tools}

## Response Format

### When you need to use a tool:
```
Thought: [Analyze current situation and decide next action]
Action: [tool_name]
Action Input: [tool parameters in JSON]
```

### When providing the final answer:
```
Thought: I have gathered sufficient information. Here is my final answer.
Final Answer: [Final response to the user]
```

## Rules
1. For complex questions, use multiple tools sequentially.
2. For quiz requests, use the create_quiz_cell tool.
3. For topics requiring prior knowledge, run check_prerequisites first.
4. Always start each step with Thought.
5. Format your Final Answer in markdown.

## Example
User: "Explain calculus and also create a quiz"

Thought: The user wants an explanation of calculus and a quiz. I'll first generate a concept explanation, then create a quiz.
Action: generate_concept_cell
Action Input: {{"topic": "calculus"}}

(After Observation)

Thought: I've created the concept explanation. Now I'll generate a quiz.
Action: create_quiz_cell
Action Input: {{"topic": "calculus", "num_questions": 3}}

(After Observation)

Thought: I have both the concept explanation and quiz ready. Here is my final answer.
Final Answer: I've prepared an explanation and quiz about calculus! ...
"""


class ReactLearningAgent:
    """
    Learning agent with ReAct pattern
    
    Flow:
    1. Receive user question
    2. Thought: Decide next action
    3. Action: Call tool
    4. Observation: Check tool result
    5. Repeat or return Final Answer
    """
    
    def __init__(
        self,
        folder_id: Optional[str] = None,
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        max_iterations: int = 5
    ):
        self.llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.toolkit = get_learning_toolkit(
            folder_id=folder_id,
            session_id=session_id,
            document_ids=document_ids
        )
        self.max_iterations = max_iterations
        self.scratchpad = ""
    
    def _build_prompt(self, question: str) -> str:
        """Combine system prompt + user question + scratchpad"""
        tools_description = self.toolkit.get_tools_prompt()
        system_prompt = REACT_SYSTEM_PROMPT.format(tools=tools_description)
        
        prompt = f"""{system_prompt}

## Current Session
User Question: {question}

{self.scratchpad}"""
        return prompt
    
    def _parse_action(self, response: str) -> Optional[Dict[str, Any]]:
        """Parse Action and Action Input from LLM response"""
        # Parse Action
        action_match = re.search(r'Action:\s*(\w+)', response)
        if not action_match:
            return None
        
        action_name = action_match.group(1).strip()
        
        # Parse Action Input (JSON format)
        input_match = re.search(r'Action Input:\s*(\{.*?\})', response, re.DOTALL)
        if input_match:
            try:
                action_input = json.loads(input_match.group(1))
            except json.JSONDecodeError:
                action_input = {}
        else:
            # Parse simple string input
            input_match = re.search(r'Action Input:\s*(.+?)(?:\n|$)', response)
            if input_match:
                action_input = {"query": input_match.group(1).strip().strip('"')}
            else:
                action_input = {}
        
        return {
            "action": action_name,
            "action_input": action_input
        }
    
    def _parse_final_answer(self, response: str) -> Optional[str]:
        """Parse Final Answer"""
        match = re.search(r'Final Answer:\s*(.+)', response, re.DOTALL)
        if match:
            return match.group(1).strip()
        return None
    
    def _extract_thought(self, response: str) -> str:
        """Extract Thought portion"""
        match = re.search(r'Thought:\s*(.+?)(?:Action:|Final Answer:|$)', response, re.DOTALL)
        if match:
            return match.group(1).strip()
        return ""
    
    @track(name="react_agent_run", type="tool")
    async def run(self, question: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Execute ReAct agent (streaming)
        
        Yields:
            {"status": "progress", "step": "...", "message": "..."}
            {"status": "complete", "data": {...}}
        """
        self.scratchpad = ""
        accumulated_learning_units = []
        
        yield {
            "status": "progress", 
            "step": "thinking", 
            "message": "Analyzing your question... 🤔"
        }
        
        for iteration in range(self.max_iterations):
            # 1. Request LLM to decide next action
            prompt = self._build_prompt(question)
            
            try:
                response = await self.llm.ainvoke(prompt)
                response_text = response.content
            except Exception as e:
                yield {
                    "status": "error",
                    "data": {"message": f"LLM call failed: {str(e)}"}
                }
                return
            
            # 2. Check for Final Answer
            final_answer = self._parse_final_answer(response_text)
            if final_answer:
                yield {
                    "status": "complete",
                    "data": {
                        "message": final_answer,
                        "conversation_id": "react-session",
                        "sources": [],
                        "reasoning_chain": self._get_reasoning_chain(),
                        "learning_units": accumulated_learning_units
                    }
                }
                return
            
            # 3. Parse Action
            action = self._parse_action(response_text)
            if not action:
                # No Action or Final Answer, return response as-is
                yield {
                    "status": "complete",
                    "data": {
                        "message": response_text,
                        "conversation_id": "react-session",
                        "sources": [],
                        "reasoning_chain": ["Direct response"]
                    }
                }
                return
            
            thought = self._extract_thought(response_text)
            action_name = action["action"]
            action_input = action["action_input"]
            
            # 4. Stream progress status
            yield {
                "status": "progress",
                "step": f"action_{iteration + 1}",
                "message": f"Executing tool: {action_name} 🔧"
            }
            
            # 5. Execute tool
            try:
                observation = await self.toolkit.execute(action_name, **action_input)
            except Exception as e:
                observation = f"[Error] Tool execution failed: {str(e)}"
            
            # 6. Collect Learning Units (for quiz_cell or concept_cell)
            if action_name in ["create_quiz_cell", "generate_concept_cell"]:
                accumulated_learning_units.append({
                    "type": "quiz" if "quiz" in action_name else "concept",
                    "content": observation
                })
            
            # 7. Update scratchpad
            self.scratchpad += f"\nThought: {thought}\n"
            self.scratchpad += f"Action: {action_name}\n"
            self.scratchpad += f"Action Input: {json.dumps(action_input, ensure_ascii=False)}\n"
            self.scratchpad += f"Observation: {observation[:500]}...\n" if len(observation) > 500 else f"Observation: {observation}\n"
        
        # Max iterations reached
        yield {
            "status": "complete",
            "data": {
                "message": "Maximum iterations reached. Here is my response based on the information gathered so far.",
                "conversation_id": "react-session",
                "sources": [],
                "reasoning_chain": self._get_reasoning_chain(),
                "learning_units": accumulated_learning_units
            }
        }
    
    def _get_reasoning_chain(self) -> List[str]:
        """Extract reasoning chain from scratchpad"""
        thoughts = re.findall(r'Thought:\s*(.+?)(?:\n|$)', self.scratchpad)
        actions = re.findall(r'Action:\s*(\w+)', self.scratchpad)
        
        chain = []
        for i, (thought, action) in enumerate(zip(thoughts, actions)):
            chain.append(f"Step {i+1}: {thought[:50]}... → {action}")
        
        if not chain:
            chain = ["Direct response"]
        
        return chain


async def query_with_react_agent(
    question: str,
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process question with ReAct agent (convenience function)
    
    Args:
        question: User question
        folder_id: Folder ID (document filtering)
        session_id: Session ID (history integration)
        document_ids: Specific document ID list
    
    Yields:
        Streaming events
    """
    agent = ReactLearningAgent(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids
    )
    
    async for event in agent.run(question):
        yield event
