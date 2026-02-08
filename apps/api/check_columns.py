
import os
from utils.supabase_client import get_supabase_client

supabase = get_supabase_client()

try:
    # Try to select folder_id from reels
    # We limit to 1 record
    response = supabase.table("reels").select("folder_id").limit(1).execute()
    print("Column folder_id EXISTS.")
except Exception as e:
    print(f"Column folder_id missing or error: {e}")
