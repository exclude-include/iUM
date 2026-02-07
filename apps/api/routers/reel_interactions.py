"""
Reels interaction endpoints for likes and comments count
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from utils.supabase_client import get_supabase_client
from datetime import datetime, timezone

router = APIRouter()


class LikeToggleRequest(BaseModel):
    reel_id: str


def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from Supabase JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    supabase = get_supabase_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_response.user.id
    except Exception as e:
        print(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/like")
async def toggle_like(request: LikeToggleRequest, authorization: str = Header(...)):
    """
    Toggle like on a reel (insert or delete from likes table)
    
    Args:
        request: LikeToggleRequest with reel_id
        authorization: JWT token for authentication
        
    Returns:
        Updated like count and whether user has liked the reel
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        # Check if user has already liked this reel
        existing_like = supabase.table("likes") \
            .select("id") \
            .eq("reel_id", request.reel_id) \
            .eq("user_id", user_id) \
            .execute()
        
        if existing_like.data:
            # User has already liked - remove the like
            supabase.table("likes").delete().eq("id", existing_like.data[0]["id"]).execute()
            is_liked = False
            
            # Decrement reels.likes field (lazy propagation)
            reel_result = supabase.table("reels").select("likes").eq("id", request.reel_id).execute()
            if reel_result.data:
                current_likes = reel_result.data[0]["likes"] or 0
                new_likes = max(0, current_likes - 1)
                supabase.table("reels").update({"likes": new_likes}).eq("id", request.reel_id).execute()
        else:
            # User hasn't liked - add the like
            supabase.table("likes").insert({
                "reel_id": request.reel_id,
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            is_liked = True
            
            # Increment reels.likes field (lazy propagation)
            reel_result = supabase.table("reels").select("likes").eq("id", request.reel_id).execute()
            if reel_result.data:
                current_likes = reel_result.data[0]["likes"] or 0
                new_likes = current_likes + 1
                supabase.table("reels").update({"likes": new_likes}).eq("id", request.reel_id).execute()
        
        # Return the updated count from reels table (fast, lazy propagation)
        final_result = supabase.table("reels").select("likes").eq("id", request.reel_id).execute()
        total_likes = final_result.data[0]["likes"] if final_result.data else 0
        
        return {"success": True, "likes": total_likes, "is_liked": is_liked}
        

        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling like: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle like: {str(e)}")


@router.post("/increment-comment-count/{reel_id}")
async def increment_comment_count(reel_id: str):
    """
    Increment comment count for a reel
    
    Args:
        reel_id: Reel ID to increment comment count for
        
    Returns:
        Updated comment count
    """
    try:
        supabase = get_supabase_client()
        
        # Get current comment count
        result = supabase.table("reels").select("comments").eq("id", reel_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        current_comments = result.data[0]["comments"] or 0
        new_comments = current_comments + 1
        
        # Update comment count
        update_result = supabase.table("reels") \
            .update({"comments": new_comments}) \
            .eq("id", reel_id) \
            .execute()
        
        return {"success": True, "comments": new_comments}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error incrementing comment count: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to increment comment count: {str(e)}")


@router.post("/decrement-comment-count/{reel_id}")
async def decrement_comment_count(reel_id: str):
    """
    Decrement comment count for a reel
    
    Args:
        reel_id: Reel ID to decrement comment count for
        
    Returns:
        Updated comment count
    """
    try:
        supabase = get_supabase_client()
        
        # Get current comment count
        result = supabase.table("reels").select("comments").eq("id", reel_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        current_comments = result.data[0]["comments"] or 0
        new_comments = max(0, current_comments - 1)
        
        # Update comment count
        update_result = supabase.table("reels") \
            .update({"comments": new_comments}) \
            .eq("id", reel_id) \
            .execute()
        
        return {"success": True, "comments": new_comments}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error decrementing comment count: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to decrement comment count: {str(e)}")

@router.get("/user-likes")
async def get_user_likes(authorization: str = Header(...)):
    """
    Get all reels liked by the current user
    
    Args:
        authorization: JWT token for authentication
        
    Returns:
        List of reel IDs that the user has liked
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        # Get all likes for this user
        result = supabase.table("likes") \
            .select("reel_id") \
            .eq("user_id", user_id) \
            .execute()
        
        # Extract reel IDs
        liked_reel_ids = [like["reel_id"] for like in result.data] if result.data else []
        
        return {"success": True, "liked_reels": liked_reel_ids}
        
    except Exception as e:
        print(f"Error fetching user likes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user likes: {str(e)}")
