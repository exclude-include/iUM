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


def get_retriever(
    collection_name: str = "documents",
    persist_directory: str = None,
    k: int = 4,
    folder_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None  # ✨ [필수] NotebookLM 기능용 인자
):
    """
    Get a retriever from the vector store with filtering.
    """
    vector_store = get_vector_store()
    
    # ✨ Supabase Filter Logic (JSONB @> operator)
    # 현재 기본 함수는 exact match만 지원합니다.
    filter_dict = {}
    
    if folder_id:
        filter_dict["folder_id"] = folder_id

    # NOTE: 기본 match_documents 함수는 array contains($in)를 지원하지 않으므로
    # 단일 document_id 필터링만 우선 지원하거나, 커스텀 쿼리가 필요함.
    # 현재는 첫 번째 ID로 필터링 (임시)
    if document_ids and len(document_ids) > 0:
        filter_dict["document_id"] = document_ids[0]
    
    search_kwargs = {"k": k}
    if filter_dict:
        search_kwargs["filter"] = filter_dict
    
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs
    )
    return retriever