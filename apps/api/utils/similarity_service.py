"""
Similarity calculation service for reel recommendations.
Handles folder document centroid calculation and cosine similarity.
"""

import numpy as np
from typing import List, Optional
from utils.vector_store import get_vector_store


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
        
    Returns:
        float: Similarity score between 0 and 1 (1 = identical)
    """
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    # Calculate cosine similarity
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    
    return float(dot_product / (norm_v1 * norm_v2))


def calculate_folder_centroid(folder_ids: List[str], collection_name: str = "user_knowledge") -> Optional[List[float]]:
    """
    Calculate the centroid (average) embedding from documents in specified folders.
    
    Args:
        folder_ids: List of folder IDs to include
        collection_name: Vector store collection name
        
    Returns:
        List[float]: Centroid embedding vector, or None if no documents found
    """
    if not folder_ids:
        return None
    
    try:
        # Get vector store
        vector_store = get_vector_store(collection_name)
        collection = vector_store._collection
        
        # Build filter for multiple folders
        if len(folder_ids) == 1:
            where_filter = {"folder_id": folder_ids[0]}
        else:
            where_filter = {"folder_id": {"$in": folder_ids}}
        
        # Get embeddings from vector store
        results = collection.get(
            where=where_filter,
            include=["embeddings"]
        )
        
        if not results["embeddings"] or len(results["embeddings"]) == 0:
            return None
        
        # Calculate centroid (average) of document embeddings
        doc_embeddings = np.array(results["embeddings"])
        centroid = doc_embeddings.mean(axis=0).tolist()
        
        return centroid
        
    except Exception as e:
        print(f"Error calculating folder centroid: {e}")
        return None
