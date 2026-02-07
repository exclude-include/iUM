import os
import sys

# Add app directory to path
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

from dotenv import load_dotenv
load_dotenv("apps/api/.env")

from utils.supabase_client import get_supabase_client

def check_docs():
    try:
        client = get_supabase_client()
        print("Checking documents table for folder_id...")
        
        # documents 테이블 조회 (LangChain VectorStore 사용 테이블)
        res = client.table("documents").select("id, metadata, content").limit(5).execute()
        
        if not res.data:
            print("No documents found.")
            return

        for doc in res.data:
            meta = doc.get('metadata', {})
            folder_id = meta.get('folder_id', 'Not Set')
            doc_id = meta.get('document_id', 'Not Set')
            source = meta.get('source', 'Unknown')
            print(f"- ID: {doc['id']}")
            print(f"  Folder ID: {folder_id}")
            print(f"  Doc ID: {doc_id}")
            print(f"  Source: {source}")
            print(f"  Content Preview: {doc['content'][:50]}...")
            print("-" * 30)
            
    except Exception as e:
        print(f"Error checking documents: {e}")

if __name__ == "__main__":
    check_docs()
