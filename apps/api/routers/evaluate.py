"""
Evaluation API router for iUM.
Provides endpoints for dataset management and running evaluations.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import datetime

from utils.opik_evaluation import (
    get_dataset_manager,
    get_evaluation_runner,
    get_evaluation_metrics,
)
from utils.rag_chain import query_rag_chain, query_rag_chain_sync

router = APIRouter()


# ============== Pydantic Models ==============

class DatasetCreate(BaseModel):
    """Request model for creating a dataset."""
    name: str = Field(..., description="Name of the dataset")
    description: Optional[str] = Field(None, description="Optional description")


class DatasetItemCreate(BaseModel):
    """Request model for creating dataset items."""
    items: List[Dict[str, Any]] = Field(
        ..., 
        description="List of items with 'input', 'expected_output', etc."
    )


class DatasetItemDelete(BaseModel):
    """Request model for deleting dataset items."""
    item_ids: List[str] = Field(..., description="List of item IDs to delete")


class EvaluationRun(BaseModel):
    """Request model for running an evaluation."""
    dataset_name: str = Field(..., description="Name of the dataset to evaluate")
    experiment_name: Optional[str] = Field(None, description="Optional experiment name")
    folder_id: Optional[str] = Field(None, description="Optional folder ID for RAG context")
    config: Optional[Dict[str, Any]] = Field(None, description="Optional experiment config")
    max_samples: Optional[int] = Field(None, description="Limit execution to N samples for speed")
    use_heavy_metrics: bool = Field(False, description="If True, use LLM-as-Judge metrics. If False, use fast Heuristic metrics only.")


class DatasetResponse(BaseModel):
    """Response model for dataset operations."""
    success: bool
    name: Optional[str] = None
    message: Optional[str] = None


class DatasetsListResponse(BaseModel):
    """Response model for listing datasets."""
    success: bool
    datasets: List[Dict[str, Any]] = []


class EvaluationResponse(BaseModel):
    """Response model for evaluation operations."""
    success: bool
    experiment_id: Optional[str] = None
    experiment_name: Optional[str] = None
    num_samples: Optional[int] = None
    error: Optional[str] = None
    message: Optional[str] = None


class OpikStatusResponse(BaseModel):
    """Response model for Opik status check."""
    enabled: bool
    message: str


# ============== Status Endpoint ==============

@router.get("/status", response_model=OpikStatusResponse)
async def get_opik_status():
    """Check if Opik evaluation is available."""
    dm = get_dataset_manager()
    if dm.is_available:
        return OpikStatusResponse(
            enabled=True,
            message="Opik evaluation is enabled and ready."
        )
    return OpikStatusResponse(
        enabled=False,
        message="Opik is not configured. Set OPIK_API_KEY environment variable."
    )


# ============== Dataset Endpoints ==============

@router.post("/datasets", response_model=DatasetResponse)
async def create_dataset(request: DatasetCreate):
    """
    Create a new dataset or get existing one.
    Opik automatically handles deduplication.
    """
    dm = get_dataset_manager()
    if not dm.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    dataset = dm.get_or_create_dataset(
        name=request.name,
        description=request.description
    )
    
    if dataset is None:
        raise HTTPException(status_code=500, detail="Failed to create dataset.")
    
    return DatasetResponse(
        success=True,
        name=request.name,
        message=f"Dataset '{request.name}' created/retrieved successfully."
    )


@router.get("/datasets", response_model=DatasetsListResponse)
async def list_datasets():
    """List all available datasets."""
    dm = get_dataset_manager()
    if not dm.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    datasets = dm.list_datasets()
    return DatasetsListResponse(success=True, datasets=datasets)


@router.get("/datasets/{name}")
async def get_dataset(name: str):
    """Get details of a specific dataset."""
    dm = get_dataset_manager()
    if not dm.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    dataset = dm.get_dataset(name)
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")
    
    # Get dataset items count if available
    try:
        items = list(dataset.get_items())
        item_count = len(items)
    except Exception:
        item_count = 0
    
    return {
        "success": True,
        "name": dataset.name,
        "description": getattr(dataset, 'description', ''),
        "id": getattr(dataset, 'id', ''),
        "item_count": item_count,
    }


@router.post("/datasets/{name}/items", response_model=DatasetResponse)
async def add_dataset_items(name: str, request: DatasetItemCreate):
    """
    Add items to a dataset.
    
    Each item should have at minimum:
    - input: The input/question text
    - expected_output: The expected answer (optional but recommended)
    
    Additional fields like 'context' can be added for RAG evaluation.
    """
    dm = get_dataset_manager()
    if not dm.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    success = dm.insert_items(name, request.items)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to insert items.")
    
    return DatasetResponse(
        success=True,
        name=name,
        message=f"Added {len(request.items)} items to dataset '{name}'."
    )


@router.delete("/datasets/{name}/items", response_model=DatasetResponse)
async def delete_dataset_items(name: str, request: DatasetItemDelete):
    """Delete items from a dataset by their IDs."""
    dm = get_dataset_manager()
    if not dm.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    success = dm.delete_items(name, request.item_ids)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete items.")
    
    return DatasetResponse(
        success=True,
        name=name,
        message=f"Deleted {len(request.item_ids)} items from dataset '{name}'."
    )


# ============== Evaluation Endpoints ==============

@router.post("/run", response_model=EvaluationResponse)
async def run_evaluation(request: EvaluationRun, background_tasks: BackgroundTasks):
    """
    Run an evaluation experiment on a dataset.
    
    This endpoint triggers an evaluation using the iUM RAG chain
    against the specified dataset. Results are tracked in Opik.
    
    The evaluation uses the following metrics:
    - AnswerRelevance: Measures if answers are relevant to questions
    - Hallucination: Detects content not grounded in context
    - ContextPrecision: Measures precision of retrieved documents
    - ContextRecall: Measures recall of retrieved documents
    """
    runner = get_evaluation_runner()
    if not runner.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    # Define the evaluation task
    folder_id = request.folder_id
    
    def rag_evaluation_task(dataset_item: dict) -> dict:
        """
        Evaluation task that runs the RAG chain.
        Maps dataset items to the format expected by metrics.
        """
        question = dataset_item.get("input", "")
        expected = dataset_item.get("expected_output", "")
        
        try:
            # Run RAG chain (Synchronous)
            result = query_rag_chain_sync(
                question=question,
                folder_id=folder_id
            )
            
            # Extract context from sources
            context_texts = []
            for source in result.get("sources", []):
                if isinstance(source, dict):
                    context_texts.append(source.get("content", ""))
                else:
                    context_texts.append(str(source))
            
            return {
                "input": question,
                "output": result.get("answer", ""),
                "expected_output": expected,
                "context": context_texts,
            }
        except Exception as e:
            return {
                "input": question,
                "output": f"Error: {str(e)}",
                "expected_output": expected,
                "context": [],
            }
    
    # Build experiment config
    experiment_config = request.config or {}
    experiment_config.update({
        "model": "gemini-2.5-flash",
        "folder_id": folder_id,
        "timestamp": datetime.datetime.now().isoformat(),
    })
    
    # Select metrics based on configuration
    from utils.opik_evaluation import get_heuristic_metrics, get_evaluation_metrics
    
    if request.use_heavy_metrics:
        metrics = get_evaluation_metrics()
        # Fallback to heuristic if LLM metrics fail or return empty
        if not metrics:
            metrics = get_heuristic_metrics()
    else:
        metrics = get_heuristic_metrics()

    result = await runner.run_evaluation(
        dataset_name=request.dataset_name,
        task=rag_evaluation_task,
        experiment_name=request.experiment_name,
        metrics=metrics,
        experiment_config=experiment_config,
        max_samples=request.max_samples,
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Evaluation failed.")
        )
    
    return EvaluationResponse(
        success=True,
        experiment_id=result.get("experiment_id"),
        experiment_name=result.get("experiment_name"),
        num_samples=result.get("num_samples"),
        message="Evaluation completed. View results in Opik dashboard."
    )


@router.get("/metrics")
async def list_available_metrics():
    """List available evaluation metrics."""
    metrics = get_evaluation_metrics()
    
    if not metrics:
        return {
            "success": True,
            "metrics": [],
            "message": "No metrics available. Opik may not be configured."
        }
    
    metric_info = []
    for metric in metrics:
        metric_info.append({
            "name": type(metric).__name__,
            "type": "llm-as-judge",
            "description": getattr(metric, '__doc__', '') or f"{type(metric).__name__} metric"
        })
    
    return {
        "success": True,
        "metrics": metric_info,
    }
