"""
Supabase client configuration and helper functions
"""
import os
from supabase import create_client, Client
from typing import Optional


class SupabaseClient:
    """Singleton Supabase client for the application"""
    
    _instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """
        Get or create Supabase client instance
        
        Returns:
            Supabase client instance
            
        Raises:
            ValueError: If required environment variables are not set
        """
        if cls._instance is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            
            if not url or not key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_KEY environment variables must be set. "
                    "Please add them to your .env file."
                )
            
            cls._instance = create_client(url, key)
        
        return cls._instance
    
    @classmethod
    def reset_client(cls):
        """Reset the client instance (useful for testing)"""
        cls._instance = None


# Convenience function for getting the client
def get_supabase() -> Client:
    """
    Get Supabase client instance
    
    Usage:
        from utils.supabase_client import get_supabase
        
        supabase = get_supabase()
        result = supabase.table('users').select('*').execute()
    """
    return SupabaseClient.get_client()
