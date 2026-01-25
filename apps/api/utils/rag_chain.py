"""
RAG Chain implementation with Feynman Technique prompt
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
from utils.opik_config import track

# Feynman Tutor System Prompt
FEYNMAN_TUTOR_PROMPT = """You are an expert AI tutor named iUM, designed to explain concepts clearly and intuitively in the style of Richard Feynman.

Your teaching philosophy:
1. **Explain Simply**: Break down complex concepts into simple, understandable terms
2. **Answer Directly**: When a student asks a question, provide a comprehensive answer immediately - DO NOT ask them to explain first
3. **Use Analogies**: Relate new concepts to things the student already knows
4. **Build Step-by-Step**: Guide students through learning step by step with clear explanations
5. **Be Intuitive**: Help students develop intuition and understanding through clear, direct explanations

**Answering Rules (CRITICAL):**
**Rule 1:** First, check the provided `context` for the answer. If the `context` contains relevant information, cite the sources and explain based on the context.

**Rule 2 (CRUCIAL):** If the `context` is empty, insufficient, or does not contain the answer, **DO NOT refuse to answer.** Instead, answer the question comprehensively using your own general knowledge and training data. You are an expert tutor - use your expertise to help the student learn.

**Rule 3:** When answering from general knowledge, do not invent fake sources. Simply provide a clear, comprehensive explanation without citing sources.

**Rule 4 (IMPORTANT):** Answer the user's question DIRECTLY and IMMEDIATELY. Do NOT ask the user to explain concepts first. Do NOT use Socratic questioning. Provide comprehensive definitions, intuition, examples, and explanations right away.

**Rule 5:** Be encouraging and supportive, and provide helpful explanations whether from context or general knowledge.

**Learning Unit Generation:**
When the user asks about a complex concept (e.g., mathematical equations, scientific principles, code examples, detailed explanations, or requests a quiz), generate a structured Learning Unit alongside your conversational reply.

Format your response as follows:
1. First, provide your conversational reply (as usual).
2. Then, if applicable, add a structured Learning Unit in JSON format at the end, wrapped in <LEARNING_UNIT> tags:

<LEARNING_UNIT>
{{
  "title": "Concept Title",
  "type": "concept|math|code|summary|quiz",
  "content": "Markdown formatted explanation. For diagrams, use mermaid code blocks: ```mermaid\\ngraph TD\\n  A[Start] --> B[Process]\\n```",
  "equations": ["LaTeX equation 1", "LaTeX equation 2"],
  "diagram_description": "Optional description (deprecated - use mermaid in content instead)",
  "quiz_data": [
    {{
      "id": "q1",
      "question_text": "Question text here?",
      "options": [
        {{"id": "A", "text": "Option A text", "is_correct": true}},
        {{"id": "B", "text": "Option B text", "is_correct": false}},
        {{"id": "C", "text": "Option C text", "is_correct": false}}
      ],
      "explanation": "Explanation of why the correct answer is correct"
    }}
  ]
}}
</LEARNING_UNIT>

**Type Guidelines:**
- Use "math" type for mathematical concepts with equations
- Use "code" type for programming examples
- Use "concept" type for general explanations
- Use "summary" type for condensed overviews
- Use "quiz" type when the user explicitly asks for a quiz or practice questions

**Content Guidelines:**
- Include LaTeX equations in the "equations" array when explaining mathematical concepts
- **Diagrams (Mermaid):** When explaining processes (like Git flow, photosynthesis, system workflows, algorithms, flows, hierarchies, relationships, system architectures), output a Markdown code block with `mermaid` language syntax (e.g., ```mermaid graph TD...```) inside the `content` field. Always place Mermaid diagrams within the `content` field as code blocks, not in the message text. Ensure the Mermaid syntax is correct and the diagram clearly illustrates the concept.
  - **CRITICAL SYNTAX RULES:**
    1. Always use **double quotes** around node labels if they contain spaces or special characters (like `&`, `()`, `[]`, `-`, `/`, etc.).
       - ❌ Bad: `A[Water (H2O)]`, `B[ATP & NADPH]`, `C[Step 1/2]`
       - ✅ Good: `A["Water (H2O)"]`, `B["ATP & NADPH"]`, `C["Step 1/2"]`
    2. Keep the graph direction simple (e.g., `graph TD` for top-down or `graph LR` for left-right).
    3. Simple labels without spaces or special characters can remain unquoted (e.g., `A[Start]`, `B[End]`).
  - Common Mermaid diagram types: graph (flowchart), sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, pie
  - Example for a process flow:
    ```mermaid
    graph TD
      A["Start"] --> B["Decision Point"]
      B -->|Yes| C["Action 1"]
      B -->|No| D["Action 2"]
      C --> E["End"]
      D --> E
    ```
  - Example for a sequence diagram:
    ```mermaid
    sequenceDiagram
      participant User
      participant System
      User->>System: Request
      System->>User: Response
    ```
  - Always validate that your Mermaid syntax is correct before including it, especially ensuring all labels with special characters are properly quoted

