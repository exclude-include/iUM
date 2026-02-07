# 🚀 Opik 기능 마이그레이션 가이드

> 이 문서는 `feat/opik-sh-task2` 브랜치에서 개발한 Opik 평가 기능을 `dev` 브랜치 기반 새 브랜치에서 다시 구현하기 위한 상세 가이드입니다.

## 📋 작업 개요

### 목표
iUM 프로젝트에 Opik을 이용한 RAG 시스템 평가 기능 추가

### 구현된 기능 요약
1. **Opik 설정 및 트레이싱** (`opik_config.py`)
2. **평가 메트릭 및 데이터셋 관리** (`opik_evaluation.py`)
3. **평가 API 엔드포인트** (`routers/evaluate.py`)
4. **RAG Chain에 Opik 트레이싱 통합** (`rag_chain.py` 수정)

---

## 🔧 1단계: 새 브랜치 생성

```bash
# 1. dev 브랜치로 이동 및 최신화
git checkout dev
git pull origin dev

# 2. 새 feature 브랜치 생성
git checkout -b feat/opik-v2

# 확인
git branch
```

---

## 📦 2단계: 의존성 추가

### `apps/api/requirements.txt`에 추가
```
opik>=0.1.0
```

### `.env.example` 업데이트
```env
# Opik Configuration
OPIK_API_KEY=your_opik_api_key_here
OPIK_WORKSPACE=your_workspace_name
OPIK_PROJECT_NAME=iUM
OPIK_EVAL_MODEL=gpt-4o-mini
```

---

## 📁 3단계: 새 파일 생성

### 3.1 `apps/api/utils/opik_config.py` (신규 생성)

```python
"""
Opik configuration and setup for tracing LangChain operations.
Provides a singleton OpikService for dependency injection.
"""
import os
import functools
import asyncio
from typing import Optional, Callable, Any, List, Dict


class OpikService:
    """
    Singleton service for managing Opik client.
    Initializes Opik client on app startup and provides it for dependency injection.
    """
    _instance: Optional["OpikService"] = None
    _client = None
    _initialized: bool = False

    def __new__(cls) -> "OpikService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self) -> None:
        """
        Initialize Opik client with environment variables.
        Should be called once at app startup.
        """
        if self._initialized:
            return

        api_key = os.getenv("OPIK_API_KEY")
        workspace = os.getenv("OPIK_WORKSPACE")
        project_name = os.getenv("OPIK_PROJECT_NAME", "iUM")

        if not api_key:
            print("[OpikService] OPIK_API_KEY not set. Opik tracing disabled.")
            self._initialized = True
            return

        try:
            from opik import Opik
            self._client = Opik(
                api_key=api_key,
                workspace=workspace,
                project_name=project_name,
            )
            self._initialized = True
            print(f"[OpikService] Initialized successfully. Project: {project_name}")
        except ImportError:
            print("[OpikService] opik package not installed. Tracing disabled.")
            self._initialized = True
        except Exception as e:
            print(f"[OpikService] Failed to initialize: {e}")
            self._initialized = True

    @property
    def client(self):
        """Get the Opik client instance."""
        if not self._initialized:
            self.initialize()
        return self._client

    @property
    def is_enabled(self) -> bool:
        """Check if Opik tracing is enabled."""
        return self._client is not None

    def shutdown(self) -> None:
        """Cleanup on app shutdown."""
        if self._client is not None:
            try:
                self._client.flush()
            except Exception:
                pass
            self._client = None
        self._initialized = False
        print("[OpikService] Shutdown complete.")


# Global singleton instance
opik_service = OpikService()


def get_opik_service() -> OpikService:
    """
    Dependency injection function for FastAPI.
    Usage: opik = Depends(get_opik_service)
    """
    return opik_service


def get_opik_client():
    """
    Get the raw Opik client for direct usage.
    Returns None if Opik is not configured.
    """
    return opik_service.client


# Opik track decorator - supports both sync and async functions
def track(
    name: Optional[str] = None,
    type: str = "general",
    tags: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    capture_input: bool = True,
    capture_output: bool = True,
):
    """
    Decorator for tracing functions with Opik.
    Works with both sync and async functions.
    If Opik is not configured, returns the function unchanged.

    Args:
        name: Custom name for the trace (defaults to function name)
        type: Trace type - 'general', 'tool', 'llm', or 'guardrail'
        tags: Optional list of tags for categorization
        metadata: Optional metadata dict to attach to trace
        capture_input: Whether to capture function inputs
        capture_output: Whether to capture function outputs
    """
    def decorator(func: Callable) -> Callable:
        # Check if Opik is available at decoration time
        try:
            from opik import track as opik_track
        except ImportError:
            return func

        # Check if API key is set
        if not os.getenv("OPIK_API_KEY"):
            return func

        # Apply Opik's track decorator
        trace_name = name or func.__name__
        tracked_func = opik_track(
            name=trace_name,
            type=type,
            tags=tags,
            metadata=metadata,
            capture_input=capture_input,
            capture_output=capture_output,
        )(func)

        return tracked_func

    return decorator


# Legacy alias for backward compatibility
def trace(func):
    """
    Legacy decorator for tracing functions with Opik.
    Use @track() instead for more options.
    """
    return track()(func)


# Legacy support: OpikWrapper for backward compatibility
class OpikWrapper:
    """Wrapper class for Opik compatibility (legacy)"""
    @staticmethod
    def trace(func):
        return trace(func)

opik = OpikWrapper()
```

