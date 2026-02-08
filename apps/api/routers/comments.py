"""
Comments Router
Handles comment CRUD operations for reels
"""

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from utils.supabase_client import get_supabase_client, get_user_metadata, get_user_id_from_token

router = APIRouter()


class CommentCreate(BaseModel):
    reel_id: str
    content: str


class Comment(BaseModel):
    id: str
    reel_id: str
    user_id: str
    content: str
    created_at: str
    updated_at: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None


@router.get("/{reel_id}", response_model=List[Comment])
async def get_comments(reel_id: str):
    """
    Get all comments for a specific reel
    
    Args:
        reel_id: Reel ID to fetch comments for
        
    Returns:
        List[Comment]: List of comments for the reel with user metadata
    """
    try:
        supabase = get_supabase_client()
        
        # Get comments
        result = supabase.table("comments") \
            .select("*") \
            .eq("reel_id", reel_id) \
            .order("created_at", desc=False) \
            .execute()
        
        comments = []
        for comment_data in result.data:
            # Fetch user metadata for each comment
            user_metadata = get_user_metadata(comment_data["user_id"])
            
            comments.append(Comment(
                id=comment_data["id"],
                reel_id=comment_data["reel_id"],
                user_id=comment_data["user_id"],
                content=comment_data["content"],
                created_at=comment_data["created_at"],
                updated_at=comment_data["updated_at"],
                author_name=user_metadata["name"],
                author_avatar=user_metadata["avatar_url"]
            ))
        
        return comments
        
    except Exception as e:
        print(f"Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comments: {str(e)}")


@router.post("", response_model=Comment)
async def create_comment(
    comment: CommentCreate,
    authorization: str = Header(...)
):
    """
    Create a new comment on a reel
    
    Args:
        comment: Comment data (reel_id, content)
        authorization: JWT token for authentication
        
    Returns:
        Comment: Created comment with metadata
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        # Insert comment
        comment_data = {
            "reel_id": comment.reel_id,
            "user_id": user_id,
            "content": comment.content,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = supabase.table("comments").insert(comment_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create comment")
        
        created_comment = result.data[0]
        
        # Get user metadata using helper function
        user_metadata = get_user_metadata(user_id)
        
        return Comment(
            id=created_comment["id"],
            reel_id=created_comment["reel_id"],
            user_id=created_comment["user_id"],
            content=created_comment["content"],
            created_at=created_comment["created_at"],
            updated_at=created_comment["updated_at"],
            author_name=user_metadata["name"],
            author_avatar=user_metadata["avatar_url"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        print(f"Error creating comment: {e}")
        if "42501" in err_msg or "row-level security" in err_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="RLS violation: set SUPABASE_SERVICE_KEY to the service_role (secret) key in Render, not the anon key. Supabase Dashboard > Project Settings > API > service_role.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to create comment: {err_msg}")


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: str,
    authorization: str = Header(...)
):
    """
    Delete a comment (only by owner)
    
    Args:
        comment_id: Comment ID to delete
        authorization: JWT token for authentication
        
    Returns:
        Success message
    """
    user_id = get_user_id_from_token(authorization)
    supabase = get_supabase_client()
    
    try:
        # Get comment to verify ownership
        comment_result = supabase.table("comments").select("*").eq("id", comment_id).execute()
        
        if not comment_result.data:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        comment = comment_result.data[0]
        
        # Verify ownership
        if comment["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
        
        # Delete comment
        supabase.table("comments").delete().eq("id", comment_id).execute()
        
        return {"success": True, "message": "Comment deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting comment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete comment: {str(e)}")
