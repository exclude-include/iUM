"""
RAG Chain implementation with Feynman Technique prompt
Refactored: STRICT JSON Escaping & SAFE MERMAID Rules
"""
import os
import json
import re
from typing import Optional, Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage
from utils.vector_store import get_retriever
from utils.opik_config import trace
from utils.supabase_client import get_supabase_client
import base64

# ✨ [프롬프트 강화] Mermaid 문법 제한 추가 (No 'note for', No 'linkStyle')
FEYNMAN_TUTOR_PROMPT = """You are an expert AI tutor named iUM, designed to explain concepts clearly and intuitively in the style of Richard Feynman.

**Teaching Philosophy:**
1. **Explain Simply:** Break down complex concepts into simple terms.
2. **Visualize:** Always try to visualize concepts using diagrams.
3. **Interactive:** Provide quizzes when asked.

**Answering Rules:**
1. Check `Conversation History` and `Context` first.
2. If the user asks about previous conversation (e.g., "what did I say?"), you MUST use the `Conversation History` to answer.
3. If context is empty, use general knowledge.

**Learning Unit Generation (CRITICAL):**
You MUST generate a structured Learning Unit JSON wrapped in <LEARNING_UNIT> tags.
Determine the User's Intent and choose ONE of the following modes:

---
**MODE A: GENERAL EXPLANATION (Default)**
Used when the user asks "What is...", "Explain...", or creates code/math content.

* **"message":** Keep it clean and engaging. Example: "I've prepared a detailed explanation in the workspace!"
* **"content":** The FULL detailed explanation.
    * **DIAGRAMS (REQUIRED):** Include a Reactflow JSON data structure.
    * **REACTFLOW RULES (STRICT):** 
        1. Provide strictly valid JSON in `graph_data`.
        2. `nodes`: List of objects { "id": "1", "label": "Start", "type": "input"|"default"|"output" }.
        3. `edges`: List of objects { "id": "e1-2", "source": "1", "target": "2", "label": "connection" }.
        4. Keep labels short and clear.
    * **MATH/LATEX FORMATTING (CRITICAL):**
        1. **INLINE MATH** (use `$...$`): For simple, short variables or expressions mentioned within text.
           * Example: "For any $n$ greater than 2..." or "when $n=2$..."
           * ⚠️ **Keep inline math ON THE SAME LINE as surrounding text.** Do NOT put `$n$` on its own line.
        2. **BLOCK MATH** (use `$$...$$`): ONLY for key formulas, theorems, or conclusions that deserve emphasis.
           * Example: "The famous equation is:\\n$$a^n + b^n = c^n$$\\nThis has no solutions..."
           * Block math should be on its own line, separated by newlines.
        3. **RULE OF THUMB:** If it's just a variable name or simple term like $x$, $n$, $n=2$, $E=mc^2$ — use inline.
           Only use block for the "star" equations that are central to the explanation.

* **"quiz_data":** Leave empty [].

---
**MODE B: QUIZ REQUEST**
Used ONLY when the user asks for a "quiz".

* **"type":** "quiz"
* **"message":** "I've prepared a quiz!"
* **"content":** "## Quiz Time!\\nTest your knowledge below."
* **"quiz_data":** Generate 3-5 questions (use "question_text", and options list of objects).

---
**🚨 EXTREMELY IMPORTANT JSON RULES 🚨**
1. **ESCAPE DOUBLE QUOTES:** If your content contains a double quote (`"`), you **MUST** escape it with a backslash (`\"`).
   * ❌ WRONG: `"content": "He said "Hello""`
   * ✅ RIGHT: `"content": "He said \"Hello\""`
   * This is frequent in explanations (e.g., metaphors, code). **CHECK THIS TWICE.**

2. **NO CONTROL CHARACTERS:** Do not put real line breaks inside the string. Use `\n` for newlines.

3. **VALID JSON:** The output inside <LEARNING_UNIT> tags must be parseable by standard `json.loads()`.

**JSON Structure:**
<LEARNING_UNIT>
{{
  "title": "Topic Title",
  "type": "concept|math|code|quiz",
  "title": "Topic Title",
  "type": "concept|math|code|quiz",
  "content": "Markdown content here...",
  "graph_data": {
     "nodes": [{"id": "1", "label": "Node A", "type": "input"}, {"id": "2", "label": "Node B", "type": "default"}],
     "edges": [{"id": "e1-2", "source": "1", "target": "2"}]
  },
  "equations": [],
  "quiz_data": [
    {{
      "id": "1",
      "question_text": "Question?",
      "options": [
        {{"id": "A", "text": "Option A", "is_correct": true}},
        {{"id": "B", "text": "Option B", "is_correct": false}}
      ],
      "explanation": "Explanation here."
    }}
  ]
}}
</LEARNING_UNIT>

Context:
{context}

Conversation History:
{history}

User's question: {question}

Your response (as iUM):"""

