# Opik Evaluation Integration Analysis & Next Steps

## 🚨 Current Issue: Evaluation Timeout

### Symptom
When calling `POST /api/evaluate/run`, the request times out (connection reset) or hangs indefinitely, even when `max_samples=1` is used.

### Root Cause Analysis
1. **Synchronous Blocking in Async Loop**:
   - The FastAPI app runs on `uvicorn` (Asynchronous Event Loop).
   - The Opik SDK's `evaluate()` function is synchronous and blocking.
   - The RAG chain (`query_rag_chain_sync`) involves heavy computations (Vector Search + LLM Generation).
   - Running heavy synchronous code directly within an async route blocks the event loop, causing heartbeats to fail or requests to time out.

2. **RAG Chain Compatibility**:
   - The `ChatGoogleGenerativeAI` class from LangChain may have internal async dependencies that conflict when forced to run synchronously inside an already running event loop (`uvicorn`'s loop).

3. **Execution Time**:
   - A single evaluation metrics calculation (LLM-as-Judge) combined with RAG generation takes 10~30 seconds. This exceeds typical HTTP client timeouts for synchronous requests.

### ✅ What Works
- **Manual Script (`test_manual_eval.py`)**:
  - Running evaluation via a standalone Python script works perfectly.
  - Opik SDK connects, logs traces, and updates the dashboard correctly.
- **Lightweight Metrics**:
  - Heuristic metrics (Contains, IsJson) work fine as they don't involve extra LLM calls.

---

## 🛠️ Proposed Solution (Next Steps)

### Phase 1: Immediate Fix (Lightweight API)
- **Current Status**: Implemented `max_samples` and `use_heavy_metrics` options.
- **Action**: Use `max_samples=1` and `use_heavy_metrics=False` for quick API checks.
- **Recommendation**: For heavy evaluation, DO NOT use the API directly. Use a CLI script.

### Phase 2: Asynchronous Queue (Recommended Fix)
To support full evaluation via API, we need to decouple execution from the HTTP request.

1. **Architecture Change**:
   - **Frontend**: Sends `POST /api/evaluate/run` -> receives `202 Accepted` + `task_id`.
   - **Backend**: Pushes the evaluation task to a background queue (Celery + Redis).
   - **Worker**: A separate process picks up the task and runs `opik.evaluate()`.
   - **Frontend**: Polls `GET /api/evaluate/status/{task_id}` for completion.

2. **Alternative (BackgroundTasks)**:
   - Use FastAPI's `BackgroundTasks` to run evaluation after returning the response.
   - *Note*: This might still block the event loop if not run in a separate thread pool (`run_in_threadpool`).

### 📝 Action Items for Tomorrow
1. [ ] Create a dedicated CLI script `apps/api/scripts/run_eval.py` for running heavy evaluations manually.
2. [ ] (Optional) Implement a simple BackgroundTask + ThreadPoolExecutor solution in `evaluate.py` to prevent blocking.
   ```python
   from fastapi.concurrency import run_in_threadpool
   
   @router.post("/run")
   async def run_eval(background_tasks: BackgroundTasks):
       background_tasks.add_task(run_in_threadpool, blocking_evaluation_function)
       return {"message": "Evaluation started in background"}
   ```