---

### 3.2 `apps/api/utils/opik_evaluation.py` (신규 생성)

```python
"""
Opik Evaluation Metrics configuration for iUM.
Provides evaluation metrics for RAG system quality assessment.
"""
import os
from typing import Optional, List, Dict, Any, Callable
from utils.opik_config import get_opik_client


def get_evaluation_metrics() -> List[Any]:
    """
    Get a list of Opik evaluation metrics for RAG evaluation.
    Returns empty list if Opik is not configured.
    
    Metrics included:
    - AnswerRelevance: Measures if the answer is relevant to the question
    - Hallucination: Detects hallucinated content not in context
    - ContextPrecision: Measures precision of retrieved context
    - ContextRecall: Measures recall of retrieved context
    """
    if not os.getenv("OPIK_API_KEY"):
        return []
    
    try:
        from opik.evaluation.metrics import (
            AnswerRelevance,
            Hallucination,
            ContextPrecision,
            ContextRecall,
        )
        
        # LLM model for LLM-as-Judge metrics
        model_name = os.getenv("OPIK_EVAL_MODEL", "gpt-4o-mini")
        
        metrics = [
            AnswerRelevance(model=model_name),
            Hallucination(model=model_name),
            ContextPrecision(model=model_name),
            ContextRecall(model=model_name),
        ]
        
        return metrics
    except ImportError as e:
        print(f"[OpikEvaluation] Failed to import metrics: {e}")
        return []
    except Exception as e:
        print(f"[OpikEvaluation] Error initializing metrics: {e}")
        return []


def get_heuristic_metrics() -> List[Any]:
    """
    Get heuristic (non-LLM) evaluation metrics.
    These are faster and don't require API calls.
    
    Metrics included:
    - Contains: Check if output contains expected keywords
    - IsJson: Validate JSON format for structured outputs
    """
    if not os.getenv("OPIK_API_KEY"):
        return []
    
    try:
        from opik.evaluation.metrics import Contains, IsJson
        
        return [
            Contains(case_sensitive=False),
            IsJson(),
        ]
    except ImportError as e:
        print(f"[OpikEvaluation] Failed to import heuristic metrics: {e}")
        return []
    except Exception as e:
        print(f"[OpikEvaluation] Error initializing heuristic metrics: {e}")
        return []


class DatasetManager:
    """
    Manager for Opik datasets.
    Provides methods for creating, updating, and querying datasets.
    """
    
    def __init__(self):
        self._client = None
    
    @property
    def client(self):
        """Lazy load Opik client."""
        if self._client is None:
            self._client = get_opik_client()
        return self._client
    
    @property
    def is_available(self) -> bool:
        """Check if Opik is available."""
        return self.client is not None
    
    def get_or_create_dataset(self, name: str, description: Optional[str] = None) -> Optional[Any]:
        """
        Get existing dataset or create a new one.
        
        Args:
            name: Dataset name
            description: Optional description
            
        Returns:
            Opik Dataset object or None if unavailable
        """
        if not self.is_available:
            return None
        
        try:
            dataset = self.client.get_or_create_dataset(
                name=name,
                description=description or f"iUM evaluation dataset: {name}"
            )
            return dataset
        except Exception as e:
            print(f"[DatasetManager] Failed to get/create dataset: {e}")
            return None
    
    def get_dataset(self, name: str) -> Optional[Any]:
        """
        Get an existing dataset by name.
        
        Args:
            name: Dataset name
            
        Returns:
            Opik Dataset object or None
        """
        if not self.is_available:
            return None
        
        try:
            return self.client.get_dataset(name=name)
        except Exception as e:
            print(f"[DatasetManager] Failed to get dataset '{name}': {e}")
            return None
    
    def list_datasets(self) -> List[Dict[str, Any]]:
        """
        List all datasets.
        
        Returns:
            List of dataset info dictionaries
        """
        if not self.is_available:
            return []
        
        try:
            datasets = self.client.get_datasets()
            return [
                {
                    "name": ds.name,
                    "description": getattr(ds, 'description', ''),
                    "id": getattr(ds, 'id', ''),
                }
                for ds in datasets
            ]
        except Exception as e:
            print(f"[DatasetManager] Failed to list datasets: {e}")
            return []
    
    def insert_items(
        self, 
        dataset_name: str, 
        items: List[Dict[str, Any]]
    ) -> bool:
        """
        Insert items into a dataset.
        
        Args:
            dataset_name: Name of the dataset
            items: List of item dictionaries with 'input', 'expected_output', etc.
            
        Returns:
            True if successful, False otherwise
        """
        dataset = self.get_or_create_dataset(dataset_name)
        if dataset is None:
            return False
        
        try:
            dataset.insert(items)
            return True
        except Exception as e:
            print(f"[DatasetManager] Failed to insert items: {e}")
            return False
    
    def delete_items(self, dataset_name: str, item_ids: List[str]) -> bool:
        """
        Delete items from a dataset.
        
        Args:
            dataset_name: Name of the dataset
            item_ids: List of item IDs to delete
            
        Returns:
            True if successful, False otherwise
        """
        dataset = self.get_dataset(dataset_name)
        if dataset is None:
            return False
        
        try:
            dataset.delete(item_ids)
            return True
        except Exception as e:
            print(f"[DatasetManager] Failed to delete items: {e}")
            return False


class EvaluationRunner:
    """
    Runner for Opik evaluations.
    Executes evaluation experiments on datasets with specified metrics.
    """
    
    def __init__(self):
        self.dataset_manager = DatasetManager()
    
    @property
    def is_available(self) -> bool:
        """Check if evaluation is available."""
        return self.dataset_manager.is_available
    
    async def run_evaluation(
        self,
        dataset_name: str,
        task: Callable,
        experiment_name: Optional[str] = None,
        metrics: Optional[List[Any]] = None,
        experiment_config: Optional[Dict[str, Any]] = None,
        max_samples: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Run an evaluation experiment.
        
        Args:
            dataset_name: Name of the dataset to evaluate on
            task: Evaluation task function that takes dataset item and returns output dict
            experiment_name: Optional name for the experiment
            metrics: Optional list of metrics (defaults to RAG metrics)
            experiment_config: Optional experiment configuration metadata
            max_samples: Optional limit on number of samples to evaluate
            
        Returns:
            Dictionary with experiment results
        """
        if not self.is_available:
            return {
                "success": False,
                "error": "Opik is not configured. Set OPIK_API_KEY environment variable."
            }
        
        try:
            from opik import evaluate
            import random
            
            # Get dataset
            dataset = self.dataset_manager.get_dataset(dataset_name)
            if dataset is None:
                return {
                    "success": False,
                    "error": f"Dataset '{dataset_name}' not found."
                }
            
            dataset_to_eval = dataset
            
            # Handle sampling if max_samples is set
            if max_samples is not None:
                try:
                    items = list(dataset.get_items())
                    if len(items) > max_samples:
                        sampled_items = random.sample(items, max_samples)
                        import uuid
                        temp_name = f"temp_sample_{uuid.uuid4().hex[:8]}"
                        temp_dataset = self.dataset_manager.get_or_create_dataset(temp_name)
                        
                        insert_items = []
                        for item in sampled_items:
                            item_dict = {
                                "input": getattr(item, "input", "") or item.get("input"),
                                "expected_output": getattr(item, "expected_output", "") or item.get("expected_output"),
                            }
                            if hasattr(item, "__dict__"):
                                item_dict.update({k:v for k,v in item.__dict__.items() if not k.startswith('_')})
                            elif isinstance(item, dict):
                                item_dict.update(item)
                            insert_items.append(item_dict)
                            
                        temp_dataset.insert(insert_items)
                        dataset_to_eval = temp_dataset
                        print(f"[EvaluationRunner] Created temp dataset '{temp_name}' with {len(insert_items)} samples")
                except Exception as e:
                    print(f"[EvaluationRunner] Sampling failed: {e}. Using full dataset.")
            
            # Use default metrics if not provided
            if metrics is None:
                metrics = get_evaluation_metrics()
            
            # Generate experiment name if not provided
            if experiment_name is None:
                import datetime
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                experiment_name = f"iUM_eval_{timestamp}"
            
            # Run evaluation
            result = evaluate(
                dataset=dataset_to_eval,
                task=task,
                scoring_metrics=metrics,
                experiment_name=experiment_name,
                experiment_config=experiment_config or {},
            )
            
            return {
                "success": True,
                "experiment_id": getattr(result, 'experiment_id', None),
                "experiment_name": experiment_name,
                "num_samples": len(getattr(result, 'test_results', [])),
            }
            
        except Exception as e:
            print(f"[EvaluationRunner] Evaluation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instances
dataset_manager = DatasetManager()
evaluation_runner = EvaluationRunner()


def get_dataset_manager() -> DatasetManager:
    """Get the DatasetManager singleton."""
    return dataset_manager


def get_evaluation_runner() -> EvaluationRunner:
    """Get the EvaluationRunner singleton."""
    return evaluation_runner
```