prompt_template = PromptTemplate(
    template=FEYNMAN_TUTOR_PROMPT,
    input_variables=["context", "question", "history"]
)


def parse_learning_unit_from_response(response_text: str) -> tuple[str, Optional[Dict[str, Any]]]:
    """
    Parse the LLM response to extract the conversational message and optional Learning Unit JSON.
    Handles broken closing tags and markdown code blocks.
    """
    json_str = ""
    conversational_message = response_text

    # 1. Try exact tag match
    pattern = r'<LEARNING_UNIT>(.*?)</LEARNING_UNIT>'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if match:
        json_str = match.group(1).strip()
        conversational_message = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
    else:
        # 2. Fallback: Tag typo or missing closing tag
        # Look for start tag and find the last valid JSON brace
        start_marker = "<LEARNING_UNIT>"
        if start_marker in response_text:
            start_idx = response_text.find(start_marker)
            content_start = start_idx + len(start_marker)
            possible_content = response_text[content_start:]
            
            # Find the last '}' to guess where JSON ends
            last_brace = possible_content.rfind('}')
            if last_brace != -1:
                json_str = possible_content[:last_brace+1].strip()
                conversational_message = response_text[:start_idx].strip()

    if json_str:
        try:
            # Common JSON cleanup
            # Remove markdown code blocks
            json_str = re.sub(r'^```(json)?\s*', '', json_str.strip(), flags=re.IGNORECASE).strip()
            json_str = re.sub(r'\s*```$', '', json_str).strip()
            
            learning_unit_dict = json.loads(json_str)
            
            # Fallback for empty content
            if learning_unit_dict.get("type") != "quiz":
                content = learning_unit_dict.get("content", "").strip()
                if not content or len(content) < 10:
                    learning_unit_dict["content"] = conversational_message
            
            return conversational_message, learning_unit_dict
            
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            # Even if parsing fails, we prefer the separated conversational message behavior
            # But since we can't show the unit, we return the full text or just the message
            return conversational_message, None

    return response_text, None


