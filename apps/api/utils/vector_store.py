"""
VectorDB utility functions for ChromaDB integration
Updated: Added support for 'document_ids' filtering (NotebookLM style) and refined embedding configuration.
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
# ✨ [수정] 모델명을 'models/text-embedding-004'로 명확히 지정
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
    
    Args:
        persist_directory: Directory to persist the ChromaDB database
        
    Returns:
        ChromaDB client instance
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
    
    Args:
        collection_name: Name of the collection to use
        persist_directory: Directory to persist the ChromaDB database
        
    Returns:
        Chroma vector store instance
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
    
    Args:
        documents: List of LangChain Document objects
        collection_name: Name of the collection
        persist_directory: Directory to persist the ChromaDB database
        
    Returns:
        List of document IDs added to the vector store
    """
    # Split documents into chunks
    chunks = text_splitter.split_documents(documents)
    
    # Get or create vector store
    vector_store = get_vector_store(collection_name, persist_directory)
    
    # Add chunks to vector store
    # Note: ChromaDB persists automatically when persist_directory is set
    document_ids = vector_store.add_documents(chunks)
    
    return document_ids


def get_retriever(
    collection_name: str = "user_knowledge",
    persist_directory: str = "./chroma_db",
    k: int = 4,
    folder_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None  # ✨ [추가] 중요: document_ids 인자 추가
):
    """
    Get a retriever from the vector store with advanced filtering.
    
    Args:
        collection_name: Name of the collection
        persist_directory: Directory to persist the ChromaDB database
        k: Number of documents to retrieve
        folder_id: Optional folder ID to filter documents by
        document_ids: Optional list of document IDs to restrict search (NotebookLM style)
        
    Returns:
        Vector store retriever
    """
    vector_store = get_vector_store(collection_name, persist_directory)
    
    # ✨ [수정] ChromaDB 필터 구성 로직 강화
    # $and, $in 연산자를 사용하여 폴더와 선택된 파일을 동시에 필터링
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

    # 필터 결합 로직
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