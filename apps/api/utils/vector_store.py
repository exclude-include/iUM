"""
VectorDB utility functions for ChromaDB integration
Updated: Fixed Embedding Model Name & Added 'document_ids' filtering
"""
import os
from typing import Optional, List, Dict, Any
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import chromadb
from chromadb.config import Settings

# Initialize Google Gemini Embeddings
# ✨ [수정] 'models/' 접두사 제거 (404 에러 해결)
embeddings = GoogleGenerativeAIEmbeddings(
    model="text-embedding-004", 
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# Text splitter configuration
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", " ", ""]
)


def get_chroma_client(persist_directory: str = "./chroma_db") -> chromadb.ClientAPI:
    """
    Initialize and return a persistent ChromaDB client.
    """
    # Create directory if it doesn't exist
    os.makedirs(persist_directory, exist_ok=True)
    
    client = chromadb.PersistentClient(
        path=persist_directory,
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )
    
    return client


def get_vector_store(
    collection_name: str = "user_knowledge",
    persist_directory: str = "./chroma_db"
) -> Chroma:
    """
    Get or create a ChromaDB vector store for user knowledge.
    """
    client = get_chroma_client(persist_directory)
    
    vector_store = Chroma(
        client=client,
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=persist_directory
    )
    
    return vector_store


def add_documents_to_vector_store(
    documents: list[Document],
    collection_name: str = "user_knowledge",
    persist_directory: str = "./chroma_db"
) -> list[str]:
    """
    Add documents to the vector store after chunking.
    """
    # Split documents into chunks
    chunks = text_splitter.split_documents(documents)
    
    # Get or create vector store
    vector_store = get_vector_store(collection_name, persist_directory)
    
    # Add chunks to vector store
    document_ids = vector_store.add_documents(chunks)
    
    return document_ids


def get_retriever(
    collection_name: str = "user_knowledge",
    persist_directory: str = "./chroma_db",
    k: int = 4,
    folder_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None  # ✨ [필수] NotebookLM 기능용 인자
):
    """
    Get a retriever from the vector store with advanced filtering.
    """
    vector_store = get_vector_store(collection_name, persist_directory)
    
    # ✨ ChromaDB 필터 구성 로직
    where_filter: Dict[str, Any] = {}
    filters_list = []

    # 1. 폴더 필터
    if folder_id:
        filters_list.append({"folder_id": folder_id})

    # 2. 파일 ID 필터 (선택된 파일만 검색)
    if document_ids and len(document_ids) > 0:
        if len(document_ids) == 1:
            # 파일이 하나일 때
            filters_list.append({"document_id": document_ids[0]})
        else:
            # 파일이 여러 개일 때 ($in 연산자 사용)
            filters_list.append({"document_id": {"$in": document_ids}})

    # 필터 결합 로직 ($and)
    if len(filters_list) > 1:
        where_filter = {"$and": filters_list}
    elif len(filters_list) == 1:
        where_filter = filters_list[0]
    else:
        where_filter = None # 필터 없음

    # 검색 설정
    search_kwargs = {"k": k}
    if where_filter:
        search_kwargs["filter"] = where_filter
    
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs
    )
    return retriever