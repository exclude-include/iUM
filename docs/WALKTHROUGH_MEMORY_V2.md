# iUM Memory System v2 & Opik Integration Walkthrough

## Overview
This update introduces two major features to the iUM platform:
1.  **Memory System v2**: Persistent conversation history using Supabase, enabling multi-turn context retention.
2.  **Opik Integration**: Comprehensive evaluation pipeline using Comet Opik for RAG system assessment.

---

## 1. Memory System v2 Implementation

### Database Schema (Supabase)
We migrated from stateless interaction to a persistent memory model.
-   **`chat_sessions` Table**: Stores session metadata (id, user_id, title, folder_id).
-   **`chat_messages` Table**: Stores conversation logs (role, content, metadata).
-   **RLS Policies**: Implemented Row Level Security to ensure users can only access their own data.
    -   *Note*: During development with `mock-user-id`, foreign key constraints were relaxed to allow testing.

### Backend Architecture
-   **`MemoryManager` (`utils/memory_manager.py`)**:
    -   Handles CRUD operations for sessions and messages.
    -   Implements 3-tier memory architecture (Sensory -> Working -> Episodic).
    -   Retrieves formatted history context for LLM injection.

-   **Agent Integration (`routers/agent.py`)**:
    -   Automatically creates sessions on first message.
    -   Persists User and Assistant messages asynchronously.
    -   Handles streaming responses while ensuring data integrity.

-   **Prompt Engineering (`utils/rag_chain.py`)**:
    -   Injected `Conversation History` into the Feynman Tutor prompt.
    -   **Critical Fix**: Implemented safety mechanisms to escape curly braces `{}` in history content, preventing `PromptTemplate` formatting errors that previously caused context loss.

### Verification
-   **Test Script**: `tests/manual_test_memory.py`
-   **Result**: `✅ PASSED: Memory successfully recalled context.`
    -   The system correctly recalled user preferences ("My favorite color is blue") across separate API requests.

---

## 2. Opik Evaluation Integration

### Features
-   **Evaluation Dataset**: Scripts to generate and manage evaluation datasets (`iUM_RAG_Evaluation`) in Opik.
-   **Evaluation Endpoint**: `POST /api/evaluate/run` triggers a comprehensive evaluation job.
-   **Metrics**:
    -   **Context Recall**: Measures if the retrieved documents contain the answer.
    -   **Answer Relevance**: Measures if the generated answer addresses the question.
    -   **Hallucination**: Checks for faithfulness to the context.

### Usage
-   Run evaluation: `curl -X POST http://localhost:8000/api/evaluate/run`
-   Check status: `curl http://localhost:8000/api/evaluate/jobs`

---

## Conclusion
The iUM agent now possesses both **long-term memory** and **self-evaluation capabilities**, significantly enhancing its conversational depth and reliability.
