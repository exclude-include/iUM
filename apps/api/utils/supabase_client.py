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
