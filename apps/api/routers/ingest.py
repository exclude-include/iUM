"""
Document ingestion endpoint for uploading and processing PDFs/Text files
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from utils.vector_store import add_documents_to_vector_store
from utils.opik_config import trace
import os
import tempfile

router = APIRouter()


@trace
async def process_pdf_file(file_path: str, original_filename: str, folder_id: Optional[str] = None) -> List[Document]:
    """
    Process a PDF file and extract text as LangChain Documents.
    
    Args:
        file_path: Path to the temporary PDF file
        original_filename: Original filename from the upload
        folder_id: Optional folder ID to tag documents with
        
    Returns:
        List of LangChain Document objects
    """
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    
    # Add metadata with original filename (not temp filename) and folder_id
    for doc in documents:
        doc.metadata["source"] = original_filename
        doc.metadata["type"] = "pdf"
        if folder_id:
            doc.metadata["folder_id"] = folder_id
    
    return documents


@trace
async def process_text_file(content: str, filename: str, folder_id: Optional[str] = None) -> List[Document]:
    """
    Process a text file content and create LangChain Documents.
    
    Args:
        content: Text content
        filename: Name of the file
        folder_id: Optional folder ID to tag documents with
        
    Returns:
        List of LangChain Document objects
    """
    metadata = {
        "source": filename,
        "type": "text"
    }
    if folder_id:
        metadata["folder_id"] = folder_id
    
    document = Document(
        page_content=content,
        metadata=metadata
    )
    
    return [document]


@router.post("")
async def ingest_document(
    file: UploadFile = File(...),
    collection_name: str = Form("user_knowledge"),
    folder_id: Optional[str] = Form(None)
):
    """
    Ingest a document (PDF or Text) into the VectorDB.
    
    - **file**: PDF or text file to upload
    - **collection_name**: ChromaDB collection name (default: user_knowledge)
    
    Returns:
        JSON response with ingestion status and document IDs
    """
    try:
        # Check file type
        content_type = file.content_type or ""
        file_extension = file.filename.split(".")[-1].lower() if file.filename else ""
        
        documents: List[Document] = []
        
        if content_type == "application/pdf" or file_extension == "pdf":
            # Process PDF file
            original_filename = file.filename or "uploaded_file.pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                content = await file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name
            
            try:
                documents = await process_pdf_file(tmp_file_path, original_filename, folder_id)
            finally:
                # Clean up temporary file
                os.unlink(tmp_file_path)
                
        elif content_type.startswith("text/") or file_extension in ["txt", "md", "markdown"]:
            # Process text file
            content = await file.read()
            text_content = content.decode("utf-8")
            documents = await process_text_file(text_content, file.filename or "uploaded_file.txt", folder_id)
            
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {content_type}. Supported types: PDF, TXT, MD"
            )
        
        if not documents:
            raise HTTPException(
                status_code=400,
                detail="No content extracted from the file"
            )
        
        # Ensure all documents have the correct source metadata with original filename and folder_id
        original_filename = file.filename or "uploaded_file"
        for doc in documents:
            # Force use of original filename (overwrite any temp filename that might have been set)
            doc.metadata["source"] = original_filename
            # Ensure folder_id is set if provided
            if folder_id:
                doc.metadata["folder_id"] = folder_id
        
        # Add documents to vector store
        document_ids = add_documents_to_vector_store(
            documents=documents,
            collection_name=collection_name
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "Document ingested successfully",
                "filename": file.filename,
                "chunks_created": len(document_ids),
                "document_ids": document_ids[:10],  # Return first 10 IDs
                "collection": collection_name
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document: {str(e)}"
        )


@router.get("/status")
async def get_ingestion_status(collection_name: str = "user_knowledge"):
    """
    Get status of the vector store collection.
    
    Args:
        collection_name: Name of the collection to check
        
    Returns:
        Collection status information
    """
    try:
        from utils.vector_store import get_vector_store
        
        vector_store = get_vector_store(collection_name=collection_name)
        collection = vector_store._collection
        
        # Get collection count
        count = collection.count()
        
        return {
            "collection_name": collection_name,
            "document_count": count,
            "status": "active"
        }
    except Exception as e:
        return {
            "collection_name": collection_name,
            "document_count": 0,
            "status": "error",
            "error": str(e)
        }

