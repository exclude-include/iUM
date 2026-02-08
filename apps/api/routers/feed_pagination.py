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
    active_folder_ids: Optional[str] = Query(None, description="Comma-separated active folder IDs for filtering"),
    similarity_threshold: float = Query(0.3, ge=0.0, le=1.0, description="Similarity threshold for quiz reels"),
):
    """
    Get paginated feed of reels with folder-aware filtering
    
    Filtering logic:
    - No folders active: Return only non-quiz reels
    - Folders active: Return quiz reels (similarity >= threshold) + all non-quiz reels
    - Results are randomized
    
    Args:
        page: Page number (0-indexed)
        page_size: Number of reels to return
        last_reel_id: Last reel ID for cursor-based pagination (future)
        user_id: User ID for personalization (future)
        active_folder_ids: Comma-separated folder IDs (e.g., "folder-1,folder-2")
        similarity_threshold: Minimum similarity score for quiz reels (default 0.7)
        
    Returns:
        FeedResponse: Paginated list of reels
    """
    try:
        from utils.similarity_service import calculate_folder_centroid, cosine_similarity
        import random
        
        supabase = get_supabase_client()
        
        # Parse folder IDs
        folder_id_list = []
        if active_folder_ids:
            folder_id_list = [fid.strip() for fid in active_folder_ids.split(",") if fid.strip()]
        
        # Get all reels (we'll filter in Python for simplicity)
        # In production, you might want to use SQL functions for better performance
        all_reels_result = supabase.table("reels").select("*").execute()
        
        if not all_reels_result.data:
            return FeedResponse(
                reels=[],
                hasMore=False,
                page=page,
                pageSize=page_size
            )
        
        candidate_reels = []
        
        # Case 1: No folders active - only non-quiz reels
        if not folder_id_list:
            candidate_reels = [
                reel for reel in all_reels_result.data
                if reel.get("quiz") is None
            ]
        
        # Case 2: Folders active - filter quiz reels by similarity
        else:
            # Calculate folder centroid
            centroid = calculate_folder_centroid(folder_id_list)
            
            if centroid is None:
                # No documents in folders, treat as no folders
                candidate_reels = [
                    reel for reel in all_reels_result.data
                    if reel.get("quiz") is None
                ]
            else:
                for reel in all_reels_result.data:
                    # Explicit folder match (Priority)
                    if reel.get("folder_id") and str(reel.get("folder_id")) in folder_id_list:
                        candidate_reels.append(reel)
                        continue

                    # Non-quiz reels: always include
                    if reel.get("quiz") is None:
                        candidate_reels.append(reel)
                    
                    # Quiz reels: check similarity
                    elif reel.get("quiz_embedding") is not None:
                        quiz_emb = reel["quiz_embedding"]
                        
                        if isinstance(quiz_emb, str):
                            import json
                            try:
                                quiz_emb = json.loads(quiz_emb)
                            except:
                                continue

                        similarity = cosine_similarity(centroid, quiz_emb)
                        
                        if similarity >= similarity_threshold:
                            reel["similarity"] = similarity  # Inject score for debugging
                            candidate_reels.append(reel)
        
        # Randomize order
        random.shuffle(candidate_reels)
        
        # Apply pagination
        offset = page * page_size
        total_count = len(candidate_reels)
        has_more = (offset + page_size) < total_count
        
        # Get page of reels
        reels_data = candidate_reels[offset:offset + page_size]
        reels = [Reel(**reel_data) for reel_data in reels_data]
        
        return FeedResponse(
            reels=reels,
            hasMore=has_more,
            page=page,
            pageSize=page_size
        )
        
    except Exception as e:
        # Check if it's a 416 Range Not Satisfiable error from Supabase/PostgREST
        # This happens when requesting a page beyond the total number of items
        error_str = str(e)
        if "416" in error_str or "Range Not Satisfiable" in error_str:
            return FeedResponse(
                reels=[],
                hasMore=False,
                page=page,
                pageSize=page_size
            )
            
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
