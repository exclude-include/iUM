"""
RAG Chain implementation with Feynman Technique prompt
Refactored: STRICT JSON Escaping Rules to prevent broken JSON
"""
import os
import json
import re
from typing import Optional, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from utils.vector_store import get_retriever
from utils.opik_config import trace

# ✨ [프롬프트 강화] 쌍따옴표 이스케이프 규칙 추가
FEYNMAN_TUTOR_PROMPT = """You are an expert AI tutor named iUM, designed to explain concepts clearly and intuitively in the style of Richard Feynman.

**Teaching Philosophy:**
1. **Explain Simply:** Break down complex concepts into simple terms.
2. **Visualize:** Always try to visualize concepts using diagrams.
3. **Interactive:** Provide quizzes when asked.

**Answering Rules:**
1. Check `context` first. Cite sources using.
2. If context is empty, use general knowledge.

**Learning Unit Generation (CRITICAL):**
You MUST generate a structured Learning Unit JSON wrapped in <LEARNING_UNIT> tags.
Determine the User's Intent and choose ONE of the following modes:

---
**MODE A: GENERAL EXPLANATION (Default)**
Used when the user asks "What is...", "Explain...", or creates code/math content.

* **"message":** Keep it clean and engaging. Example: "I've prepared a detailed explanation in the workspace!"
* **"content":** * The FULL detailed explanation.
    * **DIAGRAMS (REQUIRED):** Include a Mermaid diagram code block.
    * **MERMAID SYNTAX:** Use double quotes for labels (e.g., A["Label"]).

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
  "content": "Markdown content here... \\n\\n```mermaid\\ngraph TD\\nA[\\"Start\\"]-->B[\\"End\\"]\\n```",
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

User's question: {question}

Your response (as iUM):"""

prompt_template = PromptTemplate(
    template=FEYNMAN_TUTOR_PROMPT,
    input_variables=["context", "question"]
)


def parse_learning_unit_from_response(response_text: str) -> tuple[str, Optional[Dict[str, Any]]]:
    """
    Parse the LLM response to extract the conversational message and optional Learning Unit JSON.
    """
    pattern = r'<LEARNING_UNIT>(.*?)</LEARNING_UNIT>'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if match:
        json_str = match.group(1).strip()
        conversational_message = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        
        try:
            # Common JSON cleanup
            json_str = match.group(1).strip()
            
            # ✨ [추가] LLM이 실수로 제어문자(줄바꿈)를 넣었을 경우를 대비해 살짝 청소
            # (단, \n 문자열은 건드리면 안 되므로 주의)
            # json_str = json_str.replace('\n', '\\n') # 이건 위험할 수 있어서 생략하고 프롬프트에 의존
            
            learning_unit_dict = json.loads(json_str)
            
            # Fallback for empty content
            if learning_unit_dict.get("type") != "quiz":
                content = learning_unit_dict.get("content", "").strip()
                if not content or len(content) < 10:
                    learning_unit_dict["content"] = conversational_message
            
            return conversational_message, learning_unit_dict
            
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            print(f"Faulty JSON: {json_str[:200]}...") # 로그 확인용
            # 파싱 실패 시, 원본 텍스트를 그대로 리턴하면 화면에 지저분하게 뜨므로
            # 태그만이라도 제거하고 리턴하는 것이 좋습니다.
            return conversational_message, None
    else:
        return response_text, None


@trace
def create_rag_chain(
    collection_name: str = "user_knowledge",
    model_name: str = "models/gemini-2.5-flash",
    temperature: float = 0,
    k: int = 4,
    folder_id: Optional[str] = None
):
    """
    Create a RAG chain for chat interactions.
    """
    retriever = get_retriever(
        collection_name=collection_name,
        k=k,
        folder_id=folder_id
    )
    
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )
    
    chain = (
        {
            "context": retriever | (lambda docs: "\n\n".join([doc.page_content for doc in docs])),
            "question": RunnablePassthrough()
        }
        | prompt_template
        | llm
        | StrOutputParser()
    )
    
    return chain


@trace
async def query_rag_chain(
    question: str,
    collection_name: str = "user_knowledge",
    model_name: str = "models/gemini-2.5-flash",
    k: int = 4,
    folder_id: Optional[str] = None
):  # -> Return type annotation removed as it yields
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

    # 3. 답변 파싱 및 후처리 (기존 로직 유지)
    answer, learning_unit_dict = parse_learning_unit_from_response(raw_answer)
    
    # ... (중략: 소스 매핑 로직은 기존과 동일) ...
    source_map = {}
    for doc in relevant_docs:
        # (기존 소스 매핑 코드 유지)
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
    
    # ... (중략: 추론 과정 기록 로직 유지) ...
    reasoning_chain = []
    if relevant_docs:
        reasoning_chain.append(f"Retrieved {len(relevant_docs)} documents")
    else:
        reasoning_chain.append("Using General Knowledge")
    reasoning_chain.append("Generated response using Gemini")

    result = {
        "message": answer, # Frontend expects 'message', not 'answer' in final response structure usually
        "conversation_id": "temp-id", # You might want to manage this
        "sources": sources,
        "reasoning_chain": reasoning_chain
    }
    
    if learning_unit_dict:
        result["learning_unit"] = learning_unit_dict
        
    # 📡 [상태 전송 4] 최종 완료 데이터 전송
    yield {"status": "complete", "data": result}


async def generate_study_summary(messages: list) -> dict:
    # (기존 코드 유지)
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