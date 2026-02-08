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
2. **CRITICAL**: If the user has selected or attached documents, context from those documents may be provided below. You MUST base your answer on that context. Use `search_knowledge` if you need more retrieval.
3. **CRITICAL**: If the user asks for an explanation, proof, concept definition, or detailed information, **YOU MUST USE `generate_concept_cell`**. Do NOT write the explanation in the Final Answer.
4. For quiz requests, use the create_quiz_cell tool.
5. For topics requiring prior knowledge, run check_prerequisites first.
6. For file/document summarization, use the create_summary_cell tool.
7. Always start each step with Thought.
8. Your Final Answer should be a short confirmation like "I have generated the content in the workspace." followed by the actual content generation via tools.

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
        attachments: Optional[List[Dict[str, Any]]] = None,
        initial_document_context: Optional[str] = None,
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
            document_ids=document_ids,
            attachments=attachments
        )
        self.initial_document_context = (initial_document_context or "").strip()
        self.max_iterations = max_iterations
        self.scratchpad = ""
    
    def _build_prompt(self, question: str) -> str:
        """Combine system prompt + user question + scratchpad; inject document context when present."""
        tools_description = self.toolkit.get_tools_prompt()
        system_prompt = REACT_SYSTEM_PROMPT.format(tools=tools_description)
        
        user_block = f"User Question: {question}"
        if self.initial_document_context:
            user_block = (
                "## Context from the user's selected/attached documents (use this for your answer)\n"
                f"{self.initial_document_context}\n\n"
                f"{user_block}"
            )
        
        prompt = f"""{system_prompt}

## Current Session
{user_block}

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
    
    def _get_friendly_action_message(self, action_name: str, action_input: Dict[str, Any]) -> str:
        """Generate user-friendly status message based on action"""
        topic = action_input.get("topic")
        query = action_input.get("query")
        
        if action_name == "generate_concept_cell":
            return f"Thinking about '{topic}' and writing an explanation... ✍️" if topic else "Drafting an explanation... ✍️"
        elif action_name == "create_quiz_cell":
            return f"Creating quiz questions for '{topic}'... 📝" if topic else "Preparing a quiz... 📝"
        elif action_name == "check_prerequisites":
            return f"Checking what you need to know before learning '{topic}'... 🔍" if topic else "Checking prerequisites... 🔍"
        elif action_name == "create_summary_cell":
            return "Summarizing the content... 📋"
        elif action_name == "vector_search":
            return f"Searching knowledge base for '{query}'... 🔎" if query else "Searching knowledge base... 🔎"
        else:
            return f"Working on it ({action_name})... 🔧"

    @track(name="react_agent_run", type="tool")
    async def run(self, question: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Execute ReAct agent (streaming)
        
        Yields:
            {"status": "progress", "step": "...", "message": "..."}
            {"status": "complete", "data": {...}}
        """
        self.scratchpad = ""
        self.accumulated_learning_units = []
        self.detected_topic = None  # Track main topic for chat message
        
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
                # Generate appropriate chat message based on actions taken
                chat_msg = self._generate_chat_message()
                
                # Build learning_unit from accumulated content
                learning_unit = self._build_learning_unit()
                
                yield {
                    "status": "complete",
                    "data": {
                        "message": chat_msg,  # Short status for chat sidebar
                        "chat_message": chat_msg,  # Explicit field
                        "conversation_id": "react-session",
                        "sources": [],
                        "reasoning_chain": self._get_reasoning_chain(),
                        "learning_unit": learning_unit  # Structured for cell
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
            
            # 4. Stream progress status with friendly message
            friendly_msg = self._get_friendly_action_message(action_name, action_input)
            yield {
                "status": "progress",
                "step": f"action_{iteration + 1}",
                "message": friendly_msg
            }
            
            # 5. Execute tool (map vector_search -> search_knowledge for compatibility)
            tool_name = "search_knowledge" if action_name == "vector_search" else action_name
            if action_name == "vector_search" and "query" not in action_input and "topic" in action_input:
                action_input = {"query": action_input.get("topic", "")}
            try:
                observation = await self.toolkit.execute(tool_name, **action_input)
            except Exception as e:
                observation = f"[Error] Tool execution failed: {str(e)}"
            
            # 6. Collect Learning Units and extract topic
            if action_name in ["create_quiz_cell", "generate_concept_cell", "check_prerequisites", "create_summary_cell"]:
                # Determine unit type based on action name
                if "quiz" in action_name:
                    unit_type = "quiz"
                elif "summary" in action_name:
                    unit_type = "summary"
                else:
                    unit_type = "concept"
                
                content = observation
                graph_data = None
                
                # ✨ [Fix] Parse JSON output from generate_concept_cell
                if action_name == "generate_concept_cell":
                    try:
                        # Try to find JSON object boundaries
                        json_match = re.search(r'\{.*\}', observation, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            if "text_content" in parsed:
                                content = parsed["text_content"]
                            if "graph_data" in parsed:
                                graph_data = parsed["graph_data"]
                    except:
                        # Fallback: Regex Extraction (Robust against bad escaping)
                        # Extract text_content
                        try:
                            text_match = re.search(r'"text_content"\s*:\s*"(.*?)(?<!\\)",', observation, re.DOTALL)
                            if text_match:
                                # Start of manual unescape
                                extracted_text = text_match.group(1)
                                extracted_text = extracted_text.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                                content = extracted_text
                            
                            # Extract graph_data
                            graph_match = re.search(r'"graph_data"\s*:\s*(\{.*\})\s*\}', observation, re.DOTALL)
                            if graph_match:
                                graph_json = graph_match.group(1)
                                # Try parsing just the graph part
                                try:
                                    graph_data = json.loads(graph_json)
                                except:
                                    pass
                        except:
                            pass
                        # If all fails, content remains as observation (raw JSON) -> better than crash, but user will complain
                        # But at least we tried harder.

                self.accumulated_learning_units.append({
                    "type": unit_type,
                    "content": content,
                    "title": action_input.get("topic", "Learning Content"),
                    "graph_data": graph_data
                })
                # Track topic for chat message
                if action_input.get("topic"):
                    self.detected_topic = action_input.get("topic")
            
            # 7. Update scratchpad
            self.scratchpad += f"\nThought: {thought}\n"
            self.scratchpad += f"Action: {action_name}\n"
            self.scratchpad += f"Action Input: {json.dumps(action_input, ensure_ascii=False)}\n"
            self.scratchpad += f"Observation: {observation[:500]}...\n" if len(observation) > 500 else f"Observation: {observation}\n"
        
        # Max iterations reached
        chat_msg = self._generate_chat_message() or "I've prepared some learning materials for you. Check the workspace!"
        learning_unit = self._build_learning_unit()
        
        yield {
            "status": "complete",
            "data": {
                "message": chat_msg,
                "chat_message": chat_msg,
                "conversation_id": "react-session",
                "sources": [],
                "reasoning_chain": self._get_reasoning_chain(),
                "learning_unit": learning_unit
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
    
    def _generate_chat_message(self) -> str:
        """Generate short status message for chat sidebar"""
        if not self.accumulated_learning_units:
            return "답변하기 어렵거나 에러가 발생한 것 같습니다!"
        
        # Count what was created
        has_concept = any(u["type"] == "concept" for u in self.accumulated_learning_units)
        has_quiz = any(u["type"] == "quiz" for u in self.accumulated_learning_units)
        has_summary = any(u["type"] == "summary" for u in self.accumulated_learning_units)
        
        topic = self.detected_topic or "your topic"
        
        if has_summary:
            return f"📋 I've created a summary of **{topic}**. Check the workspace!"
        elif has_concept and has_quiz:
            return f"📚 I've prepared an explanation and quiz about **{topic}**! Check the workspace."
        elif has_quiz:
            return f"📝 Quiz ready! I've added questions about **{topic}** to test your understanding."
        elif has_concept:
            return f"📚 I've created an explanation about **{topic}**. Check the workspace!"
        else:
            return "✅ Done! Check the workspace for the results."
    
    def _build_learning_unit(self) -> Optional[Dict[str, Any]]:
        """Build structured learning unit for cell display"""
        if not self.accumulated_learning_units:
            return None
        
        # Combine all accumulated content into a single learning unit
        combined_content = ""
        unit_type = "concept"
        quiz_data = []
        graph_data = None # ✨ [Added]
        
        for unit in self.accumulated_learning_units:
            if unit["type"] == "quiz":
                unit_type = "quiz"
                # Try to parse quiz JSON from content
                try:
                    content = unit["content"]
                    # Extract JSON from markdown code block if present
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
                    if json_match:
                        quiz_data = json.loads(json_match.group(1))
                    else:
                        # Try direct JSON parse
                        quiz_data = json.loads(content)
                except:
                    combined_content += f"\n\n## Quiz\n{unit['content']}"
            elif unit["type"] == "summary":
                unit_type = "summary"
                combined_content += f"\n\n{unit['content']}"
            else:
                combined_content += f"\n\n{unit['content']}"
                if unit.get("graph_data"):
                    graph_data = unit["graph_data"] # ✨ [Added] Use graph data from concept unit
        
        learning_unit = {
            "title": self.detected_topic or "Learning Content",
            "type": unit_type,
            "content": combined_content.strip(),
            "equations": [],
            "quiz_data": quiz_data if unit_type == "quiz" else [],
            "graph_data": graph_data # ✨ [Added] Pass graph data
        }
        
        return learning_unit


async def query_with_react_agent(
    question: str,
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process question with ReAct agent. When document_ids or attachments are provided,
    pre-fetches context from those documents so the agent uses them in the response.
    """
    initial_document_context = ""
    if document_ids or attachments:
        loop = asyncio.get_event_loop()
        try:
            from utils.vector_store import get_retriever
            # 1) Try with document_ids filter so we only get chunks from selected files
            retriever = get_retriever(
                collection_name="user_knowledge",
                k=16,
                folder_id=folder_id,
                document_ids=document_ids or None,
            )
            docs = await loop.run_in_executor(
                None, lambda: retriever.invoke(question)
            )
            # 2) If filter returned nothing, fallback: search without doc filter and filter in Python
            #    (handles metadata key/format mismatch between ingest and Supabase)
            if document_ids and (not docs or all(
                d.metadata.get("document_id") not in document_ids
                for d in docs
            )):
                retriever_fallback = get_retriever(
                    collection_name="user_knowledge",
                    k=24,
                    folder_id=folder_id,
                    document_ids=None,
                )
                raw_docs = await loop.run_in_executor(
                    None, lambda: retriever_fallback.invoke(question)
                )
                docs = [
                    d for d in raw_docs
                    if d.metadata.get("document_id") in document_ids
                    or d.metadata.get("source") in document_ids
                ][:16]
            if docs:
                parts = []
                for doc in docs:
                    source = doc.metadata.get("source", "Document")
                    parts.append(f"[{source}]\n{doc.page_content}")
                initial_document_context = "\n\n---\n\n".join(parts)[:8000]
        except Exception as e:
            print(f"Pre-fetch document context failed: {e}")

    agent = ReactLearningAgent(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids,
        attachments=attachments,
        initial_document_context=initial_document_context or None,
    )

    async for event in agent.run(question):
        yield event
