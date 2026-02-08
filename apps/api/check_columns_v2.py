
import os
import json
from utils.supabase_client import get_supabase_client

supabase = get_supabase_client()

try:
    # Select * to see all columns
    response = supabase.table("reels").select("*").limit(1).execute()
    if response.data:
        keys = response.data[0].keys()
        print(f"Columns: {list(keys)}")
        if "folder_id" in keys:
            print("folder_id EXISTS")
        else:
            print("folder_id MISSING")
    else:
        print("Table empty or no access")
except Exception as e:
    print(f"Error: {e}")
