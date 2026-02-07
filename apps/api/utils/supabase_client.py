"""
Supabase client configuration for backend API
"""

import os
from supabase import create_client, Client
from typing import Optional

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Get or create Supabase client instance
    
    Returns:
        Client: Supabase client instance
        
    Raises:
        ValueError: If required environment variables are missing
    """
    global _supabase_client
    
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError(
                "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY"
            )
        
        _supabase_client = create_client(supabase_url, supabase_key)
    
    return _supabase_client


def get_storage_client():
    """
    Get Supabase storage client
    
    Returns:
        Storage client instance
    """
    client = get_supabase_client()
    return client.storage


def get_user_metadata(user_id: str) -> dict:
    """
    Get user metadata from Supabase auth using admin API
    
    Args:
        user_id: User ID to fetch metadata for
        
    Returns:
        dict: User metadata with keys: name, avatar_url, email
    """
    try:
        client = get_supabase_client()
        
        # Use admin API to get user by ID
        user_response = client.auth.admin.get_user_by_id(user_id)
        
        if not user_response or not user_response.user:
            return {
                "name": f"User {user_id[:8]}",
                "avatar_url": None,
                "email": None
            }
        
        user = user_response.user
        user_metadata = user.user_metadata or {}
        
        # Try to get name from various metadata fields
        name = (
            user_metadata.get("full_name") or 
            user_metadata.get("display_name") or 
            user_metadata.get("name") or
            (user.email.split("@")[0] if user.email else None) or
            f"User {user_id[:8]}"
        )
        
        avatar_url = user_metadata.get("avatar_url") or user_metadata.get("picture")
        
        return {
            "name": name,
            "avatar_url": avatar_url,
            "email": user.email
        }
        
    except Exception as e:
        print(f"Error fetching user metadata for {user_id}: {e}")
        # Return fallback data
        return {
            "name": f"User {user_id[:8]}",
            "avatar_url": None,
            "email": None
        }
