"""
RAG Chain implementation with Feynman Technique prompt
Refactored to ensure Learning Unit content is never empty
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

# ✨ [수정됨] 프롬프트 강화: content 필드 채우기 강제
FEYNMAN_TUTOR_PROMPT = """You are an expert AI tutor named iUM, designed to explain concepts clearly and intuitively in the style of Richard Feynman.

Your teaching philosophy:
1. **Explain Simply**: Break down complex concepts into simple, understandable terms
2. **Answer Directly**: Provide comprehensive answers immediately
3. **Use Analogies**: Relate new concepts to things the student already knows
4. **Build Step-by-Step**: Guide students through learning step by step
5. **Be Intuitive**: Help students develop intuition

**Answering Rules:**
1. Check `context` first. Cite sources using.
2. If context is empty, use general knowledge without fake citations.
3. Be encouraging and supportive.

**Learning Unit Generation (CRITICAL):**
When the user asks about a concept, code, math, or requests a quiz, you MUST generate a structured Learning Unit.

Format your response as follows:
1. First, provide your conversational reply.
2. Then, wrap the Learning Unit JSON in <LEARNING_UNIT> tags.

<LEARNING_UNIT>
{{
  "title": "Clear Concept Title",
  "type": "concept|math|code|summary|quiz",
  "content": "FULL_EXPLANATION_HERE",
  "equations": ["LaTeX equation"],
  "quiz_data": []
}}
</LEARNING_UNIT>

**IMPORTANT RULES FOR 'content' FIELD:**
1. **NEVER LEAVE 'content' EMPTY.**
2. **DUPLICATE YOUR EXPLANATION:** The `content` field must contain the FULL detailed explanation, even if you already wrote it in the conversational reply. The frontend displays this field separately.
3. **INCLUDE DIAGRAMS HERE:** If a diagram is needed, write the Mermaid code block INSIDE this `content` string.
   - Example: "... explanation ... \\n\\n```mermaid\\ngraph TD\\nA[Start]-->B[End]\\n```"
   - Use double quotes for Mermaid node labels (e.g., A["Label with space"]).

**Type Guidelines:**
- "math": for equations
- "code": for programming
- "concept": for general explanations
- "quiz": ONLY when explicitly asked for a quiz. (Put questions in `quiz_data`, keep `content` brief).

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
    Includes fail-safes for empty content.
    """
    pattern = r'<LEARNING_UNIT>(.*?)</LEARNING_UNIT>'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if match:
        json_str = match.group(1).strip()
        conversational_message = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        
        try:
            # Common JSON cleanup for LLMs (trailing commas, unescaped newlines)
            # This simple cleanup handles basic markdown issues
            json_str = json_str.replace('\n', '\\n')  # Escape newlines inside the string logic if raw
            # Better approach: trust json.loads but be ready to fail
            
            # Re-fetch raw string for standard parsing (the replace above might be too aggressive)
            json_str = match.group(1).strip() 
            
            learning_unit_dict = json.loads(json_str)
            
            # ✨ [추가됨] 안전장치: 만약 AI가 content를 비워서 보냈다면?
            # 퀴즈가 아닌데 내용이 비어있으면, 채팅 메시지를 복사해서 채워넣습니다.
            if learning_unit_dict.get("type") != "quiz":
                content = learning_unit_dict.get("content", "").strip()
                if not content or len(content) < 10:
                    # 채팅 메시지를 content로 재활용 (Fallback)
                    learning_unit_dict["content"] = conversational_message
            
            return conversational_message, learning_unit_dict
            
        except json.JSONDecodeError:
            print("Failed to parse Learning Unit JSON")
            return response_text, None
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
) -> dict:
    chain = create_rag_chain(
        collection_name=collection_name,
        model_name=model_name,
        k=k,
        folder_id=folder_id
    )
    
    # Retrieve documents for sources
    retriever = get_retriever(collection_name=collection_name, k=k, folder_id=folder_id)
    relevant_docs = retriever.invoke(question) if hasattr(retriever, 'invoke') else retriever.get_relevant_documents(question)
    
    # Invoke chain
    raw_answer = chain.invoke(question)
    
    # Parse response
    answer, learning_unit_dict = parse_learning_unit_from_response(raw_answer)
    
    # Check for general knowledge usage indicators
    general_knowledge_indicators = [
        "i don't have information", "based on my general knowledge", "not in the provided context"
    ]
    using_general_knowledge = any(ind in answer.lower() for ind in general_knowledge_indicators)
    
    # Process Sources
    source_map = {}
    for doc in relevant_docs:
        raw_source = doc.metadata.get("source", "Unknown")
        if not raw_source or "tmp" in raw_source: continue
        
        source_filename = os.path.basename(raw_source).strip()
        if source_filename and source_filename != "Unknown" and source_filename not in source_map:
            source_map[source_filename] = {
                "id": doc.metadata.get("id", ""),
                "title": source_filename,
                "relevance_score": 1.0
            }
    
    sources = list(source_map.values())
    if using_general_knowledge or not sources:
        sources = []
    
    result = {
        "answer": answer,
        "sources": sources,
        "reasoning_chain": ["Retrieved docs", "Applied Feynman Prompt", "Generated Response"]
    }
    
    if learning_unit_dict:
        result["learning_unit"] = learning_unit_dict
    
    return result

# generate_study_summary 함수는 기존 코드 유지 (변경 없음)
async def generate_study_summary(messages: list) -> dict:
    # ... (기존 코드와 동일하게 유지해 주세요) ...
    # (코드 길이상 생략, 기존 파일 내용을 그대로 두시면 됩니다)
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
        # Simple parsing logic
        match = re.search(r'\{.*\}', response.content.replace('\n', ''), re.DOTALL)
        if match: return json.loads(match.group())
        return {"title": "General Study", "category": "concept"}
    except:
        return {"title": "General Study", "category": "concept"}