"""
Users Router
Exposes public user metadata (name, avatar_url) for display (e.g. reel author profile)
and account deletion (admin delete user).
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from utils.supabase_client import get_user_metadata, get_user_id_from_token, get_supabase_client

router = APIRouter()


@router.post("/delete-account")
async def delete_account(authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Delete the authenticated user's account. Requires Bearer token.
    Uses Supabase Admin API to remove the user from auth.users.
    """
    if not authorization or not authorization.strip().startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    try:
        user_id = get_user_id_from_token(authorization)
        supabase = get_supabase_client()
        supabase.auth.admin.delete_user(user_id)
        return {"success": True, "message": "Account deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
