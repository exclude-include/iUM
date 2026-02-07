import os
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import time

load_dotenv(dotenv_path="apps/api/.env")

def test_embedding():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ ERROR: GOOGLE_API_KEY not found")
        return

    print(f"🔑 Testing embeddings with API Key: {api_key[:10]}...")
    print("Using model: models/gemini-embedding-001")

    try:
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key
        )
        
        text = "This is a test sentence for embedding."
        print(f"Adding embedding request for: '{text}'")
        
        start_time = time.time()
        vector = embeddings.embed_query(text)
        end_time = time.time()
        
        print(f"✅ Success! Vector length: {len(vector)}")
        print(f"⏱️ Time taken: {end_time - start_time:.2f}s")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_embedding()
