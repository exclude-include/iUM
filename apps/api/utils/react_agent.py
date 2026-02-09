"""
ReAct Learning Agent for iUM
Reasoning + Acting pattern learning agent
"""
import os
import re
import json
import random
import asyncio
from typing import Optional, Dict, Any, List, AsyncGenerator
from langchain_google_genai import ChatGoogleGenerativeAI
from utils.learning_tools import LearningToolkit, get_learning_toolkit
from utils.opik_config import track
from utils.self_reflection import get_self_reflection


REACT_SYSTEM_PROMPT = """You are the iUM learning agent.
You think step-by-step about the user's learning questions and use tools to provide the best possible answers.

## Available Tools
{tools}

## Available Files Context
{folder_files_context}

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

## ⚠️ CRITICAL: Knowledge Search Strategy (MUST FOLLOW)

**For ANY question that is NOT a trivial calculation or simple task (like "1+1", "create a simple table with 1,2,3"), you MUST search for knowledge FIRST before generating content.**

### Search Priority Order (ALWAYS follow this sequence):

**Step 1: Check Attached Files (Highest Priority)**
- If the user has uploaded/attached files in THIS chat message, their content is provided in the context
- Use this content FIRST to answer the question

**Step 2: Search Folder Documents**
- If Step 1 doesn't provide sufficient information, use `search_knowledge` to search through ALL documents in the current folder
- Also check "Available Files Context" above for file summaries
- If you need full content of a specific file, use `read_file_content` with the file_id

**Step 3: Web Search (Required when local info is insufficient)**
- If Steps 1-2 don't provide confident, authoritative answers, you MUST use `web_search`
- **MANDATORY web search scenarios:**
  - Topic requires current/recent information (news, trends, recent events)
  - Search results from Steps 1-2 are empty or low-confidence
  - Question asks about something not likely in personal documents
  - Need external sources or citations

### Example Flow for a Complex Question:
```
User: "Explain quantum computing"

Thought: This is a complex topic. I must search for knowledge first. Let me check folder documents.
Action: search_knowledge
Action Input: {{"query": "quantum computing"}}

(If results are insufficient or empty)

Thought: Local documents don't have enough information. I must search the web.
Action: web_search
Action Input: {{"query": "quantum computing explained basics"}}

(After getting good context)

Thought: Now I have sufficient context. I'll create an explanation.
Action: generate_concept_cell
Action Input: {{"topic": "quantum computing"}}
```

### Simple Tasks (NO search needed):
- Basic math: "1+1", "5*3"
- Simple formatting: "make a table with numbers 1,2,3"
- Direct instructions with all info provided

## Rules
1. **ALWAYS search first** for non-trivial questions (use the 3-step priority above)
2. For explanations, proofs, or detailed information, use `generate_concept_cell` AFTER gathering context
3. For quiz requests, use `create_quiz_cell`
4. For file/document summarization, use `create_summary_cell`
5. For flashcard requests, use `create_flashcard_cell`
6. **For TABLE requests**: Use `create_table_cell`
7. **For DIAGRAM requests**: Use `create_diagram_cell`
8. Always cite sources when using web search results
9. Your Final Answer should be a short confirmation like "I have generated the content in the workspace."

## Example for Table
User: "Create a table showing 1, 2, 3"

Thought: This is a simple formatting task with all information provided. No search needed.
Action: create_table_cell
Action Input: {{"topic": "numbers 1,2,3"}}

## Example for Complex Topic
User: "Explain the French Revolution"

Thought: This is a complex historical topic. I need to search for context first.
Action: search_knowledge
Action Input: {{"query": "French Revolution history"}}

(If no relevant local results)

Thought: No relevant documents found locally. I must search the web for reliable information.
Action: web_search  
Action Input: {{"query": "French Revolution causes events outcomes"}}

(After getting context)

Thought: I now have sufficient context. Creating the explanation.
Action: generate_concept_cell
Action Input: {{"topic": "French Revolution"}}
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
        folder_files_context: Optional[str] = None,  # ✨ 폴더 내 파일 요약 컨텍스트
        max_iterations: int = 5,
        skip_evaluation: bool = False,  # ✨ [추가] 품질 평가 건너뛰기
        enable_web_search: bool = False  # ✨ [추가] 웹 검색 활성화
    ):
        self.llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.folder_files_context = (folder_files_context or "").strip()
        self.enable_web_search = enable_web_search  # ✨ [추가]
        self.toolkit = get_learning_toolkit(
            folder_id=folder_id,
            session_id=session_id,
            document_ids=document_ids,
            attachments=attachments,
            folder_files_context=self.folder_files_context,
            enable_web_search=enable_web_search  # ✨ [추가] 웹 검색 설정 전달
        )
        self.initial_document_context = (initial_document_context or "").strip()
        self.max_iterations = max_iterations
        self.scratchpad = ""
        self.skip_evaluation = skip_evaluation  # ✨ [추가]
        self.reflection = get_self_reflection(self.llm)
        self.evaluation_metrics = {}

    def _build_prompt(self, question: str) -> str:
        """Combine system prompt + user question + scratchpad; inject document context when present."""
        tools_description = self.toolkit.get_tools_prompt()
        
        # Include folder files context if available
        files_context = self.folder_files_context if self.folder_files_context else "No files available in current folder."
        system_prompt = REACT_SYSTEM_PROMPT.format(
            tools=tools_description,
            folder_files_context=files_context
        )

        user_block = f"User Question: {question}"
        if self.initial_document_context:
            user_block = (
                "## Context from the user's selected/attached documents (you MUST use this to answer)\n"
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
        # Improvement: greedy match for JSON to handle nested braces or multiple lines better
        input_match = re.search(r'Action Input:\s*(\{.*\})', response, re.DOTALL)
        if input_match:
            try:
                json_str = input_match.group(1)
                # Cleaning: sometimes LLM adds backticks around JSON
                if json_str.startswith("```json"):
                    json_str = json_str[7:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]
                
                action_input = json.loads(json_str.strip())
            except json.JSONDecodeError:
                print(f"[DEBUG] JSON Decode Error for action {action_name}. Raw: {input_match.group(1)}")
                action_input = {}
        else:
            # Parse simple string input
            input_match = re.search(r'Action Input:\s*(.+?)(?:\n|$)', response)
            if input_match:
                raw_input = input_match.group(1).strip().strip('"')
                # If it looks like start of JSON but failed regex, it might be incomplete
                if raw_input.startswith("{"):
                    print(f"[DEBUG] Failed to parse JSON input for {action_name}: {raw_input}")
                    action_input = {}
                else:
                    # Assume single argument "query" (legacy behavior) or "topic" based on tool?
                    # Actually, for flashcards, if it's just a string, it's likely the topic.
                    if action_name == "create_flashcard_cell":
                         action_input = {"topic": raw_input}
                    elif action_name == "search_knowledge":
                         action_input = {"query": raw_input}
                    elif action_name == "web_search":
                         action_input = {"query": raw_input}
                    elif action_name == "read_file_content":
                         action_input = {"file_id": raw_input}  # ✨ Handle file reading
                    else:
                         action_input = {"topic": raw_input} # Default fallback
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
        elif action_name == "create_table_cell":
            return f"Creating a structured table for '{topic}'... 📊" if topic else "Creating a table... 📊"
        elif action_name == "create_diagram_cell":
            return f"Creating a visual diagram for '{topic}'... 📈" if topic else "Creating a diagram... 📈"
        elif action_name == "search_knowledge":
            return f"Searching your documents for '{query}'... 🔎" if query else "Searching your documents... 🔎"
        elif action_name == "web_search":
            return f"Searching the web for '{query}'... 🌐" if query else "Searching the internet... 🌐"
        elif action_name == "read_file_content":
            file_id = action_input.get("file_id", "")
            return f"Reading file content ({file_id[:8]}...)... 📄" if file_id else "Reading file content... 📄"
        elif action_name == "get_learning_history":
            return "Reviewing your learning history... 🕒"
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
                # ✨ Self-Reflection: Evaluate and improve response quality (if not skipped)
                if not self.skip_evaluation:
                    yield {
                        "status": "progress",
                        "step": "self_reflection",
                        "message": "Evaluating response quality... 🔍"
                    }
                    
                    final_answer, self.evaluation_metrics = await self.reflection.evaluate_and_improve(
                        response=final_answer,
                        query=question,
                        context=self.initial_document_context
                    )
                else:
                    # Skip evaluation - use response as-is
                    self.evaluation_metrics = {"skipped": True}
                
                # Generate appropriate chat message based on actions taken
                chat_msg = self._generate_chat_message(final_text=final_answer)
                
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
                        "learning_unit": learning_unit,  # Structured for cell
                        "evaluation_metrics": self.evaluation_metrics  # ✨ Quality metrics
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
            action_name = action["action"].strip()
            action_input = action["action_input"]
            
            # 4. Stream progress status with friendly message
            friendly_msg = self._get_friendly_action_message(action_name, action_input)
            yield {
                "status": "progress",
                "step": f"action_{iteration + 1}",
                "message": friendly_msg
            }
            
            # 5. Execute tool
            try:
                observation = await self.toolkit.execute(action_name, **action_input)
            except Exception as e:
                observation = f"[Error] Tool execution failed: {str(e)}"
            
            # 6. Collect Learning Units and extract topic
            print(f"[DEBUG] Action: {action_name}")
            if action_name in ["create_quiz_cell", "generate_concept_cell", "check_prerequisites", "create_summary_cell", "create_flashcard_cell", "create_table_cell", "create_diagram_cell"]:
                # Determine unit type based on action name
                print(f"[DEBUG] Collecting Unit: {action_name}")
                if "quiz" in action_name:
                    unit_type = "quiz"
                elif "summary" in action_name:
                    unit_type = "summary"
                elif "flashcard" in action_name:
                    unit_type = "flashcard"
                elif "table" in action_name:
                    unit_type = "table"
                elif "diagram" in action_name:
                    unit_type = "concept"  # diagram uses concept type with graph_data
                else:
                    unit_type = "concept"
                
                content = observation
                graph_data = None
                
                # ✨ [Fix] Parse JSON output from generate_concept_cell or create_diagram_cell
                if action_name in ["generate_concept_cell", "create_diagram_cell"]:
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
                
                # ✨ [New] For diagram without graph_data, create a fallback
                if action_name == "create_diagram_cell" and not graph_data:
                    topic = action_input.get("topic", "Concept")
                    graph_data = {
                        "nodes": [
                            {"id": "1", "label": topic, "type": "input"},
                            {"id": "2", "label": "Process", "type": "default"},
                            {"id": "3", "label": "Result", "type": "output"},
                        ],
                        "edges": [
                            {"id": "e1-2", "source": "1", "target": "2"},
                            {"id": "e2-3", "source": "2", "target": "3"},
                        ],
                    }

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
        chat_msg = self._generate_chat_message(final_text="I've analyzed your request but couldn't generate a specific learning unit. Please try rephrasing.")
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
    
    def _generate_chat_message(self, final_text: Optional[str] = None) -> str:
        """Generate short status message for chat sidebar"""
        if not self.accumulated_learning_units:
            # ✨ [Fix] If no units but we have a final text answer, show that!
            if final_text:
                return final_text
            return "답변하기 어렵거나 에러가 발생한 것 같습니다!"
        
        # Count what was created
        has_concept = any(u["type"] == "concept" for u in self.accumulated_learning_units)
        has_quiz = any(u["type"] == "quiz" for u in self.accumulated_learning_units)
        has_summary = any(u["type"] == "summary" for u in self.accumulated_learning_units)
        has_flashcard = any(u["type"] == "flashcard" for u in self.accumulated_learning_units)
        has_table = any(u["type"] == "table" for u in self.accumulated_learning_units)
        has_diagram = any(u.get("graph_data") for u in self.accumulated_learning_units)
        
        print(f"[DEBUG] has_flashcard: {has_flashcard}, has_table: {has_table}, has_diagram: {has_diagram}, units: {len(self.accumulated_learning_units)}")
        
        topic = self.detected_topic or "your topic"
        
        if has_table:
            return f"📊 I've created a table about **{topic}**. Check the workspace!"
        elif has_diagram:
            return f"📈 I've created a diagram for **{topic}**. Check the workspace!"
        elif has_summary:
            return f"📋 I've created a summary of **{topic}**. Check the workspace!"
        elif has_flashcard:
            return f"🎴 I've created flashcards for **{topic}**. Check the workspace!"
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
        flashcard_data = []
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
                    # Shuffle options so correct answer is randomly A/B/C/D
                    if isinstance(quiz_data, list):
                        for q in quiz_data:
                            if isinstance(q, dict) and q.get("options") and len(q["options"]) >= 2:
                                opts = q["options"]
                                random.shuffle(opts)
                                for i, o in enumerate(opts):
                                    if isinstance(o, dict):
                                        o["id"] = chr(65 + i)
                except:
                    combined_content += f"\n\n## Quiz\n{unit['content']}"
            elif unit["type"] == "flashcard":
                unit_type = "flashcard"
                try:
                    flashcard_content = unit["content"]
                    # Extract JSON if in code block
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', flashcard_content)
                    if json_match:
                        raw_data = json.loads(json_match.group(1))
                    else:
                        raw_data = json.loads(flashcard_content)
                    
                    # Ensure it's a list
                    if isinstance(raw_data, list):
                        flashcard_data = raw_data
                    elif isinstance(raw_data, dict):
                        # Try to find a list within the dict (common LLM behavior)
                        for key, value in raw_data.items():
                            if isinstance(value, list) and len(value) > 0 and "front" in value[0]:
                                flashcard_data = value
                                break
                        if not flashcard_data:
                            flashcard_data = raw_data.get("flashcards", [])
                    
                    if not isinstance(flashcard_data, list):
                        print(f"[DEBUG] Flashcard data is not a list: {type(flashcard_data)}")
                        raise ValueError("Flashcard data is not a list")
                        
                    if not flashcard_data:
                        print("[DEBUG] Flashcard data is empty")
                        raise ValueError("Flashcard data is empty")
                        
                    print(f"[DEBUG] Successfully parsed {len(flashcard_data)} flashcards")

                except Exception as e:
                    print(f"Error parsing flashcard data: {e}")
                    flashcard_data = []
                    combined_content += f"\n\n## Flashcards\n{unit['content']}"
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
            "flashcard_data": flashcard_data if unit_type == "flashcard" else [],
            "graph_data": graph_data # ✨ [Added] Pass graph data
        }
        
        return learning_unit


async def query_with_react_agent(
    question: str,
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
    skip_evaluation: bool = False,  # ✨ [추가] 품질 평가 건너뛰기
    enable_web_search: bool = False  # ✨ [추가] 웹 검색 활성화
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process question with ReAct agent (convenience function)
    
    Args:
        question: User question
        folder_id: Folder ID (document filtering)
        session_id: Session ID (history integration)
        document_ids: Specific document ID list
        attachments: Attached files content
        skip_evaluation: Skip quality evaluation for faster response
        enable_web_search: Enable web search (prioritized when checked)
    
    Yields:
        Streaming events
    """
    # ✨ [NEW] Get folder files with summaries for RAG context
    folder_files_context = ""
    if folder_id:
        try:
            from utils.learning_tools import get_folder_files_with_summaries
            folder_files_context = await get_folder_files_with_summaries(
                folder_id=folder_id,
                exclude_extensions=[".ium"]
            )
            if folder_files_context:
                print(f"[DEBUG] Loaded folder files context: {len(folder_files_context)} chars")
        except Exception as e:
            print(f"Error loading folder files context: {e}")
    
    initial_document_context = ""
    if document_ids or attachments:
        loop = asyncio.get_event_loop()
        try:
            from utils.vector_store import get_retriever
            retriever = get_retriever(
                collection_name="user_knowledge",
                k=16,
                folder_id=folder_id,
                document_ids=document_ids or None,
            )
            docs = await loop.run_in_executor(None, lambda: retriever.invoke(question))
            if document_ids and (not docs or all(d.metadata.get("document_id") not in document_ids for d in docs)):
                retriever_fb = get_retriever(
                    collection_name="user_knowledge", k=24, folder_id=folder_id, document_ids=None
                )
                raw = await loop.run_in_executor(None, lambda: retriever_fb.invoke(question))
                docs = [d for d in raw if d.metadata.get("document_id") in document_ids or d.metadata.get("source") in document_ids][:16]
            if docs:
                parts = [f"[{d.metadata.get('source', 'Document')}]\n{d.page_content}" for d in docs]
                initial_document_context = "\n\n---\n\n".join(parts)[:8000]
        except Exception as e:
            print(f"Pre-fetch document context failed: {e}")

    agent = ReactLearningAgent(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids,
        attachments=attachments,
        initial_document_context=initial_document_context or None,
        folder_files_context=folder_files_context or None,  # ✨ [NEW] Pass folder files context
        skip_evaluation=skip_evaluation,  # ✨ [추가] 품질 평가 건너뛰기 옵션 전달
        enable_web_search=enable_web_search,  # ✨ [추가] 웹 검색 활성화 옵션 전달
    )
    async for event in agent.run(question):
        yield event
