"""
RAG Chain implementation with Feynman Technique prompt
Refactored: Strict JSON Schema enforcement for Quizzes & Clean Chat
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

# ✨ [프롬프트 강화] 퀴즈 JSON 구조를 틀리지 않도록 예시와 경고를 대폭 추가했습니다.
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

* **"message" (Conversational Reply):**
    * Keep it **clean, engaging, and summary-like**.
    * **DO NOT** include large code blocks or Mermaid code here.
    * Example: "That's a great question! A BJT is essentially... (brief summary). I've prepared a detailed explanation with a diagram in the workspace!"

* **"content" (Learning Unit Body):**
    * This is where the **FULL, DETAILED explanation** goes.
    * **DIAGRAMS (REQUIRED):** You MUST include a Mermaid diagram code block here to visualize the concept.
    * **MERMAID SYNTAX RULE:** You MUST use double quotes for ALL node labels (e.g., A["Label"]).

* **"quiz_data":** Leave empty [].

---
**MODE B: QUIZ REQUEST**
Used ONLY when the user asks for a "quiz", "test", "practice questions".

* **"type":** "quiz"
* **"message":** "I've prepared a quiz to test your understanding!" (Keep it short).
* **"content":** "## Quiz Time!\\nTest your knowledge below."
* **"quiz_data":** Generate 3-5 questions.
    * **CRITICAL JSON RULES FOR QUIZ:**
        1. Use key `"question_text"`, NOT `"question"`.
        2. `options` MUST be a list of OBJECTS, NOT strings.
        3. Each option MUST have `"id"`, `"text"`, `"is_correct"`.

    * **CORRECT QUIZ EXAMPLE:**
      ```json
      {
        "id": "q1",
        "question_text": "What is CLI?",
        "options": [
          {"id": "A", "text": "Command Line Interface", "is_correct": true},
          {"id": "B", "text": "Computer Line", "is_correct": false}
        ],
        "explanation": "CLI stands for..."
      }
      ```
---

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
    Includes fail-safes for empty content.
    """
    pattern = r'<LEARNING_UNIT>(.*?)</LEARNING_UNIT>'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if match:
        json_str = match.group(1).strip()
        conversational_message = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        
        try:
            # Common JSON cleanup
            json_str = match.group(1).strip()
            learning_unit_dict = json.loads(json_str)
            
            # ✨ [안전장치] 퀴즈가 아닌데 내용이 비어있으면 채팅 메시지 복사
            if learning_unit_dict.get("type") != "quiz":
                content = learning_unit_dict.get("content", "").strip()
                if not content or len(content) < 10:
                    learning_unit_dict["content"] = conversational_message
            
            return conversational_message, learning_unit_dict
            
        except json.JSONDecodeError:
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
) -> dict:
    """
    Query the RAG chain with a user question.
    """
    chain = create_rag_chain(
        collection_name=collection_name,
        model_name=model_name,
        k=k,
        folder_id=folder_id
    )
    
    # Get relevant documents for source attribution
    retriever = get_retriever(collection_name=collection_name, k=k, folder_id=folder_id)
    relevant_docs = retriever.invoke(question) if hasattr(retriever, 'invoke') else retriever.get_relevant_documents(question)
    
    # Invoke the chain
    raw_answer = chain.invoke(question)
    
    # Parse learning unit from response
    answer, learning_unit_dict = parse_learning_unit_from_response(raw_answer)
    
    # Check if answer indicates general knowledge usage
    general_knowledge_indicators = [
        "i don't have information",
        "i don't have enough information",
        "not in the provided context",
        "not in the context",
        "context doesn't contain",
        "context is empty",
        "no information in",
        "based on my general knowledge",
        "using my knowledge",
        "from my training",
        "general knowledge"
    ]
    answer_lower = answer.lower()
    using_general_knowledge = any(indicator in answer_lower for indicator in general_knowledge_indicators)
    
    # Format and clean sources
    source_map = {}
    
    for doc in relevant_docs:
        raw_source = doc.metadata.get("source", "Unknown")
        
        if not raw_source or raw_source == "Unknown": continue
        if "/tmp" in raw_source or raw_source.startswith("tmp"): continue
        
        source_filename = os.path.basename(raw_source).strip()
        
        if source_filename.startswith("tmp"): continue
        if not source_filename or source_filename == "Unknown": continue
        
        if source_filename not in source_map:
            source_map[source_filename] = {
                "id": doc.metadata.get("id", ""),
                "title": source_filename,
                "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                "relevance_score": 1.0
            }
    
    sources = list(source_map.values())
    
    if using_general_knowledge or not sources or len(relevant_docs) == 0:
        sources = []
    
    # Build reasoning chain
    reasoning_chain = []
    if len(relevant_docs) > 0:
        reasoning_chain.append("Retrieved relevant documents from VectorDB")
    else:
        reasoning_chain.append("No documents found in VectorDB - using general knowledge")
    
    reasoning_chain.append("Applied Feynman Technique prompt")
    
    if using_general_knowledge or not sources:
        reasoning_chain.append("Generated response using general knowledge (no context available)")
    else:
        reasoning_chain.append("Generated response using Gemini with RAG context")
    
    result = {
        "answer": answer,
        "sources": sources,
        "reasoning_chain": reasoning_chain
    }
    
    if learning_unit_dict:
        result["learning_unit"] = learning_unit_dict
    
    return result


async def generate_study_summary(messages: list) -> dict:
    """
    Analyze conversation history to generate a concise study topic summary.
    """
    if not messages or len(messages) == 0:
        return {"title": "General Study", "category": "concept"}
    
    conversation_text = "\n".join([
        f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}"
        for msg in messages
        if msg.get('role') in ['user', 'assistant']
    ])
    
    summary_prompt = f"""Analyze the following conversation history. Identify the main topic the user is studying (max 3 words).
Also categorize it into one of: ['concept', 'code', 'review', 'quiz'].

Conversation:
{conversation_text[:2000]}

Return ONLY valid JSON in this exact format:
{{"title": "Topic Name", "category": "concept|code|review|quiz"}}

Do not include any other text, explanations, or markdown formatting. Only return the JSON object."""

    try:
        llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0.3,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        response = await llm.ainvoke(summary_prompt)
        response_text = response.content.strip()
        
        json_match = re.search(r'\{[^}]+\}', response_text)
        if json_match:
            summary_dict = json.loads(json_match.group())
        else:
            summary_dict = json.loads(response_text)
        
        valid_categories = ['concept', 'code', 'review', 'quiz']
        category = summary_dict.get('category', 'concept')
        if category not in valid_categories:
            category = 'concept'
        
        title = summary_dict.get('title', 'General Study')
        title_words = title.split()
        if len(title_words) > 3:
            title = ' '.join(title_words[:3])
        
        return {
            "title": title,
            "category": category
        }
        
    except Exception as e:
        print(f"Error generating study summary: {str(e)}")
        first_user_msg = next(
            (msg.get('content', '') for msg in messages if msg.get('role') == 'user'),
            'General Study'
        )
        title_words = first_user_msg.split()[:3]
        title = ' '.join(title_words) if title_words else 'General Study'
        
        return {
            "title": title,
            "category": "concept"
        }