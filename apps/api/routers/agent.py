

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import logging
from models import ChatMessage
# query_rag_chain과 generate_study_summary를 가져옵니다.
from utils.rag_chain import query_rag_chain, generate_study_summary

router = APIRouter()

# Validated model name from check_models.py output
MODEL_NAME = os.getenv("LLM_MODEL", "models/gemini-2.5-flash")

class ChatRequest(BaseModel):
    message: str
    workspace_id: Optional[str] = None
    context: Optional[List[str]] = None
    conversation_id: Optional[str] = None
    collection_name: Optional[str] = "user_knowledge"
    folder_id: Optional[str] = None
    attachments: Optional[List[dict]] = None # ✨ [추가]

# ✨ [핵심 수정] 일반 JSON 반환 대신 StreamingResponse 사용
# 프론트엔드 api.ts에서 "/api/agent/message"로 요청하므로 경로를 "/message"로 변경했습니다.
@router.post("/message")
async def chat_with_agent_stream(request: ChatRequest):
    """
    RAG Process Status Streaming Endpoint
    Streams events: Searching -> Analyzing -> Generating -> Final Response
    """
    print(f"DEBUG: Received chat request: message='{request.message[:20]}...'")
    
    # Google API Key 체크
    if not os.getenv("GOOGLE_API_KEY"):
        # 스트림 에러 형식으로 반환
        async def key_error_generator():
            error_data = json.dumps({
                "status": "error",
                "message": "[System] Google API Key is missing. Please check .env file."
            })
            yield f"data: {error_data}\n\n"
        return StreamingResponse(key_error_generator(), media_type="text/event-stream")

    # [Refactored] 모든 로직을 제너레이터 내부로 이동하여 즉시 응답 시작 보장
    async def event_generator():
        print("DEBUG: Event generator started", flush=True)
        
        try:
            # 1. 즉시 연결 확인 메시지 전송
            yield f"data: {json.dumps({'status': 'progress', 'message': 'Initializing connection...'}, ensure_ascii=False)}\n\n"
            
            # 2. 메모리 초기화 및 세션 관리 (제너레이터 내부에서 수행)
            from utils.memory_manager import get_memory_manager
            memory = get_memory_manager()
            
            user_id = "mock-user-id" # TODO: Auth
            session_id = request.conversation_id
            
            if not session_id or session_id.startswith("conv-"):
                session_id = await memory.create_session(
                    user_id=user_id,
                    folder_id=request.folder_id
                )
                
            await memory.add_user_message(session_id, request.message)
            
            # 3. RAG 체인 실행
            full_answer = ""
            final_sources = []
            
            async for update in query_rag_chain(
                question=request.message,
                collection_name=request.collection_name or "user_knowledge",
                model_name=MODEL_NAME,
                k=4,
                folder_id=request.folder_id,
                session_id=session_id,
                attachments=request.attachments
            ):
                if update.get("status") == "complete":
                    data = update.get("data", {})
                    data["conversation_id"] = session_id 
                    full_answer = data.get("message", "")
                    final_sources = data.get("sources", [])
                    update["data"] = data
                
                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                
            # 4. 완료 후 저장
            if full_answer:
                await memory.add_assistant_message(
                    session_id,
                    full_answer,
                    metadata={"sources": final_sources}
                )

        except Exception as e:
            logging.error(f"Streaming Error: {str(e)}")
            error_data = json.dumps({
                "status": "error", 
                "message": f"Server Error: {str(e)}"
            }, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# --- 아래는 기존 Helper 함수들 (유지) ---

@router.get("/chat/{conversation_id}/history", response_model=List[ChatMessage])
async def get_conversation_history(conversation_id: str):
    """대화 기록 가져오기 (Mock Data)"""
    return [
        ChatMessage(
            id="msg-1",
            role="assistant",
            content="안녕하세요! 저는 당신의 학습을 돕는 iUM AI 에이전트입니다. 무엇을 도와드릴까요?",
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
class StudySummaryRequest(BaseModel):
    messages: List[dict]  # List of ChatMessage-like dicts


class StudySummaryResponse(BaseModel):
    title: str
    category: str  # 'concept' | 'code' | 'review' | 'quiz'


@router.post("/chat/summary", response_model=StudySummaryResponse)
async def generate_chat_summary(request: StudySummaryRequest):
    """
    Analyze conversation history to generate a concise study topic summary.
    Used for auto-generating timeline events.
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
        # Fallback response
        return StudySummaryResponse(
            title="General Study",
            category="concept"
        )