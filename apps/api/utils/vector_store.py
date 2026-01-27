"""
VectorDB utility functions for ChromaDB integration
"""
import os
from typing import Optional
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import chromadb
from chromadb.config import Settings

# Initialize Google Gemini Embeddings
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",
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
    folder_id: Optional[str] = None
):
    """
    Get a retriever from the vector store.
    
    Args:
        collection_name: Name of the collection
        persist_directory: Directory to persist the ChromaDB database
        k: Number of documents to retrieve
        folder_id: Optional folder ID to filter documents by
        
    Returns:
        Vector store retriever
    """
    vector_store = get_vector_store(collection_name, persist_directory)
    
    # Build search kwargs with optional folder filter
    search_kwargs = {"k": k}
    if folder_id:
        search_kwargs["filter"] = {"folder_id": folder_id}
    
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs
    )
    return retriever

