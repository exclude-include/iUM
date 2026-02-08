"""
VectorDB utility functions for Supabase Vector Store integration
Updated: Replaced ChromaDB with SupabaseVectorStore to fix local crash issues.
"""
import os
from typing import Optional, List, Dict, Any
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from utils.supabase_client import get_supabase_client

# Initialize Google Gemini Embeddings
# ✨ [수정] 검증된 임베딩 모델 사용 (check_embedding_models.py 결과)
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001", 
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    task_type="retrieval_document" # ✨ Gemini API 요구사항
)

# Text splitter configuration
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", " ", ""]
)


def get_vector_store(
    collection_name: str = "documents", # Table name in Supabase
) -> SupabaseVectorStore:
    """
    Get Supabase vector store instance.
    """
    supabase = get_supabase_client()
    
    vector_store = SupabaseVectorStore(
        client=supabase,
        embedding=embeddings,
        table_name="documents",
        query_name="match_documents"
    )
    
    return vector_store


def add_documents_to_vector_store(
    documents: list[Document],
    collection_name: str = "documents", # Unused in Supabase vs Chroma, but kept for signature
    persist_directory: str = None # Ignored
) -> list[str]:
    """
    Add documents to the vector store after chunking.
    """
    # Split documents into chunks
    chunks = text_splitter.split_documents(documents)
    
    if not chunks:
        print("Warning: No chunks created from documents")
        return []
    
    # Get vector store
    vector_store = get_vector_store()
    
    # Add chunks to vector store
    # SupabaseVectorStore returns list of IDs
    document_ids = vector_store.add_documents(chunks)
    
    return document_ids


def delete_documents_by_file_id(file_id: str) -> bool:
    """
    Permanently delete all vector store chunks for the given file (document_id).
    Returns True if delete succeeded, False on error.
    """
    try:
        supabase = get_supabase_client()
        file_id_str = str(file_id)
        # Supabase: delete rows where metadata contains document_id = file_id
        res = (
            supabase.table("documents")
            .delete()
            .contains("metadata", {"document_id": file_id_str})
            .execute()
        )
        return True
    except Exception as e:
        print(f"Vector DB delete by document_id failed: {e}")
        return False



class CustomSupabaseRetriever(BaseRetriever):
    client: Any
    embeddings: Any
    query_name: str = "match_documents"
    k: int = 4
    filter: Optional[Dict[str, Any]] = None

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        print(f"DEBUG: CustomSupabaseRetriever called with query='{query[:20]}...'")
        try:
            # 1. Embed query
            # embeddings object is defined globally in this file
            query_embedding = embeddings.embed_query(query)
            
            # 2. Prepare RPC params
            params = {
                "query_embedding": query_embedding,
                "match_threshold": 0.5, # Adjust as needed (0.0 - 1.0)
                "match_count": self.k,
                "filter": self.filter or {}
            }
            
            # 3. Call RPC directly
            # This bypasses the langchain SupabaseVectorStore implementation which causes the params error
            response = self.client.rpc(self.query_name, params).execute()
            
            # Handle response structure
            data = response.data if hasattr(response, 'data') else response
            
            documents = []
            for item in data:
                content = item.get("content", "")
                metadata = item.get("metadata", {}) or {}
                
                # Ensure useful fields are in metadata
                if "id" in item: metadata["id"] = item["id"]
                if "document_id" in item: metadata["document_id"] = item["document_id"]
                
                documents.append(Document(page_content=content, metadata=metadata))
                
            return documents
            
        except Exception as e:
            print(f"⚠️ Custom Retriever Error: {e}")
            # Try fallback without filter if it failed? No, just return empty
            return []

    async def _aget_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        # Async implementation for better performance
        # Note: embeddings.embed_query is usually sync, but we can verify
        return self._get_relevant_documents(query, run_manager=run_manager)


def get_retriever(
    collection_name: str = "documents",
    persist_directory: str = None,
    k: int = 4,
    folder_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None
):
    """
    Get a custom retriever that bypasses the LangChain SupabaseVectorStore issue.
    """
    supabase = get_supabase_client()
    
    # Supabase Filter Logic
    filter_dict = {}
    if folder_id:
        filter_dict["folder_id"] = folder_id
        
    if document_ids and len(document_ids) > 0:
        filter_dict["document_id"] = document_ids[0]
    
    return CustomSupabaseRetriever(
        client=supabase,
        embeddings=embeddings,
        k=k,
        filter=filter_dict
    )