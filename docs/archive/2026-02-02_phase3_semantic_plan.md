# Phase 3: Semantic Memory (장기 사용자 프로필)

> **상태**: ✅ 구현 완료  
> **날짜**: 2026-02-02  
> **관련 Walkthrough**: [2026-02-02_phase3_semantic_walkthrough.md](./2026-02-02_phase3_semantic_walkthrough.md)

---

Phase 2 (Episodic Memory)가 완료되어 대화 이력이 Supabase에 영구 저장됩니다.
Phase 3에서는 **장기 사용자 프로필**을 구축하여 개인화된 학습 경험을 제공합니다.

## 목표

- 사용자별 학습 스타일, 선호도 추적
- 자주 묻는 주제, 관심 분야 기록
- 응답 시 사용자 프로필 기반 맞춤화

---

## Proposed Changes

### Database (Supabase)

#### [NEW] migrations/004_create_user_profiles_table.sql

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    learning_style TEXT DEFAULT 'textual',
    expertise_level TEXT DEFAULT 'beginner',
    preferred_language TEXT DEFAULT 'ko',
    interests JSONB DEFAULT '[]',
    frequent_topics JSONB DEFAULT '[]',
    preferences JSONB DEFAULT '{}',
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Backend (apps/api)

#### [NEW] utils/semantic_memory.py

- `UserProfile` dataclass
- `SemanticMemory` class with Supabase integration
- Profile load/save/update methods

#### [MODIFY] utils/memory_manager.py

- SemanticMemory integration
- `get_full_context()` method
- `get_expertise_level()` helper

#### [MODIFY] utils/rag_chain.py

- Added `user_profile` to prompt template
- Added `user_profile_context` parameter to `query_rag_chain()`

#### [MODIFY] routers/agent.py

- Retrieves user profile context
- Passes profile to RAG chain

---

## Implementation Priority ✅

1. **Migration 파일 생성** ✅
2. **SemanticMemory 클래스 구현** ✅
3. **MemoryManager 통합** ✅
4. **RAG 프롬프트 업데이트** ✅
5. **agent.py 업데이트** ✅
