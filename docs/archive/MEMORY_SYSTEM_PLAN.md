# iUM 메모리 시스템 개선 계획

## 문제 정의

현재 iUM 에이전트의 메모리 시스템은 다음과 같은 한계가 있습니다:

1. **무상태(Stateless) 백엔드**: 매 요청이 독립적으로 처리되어 이전 대화 내용을 참조하지 않음
2. **휘발성 프론트엔드 메모리**: Zustand로만 관리되어 브라우저 새로고침 시 삭제
3. **Multi-turn 대화 미지원**: 이전 대화 맥락이 LLM에 전달되지 않음
4. **영구 저장 없음**: Supabase와의 대화 이력 동기화 미구현

---

## 제안: 3계층 하이브리드 메모리 시스템

Claude의 `CLAUDE.md`에서 영감을 받아, 다음과 같은 **3계층 메모리 구조**를 제안합니다:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: Working Memory                      │
│                 (Short-term, 최근 N개 메시지)                     │
│          ConversationBufferWindowMemory (k=10)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Layer 2: Episodic Memory                      │
│            (Session-level, 대화 요약 + 핵심 지식)                  │
│              ConversationSummaryBufferMemory                    │
│               + Supabase 영구 저장                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Layer 3: Semantic Memory                       │
│          (Long-term, 사용자 프로필 + 학습 히스토리)                 │
│              user_memory.md + VectorStore                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proposed Changes

### Backend (apps/api)

---

#### [NEW] utils/memory_manager.py

**역할**: 3계층 메모리 시스템 관리자

**주요 기능**:
- `WorkingMemory`: 최근 10개 메시지 버퍼 (세션 내 즉시 사용)
- `EpisodicMemory`: 세션별 대화 요약 저장/로드
- `SemanticMemory`: 사용자별 장기 학습 프로필 관리
- `MemoryManager`: 통합 인터페이스

```python
class MemoryManager:
    def __init__(self, user_id: str, folder_id: str):
        self.working = WorkingMemory(k=10)
        self.episodic = EpisodicMemory(user_id, folder_id)
        self.semantic = SemanticMemory(user_id)
    
    async def add_message(self, message: ChatMessage):
        """모든 메모리 레이어에 메시지 추가"""
        
    async def get_context(self) -> str:
        """RAG 체인에 전달할 통합 컨텍스트 생성"""
        
    async def save_session(self):
        """세션 종료 시 요약 저장 (Supabase)"""
```

---

#### [NEW] utils/user_memory.py

**역할**: 사용자별 장기 메모리 관리 (Claude.md 스타일)

**주요 기능**:
- 사용자별 `user_memory.md` 파일 관리
- 학습 스타일, 선호도, 자주 묻는 주제 추적
- 자동 프로필 업데이트

---

#### [MODIFY] utils/rag_chain.py

**변경 사항**:
1. `query_rag_chain` 함수에 메모리 컨텍스트 통합
2. 프롬프트 템플릿에 대화 히스토리 섹션 추가
3. 응답 후 메모리 업데이트 로직 추가

```python
# Before
async def query_rag_chain(question: str, ...):
    # 단일 질문만 처리

# After  
async def query_rag_chain(
    question: str,
    memory_manager: Optional[MemoryManager] = None,
    ...
):
    # 메모리에서 대화 컨텍스트 가져오기
    conversation_context = ""
    if memory_manager:
        conversation_context = await memory_manager.get_context()
    
    # 프롬프트에 대화 히스토리 포함
    prompt = f"""
## Previous Conversation Context
{conversation_context}

## Current Question
{question}

## Retrieved Documents
{context}
"""
```

---

#### [MODIFY] routers/agent.py

**변경 사항**:
1. 요청 시 `user_id` 파라미터 추가
2. 메모리 매니저 인스턴스 생성/관리
3. 응답 후 메모리 저장

---

#### [NEW] migrations/create_chat_history_table.sql

**역할**: Supabase에 대화 이력 테이블 생성

```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    folder_id TEXT,
    summary TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Frontend (apps/web)

---

#### [MODIFY] lib/store.ts

**변경 사항**:
- `loadChatHistory`: Supabase에서 이전 대화 로드
- `saveChatHistory`: 대화 종료 시 저장

---

#### [MODIFY] lib/api.ts

**변경 사항**:
- 채팅 요청에 `user_id` 포함
- 대화 히스토리 API 연동

---

## 핵심 이점

| 기존 | 개선 후 |
|------|---------|
| 매 요청 독립 | 이전 대화 맥락 유지 |
| 새로고침 시 소실 | Supabase 영구 저장 |
| 동일 질문 반복 응답 | 사용자 맞춤 응답 |
| 세션 간 정보 단절 | 장기 학습 프로필 구축 |

---

## Verification Plan

### Automated Tests

현재 프로젝트에는 자동화된 테스트가 없어 새로 추가해야 합니다:

```bash
# 새로운 테스트 파일 생성 후 실행
cd apps/api
python -m pytest tests/test_memory_manager.py -v
```

### Manual Verification

1. **Working Memory 테스트**:
   - 서버 실행: `uvicorn main:app --reload --port 8000`
   - 동일 세션에서 3개 이상의 연속 질문
   - 3번째 응답에서 이전 대화 참조 여부 확인

2. **Episodic Memory 테스트**:
   - 대화 후 브라우저 새로고침
   - 동일 폴더에서 이전 대화 요약이 표시되는지 확인

3. **Supabase 저장 테스트**:
   - Supabase Dashboard에서 `chat_sessions`, `chat_messages` 테이블 확인
   - 대화 내용이 저장되는지 검증

---

## User Review Required

> [!IMPORTANT]
> 다음 사항에 대한 결정이 필요합니다:

1. **메모리 저장 위치**: Supabase만 사용할지, 로컬 파일도 병행할지?
2. **대화 히스토리 범위**: 최근 10개 메시지가 적절한지, 더 적게/많게?
3. **사용자 프로필 자동 생성**: 자동으로 학습 프로필을 업데이트할지, 명시적 저장만 할지?
4. **구현 우선순위**: 전체 구현 vs 핵심 기능만 먼저?

---

## Implementation Priority

추천 순서:

1. **Phase 1**: Working Memory (즉시 효과, 변경 적음)
2. **Phase 2**: Supabase 저장 (영구성 확보)
3. **Phase 3**: Semantic Memory (장기 프로필)
