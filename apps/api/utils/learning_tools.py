"""
iUM Learning Tools for ReAct Agent
Learning platform-specific tool collection
"""
import os
import json
import re
import asyncio
from typing import Callable, Dict, Any, Optional, List
from langchain_google_genai import ChatGoogleGenerativeAI
from utils.supabase_client import get_supabase_client

# ✨ [추가] 전역 세마포어: LLM 호출 동시성 제한 (react_agent와 공유)
_llm_semaphore = asyncio.Semaphore(1)
_MIN_REQUEST_DELAY = 0.5


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
        attachments: Optional[List[Dict[str, Any]]] = None,
        folder_files_context: Optional[str] = None,  # ✨ 폴더 내 파일 요약 컨텍스트
        enable_web_search: bool = False  # ✨ [추가] 웹 검색 활성화 여부
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
        self.folder_files_context = folder_files_context
        self.enable_web_search = enable_web_search  # ✨ [추가]
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
        tools = {
            "search_knowledge": Tool(
                name="search_knowledge",
                description="Search for relevant content in uploaded documents",
                func=self._search_knowledge,
                params=["query"]
            ),
            "read_file_content": Tool(
                name="read_file_content",
                description="Read the full content of a specific file by its ID. Use this when you need detailed information from a file after reviewing the file summaries. Returns the complete text content of the file.",
                func=self._read_file_content,
                params=["file_id"]
            ),
            "generate_concept_cell": Tool(
                name="generate_concept_cell", 
                description="Generate a concept explanation Learning Unit for the topic",
                func=self._generate_concept_cell,
                params=["topic"]
            ),
            "create_table_cell": Tool(
                name="create_table_cell",
                description="Generate a structured table with organized information. Use this when user asks to create a table or organize information in tabular format.",
                func=self._create_table_cell,
                params=["topic", "context(optional)"]
            ),
            "create_diagram_cell": Tool(
                name="create_diagram_cell",
                description="Generate a visual diagram (flowchart, concept map, etc.) with nodes and edges. Use this when user asks for a diagram, flowchart, or visual representation.",
                func=self._create_diagram_cell,
                params=["topic", "diagram_type(optional)"]
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
            "create_flashcard_cell": Tool(
                name="create_flashcard_cell",
                description="Generate flashcards. Use 'context' to pass specific text/content.",
                func=self._create_flashcard_cell,
                params=["topic", "num_cards", "context"]
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
        
        # ✨ [추가] 웹 검색이 활성화된 경우에만 web_search 도구 추가
        if self.enable_web_search:
            tools["web_search"] = Tool(
                name="web_search",
                description="[PRIORITY] Search the internet for up-to-date information. This tool is ENABLED and should be used proactively. Use this for: 1) Current events or recent information, 2) Topics not found in uploaded documents, 3) External authoritative sources, 4) Verification of facts. Returns web search results with snippets and URLs.",
                func=self._web_search,
                params=["query"]
            )
        
        return tools
    
    def get_tools_prompt(self) -> str:
        """Return all tool descriptions in prompt format"""
        return "\n".join([tool.to_prompt_string() for tool in self.tools.values()])
    
    async def execute(self, tool_name: str, **kwargs) -> str:
        """Execute tool"""
        if tool_name not in self.tools:
            return f"죄송합니다, 알 수 없는 도구입니다: {tool_name}"
        
        tool = self.tools[tool_name]
        try:
            print(f"[DEBUG] Executing {tool_name} with kwargs: {kwargs}")
            result = await tool.func(**kwargs)
            
            # ✨ Validate result is not empty
            if not result or (isinstance(result, str) and len(result.strip()) < 10):
                print(f"[WARNING] Tool {tool_name} returned empty or very short result")
                return f"Tool {tool_name} completed but returned minimal content. The topic may need more context."
            
            return result
        except Exception as e:
            import traceback
            traceback.print_exc()
            error_msg = str(e)
            print(f"[ERROR] Tool {tool_name} failed: {error_msg}")
            
            # ✨ Return more informative error messages based on error type
            if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                return "API rate limit reached. Please try again later."
            elif "timeout" in error_msg.lower():
                return "Request timed out. Please try again."
            elif "connection" in error_msg.lower() or "network" in error_msg.lower():
                return "Network connection error. Please check your internet connection."
            else:
                # Generic but more helpful message
                return f"An error occurred while running '{tool_name}'. Please try again."
    
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
            
            # Robust retrieval call (handle different LangChain/Retriever versions)
            if hasattr(retriever, 'invoke'):
                docs = retriever.invoke(query)
            else:
                docs = retriever.get_relevant_documents(query)
            
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
    
    async def _read_file_content(self, file_id: str) -> str:
        """
        Read the full content of a file by its ID.
        Fetches from Supabase Storage and extracts text.
        """
        try:
            supabase = get_supabase_client()
            
            # 1. Get file metadata from DB
            file_res = supabase.table("files").select("*").eq("id", file_id).single().execute()
            
            if not file_res.data:
                return f"File not found with ID: {file_id}"
            
            file_data = file_res.data
            storage_path = file_data.get("storage_path")
            filename = file_data.get("name", "unknown")
            content_type = file_data.get("content_type", "")
            
            if not storage_path:
                return f"No storage path found for file: {filename}"
            
            # 2. Download file from Supabase Storage
            try:
                file_bytes = supabase.storage.from_("documents").download(storage_path)
            except Exception as e:
                return f"Failed to download file {filename}: {str(e)}"
            
            # 3. Extract text based on content type
            import tempfile
            import os
            
            # Determine file extension
            file_ext = os.path.splitext(filename)[1].lower() if filename else ""
            if not file_ext and content_type == "application/pdf":
                file_ext = ".pdf"
            elif not file_ext:
                file_ext = ".txt"
            
            # Create temp file for processing
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                tmp_file.write(file_bytes)
                tmp_file_path = tmp_file.name
            
            try:
                text_content = ""
                
                if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
                    from langchain_community.document_loaders import PyPDFLoader
                    loader = PyPDFLoader(tmp_file_path)
                    documents = loader.load()
                    text_content = "\n\n".join([doc.page_content for doc in documents])
                
                elif content_type.startswith("text/") or filename.lower().endswith(
                    (".txt", ".md", ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".csv")
                ):
                    from langchain_community.document_loaders import TextLoader
                    loader = TextLoader(tmp_file_path)
                    documents = loader.load()
                    text_content = "\n\n".join([doc.page_content for doc in documents])
                
                elif content_type.startswith("image/"):
                    return f"Image file '{filename}' - cannot extract text content. Consider describing what you see or asking about the image."
                
                else:
                    # Try to read as text
                    try:
                        text_content = file_bytes.decode("utf-8")
                    except:
                        return f"Unable to extract text from file '{filename}' (type: {content_type})"
                
                if not text_content.strip():
                    return f"File '{filename}' appears to be empty or contains no extractable text."
                
                # Truncate if too long (to avoid context overflow)
                max_length = 15000
                if len(text_content) > max_length:
                    text_content = text_content[:max_length] + f"\n\n[... Content truncated. Total length: {len(text_content)} characters]"
                
                return f"=== Content of '{filename}' ===\n\n{text_content}"
                
            finally:
                # Cleanup temp file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        except Exception as e:
            import traceback
            traceback.print_exc()
            return f"Error reading file: {str(e)}"
    
    async def _generate_concept_cell(self, topic: str = "general concept") -> str:
        """Generate concept explanation cell with optional graph data"""
        prompt = f"""Explain '{topic}' in a way that is easy for learners to understand.

Rules:
1. **Free Format**: Structure your explanation naturally. Use headings, lists, bold text, etc. Write in a clear, educational style.
2. **Math Expressions**: Include LaTeX formulas ($...$) ONLY if the topic is inherently mathematical or scientific (e.g., physics, calculus, chemistry equations). For history, humanities, social sciences, or non-quantitative topics, do NOT include any math formulas. **IMPORTANT**: When writing LaTeX inside the JSON string, escape backslashes (use `\\\\` instead of `\\`).
3. **Diagrams**: Include `graph_data` ONLY when ALL of these conditions are met:
   - The topic explicitly involves a clear sequential process, cycle, or hierarchical structure (e.g., 'Calvin Cycle', 'Software Architecture', 'Food Chain')
   - You can define at least 3 meaningful, specific nodes with clear relationships
   - Generic placeholder labels like "Key Component", "Detail 1", "Detail 2" are FORBIDDEN
   
   For these topics, do NOT generate any diagram (set graph_data to null):
   - History and historical events (e.g., Korean history, World War II)
   - Abstract concepts, theories, philosophies
   - Biographies or people
   - Literary works or art
   - Definitions or explanations of terms

Response Format (JSON):
Respond with a valid raw JSON object (do NOT wrap in markdown code blocks like ```json ... ```) containing:
- "text_content": The main explanation (markdown).
- "graph_data": null (if no diagram needed) OR a JSON object with "nodes" and "edges" where each node has a SPECIFIC, MEANINGFUL label.

Example for a topic that DOES need a diagram (water cycle):
{{
  "text_content": "# The Water Cycle\\n\\nThe water cycle describes the continuous movement of water...",
  "graph_data": {{
     "nodes": [{{"id": "1", "label": "Evaporation"}}, {{"id": "2", "label": "Condensation"}}, {{"id": "3", "label": "Precipitation"}}, {{"id": "4", "label": "Collection"}}],
     "edges": [{{"source": "1", "target": "2"}}, {{"source": "2", "target": "3"}}, {{"source": "3", "target": "4"}}, {{"source": "4", "target": "1"}}]
  }}
}}

Example for a topic that does NOT need a diagram (Korean history):
{{
  "text_content": "# 한국사의 전반적인 흐름\\n\\n한국의 역사는 고조선부터 시작하여...",
  "graph_data": null
}}
"""
        
        # ✨ Retry logic for robustness
        max_retries = 2
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                # ✨ [추가] 세마포어로 동시 LLM 호출 제한
                async with _llm_semaphore:
                    await asyncio.sleep(_MIN_REQUEST_DELAY)
                    response = await self.llm.ainvoke(prompt)
                content = response.content
                
                # ✨ Validate response is not empty
                if content and len(content.strip()) > 50:
                    return content
                else:
                    print(f"[WARNING] _generate_concept_cell got empty/short response on attempt {attempt + 1}")
                    if attempt < max_retries:
                        await asyncio.sleep(1)  # Wait before retry
                        continue
                        
            except Exception as e:
                last_error = str(e)
                print(f"[ERROR] _generate_concept_cell attempt {attempt + 1} failed: {last_error}")
                if attempt < max_retries:
                    await asyncio.sleep(1)
                    continue
        
        # ✨ Fallback: Return a basic explanation if all retries fail
        fallback_content = f"""{{
  "text_content": "# {topic}\\n\\nFailed to generate explanation for this topic. Please try again.\\n\\n**Topic**: {topic}",
  "graph_data": null
}}"""
        return fallback_content
    
    async def _create_table_cell(self, topic: str, context: str = None) -> str:
        """Generate a structured table cell with organized information"""
        context_section = f"\n\nContext to use:\n{context}" if context else ""
        
        prompt = f"""Create a well-organized table about '{topic}'.{context_section}

IMPORTANT: Return the table in markdown format that can be directly rendered.

Format your response as a markdown table with:
1. A clear title/header for the table
2. Descriptive column headers
3. Organized rows with relevant information
4. Include at least 3-5 rows of data

Example response format:
## {topic}

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

Additional notes or explanations about the table content can follow.

Now create the table:"""

        # ✨ [추가] 세마포어로 동시 LLM 호출 제한
        async with _llm_semaphore:
            await asyncio.sleep(_MIN_REQUEST_DELAY)
            response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _create_diagram_cell(self, topic: str, diagram_type: str = "flowchart") -> str:
        """Generate a diagram with nodes and edges for visual representation"""
        
        prompt = f"""Create a visual diagram about '{topic}' of type '{diagram_type}'.

You MUST return a valid JSON object with:
1. "text_content": Brief description of what the diagram represents
2. "graph_data": JSON object with "nodes" and "edges" arrays for React Flow rendering

Rules for graph_data:
- Each node must have: id (string), label (descriptive text), type (one of: "input", "default", "output")
- Each edge must have: id (string), source (node id), target (node id)
- Create meaningful, specific labels - NO generic placeholders like "Component 1"
- Include 4-8 nodes with logical connections between them

Response format (raw JSON, no code blocks):
{{
  "text_content": "This diagram shows...",
  "graph_data": {{
    "nodes": [
      {{"id": "1", "label": "Starting Point", "type": "input"}},
      {{"id": "2", "label": "Process Step", "type": "default"}},
      {{"id": "3", "label": "Final Result", "type": "output"}}
    ],
    "edges": [
      {{"id": "e1-2", "source": "1", "target": "2"}},
      {{"id": "e2-3", "source": "2", "target": "3"}}
    ]
  }}
}}

Create the diagram now:"""

        # ✨ [추가] 세마포어로 동시 LLM 호출 제한
        async with _llm_semaphore:
            await asyncio.sleep(_MIN_REQUEST_DELAY)
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

        # ✨ [추가] 세마포어로 동시 LLM 호출 제한
        async with _llm_semaphore:
            await asyncio.sleep(_MIN_REQUEST_DELAY)
            response = await self.llm.ainvoke(prompt)
        return response.content
    
    async def _create_flashcard_cell(self, topic: str, num_cards: int = 5, context: str = None) -> str:
        """Generate flashcards, optionally using provided context/text"""
        if context:
            prompt = f"""Create {num_cards} flashcards about '{topic}' based SPECIFICALLY on the following context:
            
            Context:
            {context}
            
            IMPORTANT: Return ONLY a raw JSON array. Do not wrap it in an object.
            Format:
            ```json
            [
              {{
                "front": "Term",
                "back": "Definition"
              }}
            ]
            ```"""
        else:
            prompt = f"""Create {num_cards} flashcards about '{topic}'.
            
            IMPORTANT: Return ONLY a raw JSON array. Do not wrap it in an object.
            Format:
            ```json
            [
              {{
                "front": "Term",
                "back": "Definition"
              }}
            ]
            ```"""

        # ✨ [추가] 세마포어로 동시 LLM 호출 제한
        async with _llm_semaphore:
            await asyncio.sleep(_MIN_REQUEST_DELAY)
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

        # ✨ [추가] 세마포어로 동시 LLM 호출 제한
        async with _llm_semaphore:
            await asyncio.sleep(_MIN_REQUEST_DELAY)
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
    
    async def _web_search(self, query: str) -> str:
        """
        Search the internet using DuckDuckGo for up-to-date information.
        Implements multiple fallback methods for reliability.
        """
        import asyncio
        
        # Method 1: Try duckduckgo-search library (most reliable)
        try:
            from duckduckgo_search import DDGS
            
            results = []
            loop = asyncio.get_event_loop()
            
            def sync_search():
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=5, safesearch='moderate'))
            
            search_results = await loop.run_in_executor(None, sync_search)
            
            if search_results:
                for i, result in enumerate(search_results):
                    title = result.get('title', 'No title')
                    body = result.get('body', 'No description')[:400]
                    url = result.get('href', '')
                    results.append(f"[{i+1}] **{title}**\n{body}\nSource: {url}")
                
                print(f"[WebSearch] Successfully found {len(results)} results using DDGS library")
                return "## Web Search Results\n\n" + "\n\n".join(results)
                
        except ImportError:
            print("[WebSearch] duckduckgo-search not installed, trying fallback...")
        except Exception as e:
            print(f"[WebSearch] DDGS library error: {e}, trying fallback...")
        
        # Method 2: Fallback using requests + DuckDuckGo HTML
        try:
            import requests
            from urllib.parse import quote_plus
            import re
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
            
            url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: requests.get(url, headers=headers, timeout=15)
            )
            
            if response.status_code == 200:
                html_content = response.text
                
                # Extract results using multiple patterns
                results = []
                
                # Pattern 1: result__snippet + result__a
                snippets = re.findall(r'class="result__snippet"[^>]*>([^<]+)<', html_content)
                titles = re.findall(r'class="result__a"[^>]*>([^<]+)<', html_content)
                urls = re.findall(r'class="result__url"[^>]*href="([^"]+)"', html_content)
                
                if titles and snippets:
                    for i, (title, snippet) in enumerate(zip(titles[:5], snippets[:5])):
                        url_str = urls[i] if i < len(urls) else ""
                        results.append(f"[{i+1}] **{title.strip()}**\n{snippet.strip()[:300]}\nSource: {url_str}")
                    
                    print(f"[WebSearch] Fallback found {len(results)} results")
                    return "## Web Search Results\n\n" + "\n\n".join(results)
                
                # Pattern 2: Alternative extraction for different HTML structure
                alt_results = re.findall(r'<a[^>]*class="[^"]*result[^"]*"[^>]*>([^<]+)</a>', html_content)
                if alt_results:
                    results = [f"[{i+1}] {r.strip()}" for i, r in enumerate(alt_results[:5])]
                    return "## Web Search Results\n\n" + "\n\n".join(results)
            
            print(f"[WebSearch] HTML fallback failed with status {response.status_code}")
            
        except Exception as e:
            print(f"[WebSearch] HTML fallback error: {e}")
        
        # Method 3: Final fallback - use Google's public search API (limited)
        try:
            import requests
            from urllib.parse import quote_plus
            
            # Use a simple search endpoint
            search_url = f"https://www.google.com/search?q={quote_plus(query)}&num=5"
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
            
            # This is a last resort - may not work reliably
            print("[WebSearch] All methods exhausted, returning guidance message")
            
        except Exception:
            pass
        
        # If all methods fail, return helpful message
        return f"Web search could not retrieve results for '{query}'. The search service may be temporarily unavailable. Please try again in a moment, or rephrase your query."


