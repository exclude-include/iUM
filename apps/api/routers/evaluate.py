"""
Evaluation API router for iUM.
Provides endpoints for dataset management and running evaluations.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from utils.opik_evaluation import (
    get_dataset_manager,
    get_evaluation_runner,
    get_evaluation_metrics,
    get_heuristic_metrics,
)

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
    max_samples: Optional[int] = Field(None, description="Limit execution to N samples")
    use_heavy_metrics: bool = Field(False, description="Use LLM-as-Judge metrics if True")


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
    """Create a new dataset or get existing one."""
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
    """Add items to a dataset."""
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

# In-memory store for tracking evaluation jobs
_evaluation_jobs: Dict[str, Dict[str, Any]] = {}


def _create_rag_evaluation_task(folder_id: Optional[str] = None):
    """
    Create a RAG evaluation task function.
    This function will be called for each item in the dataset.
    """
    def rag_evaluation_task(dataset_item: dict) -> dict:
        """Evaluation task that runs the RAG chain synchronously."""
        import os
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.prompts import PromptTemplate
        from utils.vector_store import get_retriever
        
        question = dataset_item.get("input", "")
        expected = dataset_item.get("expected_output", "")
        
        try:
            # Simplified RAG chain for evaluation
            retriever = get_retriever(
                collection_name="user_knowledge",
                k=4,
                folder_id=folder_id
            )
            
            # Get relevant documents
            if hasattr(retriever, 'invoke'):
                relevant_docs = retriever.invoke(question)
            else:
                relevant_docs = retriever.get_relevant_documents(question)
            
            # Build context
            context_texts = []
            for doc in relevant_docs:
                context_texts.append(doc.page_content)
            
            context = "\n\n".join(context_texts)
            
            # Simple prompt for evaluation
            prompt = f"""Answer the following question based on the context provided.
            
Context:
{context}

Question: {question}

Answer:"""
            
            # Call LLM
            llm = ChatGoogleGenerativeAI(
                model="models/gemini-2.5-flash",
                temperature=0,
                google_api_key=os.getenv("GOOGLE_API_KEY")
            )
            
            response = llm.invoke(prompt)
            answer = response.content
            
            return {
                "input": question,
                "output": answer,
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
    
    return rag_evaluation_task


def _run_evaluation_in_background(
    job_id: str,
    runner,
    dataset_name: str,
    folder_id: Optional[str],
    experiment_name: Optional[str],
    experiment_config: Dict[str, Any],
    metrics: List[Any],
    max_samples: Optional[int],
):
    """Background function to run evaluation."""
    
    try:
        _evaluation_jobs[job_id]["status"] = "running"
        
        # Create the evaluation task
        rag_task = _create_rag_evaluation_task(folder_id)
        
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(runner.run_evaluation(
                dataset_name=dataset_name,
                task=rag_task,
                experiment_name=experiment_name,
                metrics=metrics,
                experiment_config=experiment_config,
                max_samples=max_samples,
            ))
        finally:
            loop.close()
        
        if result.get("success"):
            _evaluation_jobs[job_id].update({
                "status": "completed",
                "experiment_id": result.get("experiment_id"),
                "experiment_name": result.get("experiment_name"),
                "num_samples": result.get("num_samples"),
            })
        else:
            _evaluation_jobs[job_id].update({
                "status": "failed",
                "error": result.get("error", "Unknown error"),
            })
    except Exception as e:
        _evaluation_jobs[job_id].update({
            "status": "failed",
            "error": str(e),
        })


@router.post("/run", status_code=202)
async def run_evaluation(request: EvaluationRun, background_tasks: BackgroundTasks):
    """Start an evaluation experiment on a dataset (async)."""
    from fastapi.concurrency import run_in_threadpool
    import uuid
    
    runner = get_evaluation_runner()
    if not runner.is_available:
        raise HTTPException(
            status_code=503,
            detail="Opik is not configured. Set OPIK_API_KEY environment variable."
        )
    
    job_id = str(uuid.uuid4())[:8]
    
    experiment_config = request.config or {}
    experiment_config.update({
        "model": "gemini-2.5-flash",
        "folder_id": request.folder_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    if request.use_heavy_metrics:
        metrics = get_evaluation_metrics()
        if not metrics:
            metrics = get_heuristic_metrics()
    else:
        metrics = get_heuristic_metrics()
    
    _evaluation_jobs[job_id] = {
        "status": "pending",
        "dataset_name": request.dataset_name,
        "experiment_name": request.experiment_name or f"eval_{job_id}",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    
    background_tasks.add_task(
        run_in_threadpool,
        _run_evaluation_in_background,
        job_id,
        runner,
        request.dataset_name,
        request.folder_id,
        request.experiment_name or f"eval_{job_id}",
        experiment_config,
        metrics,
        request.max_samples,
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "message": f"Evaluation started. Check status at GET /api/evaluate/jobs/{job_id}",
    }


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of an evaluation job."""
    if job_id not in _evaluation_jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    
    return _evaluation_jobs[job_id]


@router.get("/jobs")
async def list_jobs():
    """List all evaluation jobs."""
    return {"jobs": list(_evaluation_jobs.values())}


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
