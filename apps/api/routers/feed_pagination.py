"""
Feed Pagination Endpoints
Provides paginated reel feed with recommendation support
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from models.reels import Reel
from utils.supabase_client import get_supabase_client

router = APIRouter()


class FeedResponse(BaseModel):
    reels: List[Reel]
    hasMore: bool
    page: int
    pageSize: int


class ReelContextResponse(BaseModel):
    reel: Reel
    nextReels: List[Reel]


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    page_size: int = Query(10, ge=1, le=50, description="Number of reels per page"),
    last_reel_id: Optional[str] = Query(None, description="Last reel ID for cursor-based pagination"),
    user_id: Optional[str] = Query(None, description="User ID for personalization (future)"),
):
    """
    Get paginated feed of reels
    
    Args:
        page: Page number (0-indexed)
        page_size: Number of reels to return
        last_reel_id: Last reel ID for cursor-based pagination (future)
        user_id: User ID for personalization (future)
        
    Returns:
        FeedResponse: Paginated list of reels
    """
    try:
        supabase = get_supabase_client()
        
        # Calculate offset
        offset = page * page_size
        
        # Query reels with pagination
        # Order by created_at DESC for newest first
        query = supabase.table("reels").select("*", count="exact")
        
        # Apply pagination
        result = query.order("created_at", desc=True).range(
            offset, 
            offset + page_size  # Get one extra to check if there are more
        ).execute()
        
        # Check if there are more reels
        total_count = result.count if result.count is not None else 0
        has_more = (offset + page_size) < total_count
        
        # Limit to page_size (we fetched one extra)
        reels_data = result.data[:page_size] if result.data else []
        reels = [Reel(**reel_data) for reel_data in reels_data]
        
        return FeedResponse(
            reels=reels,
            hasMore=has_more,
            page=page,
            pageSize=page_size
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch feed: {str(e)}"
        )


@router.get("/reel/{reel_id}", response_model=ReelContextResponse)
async def get_reel_context(reel_id: str):
    """
    Get a specific reel with surrounding context (next reels)
    
    Used for deep linking: when user navigates directly to /soft/reels/[id],
    we need to load that reel plus the next 10 reels for smooth scrolling.
    
    Args:
        reel_id: Reel ID to fetch
        
    Returns:
        ReelContextResponse: The reel and next 10 reels
    """
    try:
        supabase = get_supabase_client()
        
        # Get the specific reel
        reel_result = supabase.table("reels").select("*").eq("id", reel_id).execute()
        
        if not reel_result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        reel = Reel(**reel_result.data[0])
        
        # Get next 10 reels (newer than this one)
        # For now, just get the next 10 most recent reels
        # Future: Use recommendation algorithm based on this reel's content
        next_reels_result = supabase.table("reels").select("*").order(
            "created_at", desc=True
        ).limit(10).execute()
        
        next_reels = [Reel(**r) for r in next_reels_result.data if r["id"] != reel_id][:10]
        
        return ReelContextResponse(
            reel=reel,
            nextReels=next_reels
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch reel context: {str(e)}"
        )
