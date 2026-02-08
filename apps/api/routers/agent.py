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
    attachments: Optional[List[dict]] = None  # ✨ [추가] Uploaded files info


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
            message="[System] Google API Key is not configured. Please check if GOOGLE_API_KEY exists in your .env file.",
            conversation_id=request.conversation_id or "conv-1",
            sources=[],
            reasoning_chain=["API Key Missing"]
        )
    
    try:
        from utils.memory_manager import get_memory_manager
        memory = get_memory_manager()
        
        # 1. 세션 관리 (없으면 생성)
        # TODO: 실제 인증된 사용자 ID 사용 필요 (현재는 임시 ID)
        user_id = "mock-user-id" 
        session_id = request.conversation_id
        
        if not session_id or session_id == "conv-1":
            # 새 세션 생성
            session_id = await memory.create_session(
                user_id=user_id, 
                folder_id=request.folder_id
            )
        
        # 2. 사용자 메시지 저장
        await memory.add_user_message(session_id, request.message)
        
        # 3. RAG 체인 호출 (비동기 처리)
        # utils/rag_chain.py의 query_rag_chain 함수가 async def여야 합니다.
        result = await query_rag_chain(
            question=request.message,
            collection_name=request.collection_name or "user_knowledge",
            model_name=MODEL_NAME, 
            k=4,
            folder_id=request.folder_id,
            session_id=session_id,  # ✨ 세션 ID 전달 (컨텍스트 조회용)
            attachments=request.attachments  # ✨ [추가] 첨부파일 전달
        )
        
        # 4. AI 응답 저장
        await memory.add_assistant_message(
            session_id, 
            result["answer"],
            metadata={"sources": result.get("sources", [])}
        )
        
        # 결과 반환
        return ChatResponse(
            message=result["answer"],
            conversation_id=session_id, # 생성된/유지된 세션 ID 반환
            sources=result.get("sources", []),
            reasoning_chain=result.get("reasoning_chain", []),
            confidence_score=0.9,
            learning_unit=result.get("learning_unit")  # Pass through learning unit if present
        )
        
    except Exception as e:
        # 서버 로그에 자세한 에러 출력
        print(f"Error during RAG chat (Model: {MODEL_NAME}): {str(e)}")
        
        return ChatResponse(
            message=f"Sorry, an error occurred while processing your request with iUM agent.\n(Error: {str(e)})\n\nPlease check if documents are uploaded or if your Google API key is valid.",
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
            content="Hello! I'm the iUM AI agent here to help with your learning. How can I assist you today?",
            timestamp="2024-01-20T10:00:00Z"
        )
    ]

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
    use_react: bool = True  # ✨ [추가] ReAct 에이전트 사용 여부 (기본값: True)
    document_ids: Optional[List[str]] = None  # ✨ [추가] 선택된 문서 ID 목록

# ✨ [핵심 수정] 일반 JSON 반환 대신 StreamingResponse 사용
# 프론트엔드 api.ts에서 "/api/agent/message"로 요청하므로 경로를 "/message"로 변경했습니다.
@router.post("/message")
async def chat_with_agent_stream(request: ChatRequest):
    """
    RAG Process Status Streaming Endpoint
    Streams events: Searching -> Analyzing -> Generating -> Final Response
    
    use_react=True (기본값): ReAct 에이전트 사용 (다단계 추론)
    use_react=False: 기존 RAG 체인 사용 (단순 Q&A)
    """
    
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

    # [Memory Integration]
    try:
        from utils.memory_manager import get_memory_manager
        memory = get_memory_manager()
        
        # 1. 세션 관리
        user_id = "mock-user-id" # TODO: Auth
        session_id = request.conversation_id
        
        if not session_id or session_id.startswith("conv-"): # 임시 ID인 경우
            session_id = await memory.create_session(
                user_id=user_id,
                folder_id=request.folder_id
            )
            
        # 2. 사용자 메시지 저장
        await memory.add_user_message(session_id, request.message)
        
    except Exception as e:
        print(f"Memory Error: {e}")
        session_id = request.conversation_id or "temp-session"

    async def event_generator():
        full_answer = ""
        final_sources = []
        
        try:
            # ✨ [ReAct 모드 분기] use_react 파라미터에 따라 에이전트 선택
            if request.use_react:
                # ReAct 에이전트 사용 (다단계 추론)
                from utils.react_agent import query_with_react_agent
                
                async for update in query_with_react_agent(
                    question=request.message,
                    folder_id=request.folder_id,
                    session_id=session_id,
                    document_ids=request.document_ids,
                    attachments=request.attachments
                ):
                    # 데이터 처리 및 응답 수정
                    if update.get("status") == "complete":
                        data = update.get("data", {})
                        data["conversation_id"] = session_id
                        full_answer = data.get("message", "")
                        final_sources = data.get("sources", [])
                        update["data"] = data
                    
                    # 데이터를 SSE 포맷(data: {...}\n\n)으로 변환하여 전송
                    yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
            else:
                # 기존 RAG 체인 사용 (단순 Q&A)
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
                    # 데이터 처리 및 응답 수정
                    if update.get("status") == "complete":
                        data = update.get("data", {})
                        data["conversation_id"] = session_id 
                        full_answer = data.get("message", "")
                        final_sources = data.get("sources", [])
                        update["data"] = data
                    
                    # 데이터를 SSE 포맷(data: {...}\n\n)으로 변환하여 전송
                    yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            logging.error(f"Streaming Error: {str(e)}")
            try:
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
            # 3. AI 응답 저장 (스트리밍 완료 후)
            if full_answer:
                try:
                    await memory.add_assistant_message(
                        session_id,
                        full_answer,
                        metadata={"sources": final_sources}
                    )
                except Exception as e:
                    print(f"Failed to save assistant message: {e}")

    # SSE(Server-Sent Events) 프로토콜 사용
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# --- 아래는 기존 Helper 함수들 (유지) ---

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