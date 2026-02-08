"""
iUM Learning Tools for ReAct Agent
Learning platform-specific tool collection
"""
import os
import json
import re
from typing import Callable, Dict, Any, Optional, List
from langchain_google_genai import ChatGoogleGenerativeAI


class Tool:
    """Tool definition class"""
    def __init__(self, name: str, description: str, func: Callable, params: List[str] = None):
        self.name = name
        self.description = description
        self.func = func
        self.params = params or []

    def to_prompt_string(self) -> str:
        """Generate tool description string for prompt"""
        params_str = ", ".join(self.params) if self.params else "none"
        return f"- {self.name}: {self.description} (params: {params_str})"


class LearningToolkit:
    """iUM learning platform-specific tool collection"""
    
    def __init__(
        self, 
        llm: Optional[ChatGoogleGenerativeAI] = None,
        folder_id: Optional[str] = None, 
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ):
        self.llm = llm or ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.folder_id = folder_id
        self.session_id = session_id
        self.document_ids = document_ids
        self.attachments = attachments or []
        self.tools = self._init_tools()

    # ... (skipping _init_tools and other methods) ...

    async def _create_summary_cell(self, topic: str = "document") -> str:
        """Summarize uploaded document content"""
        doc_content = ""
        source_names = []
        
        # 1. Check attachments first
        if self.attachments:
            for att in self.attachments:
                # Assuming attachment has 'content' or 'text' field from frontend parsing
                # If not, we might need to handle file_id if it was processed by backend
                content = att.get("content") or att.get("text") or ""
                if content:
                    doc_content += f"\n\n--- Attachment: {att.get('name', 'Unknown File')} ---\n{content}"
                    source_names.append(att.get("name", "Attached File"))
        
        # 2. If no sufficient content from attachments, search in vector store
        if len(doc_content) < 100:
            try:
                from utils.vector_store import get_retriever
                
                retriever = get_retriever(
                    collection_name="user_knowledge", 
                    k=5, 
                    folder_id=self.folder_id,
                    document_ids=self.document_ids
                )
                docs = retriever.invoke(topic)
                
                if docs:
                    doc_content += "\n\n--- Retrieved Documents ---\n"
                    doc_content += "\n\n".join([doc.page_content for doc in docs])
                    source_names.extend(list(set([doc.metadata.get("source", "Unknown") for doc in docs])))
            except Exception as e:
                pass # Ignore retrieval errors if we have attachments or just fail gracefully
            
        if not doc_content:
             return "No document content found to summarize. Please upload a document first."

        prompt = f"""Based on the following document content, create a comprehensive summary.

Document Content:
{doc_content[:4000]}

Please write the summary in the following format:
## Summary: {topic}

### Key Points
- Point 1
- Point 2
- Point 3

### Main Concepts
Brief explanation of the main concepts covered.

### Important Details
Any critical details or data mentioned.

Write your response in markdown format."""

        response = await self.llm.ainvoke(prompt)
        
        # Append source info
        if source_names:
            unique_sources = list(set(source_names))
            sources_note = f"\n\n---\n*Sources: {', '.join(unique_sources)}*"
            return response.content + sources_note
        
        return response.content
    
    def _init_tools(self) -> Dict[str, Tool]:
        return {
            "search_knowledge": Tool(
                name="search_knowledge",
                description="Search for relevant content in uploaded documents",
                func=self._search_knowledge,
                params=["query"]
            ),
            "generate_concept_cell": Tool(
                name="generate_concept_cell", 
                description="Generate a concept explanation Learning Unit for the topic",
                func=self._generate_concept_cell,
                params=["topic"]
            ),
            "create_summary_cell": Tool(
                name="create_summary_cell",
                description="Summarize the uploaded document content. Use this when user asks to summarize a file or document.",
                func=self._create_summary_cell,
                params=["topic(optional)"]
            ),
            "create_quiz_cell": Tool(
                name="create_quiz_cell",
                description="Generate quiz questions for the topic",
                func=self._create_quiz_cell,
                params=["topic", "num_questions(default=3)"]
            ),
            "check_prerequisites": Tool(
                name="check_prerequisites",
                description="Analyze prerequisite knowledge needed to learn the topic",
                func=self._check_prerequisites,
                params=["topic"]
            ),
            "get_learning_history": Tool(
                name="get_learning_history",
                description="Retrieve user's recent learning history",
                func=self._get_learning_history,
                params=[]
            ),
            "suggest_next_topic": Tool(
                name="suggest_next_topic",
                description="Recommend next learning topics based on current progress",
                func=self._suggest_next_topic,
                params=["current_topic"]
            ),
        }
    
    def get_tools_prompt(self) -> str:
        """Return all tool descriptions in prompt format"""
        return "\n".join([tool.to_prompt_string() for tool in self.tools.values()])
    
    async def execute(self, tool_name: str, **kwargs) -> str:
        """Execute tool"""
        if tool_name not in self.tools:
            return f"[Error] Unknown tool: {tool_name}"
        
        tool = self.tools[tool_name]
        try:
            result = await tool.func(**kwargs)
            return result
        except Exception as e:
            return f"[Error] Tool execution failed: {str(e)}"
    
    # ========== Tool Implementations ==========
    
    async def _search_knowledge(self, query: str) -> str:
        """Search relevant content in documents (using existing RAG retriever)"""
        try:
            from utils.vector_store import get_retriever
            
            retriever = get_retriever(
                collection_name="user_knowledge", 
                k=3, 
                folder_id=self.folder_id,
                document_ids=self.document_ids
            )
            docs = retriever.invoke(query)
            
            if not docs:
                return "No relevant documents found."
            
            results = []
            for i, doc in enumerate(docs):
                source = doc.metadata.get("source", "Unknown")
                content = doc.page_content[:300]
                results.append(f"[{i+1}] ({source}): {content}...")
            
            return "\n\n".join(results)
        except Exception as e:
            return f"Search failed: {str(e)}"
    
    async def _generate_concept_cell(self, topic: str) -> str:
        """Generate concept explanation cell"""
        prompt = f"""Explain '{topic}' in a way that is easy for learners to understand.

Please write in the following format:
1. Core Definition (1-2 sentences)
2. Key Features (3 points)
3. Real-world Example (1)
4. Mermaid Diagram (graph TD format, keep it simple)

Write your response in markdown format."""

        response = await self.llm.ainvoke(prompt)
        return response.content
    

    
    async def _create_quiz_cell(self, topic: str, num_questions: int = 3) -> str:
        """Generate quiz cell"""
        prompt = f"""Create {num_questions} multiple-choice quiz questions about '{topic}'.

Please respond in the following JSON format:
```json
[
  {{
    "id": "1",
    "question_text": "Question content",
    "options": [
      {{"id": "A", "text": "Option A", "is_correct": false}},
      {{"id": "B", "text": "Option B", "is_correct": true}},
      {{"id": "C", "text": "Option C", "is_correct": false}},
      {{"id": "D", "text": "Option D", "is_correct": false}}
    ],
    "explanation": "Explanation for the correct answer"
  }}
]
```"""

        response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _check_prerequisites(self, topic: str) -> str:
        """Analyze prerequisite knowledge"""
        prompt = f"""Analyze the prerequisite knowledge needed to effectively learn '{topic}'.

Please respond in the following format:
1. **Essential Prerequisites** (must know)
   - Concept 1: Brief explanation
   - Concept 2: Brief explanation

2. **Recommended Prerequisites** (helpful to know)
   - Concept 1: Brief explanation

3. **Suggested Learning Path**
   Prerequisites → {topic} learning roadmap"""

        response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _get_learning_history(self) -> str:
        """Retrieve learning history (using Memory Manager)"""
        if not self.session_id:
            return "Session information unavailable. Cannot retrieve learning history."
        
        try:
            from utils.memory_manager import get_memory_manager
            memory = get_memory_manager()
            context = await memory.get_context(self.session_id)
            
            if not context:
                return "No previous learning history found. Start your learning journey!"
            
            return f"Recent conversation history:\n{context}"
        except Exception as e:
            return f"Failed to retrieve learning history: {str(e)}"
    
    async def _suggest_next_topic(self, current_topic: str) -> str:
        """Suggest next learning topics"""
        # Include learning history if available
        history = ""
        if self.session_id:
            try:
                from utils.memory_manager import get_memory_manager
                memory = get_memory_manager()
                history = await memory.get_context(self.session_id)
            except:
                pass
        
        history_context = f"\n\nUser's recent learning history:\n{history}" if history else ""
        
        prompt = f"""Recommend topics to learn after completing '{current_topic}'.{history_context}

Please respond in the following format:
1. **Recommended Topic 1**: 
   - Topic name
   - Reason for recommendation (1 sentence)
   - Difficulty: Easy/Medium/Hard

2. **Recommended Topic 2**:
   - Topic name
   - Reason for recommendation (1 sentence)
   - Difficulty: Easy/Medium/Hard

3. **Learning Tips**: Key points when transitioning from {current_topic} to the next level"""

        response = await self.llm.ainvoke(prompt)
        return response.content


# Singleton instance (optional use)
def get_learning_toolkit(
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> LearningToolkit:
    """LearningToolkit instance creation helper"""
    return LearningToolkit(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids,
        attachments=attachments
    )
