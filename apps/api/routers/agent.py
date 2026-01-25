from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from models import ChatMessage, ChatResponse
from utils.rag_chain import query_rag_chain, generate_study_summary
import os

router = APIRouter()

# [수정 포인트 1] 모델명 하드코딩 방지 및 기본값 구체화
# Validated model name from check_models.py output
MODEL_NAME = os.getenv("LLM_MODEL", "models/gemini-2.5-flash")

class ChatRequest(BaseModel):
    message: str
    workspace_id: Optional[str] = None
    context: Optional[List[str]] = None  # Document IDs for RAG context
    conversation_id: Optional[str] = None
    collection_name: Optional[str] = "user_knowledge"  # VectorDB collection name
    folder_id: Optional[str] = None  # Folder ID to filter RAG context


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    RAG 기반 에이전트(Google Gemini)와의 채팅을 처리합니다.
    """
    if not request.message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # [수정 포인트 2] Google API Key 체크로 변경 (이미 잘 적용되어 있습니다!)
    if not os.getenv("GOOGLE_API_KEY"):
        return ChatResponse(
            message="[System] Google API Key가 설정되지 않았습니다. .env 파일에 GOOGLE_API_KEY가 있는지 확인해주세요.",
            conversation_id=request.conversation_id or "conv-1",
            sources=[],
            reasoning_chain=["API Key Missing"]
        )
    
    try:
        # RAG 체인 호출 (비동기 처리)
        # utils/rag_chain.py의 query_rag_chain 함수가 async def여야 합니다.
        result = await query_rag_chain(
            question=request.message,
            collection_name=request.collection_name or "user_knowledge",
            model_name=MODEL_NAME, 
            k=4,
            folder_id=request.folder_id
        )
        
        # 결과 반환
        return ChatResponse(
            message=result["answer"],
            conversation_id=request.conversation_id or "conv-1",
            sources=result.get("sources", []),
            reasoning_chain=result.get("reasoning_chain", []),
            confidence_score=0.9,
            learning_unit=result.get("learning_unit")  # Pass through learning unit if present
        )
        
    except Exception as e:
        # 서버 로그에 자세한 에러 출력
        print(f"Error during RAG chat (Model: {MODEL_NAME}): {str(e)}")
        
        return ChatResponse(
            message=f"죄송합니다, iUM 에이전트 처리 중 오류가 발생했습니다.\n(에러 내용: {str(e)})\n\n문서가 업로드되어 있는지, 또는 Google API 키가 올바른지 확인해 주세요.",
            conversation_id=request.conversation_id or "conv-1",
            sources=[],
            reasoning_chain=[f"Internal Error: {str(e)}"]
        )


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