---

### 3.3 `apps/api/routers/evaluate.py` (신규 생성)

```python
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
    get_heuristic_metrics,
)
from utils.rag_chain import query_rag_chain_sync

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
    
    def rag_evaluation_task(dataset_item: dict) -> dict:
        """Evaluation task that runs the RAG chain."""
        question = dataset_item.get("input", "")
        expected = dataset_item.get("expected_output", "")
        
        try:
            result = query_rag_chain_sync(
                question=question,
                folder_id=folder_id
            )
            
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
    
    try:
        _evaluation_jobs[job_id]["status"] = "running"
        
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(runner.run_evaluation(
                dataset_name=dataset_name,
                task=rag_evaluation_task,
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
        "timestamp": datetime.datetime.now().isoformat(),
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
        "started_at": datetime.datetime.now().isoformat(),
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
```

---

## ✏️ 4단계: 기존 파일 수정

### 4.1 `apps/api/main.py` 수정

**추가할 내용:**

```python
# 파일 상단 imports에 추가
from utils.opik_config import opik_service

# 기존 라우터 등록 부분에 추가
from routers import evaluate
app.include_router(evaluate.router, prefix="/api/evaluate", tags=["evaluation"])

# startup 이벤트에 추가
@app.on_event("startup")
async def startup_event():
    # ... 기존 코드 ...
    opik_service.initialize()

# shutdown 이벤트에 추가
@app.on_event("shutdown")
async def shutdown_event():
    # ... 기존 코드 ...
    opik_service.shutdown()
```

