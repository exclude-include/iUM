import os
import sys
# Add apps/api to path so we can import utils
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

from dotenv import load_dotenv
# ✨ Must load env vars BEFORE importing utils.vector_store
# because vector_store.py initializes embeddings at module level
load_dotenv(dotenv_path="apps/api/.env")

from typing import List
from langchain_core.documents import Document
from utils.vector_store import add_documents_to_vector_store, get_retriever
import time

def test_supabase_vector():
    print("🚀 Testing Supabase Vector Store...")
    
    # 1. Create a dummy document
    docs = [
        Document(
            page_content="This is a test document for Supabase Vector Store integration.",
            metadata={"source": "test_script.py", "type": "test"}
        )
    ]
    
    print(f"📄 Prepared {len(docs)} document(s).")
    
    # 2. Add to Supabase
    print("running add_documents_to_vector_store...")
    try:
        start_time = time.time()
        ids = add_documents_to_vector_store(docs)
        end_time = time.time()
        
        print(f"✅ Document added successfully!")
        print(f"🆔 IDs: {ids}")
        print(f"⏱️ Time: {end_time - start_time:.2f}s")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error adding document: {e}")
        return

    # 3. Test Retrieval
    print("\n🔍 Testing Retrieval...")
    try:
        retriever = get_retriever(k=1)
        results = retriever.invoke("Supabase integration")
        
        print(f"✅ Search completed. Found {len(results)} results.")
        if results:
            print(f"📝 Content: {results[0].page_content}")
            print(f"📊 Metadata: {results[0].metadata}")
        else:
            print("⚠️ No results found.")
            
    except Exception as e:
        print(f"❌ Error during retrieval: {e}")

if __name__ == "__main__":
    test_supabase_vector()
