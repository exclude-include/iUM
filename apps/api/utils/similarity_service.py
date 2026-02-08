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


def calculate_folder_centroid(folder_ids: List[str], collection_name: str = "documents") -> Optional[List[float]]:
    """
    Calculate the centroid (average) embedding from documents in specified folders.
    
    Args:
        folder_ids: List of folder IDs to include
        collection_name: Vector store table name (default 'documents')
        
    Returns:
        List[float]: Centroid embedding vector, or None if no documents found
    """
    if not folder_ids:
        return None
    
    try:
        from utils.supabase_client import get_supabase_client
        import json
        
        supabase = get_supabase_client()
        
        all_embeddings = []
        
        # Fetch embeddings for each folder
        # Note: Using .contains("metadata", {"folder_id": fid}) matches JSONB
        for fid in folder_ids:
            # Select embedding column. 
            # Note: Depending on response size, might need pagination, but folders usually small-ish?
            # Let's verify table name usage. collection_name arg is passed but vector_store says 'documents'.
            # We trust 'documents' is the table.
            
            response = supabase.table(collection_name).select("embedding").contains("metadata", {"folder_id": fid}).execute()
            
            if response.data:
                for row in response.data:
                    vec = row.get("embedding")
                    if vec:
                        if isinstance(vec, str):
                            vec = json.loads(vec)
                        all_embeddings.append(vec)
        
        if not all_embeddings:
            return None
        
        # Calculate centroid (average) of document embeddings
        doc_embeddings = np.array(all_embeddings)
        centroid = doc_embeddings.mean(axis=0).tolist()
        
        return centroid
        
    except Exception as e:
        print(f"Error calculating folder centroid: {e}")
        return None