---

### 4.2 `apps/api/utils/rag_chain.py` 수정

**추가할 imports:**

```python
from utils.opik_config import track
```

**함수에 데코레이터 추가:**

```python
@track(name="create_rag_chain", type="general", tags=["rag", "chain"])
def create_rag_chain(...):
    ...

@track(name="query_rag_chain", type="llm", tags=["rag", "chat", "gemini"])
async def query_rag_chain(...):
    ...
```

**동기 버전 함수 추가 (평가용):**

```python
@track(name="query_rag_chain_sync", type="llm", tags=["rag", "chat", "gemini", "sync"])
def query_rag_chain_sync(
    question: str,
    collection_name: str = "user_knowledge",
    model_name: str = "models/gemini-2.5-flash",
    k: int = 4,
    folder_id: Optional[str] = None
) -> dict:
    """
    Synchronous version of query_rag_chain for Opik evaluation.
    """
    # query_rag_chain과 동일한 로직이지만 async/await 없이 구현
    ...
```

---

## ✅ 5단계: 테스트

### 5.1 환경 변수 설정

`.env` 파일에 다음 추가:
```env
OPIK_API_KEY=your_actual_api_key
OPIK_WORKSPACE=your_workspace
OPIK_PROJECT_NAME=iUM
```

### 5.2 서버 실행 및 테스트

