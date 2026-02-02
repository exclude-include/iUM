# Phase 2: Supabase Memory Storage (영구성 확보)

> **상태**: ✅ 구현 완료  
> **날짜**: 2026-02-02  
> **관련 Walkthrough**: [2026-02-02_phase2_memory_walkthrough.md](./2026-02-02_phase2_memory_walkthrough.md)

---

Phase 1 (Working Memory)가 완료되어 세션 내 multi-turn 대화가 가능해졌습니다.
Phase 2에서는 Supabase에 대화 이력을 영구 저장하여, 브라우저 새로고침 후에도 대화를 이어갈 수 있게 합니다.

## Proposed Changes

### Database (Supabase)

---

#### [NEW] migrations/003_create_chat_history_tables.sql

**역할**: 대화 세션 및 메시지 테이블 생성

```sql
-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    summary TEXT,
    message_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_sessions_user_folder ON chat_sessions(user_id, folder_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
```

---

### Backend (apps/api)

---

#### [MODIFY] utils/memory_manager.py

**변경 사항**:
1. `EpisodicMemory` 클래스 추가 - Supabase 저장/로드 담당
2. `MemoryManager`에 Supabase 연동 메서드 추가
3. 세션 시작 시 기존 대화 로드, 종료 시 저장

```python
class EpisodicMemory:
    """Phase 2: Episodic Memory - Supabase persistent storage."""
    
    def __init__(self, user_id: str, folder_id: str):
        self.user_id = user_id
        self.folder_id = folder_id
        self.session_id: Optional[str] = None
        self.supabase = get_supabase_client()
    
    async def load_session(self) -> Optional[List[ChatMessage]]:
        """Load the most recent session for this folder."""
        
    async def save_message(self, message: ChatMessage) -> None:
        """Save a single message to the current session."""
        
    async def close_session(self, summary: str = None) -> None:
        """Close the session with an optional summary."""
```

---

#### [NEW] routers/memory.py

**역할**: 대화 이력 관리 API 엔드포인트

```python
@router.get("/sessions")
async def list_sessions(user_id: str, folder_id: Optional[str] = None):
    """List all chat sessions for a user."""

@router.get("/sessions/{session_id}/messages")  
async def get_session_messages(session_id: str):
    """Get all messages for a specific session."""

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session and all its messages."""
```

---

#### [MODIFY] routers/agent.py

**변경 사항**:
1. 요청에서 `user_id` 파라미터 사용 (기존 folder_id와 함께)
2. 세션 시작 시 이전 대화 로드
3. 메시지 추가 시 Supabase에 실시간 저장

```diff
class ChatRequest(BaseModel):
    message: str
+   user_id: Optional[str] = None
    folder_id: Optional[str] = None
    ...

@router.post("/message")
async def chat_with_agent_stream(request: ChatRequest):
+   # Get memory manager with Supabase integration
+   memory_manager = get_memory_manager(
+       folder_id=request.folder_id,
+       user_id=request.user_id
+   )
+   
+   # Load existing session if any
+   await memory_manager.load_session()
```

---

## Verification Plan

### Automated Tests

```bash
# conda activate encode
cd iUM/apps/api

# Test 1: Create a new session and save messages
python -c "
from utils.memory_manager import MemoryManager
import asyncio

async def test():
    mm = MemoryManager(folder_id='test-folder', user_id='test-user')
    await mm.load_session()
    mm.add_user_message('Hello!')
    await mm.save_current_session()
    print('✅ Session saved')

asyncio.run(test())
"

# Test 2: Load the saved session
python -c "
from utils.memory_manager import MemoryManager
import asyncio

async def test():
    mm = MemoryManager(folder_id='test-folder', user_id='test-user')
    await mm.load_session()
    messages = mm.get_messages()
    print(f'✅ Loaded {len(messages)} messages')
    for msg in messages:
        print(f'  - {msg.role}: {msg.content[:50]}...')

asyncio.run(test())
"
```

### Manual Verification

1. **Supabase Dashboard 확인**:
   - `chat_sessions` 테이블에 새 세션 생성 확인
   - `chat_messages` 테이블에 메시지 저장 확인

2. **브라우저 새로고침 테스트**:
   - 대화 후 페이지 새로고침
   - 이전 대화가 로드되는지 확인

3. **폴더별 세션 격리 확인**:
   - 폴더 A에서 대화
   - 폴더 B로 이동 → 폴더 A 대화가 표시되지 않아야 함
   - 폴더 A로 복귀 → 이전 대화 표시

---

## Implementation Priority

1. **Migration 파일 생성 및 실행** ✅
2. **EpisodicMemory 클래스 구현** ✅
3. **MemoryManager 통합** ✅
4. **agent.py 업데이트** ✅
5. **테스트 및 검증** ⏳ (Migration 실행 필요)
