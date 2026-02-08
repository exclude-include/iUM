
import sys
import os
from pathlib import Path
import asyncio
import json

# Add api directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.supabase_client import get_supabase_client

async def check_folders():
    supabase = get_supabase_client()
    
    print("Checking database directly via Supabase client...")
    
    # 1. Get all folders
    folders = supabase.table("folders").select("*").execute()
    if not folders.data:
        print("No folders found in DB.")
        return

    print(f"Found {len(folders.data)} folders.")
    
    for folder in folders.data:
        folder_id = folder['id']
        folder_name = folder['name']
        print(f"\nChecking Folder: {folder_name} ({folder_id})")
        
        try:
            # Query documents table for this folder
            # Assuming metadata stores folder_id
            response = supabase.table("documents").select("id", count="exact").contains("metadata", {"folder_id": folder_id}).execute()
            
            count = len(response.data) if response.data else 0
            # If server supports count in header/response, better. But exact count selection usually works.
            
            print(f"  - Document Chunks (Embeddings): {count}")
            
            if count == 0:
                print("  ! WARNING: No embeddings found. Folder might be empty.")
            else:
                print("  -> OK: Folder has embeddings.")
                
        except Exception as e:
            print(f"  ! Error querying documents table: {e}")

if __name__ == "__main__":
    asyncio.run(check_folders())