**Quiz Guidelines (CRITICAL):**
- **When to generate quizzes:** If the user explicitly asks for a quiz, practice questions, or wants to test their understanding, generate a LearningUnit with type: "quiz"
- **Message field (IMPORTANT):** When generating a quiz, your conversational `message` should ONLY say something like "I have prepared a quiz for you in the workspace!" or "Here's a quiz to test your understanding!" Do NOT write the quiz questions in the message text. All questions must go in the `quiz_data` JSON field only.
- **Content field:** When type is "quiz", leave the content field brief (e.g., "Here is a quick quiz to test your understanding!" or "Practice questions on [topic]")
- **Quiz structure:** Populate the quiz_data field with 3-5 challenging multiple-choice questions formatted according to the QuizQuestion structure. ALL questions must be in the JSON, NOT in the message or content text.
- **Question requirements:**
  - Each question should have 3-4 options (typically labeled A, B, C, D)
  - Exactly one option per question must have "is_correct": true
  - Questions should be progressively challenging and test different aspects of the concept
  - Provide clear, educational explanations for each question that help the student understand why the correct answer is correct
- **Example quiz structure:**
  - Question 1: Basic understanding
  - Question 2: Application of concept
  - Question 3: Analysis or deeper understanding
  - Question 4-5: Advanced or synthesis questions

**General Guidelines:**
- Only generate a Learning Unit when the question warrants a structured explanation, visual diagram, or quiz
- Ensure all JSON in the LEARNING_UNIT is valid and properly escaped
- When including Mermaid diagrams, test the syntax mentally to ensure it will render correctly

Context from user's documents:
{context}

User's question: {question}

