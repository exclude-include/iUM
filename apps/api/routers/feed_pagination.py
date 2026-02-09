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
        from utils.similarity_service import calculate_folder_centroid
        import random
        
        supabase = get_supabase_client()
        
        # Parse folder IDs
        folder_id_list = []
        if active_folder_ids:
            folder_id_list = [fid.strip() for fid in active_folder_ids.split(",") if fid.strip()]
        
        # Determine target counts for this page
        # Target: 70% relevant (similarity > threshold), 30% random
        target_relevant = int(page_size * 0.7)
        target_random = page_size - target_relevant
        
        relevant_reels = []
        
        # 1. Fetch Relevant Reels (if folders active)
        if folder_id_list:
            centroid = calculate_folder_centroid(folder_id_list)
            
            if centroid:
                # Use RPC for efficient similarity search
                try:
                    rpc_params = {
                        "query_embedding": centroid,
                        "match_count": page_size * 2, # Fetch more to have pool for randomization/pagination
                        "similarity_threshold": similarity_threshold
                    }
                    
                    # Call Supabase RPC
                    response = supabase.rpc("match_reels_by_embedding", rpc_params).execute()
                    
                    if response.data:
                        # Convert to Reel objects
                        # Note: RPC returns columns that match Reel model but we need to map/validate
                        flattened_reels = []
                        for r_data in response.data:
                            # Map RPC result specific fields if needed
                            # similiarity is returned by RPC, we can keep it
                            r_obj = Reel(**r_data)
                            flattened_reels.append(r_obj)
                            
                        relevant_reels = flattened_reels
                except Exception as rpc_error:
                    print(f"RPC Error: {rpc_error}")
                    # Fallback or just receive empty relevant
                    pass
        
        # 2. Fetch Random/Discovery Reels
        # logic: fetch reels that are NOT in relevant_reels (to avoid dupes)
        # For simplicity and performance, we'll just fetch recent reels and filter in memory for now
        # Ideal: use an RPC for "random reels excluding IDs" but let's stick to simple query
        
        needed_random = page_size # Get enough to fill the page
        
        # Fetch non-quiz reels or just random reels
        # We prefer reels WITHOUT quiz for "discovery" or just any reel
        # Let's fetch a mix of non-quiz reels to ensure variety
        random_response = supabase.table("reels").select("*").is_("quiz", "null").order("created_at", desc=True).limit(20).execute()
        random_reels = [Reel(**r) for r in random_response.data] if random_response.data else []
        
        # 3. Compose the Page
        final_feed = []
        
        # Add up to target_relevant from relevant pool
        # To support pagination of relevant reels, we would need a more complex cursor
        # For now, we shuffle the relevant pool and pick
        random.shuffle(relevant_reels)
        
        # We might have already seen some if we are on page > 0, but stateless random feed is acceptable for "Reels"
        # usually. However, standard pagination expects stability.
        # Given the "randomly selected with probability" requirement, strict pagination is hard.
        # We will just return a fresh slice.
        
        final_feed.extend(relevant_reels[:target_relevant])
        
        # Fill the rest with random reels
        remaining_slots = page_size - len(final_feed)
        random.shuffle(random_reels)
        final_feed.extend(random_reels[:remaining_slots])
        
        # If we still have space (e.g. no random reels found), try filling with more relevant
        if len(final_feed) < page_size and len(relevant_reels) > target_relevant:
            extra_needed = page_size - len(final_feed)
            final_feed.extend(relevant_reels[target_relevant:target_relevant+extra_needed])

        # Shuffle the final page so user doesn't see "all relevant then all random"
        random.shuffle(final_feed)
        
        # Pagination flags
        # In a random feed, "hasMore" is usually always true until empty
        has_more = True 
        
        return FeedResponse(
            reels=final_feed,
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