```bash
cd apps/api
uvicorn main:app --reload
```

### 5.3 API 테스트

```bash
# 1. Opik 상태 확인
curl http://localhost:8000/api/evaluate/status

# 2. 데이터셋 생성
curl -X POST http://localhost:8000/api/evaluate/datasets \
  -H "Content-Type: application/json" \
  -d '{"name": "test_dataset", "description": "Test dataset"}'

# 3. 데이터셋에 아이템 추가
curl -X POST http://localhost:8000/api/evaluate/datasets/test_dataset/items \
  -H "Content-Type: application/json" \
  -d '{"items": [{"input": "What is photosynthesis?", "expected_output": "Process of converting light to energy"}]}'

# 4. 평가 실행
curl -X POST http://localhost:8000/api/evaluate/run \
  -H "Content-Type: application/json" \
  -d '{"dataset_name": "test_dataset", "max_samples": 1}'
```

---

## 📊 6단계: Git 커밋

```bash
git add .
git commit -m "feat: Add Opik evaluation integration

- Add opik_config.py for Opik service singleton and tracing decorator
- Add opik_evaluation.py for metrics and dataset management
- Add evaluate.py router for evaluation API endpoints
- Add query_rag_chain_sync for synchronous evaluation
- Update main.py for Opik initialization"

git push origin feat/opik-v2
```

---

## 📚 참고: API 엔드포인트 요약

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/evaluate/status` | Opik 설정 상태 확인 |
| GET | `/api/evaluate/datasets` | 모든 데이터셋 목록 |
| POST | `/api/evaluate/datasets` | 새 데이터셋 생성 |
| GET | `/api/evaluate/datasets/{name}` | 특정 데이터셋 상세 정보 |
| POST | `/api/evaluate/datasets/{name}/items` | 데이터셋에 아이템 추가 |
| DELETE | `/api/evaluate/datasets/{name}/items` | 데이터셋에서 아이템 삭제 |
| POST | `/api/evaluate/run` | 평가 실행 (비동기) |
| GET | `/api/evaluate/jobs` | 모든 평가 작업 목록 |
| GET | `/api/evaluate/jobs/{job_id}` | 특정 평가 작업 상태 |
| GET | `/api/evaluate/metrics` | 사용 가능한 메트릭 목록 |

---

## ⚠️ 주의사항

1. **dev 브랜치 최신화**: 새 브랜치 생성 전 반드시 `git pull origin dev`
2. **import 경로**: dev 브랜치의 파일 구조에 맞게 import 경로 조정 필요할 수 있음
3. **환경 변수**: OPIK_API_KEY가 없으면 Opik 기능은 자동으로 비활성화됨 (앱은 정상 작동)
4. **충돌 방지**: `rag_chain.py` 수정 시 dev 브랜치의 기존 코드와 충돌 가능성 있음

---

*마지막 업데이트: 2026-02-01*
