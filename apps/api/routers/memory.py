"""
Memory Router - API endpoints for chat session management
Phase 2: Supabase persistent storage

Provides endpoints for listing, retrieving, and managing chat sessions.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from utils.supabase_client import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== Models ====================

class SessionResponse(BaseModel):
    """Response model for a chat session."""
    id: str
    user_id: str
    folder_id: str
    summary: Optional[str] = None
    message_count: int = 0
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    """Response model for a chat message."""
    id: str
    session_id: str
    role: str
    content: str
    sources: Optional[list] = None
    created_at: str


class SessionListResponse(BaseModel):
    """Response model for listing sessions."""
    sessions: List[SessionResponse]
    total: int


class MessageListResponse(BaseModel):
    """Response model for listing messages."""
    messages: List[MessageResponse]
    total: int
    session_id: str


# ==================== Endpoints ====================

@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    user_id: str = Query(..., description="User ID to filter sessions"),
    folder_id: Optional[str] = Query(None, description="Optional folder ID to filter"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of sessions"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    List chat sessions for a user.
    
    Returns sessions sorted by last update time (most recent first).
    """
    try:
        supabase = get_supabase_client()
        
        # Build query
        query = supabase.table("chat_sessions").select(
            "*", count="exact"
        ).eq("user_id", user_id)
        
        if folder_id:
            query = query.eq("folder_id", folder_id)
        
        # Execute with ordering and pagination
        result = query.order(
            "updated_at", desc=True
        ).range(offset, offset + limit - 1).execute()
        
        sessions = [
            SessionResponse(
                id=s["id"],
                user_id=s["user_id"],
                folder_id=s["folder_id"],
                summary=s.get("summary"),
                message_count=s.get("message_count", 0),
                created_at=s["created_at"],
                updated_at=s["updated_at"]
            )
            for s in result.data
        ]
        
        return SessionListResponse(
            sessions=sessions,
            total=result.count or len(sessions)
        )
        
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """
    Get a specific chat session by ID.
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("chat_sessions").select("*").eq(
            "id", session_id
        ).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        s = result.data
        return SessionResponse(
            id=s["id"],
            user_id=s["user_id"],
            folder_id=s["folder_id"],
            summary=s.get("summary"),
            message_count=s.get("message_count", 0),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages", response_model=MessageListResponse)
async def get_session_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of messages"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    Get all messages for a specific session.
    
    Returns messages sorted by creation time (oldest first).
    """
    try:
        supabase = get_supabase_client()
        
        # Verify session exists
        session_result = supabase.table("chat_sessions").select("id").eq(
            "id", session_id
        ).single().execute()
        
        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get messages
        result = supabase.table("chat_messages").select(
            "*", count="exact"
        ).eq(
            "session_id", session_id
        ).order(
            "created_at", desc=False
        ).range(offset, offset + limit - 1).execute()
        
        messages = [
            MessageResponse(
                id=m["id"],
                session_id=m["session_id"],
                role=m["role"],
                content=m["content"],
                sources=m.get("sources"),
                created_at=m["created_at"]
            )
            for m in result.data
        ]
        
        return MessageListResponse(
            messages=messages,
            total=result.count or len(messages),
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = Query(...)):
    """
    Delete a chat session and all its messages.
    
    Requires user_id to verify ownership.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify session exists and belongs to user
        session_result = supabase.table("chat_sessions").select("id, user_id").eq(
            "id", session_id
        ).single().execute()
        
        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session_result.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this session")
        
        # Delete session (cascade will delete messages)
        supabase.table("chat_sessions").delete().eq("id", session_id).execute()
        
        return {"status": "success", "message": "Session deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/clear")
async def clear_session_messages(session_id: str, user_id: str = Query(...)):
    """
    Clear all messages from a session but keep the session itself.
    
    Useful for starting fresh in the same session context.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify session exists and belongs to user
        session_result = supabase.table("chat_sessions").select("id, user_id").eq(
            "id", session_id
        ).single().execute()
        
        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session_result.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to clear this session")
        
        # Delete all messages for this session
        supabase.table("chat_messages").delete().eq("session_id", session_id).execute()
        
        # Reset message count
        supabase.table("chat_sessions").update({
            "message_count": 0
        }).eq("id", session_id).execute()
        
        return {"status": "success", "message": "Session messages cleared"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Health Check ====================

@router.get("/health")
async def memory_health():
    """
    Check if memory/session storage is working.
    """
    try:
        supabase = get_supabase_client()
        
        # Try a simple query
        result = supabase.table("chat_sessions").select("id").limit(1).execute()
        
        return {
            "status": "healthy",
            "supabase_connected": True,
            "tables_accessible": True
        }
        
    except Exception as e:
        logger.error(f"Memory health check failed: {e}")
        return {
            "status": "unhealthy",
            "supabase_connected": False,
            "error": str(e)
        }
