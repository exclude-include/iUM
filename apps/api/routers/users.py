"""
Users Router
Exposes public user metadata (name, avatar_url) for display (e.g. reel author profile)
"""

from fastapi import APIRouter, HTTPException

from utils.supabase_client import get_user_metadata

router = APIRouter()


@router.get("/{user_id}/metadata")
async def get_user_metadata_endpoint(user_id: str):
    """
    Get public metadata for a user (name, avatar_url).
    Used when displaying reel author profile when author_avatar is not stored on the reel.
    """
    try:
        meta = get_user_metadata(user_id)
        return {
            "name": meta.get("name"),
            "avatar_url": meta.get("avatar_url"),
            "email": meta.get("email"),  # optional, can be omitted for privacy
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user metadata: {str(e)}")