async def get_folder_files_with_summaries(folder_id: str, exclude_extensions: List[str] = None) -> str:
    """
    Get all files in a folder with their summaries for RAG context.
    Used to provide agent with overview of available files.
    
    Args:
        folder_id: The folder ID to query
        exclude_extensions: List of extensions to exclude (e.g., ['.ium'])
    
    Returns:
        Formatted string with file list and summaries
    """
    if not folder_id:
        return ""
    
    exclude_extensions = exclude_extensions or [".ium"]
    
    try:
        supabase = get_supabase_client()
        
        # Query files in folder
        files_res = supabase.table("files").select(
            "id, name, content_type, size, summary"
        ).eq("folder_id", folder_id).execute()
        
        if not files_res.data:
            return ""
        
        # Filter out excluded extensions
        files = []
        for f in files_res.data:
            filename = f.get("name", "")
            if any(filename.lower().endswith(ext) for ext in exclude_extensions):
                continue
            files.append(f)
        
        if not files:
            return ""
        
        # Format files context
        context_lines = ["## Available Files in Current Folder\n"]
        context_lines.append("You have access to the following files. Review their summaries and use `read_file_content` tool with the file_id to read full content when needed.\n")
        
        for f in files:
            file_id = f.get("id", "unknown")
            name = f.get("name", "Unknown")
            size = f.get("size", 0)
            summary = f.get("summary", "No summary available")
            content_type = f.get("content_type", "")
            
            # Format size
            if size > 1024 * 1024:
                size_str = f"{size / (1024 * 1024):.1f} MB"
            elif size > 1024:
                size_str = f"{size / 1024:.1f} KB"
            else:
                size_str = f"{size} bytes"
            
            context_lines.append(f"### 📄 {name}")
            context_lines.append(f"- **File ID**: `{file_id}`")
            context_lines.append(f"- **Type**: {content_type}")
            context_lines.append(f"- **Size**: {size_str}")
            context_lines.append(f"- **Summary**: {summary}")
            context_lines.append("")
        
        return "\n".join(context_lines)
        
    except Exception as e:
        print(f"Error fetching folder files: {e}")
        return ""


# Singleton instance (optional use)
def get_learning_toolkit(
    folder_id: Optional[str] = None,
    session_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
    folder_files_context: Optional[str] = None,
    enable_web_search: bool = False  # ✨ [추가] 웹 검색 활성화 여부
) -> LearningToolkit:
    """LearningToolkit instance creation helper"""
    return LearningToolkit(
        folder_id=folder_id,
        session_id=session_id,
        document_ids=document_ids,
        attachments=attachments,
        folder_files_context=folder_files_context,
        enable_web_search=enable_web_search  # ✨ [추가]
    )