Your response (as iUM, the Feynman Tutor):"""

prompt_template = PromptTemplate(
    template=FEYNMAN_TUTOR_PROMPT,
    input_variables=["context", "question"]
)


def parse_learning_unit_from_response(response_text: str) -> tuple[str, Optional[Dict[str, Any]]]:
    """
    Parse the LLM response to extract the conversational message and optional Learning Unit JSON.
    
    Args:
        response_text: Full LLM response text
        
    Returns:
        Tuple of (conversational_message, learning_unit_dict or None)
    """
    # Look for LEARNING_UNIT tags
    pattern = r'<LEARNING_UNIT>(.*?)</LEARNING_UNIT>'
    match = re.search(pattern, response_text, re.DOTALL)
    
    if match:
        # Extract the JSON content
        json_str = match.group(1).strip()
        # Remove the learning unit section from the conversational message
        conversational_message = re.sub(pattern, '', response_text, flags=re.DOTALL).strip()
        
        try:
            learning_unit_dict = json.loads(json_str)
            return conversational_message, learning_unit_dict
        except json.JSONDecodeError:
            # If JSON parsing fails, return the full response as conversational message
            return response_text, None
    else:
        # No learning unit found, return full response as conversational message
        return response_text, None


@track(name="create_rag_chain", type="general", tags=["rag", "chain"])
def create_rag_chain(
    collection_name: str = "user_knowledge",
    model_name: str = "models/gemini-2.5-flash",
    temperature: float = 0,
    k: int = 4,
    folder_id: Optional[str] = None
):
    """
    Create a RAG chain for chat interactions.
    
    Args:
        collection_name: Name of the ChromaDB collection
        model_name: Google Gemini model to use
        temperature: Model temperature
        k: Number of documents to retrieve
        folder_id: Optional folder ID to filter documents by
        
    Returns:
        LangChain chain for RAG-based chat
    """
    # Get retriever with optional folder filter
    retriever = get_retriever(
        collection_name=collection_name,
        k=k,
        folder_id=folder_id
    )
    
    # Initialize LLM
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )
    
    # Create the chain: Retriever -> Prompt -> LLM
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


@track(name="query_rag_chain", type="llm", tags=["rag", "chat", "gemini"])
async def query_rag_chain(
    question: str,
    collection_name: str = "user_knowledge",
    model_name: str = "models/gemini-2.5-flash",
    k: int = 4,
    folder_id: Optional[str] = None
) -> dict:
    """
    Query the RAG chain with a user question.
    
    Args:
        question: User's question
        collection_name: Name of the ChromaDB collection
        model_name: Google Gemini model to use
        k: Number of documents to retrieve
        folder_id: Optional folder ID to filter documents by
        
    Returns:
        Dictionary with answer and sources
    """
    chain = create_rag_chain(
        collection_name=collection_name,
        model_name=model_name,
        k=k,
        folder_id=folder_id
    )
    
    # Get relevant documents for source attribution (with folder filter)
    retriever = get_retriever(collection_name=collection_name, k=k, folder_id=folder_id)
    # Use invoke for LangChain retrievers (LCEL)
    relevant_docs = retriever.invoke(question) if hasattr(retriever, 'invoke') else retriever.get_relevant_documents(question)
    
    # Invoke the chain
    raw_answer = chain.invoke(question)
    
    # Parse learning unit from response
    answer, learning_unit_dict = parse_learning_unit_from_response(raw_answer)
    
    # Check if answer indicates general knowledge usage
    # If the answer mentions context is missing/insufficient, we should not cite sources
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
    # Step 1: Collect all source documents with their metadata
    source_map = {}  # Map filename -> best document (first occurrence)
    
    for doc in relevant_docs:
        # Extract source filename, handling both full paths and just filenames
        raw_source = doc.metadata.get("source", "Unknown")
        
        # Filter out temporary files (check both raw path and filename)
        if not raw_source or raw_source == "Unknown":
            continue
        
        # Check if raw source path contains temp directory indicators
        if "/tmp" in raw_source or raw_source.startswith("tmp"):
            continue
        
        source_filename = os.path.basename(raw_source)
        
        # Clean up: remove any leading/trailing whitespace
        source_filename = source_filename.strip()
        
        # Filter out temporary filenames (after basename extraction)
        if source_filename.startswith("tmp"):
            continue
        
        # Skip empty or invalid filenames
        if not source_filename or source_filename == "Unknown":
            continue
        
        # Deduplicate: only keep the first occurrence of each unique filename
        if source_filename not in source_map:
            source_map[source_filename] = {
                "id": doc.metadata.get("id", ""),
                "title": source_filename,
                "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                "relevance_score": 1.0  # ChromaDB doesn't provide scores by default
            }
    
    # Step 2: Convert map to list
    sources = list(source_map.values())
    
    # Step 3: If using general knowledge or no valid sources, return empty sources list
    # This ensures we don't cite irrelevant documents when answering from general knowledge
    # Also check if we have no valid sources after filtering (indicates empty/irrelevant context)
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
    
    # Add learning unit if present
    if learning_unit_dict:
        result["learning_unit"] = learning_unit_dict
    
    return result


@track(name="generate_study_summary", type="llm", tags=["summary", "gemini"])
async def generate_study_summary(messages: list) -> dict:
    """
    Analyze conversation history to generate a concise study topic summary.
    Returns: { title: str, category: str } where category is one of ['concept', 'code', 'review', 'quiz']
    """
    if not messages or len(messages) == 0:
        return {"title": "General Study", "category": "concept"}
    
    # Extract conversation text (only user and assistant messages)
    conversation_text = "\n".join([
        f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}"
        for msg in messages
        if msg.get('role') in ['user', 'assistant']
    ])
    
    # Create a lightweight prompt for summary generation
    summary_prompt = f"""Analyze the following conversation history. Identify the main topic the user is studying (max 3 words, e.g., 'React Hooks', 'Maxwell Eq', 'Python Functions').
Also categorize it into one of: ['concept', 'code', 'review', 'quiz'].

Conversation:
{conversation_text[:2000]}  # Limit to first 2000 chars for efficiency

Return ONLY valid JSON in this exact format:
{{"title": "Topic Name", "category": "concept|code|review|quiz"}}

Do not include any other text, explanations, or markdown formatting. Only return the JSON object."""

    try:
        # Use a lightweight model for speed
        llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0.3,  # Lower temperature for more consistent summaries
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        # Generate summary
        response = await llm.ainvoke(summary_prompt)
        response_text = response.content.strip()
        
        # Parse JSON from response (handle markdown code blocks if present)
        json_match = re.search(r'\{[^}]+\}', response_text)
        if json_match:
            summary_dict = json.loads(json_match.group())
        else:
            # Try parsing the whole response
            summary_dict = json.loads(response_text)
        
        # Validate category
        valid_categories = ['concept', 'code', 'review', 'quiz']
        category = summary_dict.get('category', 'concept')
        if category not in valid_categories:
            category = 'concept'
        
        # Validate title (max 3 words)
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
        # Fallback: try to extract a simple title from first user message
        first_user_msg = next(
            (msg.get('content', '') for msg in messages if msg.get('role') == 'user'),
            'General Study'
        )
        # Extract first few words as title
        title_words = first_user_msg.split()[:3]
        title = ' '.join(title_words) if title_words else 'General Study'
        
        return {
            "title": title,
            "category": "concept"
        }

