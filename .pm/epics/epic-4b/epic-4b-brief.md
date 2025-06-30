# Epic 4b: RAG & Intelligent Features Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**Target End Date**: [TBD + 1 week]  
**Actual End Date**: [TBD]

**Epic Goal**: Implement RAG (Retrieval-Augmented Generation) using Supabase pgvector to give dayli memory and context-awareness, enabling intelligent chat responses and pattern-based scheduling improvements.

**User Stories Addressed**:
- Story 5: AI Assistant Control - Full natural language control with context
- Story 1: Morning Planning - Improved suggestions based on historical patterns
- Hidden intelligence that makes all features smarter over time

**PRD Reference**: [Link to dayli PRD - Epic 4b section]

## Sprint Breakdown

| Sprint # | Sprint Name | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|--------|------------|----------|-----------------|
| 04b.00 | pgvector Setup & Schema | NOT STARTED | - | - | Vector storage ready |
| 04b.01 | Embedding Pipeline | NOT STARTED | - | - | Daily patterns stored |
| 04b.02 | RAG Implementation | NOT STARTED | - | - | Context-aware responses |
| 04b.03 | Intelligent Features | NOT STARTED | - | - | Pattern-based improvements |

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
- Supabase pgvector stores embeddings of daily patterns
- OpenAI generates embeddings for storage and search
- RAG pipeline enhances chat responses and scheduling
- Historical data improves without being shown to user

### Key Design Decisions
1. **Vector Storage**: pgvector in Supabase vs dedicated service
   - Alternatives considered: Pinecone, Weaviate, Chroma
   - Rationale: Already using Supabase, simpler architecture
   - Trade-offs: Less specialized but good enough for MVP

2. **Embedding Strategy**: Daily summaries vs individual events
   - Alternatives considered: Embed every email/task
   - Rationale: Aligns with POV, reduces storage, better patterns
   - Trade-offs: Less granular but more meaningful

3. **Context Window**: Last 30 days of patterns
   - Alternatives considered: All history, last 7 days
   - Rationale: Enough for patterns, not overwhelming
   - Trade-offs: Might miss seasonal patterns

4. **Privacy First**: No email content in embeddings
   - Alternatives considered: Full email embeddings
   - Rationale: Privacy, security, storage efficiency
   - Trade-offs: Less context but better trust

### Dependencies
**External Dependencies**:
- pgvector extension (already in Supabase)
- openai embeddings API (existing dependency)

**Internal Dependencies**:
- Requires: Workflows from Epic 4a, Chat from Epic 2
- Provides: Enhanced intelligence for all features

## Implementation Notes

### File Structure for Epic
```
apps/web/
├── app/
│   └── api/
│       └── rag/
│           ├── embed/
│           │   └── route.ts      # Create embeddings
│           ├── search/
│           │   └── route.ts      # Vector search
│           └── daily-summary/
│               └── route.ts      # Store daily patterns
├── lib/
│   ├── rag/
│   │   ├── embeddings.ts        # Embedding generation
│   │   ├── vectorStore.ts       # pgvector operations
│   │   ├── retrieval.ts         # Search & retrieve
│   │   └── prompts.ts           # RAG-enhanced prompts
│   ├── patterns/
│   │   ├── daily.ts             # Daily pattern extraction
│   │   ├── email.ts             # Email response patterns
│   │   └── scheduling.ts        # Time preference patterns
│   └── ai/
│       └── contextual.ts        # Context-aware responses
├── components/
│   └── chat/
│       └── ChatInterface.tsx    # Enhanced with RAG
└── supabase/
    └── migrations/
        └── 004_vector_storage.sql # pgvector tables
```

### API Endpoints Added
| Method | Path | Purpose | Sprint |
|--------|------|---------|--------|
| POST | /api/rag/daily-summary | Store daily patterns | 04b.01 |
| POST | /api/rag/embed | Create embeddings | 04b.01 |
| POST | /api/rag/search | Vector similarity search | 04b.02 |

