import os
import asyncio
from typing import Dict
from dotenv import load_dotenv

# Load env vars
load_dotenv("c:/sihyun/kaist/encode_hackathon_2/iUM/apps/api/.env")

# Mock dependencies
from utils.opik_evaluation import get_dataset_manager, get_heuristic_metrics
from opik import evaluate

def mock_task(dataset_item: Dict) -> Dict:
    """Mock evaluation task"""
    return {
        "input": dataset_item.get("input", ""),
        "output": "This is a mock output.",
        "expected_output": dataset_item.get("expected_output", ""),
        "context": ["Mock context"],
    }

def run_test():
    print("1. Checking Environment...")
    if not os.getenv("OPIK_API_KEY"):
        print("ERROR: OPIK_API_KEY not found!")
        return

    print("2. Getting Dataset...")
    dm = get_dataset_manager()
    dataset = dm.get_or_create_dataset("iUM_test")
    if not dataset:
        print("ERROR: Failed to get dataset")
        return
    print(f"   Dataset found: {dataset.name}")

    print("3. Running Evaluation (Heuristic)...")
    try:
        metrics = get_heuristic_metrics()
        print(f"   Metrics loaded: {len(metrics)}")
        
        result = evaluate(
            dataset=dataset,
            task=mock_task,
            scoring_metrics=metrics,
            experiment_name="manual_test_run",
            verbose=True
        )
        print("4. SUCCESS!")
        print(f"   Experiment ID: {result.experiment_id}")
    except Exception as e:
        print(f"5. FAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
