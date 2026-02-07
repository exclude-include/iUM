
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