### Data Model Changes
```sql
-- Supabase pgvector setup
create extension if not exists vector;

create table daily_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  date date not null,
  summary text not null,
  embedding vector(1536), -- OpenAI embedding size
  metadata jsonb,
  created_at timestamptz default now(),
  unique(user_id, date)
);

create table pattern_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  pattern_type text not null, -- 'email', 'schedule', 'focus'
  insight text not null,
  embedding vector(1536),
  confidence float,
  occurrences int default 1,
  last_seen timestamptz default now()
);

-- Vector similarity search index
create index on daily_memories 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

```typescript
// TypeScript types
interface DailyMemory {
  date: string
  summary: string
  metadata: {
    tasksCompleted: number
    focusHours: number
    emailsProcessed: number
    topSenders: string[]
    keyDecisions: string[]
  }
}

interface PatternInsight {
  type: 'email' | 'schedule' | 'focus'
  insight: string
  confidence: number
  examples: string[]
}
```

### Key Functions/Components Created
- `createDailySummary` - Generate end-of-day summary - Sprint 04b.01
- `embedText` - Create OpenAI embeddings - Sprint 04b.01
- `storeMemory` - Save to pgvector - Sprint 04b.01
- `searchSimilar` - Vector similarity search - Sprint 04b.02
- `enhanceWithContext` - Add RAG to responses - Sprint 04b.02
- `extractPatterns` - Find recurring behaviors - Sprint 04b.03
- `improveScheduling` - Use patterns for better plans - Sprint 04b.03

## Sprint Execution Log

### Sprint 04b.00: pgvector Setup & Schema
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 04b.01: Embedding Pipeline
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 04b.02: RAG Implementation
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 04b.03: Intelligent Features
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

## Testing & Quality

### Testing Approach
- Test embedding generation and storage
- Verify vector search returns relevant results
- Test RAG enhancement improves responses
- Measure pattern detection accuracy
- Privacy audit - ensure no PII in embeddings
- Performance testing for vector operations

### Known Issues
| Issue | Severity | Sprint | Status | Resolution |
|-------|----------|--------|--------|------------|
| [TBD] | - | - | - | - |

## Refactoring Completed

### Code Improvements
- [To be tracked during development]

### Performance Optimizations
- [To be tracked during development]

## Learnings & Gotchas

### What Worked Well
- [To be documented]

### Challenges Faced
- [To be documented]

### Gotchas for Future Development
- **Embedding Costs**: Each OpenAI embedding call has a cost
- **Vector Index**: Need to rebuild index as data grows
- **Privacy**: Be extremely careful what goes into embeddings
- [Additional gotchas to be documented]

## Build Testing & Verification

### Epic-End Build Process (MANDATORY)

Before marking Epic 4b as complete:

1. **Clean build test:**
   ```bash
   cd apps/web
   rm -rf .next node_modules/.cache
   bun install
   bun run build
   ```

2. **Database verification:**
   ```bash
   # Check pgvector extension
   # Verify indexes created
   # Test vector operations
   ```

3. **Run quality checks:**
   ```bash
   bun run lint      # MUST return 0 errors, 0 warnings
   bun run typecheck # MUST return 0 errors
   ```

4. **Test embedding pipeline:**
   - Generate daily summary
   - Create embeddings
   - Store successfully
   - No PII in embeddings

5. **Test RAG features:**
   - Ask about past decisions
   - Get context-aware responses
   - Verify relevance
   - Check response quality

6. **Test pattern detection:**
   - Identify email patterns
   - Detect scheduling preferences
   - Improve suggestions

7. **Verification checklist:**
   - [ ] pgvector tables created successfully
   - [ ] Daily summaries generated and stored
   - [ ] Embeddings created without PII
   - [ ] Vector search returns relevant results
   - [ ] RAG improves chat responses
   - [ ] Patterns detected accurately
   - [ ] Schedule suggestions improved
   - [ ] No performance degradation
   - [ ] Privacy maintained throughout
   - [ ] Costs within acceptable range
   - [ ] Storage growth manageable

## Epic Completion Checklist

- [ ] All planned sprints completed and approved
- [ ] pgvector storage fully functional
- [ ] Embedding pipeline operational
- [ ] RAG enhances chat responses
- [ ] Pattern detection working
- [ ] Historical context improves scheduling
- [ ] Privacy requirements met
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Epic summary added to project tracker

## Epic Summary for Project Tracker

**[To be completed at epic end]**

**Delivered Features**:
- [To be documented]

**Key Architectural Decisions**:
- [To be documented]

**Critical Learnings**:
- [To be documented]

**Technical Debt Created**:
- [To be documented]

---

*Epic Started: [Date]*  
*Epic Completed: [Date]*  
*Total Duration: [X days]*