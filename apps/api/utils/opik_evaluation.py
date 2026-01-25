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
            
            # Handle sampling if max_samples is set
            dataset_to_eval = dataset
            if max_samples is not None:
                try:
                    # Fetch items to list
                    items = list(dataset.get_items())
                    if len(items) > max_samples:
                        # Sample items
                        sampled_items = random.sample(items, max_samples)
                        # We need to pass these items to evaluate normally, 
                        # but opik.evaluate takes a dataset object.
                        # Since we can't easily create a temp dataset,
                        # we might need to rely on opik's built-in sampling if available,
                        # OR create a temporary dataset.
                        # For now, let's create a temporary dataset name
                        import uuid
                        temp_name = f"temp_sample_{uuid.uuid4().hex[:8]}"
                        temp_dataset = self.dataset_manager.get_or_create_dataset(temp_name)
                        
                        # Opik requires dicts for insert
                        # Need to convert DatasetItem objects back to dicts if needed
                        # Or just use the items if they are dicts (Opik SDK usually returns objects)
                        
                        # Simplification: If sampling is tricky with Opik SDK directly,
                        # we will skip it for now or implement client-side filtering if task supports it.
                        # Wait, opik.evaluate takes 'dataset' which can be a Dataset object.
                        # If we want to only evaluate a subset, we might need to rely on the task wrapper to skip?
                        # No, that's inefficient.
                        
                        # Let's try simpler approach:
                        # Pass dataset as list of items if opik.evaluate supports it.
                        # Checking opik docs: evaluate(dataset=...) expects Dataset object or name.
                        
                        # Workaround: Just log a warning and use full dataset for now if sampling is hard,
                        # BUT wait, we can create a temporary dataset!
                        
                        # ACTUALLY, checking Opik SDK source suggests evaluate might accept list of items too?
                        # If not, creating a temp dataset is the safest way.
                        
                        insert_items = []
                        for item in sampled_items:
                            # Convert item to dict
                            item_dict = {
                                "input": getattr(item, "input", "") or item.get("input"),
                                "expected_output": getattr(item, "expected_output", "") or item.get("expected_output"),
                                # Add other fields if necessary
                            }
                            # Preserve other fields
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
