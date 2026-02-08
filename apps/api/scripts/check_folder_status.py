
import sys
import os
from pathlib import Path

# Add api directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.supabase_client import get_supabase_client
from utils.vector_store import get_vector_store
import asyncio

async def check_folders():
    supabase = get_supabase_client()
    
    # 1. Get all folders
    folders = supabase.table("folders").select("*").execute()
    if not folders.data:
        print("No folders found in DB.")
        return

    print(f"Found {len(folders.data)} folders.")
    
    # 2. Check vector store
    vector_store = get_vector_store("user_knowledge")
    try:
        collection = vector_store._collection
    except AttributeError:
        print("Vector store does not expose _collection (might be PGVector or other).")
        return

    for folder in folders.data:
        folder_id = folder['id']
        folder_name = folder['name']
        print(f"\nChecking Folder: {folder_name} ({folder_id})")
        
        # Count documents in DB for this folder
        # Assuming documents table has folder_id? Or folders_files join?
        # Let's check 'files' table or whatever links them.
        # Actually, let's just check vector store for this folder_id metadata.
        
        try:
            results = collection.get(
                where={"folder_id": folder_id},
                include=["metadatas"]
            )
            
            count = len(results['ids'])
            print(f"  - Vector Store Entries (Chunks): {count}")
            
            if count == 0:
                print("  ! WARNING: No embeddings found for this folder.")
            else:
                # Check unique source documents
                sources = set()
                for meta in results['metadatas']:
                    if meta and 'source' in meta:
                        sources.add(meta['source'])
                print(f"  - Unique Documents Embedded: {len(sources)}")
                
        except Exception as e:
            print(f"  ! Error querying vector store: {e}")

if __name__ == "__main__":
    asyncio.run(check_folders())