@trace
async def query_rag_chain(
    question: str,
    collection_name: str = "user_knowledge",
    model_name: str = "models/gemini-2.5-flash",
    k: int = 4,
    folder_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None, # ✨ [추가] 인자 추가
    session_id: Optional[str] = None, # ✨ [추가] 세션 ID
    attachments: Optional[List[dict]] = None # ✨ [추가] 첨부파일
):
    """
    Query the RAG chain with status streaming.
    Supports selective context (document_ids) and conversation history.
    """
    
    # 📡 [상태 전송 1]
    search_msg = "Searching knowledge base... 🔍"
    if document_ids:
        search_msg = f"Searching in {len(document_ids)} selected files... 🔍"
    yield {"status": "progress", "step": "searching", "message": search_msg}

    # 1.5. 히스토리 로드 (비동기)
    history_context = ""
    if session_id:
        try:
            from utils.memory_manager import get_memory_manager
            memory = get_memory_manager()
            # Working Memory 조회 (최근 대화)
            history_context = await memory.get_context(session_id)
            
            if history_context:
                yield {"status": "progress", "step": "memory", "message": "Loading conversation history... 🧠"}
        except Exception as e:
            print(f"Failed to load history: {e}")
            history_context = ""
    
    # 1. 문서 검색 시도 (선택/첨부 파일이 있으면 더 많은 청크 검색)
    relevant_docs = []
    search_k = k * 3 if document_ids else k
    try:
        retriever = get_retriever(
            collection_name=collection_name,
            k=search_k,
            folder_id=folder_id,
            document_ids=document_ids
        )
        
        if hasattr(retriever, 'invoke'):
            docs = retriever.invoke(question)
        else:
            docs = retriever.get_relevant_documents(question)
            
        # ✨ 사용자가 파일을 선택했을 때는 선택한 파일만 사용 (다른 문서로 폴백하지 않음)
        if document_ids:
            relevant_docs = [
                d for d in docs
                if d.metadata.get("document_id") in document_ids or d.metadata.get("source") in document_ids
            ]
        else:
            relevant_docs = docs
            
    except Exception as e:
        print(f"⚠️ Vector Store Retrieval Failed: {e}")
        relevant_docs = []

    # ... (이하 로직은 기존과 동일: 문맥 분석 -> LLM 호출 -> 파싱 -> 반환)
    # 📡 [상태 전송 2]
    doc_count = len(relevant_docs)
    yield {"status": "progress", "step": "analyzing", "message": f"Found {doc_count} relevant segments. Analyzing... 🧠"}

    try:
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        context_text = "\n\n".join([doc.page_content for doc in relevant_docs]) if relevant_docs else ""
        
        # ✨ 히스토리 주입 (PromptTemplate 충돌 방지를 위해 중괄호 이스케이프)
        safe_history = history_context.replace("{", "{{").replace("}", "}}")
        
        final_prompt = prompt_template.format(
            context=context_text, 
            question=question,
            history=safe_history
        )
        
        # 📡 [상태 전송 3]
        yield {"status": "progress", "step": "generating", "message": "Formulating response... ✍️"}
        
        # ✨ [멀티모달 처리] 첨부파일이 있는 경우
        if attachments and any(att.get("type") == "image" for att in attachments):
            supabase = get_supabase_client()
            content_parts = [{"type": "text", "text": final_prompt}]
            
            for att in attachments:
                if att.get("type") == "image" and att.get("storage_path"):
                    try:
                        # Supabase Storage에서 이미지 다운로드
                        print(f"Downloading image from storage: {att['storage_path']}")
                        file_bytes = supabase.storage.from_("documents").download(att['storage_path'])
                        
                        # Base64 인코딩
                        b64_data = base64.b64encode(file_bytes).decode("utf-8")
                        
                        # LangChain HumanMessage for Vision
                        # (Mime type은 일단 jpeg로 가정하거나 확장자 확인 필요. Gemini는 mime type에 관대함)
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}
                        })
                    except Exception as e:
                        print(f"Failed to process image attachment: {e}")
                        # 에러 발생 시 텍스트로 알림 추가
                        content_parts[0]["text"] += f"\n\n[System Error] Failed to load attached image: {att.get('name')}"

            response_msg = await llm.ainvoke([HumanMessage(content=content_parts)])
        else:
            # 기존 텍스트 전용 모드
            response_msg = await llm.ainvoke(final_prompt)
            
        raw_answer = response_msg.content
        
    except Exception as e:
        yield { "status": "error", "data": { "answer": f"Error: {str(e)}", "sources": [], "reasoning_chain": ["Error"] } }
        return

    # 3. 답변 파싱 (parse_learning_unit_from_response 호출 등 기존 코드 그대로 유지)
    answer, learning_unit_dict = parse_learning_unit_from_response(raw_answer)
    
    # ... (소스 매핑 로직 유지) ...
    source_map = {}
    for doc in relevant_docs:
        raw_source = doc.metadata.get("source", "Unknown")
        # (기존 소스 처리 코드 복사/유지)
        if not raw_source or "tmp" in raw_source: continue
        source_filename = os.path.basename(raw_source).strip()
        if source_filename not in source_map:
            source_map[source_filename] = {
                "id": doc.metadata.get("id", ""),
                "title": source_filename,
                "content": doc.page_content[:200] + "...",
                "relevance_score": 1.0
            }
    sources = list(source_map.values())
    
    reasoning_chain = ["Using selected documents" if document_ids else "Using folder context"]
    reasoning_chain.append("Generated response using Gemini")

    result = {
        "message": answer,
        "conversation_id": "temp-id",
        "sources": sources,
        "reasoning_chain": reasoning_chain
    }
    
    if learning_unit_dict:
        result["learning_unit"] = learning_unit_dict
        
    yield {"status": "complete", "data": result}

    """
    Query the RAG chain with status streaming.
    Yields status updates and finally the result.
    """
    
    # 📡 [상태 전송 1] 검색 시작
    yield {"status": "progress", "step": "searching", "message": "Searching knowledge base... 🔍"}
    
    # 1. 문서 검색 시도
    relevant_docs = []
    try:
        retriever = get_retriever(collection_name=collection_name, k=k, folder_id=folder_id)
        if hasattr(retriever, 'invoke'):
            relevant_docs = retriever.invoke(question)
        else:
            relevant_docs = retriever.get_relevant_documents(question)
    except Exception as e:
        print(f"⚠️ Vector Store Retrieval Failed: {e}")
        relevant_docs = []

    # 📡 [상태 전송 2] 검색 완료 및 문맥 분석 시작
    doc_count = len(relevant_docs)
    yield {"status": "progress", "step": "analyzing", "message": f"Found {doc_count} documents. Analyzing context... 🧠"}

    # 2. RAG 체인 실행
    try:
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        context_text = "\n\n".join([doc.page_content for doc in relevant_docs]) if relevant_docs else ""
        final_prompt = prompt_template.format(context=context_text, question=question)
        
        # 📡 [상태 전송 3] 답변 생성 시작
        yield {"status": "progress", "step": "generating", "message": "Formulating response... ✍️"}
        
        # LLM 답변 생성
        response_msg = await llm.ainvoke(final_prompt) # 비동기 호출로 변경
        raw_answer = response_msg.content
        
    except Exception as e:
        yield {
            "status": "error",
            "data": {
                "answer": f"Error: {str(e)}",
                "sources": [],
                "reasoning_chain": ["Error occurred"]
            }
        }
        return

    # 3. 답변 파싱 및 후처리
    answer, learning_unit_dict = parse_learning_unit_from_response(raw_answer)
    
    source_map = {}
    for doc in relevant_docs:
        raw_source = doc.metadata.get("source", "Unknown")
        if not raw_source or "tmp" in raw_source: continue
        source_filename = os.path.basename(raw_source).strip()
        if not source_filename or source_filename == "Unknown" or source_filename.startswith("tmp"): continue
        if source_filename not in source_map:
            source_map[source_filename] = {
                "id": doc.metadata.get("id", ""),
                "title": source_filename,
                "content": doc.page_content[:200] + "...",
                "relevance_score": 1.0
            }
    sources = list(source_map.values())
    
    reasoning_chain = []
    if relevant_docs:
        reasoning_chain.append(f"Retrieved {len(relevant_docs)} documents")
    else:
        reasoning_chain.append("Using General Knowledge")
    reasoning_chain.append("Generated response using Gemini")

    result = {
        "message": answer, 
        "conversation_id": "temp-id", 
        "sources": sources,
        "reasoning_chain": reasoning_chain
    }
    
    if learning_unit_dict:
        result["learning_unit"] = learning_unit_dict
        
    # 📡 [상태 전송 4] 최종 완료 데이터 전송
    yield {"status": "complete", "data": result}


async def generate_study_summary(messages: list) -> dict:
    if not messages or len(messages) == 0:
        return {"title": "General Study", "category": "concept"}
    
    conversation_text = "\n".join([
        f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}"
        for msg in messages
        if msg.get('role') in ['user', 'assistant']
    ])
    
    summary_prompt = f"""Analyze the following conversation history. Identify the main topic (max 3 words).
Also categorize into: ['concept', 'code', 'review', 'quiz'].
Conversation: {conversation_text[:2000]}
Return JSON: {{"title": "Topic", "category": "concept"}}"""

    try:
        llm = ChatGoogleGenerativeAI(model="models/gemini-2.5-flash", temperature=0.3, google_api_key=os.getenv("GOOGLE_API_KEY"))
        response = await llm.ainvoke(summary_prompt)
        match = re.search(r'\{[^}]+\}', response.content.strip())
        if match: return json.loads(match.group())
        return {"title": "General Study", "category": "concept"}
    except:
        return {"title": "General Study", "category": "concept"}