from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import logging
from models import ChatMessage, ChatResponse
from utils.rag_chain import query_rag_chain, generate_study_summary

router = APIRouter()

# Validated model name from check_models.py output
MODEL_NAME = os.getenv("LLM_MODEL", "models/gemini-2.5-flash")

class ChatRequest(BaseModel):
    message: str
    workspace_id: Optional[str] = None
    context: Optional[List[str]] = None  # Document IDs for RAG context
    conversation_id: Optional[str] = None
    collection_name: Optional[str] = "user_knowledge"  # VectorDB collection name
    folder_id: Optional[str] = None  # Folder ID to filter RAG context
    attachments: Optional[List[dict]] = None  # Uploaded files info
    use_react: bool = True  # ReAct 에이전트 사용 여부 (기본값: True)
    document_ids: Optional[List[str]] = None  # 선택된 문서 ID 목록
    skip_evaluation: bool = False  # 품질 평가 건너뛰기 (속도 향상)
    enable_web_search: bool = True  # 웹 검색 기본 활성화 (파일 부족 시 자동 검색)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    RAG 기반 에이전트(Google Gemini)와의 채팅을 처리합니다.
    (Non-streaming version)
    """
    if not request.message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    if not os.getenv("GOOGLE_API_KEY"):
        return ChatResponse(
            message="[System] Google API Key is not configured. Please check if GOOGLE_API_KEY exists in your .env file.",
            conversation_id=request.conversation_id or "conv-1",
            sources=[],
            reasoning_chain=["API Key Missing"]
        )
    
    try:
        from utils.memory_manager import get_memory_manager
        memory = get_memory_manager()
        
        user_id = "mock-user-id" 
        session_id = request.conversation_id
        
        if not session_id or session_id == "conv-1":
            session_id = await memory.create_session(
                user_id=user_id, 
                folder_id=request.folder_id
            )
        
        await memory.add_user_message(session_id, request.message)
        
        # Note: Non-streaming always uses RAG chain for now
        result_gen = query_rag_chain(
            question=request.message,
            collection_name=request.collection_name or "user_knowledge",
            model_name=MODEL_NAME, 
            k=4,
            folder_id=request.folder_id,
            session_id=session_id,
            attachments=request.attachments,
            document_ids=request.document_ids
        )
        
        result = {"answer": "", "sources": [], "reasoning_chain": [], "learning_unit": None}
        async for update in result_gen:
            if update.get("status") == "complete":
                data = update.get("data", {})
                result["answer"] = data.get("message", "")
                result["sources"] = data.get("sources", [])
                result["learning_unit"] = data.get("learning_unit")
        
        await memory.add_assistant_message(
            session_id, 
            result["answer"],
            metadata={"sources": result["sources"]}
        )
        
        return ChatResponse(
            message=result["answer"],
            conversation_id=session_id,
            sources=result["sources"],
            reasoning_chain=result["reasoning_chain"],
            confidence_score=0.9,
            learning_unit=result["learning_unit"]
        )
        
    except Exception as e:
        print(f"Error during RAG chat (Model: {MODEL_NAME}): {str(e)}")
        return ChatResponse(
            message=f"Sorry, an error occurred while processing your request with iUM agent.\n(Error: {str(e)})\n\nPlease check if documents are uploaded or if your Google API key is valid.",
            conversation_id=request.conversation_id or "conv-1",
            sources=[],
            reasoning_chain=[f"Internal Error: {str(e)}"]
        )


@router.post("/message")
async def chat_with_agent_stream(request: ChatRequest):
    """
    RAG Process Status Streaming Endpoint
    Streams events: Searching -> Analyzing -> Generating -> Final Response
    """
    if not os.getenv("GOOGLE_API_KEY"):
        async def key_error_generator():
            error_data = json.dumps({
                "status": "error",
                "message": "[System] Google API Key is missing. Please check .env file."
            })
            yield f"data: {error_data}\n\n"
        return StreamingResponse(key_error_generator(), media_type="text/event-stream")

    try:
        from utils.memory_manager import get_memory_manager
        memory = get_memory_manager()
        
        user_id = "mock-user-id"
        session_id = request.conversation_id
        
        if not session_id or session_id.startswith("conv-") or session_id == "conv-1":
            session_id = await memory.create_session(
                user_id=user_id,
                folder_id=request.folder_id
            )
            
        await memory.add_user_message(session_id, request.message)
        
    except Exception as e:
        print(f"Memory Error: {e}")
        session_id = request.conversation_id or "temp-session"

    async def event_generator():
        full_answer = ""
        final_sources = []
        
        try:
            if request.use_react:
                from utils.react_agent import query_with_react_agent
                
                async for update in query_with_react_agent(
                    question=request.message,
                    folder_id=request.folder_id,
                    session_id=session_id,
                    document_ids=request.document_ids,
                    attachments=request.attachments,
                    skip_evaluation=request.skip_evaluation,
                    enable_web_search=request.enable_web_search
                ):
                    if update.get("status") == "complete":
                        data = update.get("data", {})
                        data["conversation_id"] = session_id
                        full_answer = data.get("message", "")
                        final_sources = data.get("sources", [])
                        update["data"] = data
                    
                    yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
            else:
                async for update in query_rag_chain(
                    question=request.message,
                    collection_name=request.collection_name or "user_knowledge",
                    model_name=MODEL_NAME,
                    k=4,
                    folder_id=request.folder_id,
                    session_id=session_id,
                    document_ids=request.document_ids,
                    attachments=request.attachments
                ):
                    if update.get("status") == "complete":
                        data = update.get("data", {})
                        data["conversation_id"] = session_id 
                        full_answer = data.get("message", "")
                        final_sources = data.get("sources", [])
                        update["data"] = data
                    
                    yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            logging.error(f"Streaming Error: {str(e)}")
            try:
                import traceback
                traceback.print_exc()
                with open("error_agent.log", "a", encoding="utf-8") as f:
                    f.write(f"[ERROR] Streaming Error: {str(e)}\n")
            except:
                pass
                
            error_data = json.dumps({
                "status": "error", 
                "message": f"Server Error: {str(e)}"
            }, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
            
        finally:
            if full_answer:
                try:
                    await memory.add_assistant_message(
                        session_id,
                        full_answer,
                        metadata={"sources": final_sources}
                    )
                except Exception as e:
                    print(f"Failed to save assistant message: {e}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/chat/{conversation_id}/history", response_model=List[ChatMessage])
async def get_conversation_history(conversation_id: str):
    """대화 기록 가져오기 (Mock Data)"""
    return [
        ChatMessage(
            id="msg-1",
            role="assistant",
            content="Hello! I'm the iUM AI agent here to help with your learning. How can I assist you today?",
            timestamp="2024-01-20T10:00:00Z"
        )
    ]


class StudySummaryRequest(BaseModel):
    messages: List[dict]


class StudySummaryResponse(BaseModel):
    title: str
    category: str


@router.post("/chat/summary", response_model=StudySummaryResponse)
async def generate_chat_summary(request: StudySummaryRequest):
    """
    Generate study topic summary from conversation history.
    """
    if not request.messages or len(request.messages) == 0:
        return StudySummaryResponse(
            title="General Study",
            category="concept"
        )
    
    try:
        summary = await generate_study_summary(request.messages)
        return StudySummaryResponse(
            title=summary["title"],
            category=summary["category"]
        )
    except Exception as e:
        print(f"Error generating study summary: {str(e)}")
        return StudySummaryResponse(
            title="General Study",
            category="concept"
        )