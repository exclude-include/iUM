import os
import shutil
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
import chromadb
from chromadb.config import Settings
import time

load_dotenv(dotenv_path="apps/api/.env")

def test_chroma():
    api_key = os.getenv("GOOGLE_API_KEY")
    print(f"🔑 Testing ChromaDB with API Key: {api_key[:10]}...")
    
    persist_dir = "./test_chroma_db"
    
    # Clean up previous test
    if os.path.exists(persist_dir):
        shutil.rmtree(persist_dir)
    
    try:
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key,
            task_type="retrieval_document"
        )
        
        print("Initializing Chroma client...")
        client = chromadb.PersistentClient(path=persist_dir)
        
        print("Initializing Vector Store...")
        vector_store = Chroma(
            client=client,
            collection_name="test_collection",
            embedding_function=embeddings,
            persist_directory=persist_dir
        )
        
        docs = [Document(page_content="This is a test document", metadata={"id": 1})]
        
        print("Adding document...", flush=True)
        start_time = time.time()
        try:
             vector_store.add_documents(docs)
        except Exception as add_err:
             print(f"❌ Error during add_documents: {add_err}", flush=True)
             raise add_err
        end_time = time.time()
        
        print(f"✅ Success! Document added in {end_time - start_time:.2f}s", flush=True)
        
        print("Testing retrieval...")
        results = vector_store.similarity_search("test query")
        print(f"✅ Retrieved {len(results)} results")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_chroma()
