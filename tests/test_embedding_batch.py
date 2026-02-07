import os
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import time

load_dotenv(dotenv_path="apps/api/.env")

def test_batch_embedding():
    api_key = os.getenv("GOOGLE_API_KEY")
    print(f"🔑 Testing batch embeddings with API Key: {api_key[:10]}...")
    
    try:
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key
        )
        
        texts = [f"This is test sentence {i}" for i in range(10)]
        print(f"Sending batch request for {len(texts)} documents...")
        
        start_time = time.time()
        # This calls batch embedding
        vectors = embeddings.embed_documents(texts)
        end_time = time.time()
        
        print(f"✅ Success! Generated {len(vectors)} vectors.")
        print(f"Dimensions: {len(vectors[0])} (should be 768)")
        print(f"⏱️ Time taken: {end_time - start_time:.2f}s")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_batch_embedding()
