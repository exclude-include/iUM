import os
import sys

# Add app directory to path
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

from dotenv import load_dotenv
load_dotenv("apps/api/.env")

from utils.supabase_client import get_supabase_client

def update_metadata():
    try:
        client = get_supabase_client()
        print("Fetching a document to update...")
        
        # Get one document
        res = client.table("documents").select("id, metadata").limit(1).execute()
        if not res.data:
            print("No documents found.")
            return

        doc = res.data[0]
        doc_id = doc['id']
        metadata = doc['metadata']
        
        print(f"Original Metadata: {metadata}")
        
        # Update metadata with folder_id
        TEST_FOLDER_ID = "test-folder-123"
        metadata["folder_id"] = TEST_FOLDER_ID
        
        print(f"Updating document {doc_id} with folder_id='{TEST_FOLDER_ID}'...")
        
        update_res = client.table("documents").update({"metadata": metadata}).eq("id", doc_id).execute()
        
        print(f"Update Result: {update_res.data}")
        print("✅ Document metadata updated.")
        
    except Exception as e:
        print(f"Error updating document: {e}")

if __name__ == "__main__":
    update_metadata()
