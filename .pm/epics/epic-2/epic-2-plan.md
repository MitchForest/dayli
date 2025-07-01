# Epic 2: AI Chat Interface & Mock Data Implementation

## Epic Overview

**Duration**: 2 weeks (10 working days)  
**Goal**: Build a fully functional AI chat interface with mock data that demonstrates the core dayli experience - an AI assistant that manages your schedule, triages emails, and helps you focus on what matters today.

## Success Criteria

1. **Functional AI Chat Interface**
   - Resizable chat panel (25%, 33%, 50% snap points)
   - Natural language command processing
   - Streaming responses with loading states
   - Command suggestions and examples
   - Context-aware responses using RAG

2. **Rich Mock Data System**
   - 7 days of realistic schedule data (past 3, today, future 3)
   - 100+ mock emails with varying importance/urgency
   - 30+ backlog tasks across different categories
   - Realistic meeting patterns and recurring events
   - Gmail/Calendar API-compatible format

3. **Interactive Schedule Management**
   - Click time blocks to view/edit contents
   - Add/remove tasks from deep work blocks
   - Complete tasks with visual feedback
   - Email queue management during triage blocks

4. **Working Email Triage**
   - Process emails with AI assistance
   - Quick decisions: now/tomorrow/never
   - Email → task conversion
   - Bulk actions and smart filtering

5. **AI-Powered Features**
   - Daily planning workflow
   - Schedule optimization
   - Task prioritization and assignment
   - Natural language schedule modifications
   - Context-aware suggestions via RAG

## Technical Architecture

### Core Technologies
- **UI Framework**: Next.js with React
- **Chat UI**: Vercel AI SDK
- **Workflow Engine**: LangGraph.js
- **State Management**: Zustand
- **Data Layer**: Supabase with PostgreSQL
- **Vector Storage**: pgvector for RAG
- **Embeddings**: OpenAI text-embedding-3-small
- **Styling**: Tailwind CSS
- **Panel Management**: react-resizable-panels

### Architecture Diagram
```
┌─────────────────────┐     ┌─────────────────────┐
│   Chat Panel (25%)  │     │  Schedule Canvas    │
│   - AI SDK useChat  │     │  - Infinite scroll  │
│   - Message list    │     │  - Time blocks      │
│   - Input area      │     │  - Interactive      │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └─────────┬─────────────────┘
                     │
                     ▼
           ┌─────────────────────┐
           │   Next.js API       │
           │   - Chat endpoint   │
           │   - LangGraph flows │
           │   - Mock Gmail API  │
           │   - Mock Calendar   │
           └─────────┬───────────┘
                     │
                     ▼
           ┌─────────────────────┐
           │   Data Layer        │
           │   - Supabase DB     │
           │   - pgvector RAG    │
           │   - Mock services   │
           │   - State stores    │
           └─────────────────────┘
```

## Sprint Breakdown

### Sprint 1: Foundation & Data Layer (Days 1-3)

**Goal**: Set up database schema with pgvector, mock data generation, and Gmail/Calendar-compatible APIs

#### Key Deliverables
1. **Database Schema with Vector Support**
   - Migration for tasks, emails, time_blocks, daily_schedules
   - pgvector extension setup
   - Embeddings table for RAG storage
   - User context and patterns tables
   - Proper relationships and indexes
   - RLS policies for security

2. **Gmail/Calendar Compatible Mock System**
   ```typescript
   // Gmail API compatible structure
   interface GmailMessage {
     id: string;
     threadId: string;
     labelIds: string[];
     snippet: string;
     payload: {
       headers: Array<{name: string; value: string}>;
       body: {data: string};
       parts?: Array<{...}>;
     };
     internalDate: string;
   }
   
   // Calendar API compatible structure
   interface CalendarEvent {
     id: string;
     summary: string;
     start: {dateTime: string; timeZone: string};
     end: {dateTime: string; timeZone: string};
     attendees?: Array<{email: string; responseStatus: string}>;
     recurrence?: string[];
   }
   ```

3. **RAG Infrastructure**
   - Embedding generation pipeline
   - Vector similarity search functions
   - Context storage for user patterns
   - Historical decision tracking

4. **Mock API Endpoints**
   - `/api/mock/gmail/messages` - Gmail API compatible
   - `/api/mock/calendar/events` - Calendar API compatible
   - Easy switch mechanism for real APIs later

### Sprint 2: UI Components & Daily Planning (Days 4-5)

**Goal**: Build the resizable panel layout, chat interface, and daily planning workflow

#### Key Deliverables
1. **Resizable Panel Layout**
   - Integrate react-resizable-panels
   - Implement 25%/33%/50% snap points
   - Persist panel size preference
   - Smooth resize animations

2. **Chat Interface Components**
   - Message list with user/assistant bubbles
   - Streaming message support
   - Input area with send button
   - Loading indicators
   - Command suggestions UI
   - Error states

3. **Daily Planning Workflow Components**
   - Morning routine trigger UI
   - Schedule template visualization
   - Block type indicators:
     - 🎯 Deep Work blocks (2-4 hours)
     - ✉️ Email Triage blocks (30 min morning/evening)
     - 🍽️ Break blocks (lunch, short breaks)
     - 🚫 Blocked time (no meetings)
     - 📅 Open meeting slot (for last-minute needs)
   - Task suggestion interface

4. **Enhanced Time Blocks**
   - Block type-specific styling
   - Interactive task management
   - Visual capacity indicators
   - Drag-to-reschedule preview

### Sprint 3: Core Functionality & Workflows (Days 6-7)

**Goal**: Implement email triage, daily planning workflow, and schedule management

#### Key Deliverables
1. **Daily Planning Workflow (LangGraph)**
   ```typescript
   const dailyPlanningWorkflow = new StateGraph({
     channels: {
       userPreferences: null,
       existingMeetings: null,
       unreadEmails: null,
       backlogTasks: null,
       generatedSchedule: null
     }
   })
   .addNode("fetchUserContext", fetchFromRAG)
   .addNode("analyzeMeetings", analyzeMeetingLoad)
   .addNode("generateTimeBlocks", createOptimalBlocks)
   .addNode("assignTasks", prioritizeAndAssign)
   .addNode("protectCalendar", blockCalendarTime)
   ```

2. **Schedule Generation Logic**
   - Analyze existing meetings
   - Place email triage blocks (morning/evening)
   - Add deep work blocks (2-4 hour chunks)
   - Insert break blocks (lunch, short breaks)
   - Create "open meeting" buffer slot
   - Block remaining time from new meetings

3. **Email Triage System**
   - Email importance scoring
   - Quick action interface
   - Batch processing during triage blocks
   - Smart categorization using embeddings

4. **Task Assignment**
   - Pull from backlog based on priority
   - Match tasks to available deep work blocks
   - Consider task duration and complexity
   - Leave buffer for overruns

### Sprint 4: AI Integration & RAG (Days 8-9)

**Goal**: Integrate AI SDK, implement RAG system, and enhance LangGraph workflows

#### Key Deliverables
1. **pgvector RAG Implementation**
   - Embed user interactions and decisions
   - Store scheduling patterns
   - Track email handling preferences
   - Build context retrieval system
   ```sql
   -- RAG tables
   CREATE TABLE embeddings (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users,
     content TEXT,
     embedding vector(1536),
     metadata JSONB,
     created_at TIMESTAMPTZ
   );
   
   CREATE INDEX ON embeddings 
   USING ivfflat (embedding vector_cosine_ops);
   ```

2. **Enhanced LangGraph Workflows**
   - Context-aware email triage
   - Pattern-based schedule optimization
   - Learning from user overrides
   - Predictive task scheduling

3. **Natural Language Commands**
   - RAG-enhanced understanding
   - Context-aware responses
   - Historical pattern recognition
   - Personalized suggestions

4. **AI Features with Memory**
   - Remember email sender patterns
   - Learn optimal focus times
   - Adapt to meeting preferences
   - Suggest based on past behavior

### Sprint 5: Polish & Testing (Day 10)

**Goal**: Polish the experience, ensure API compatibility, and prepare for real data switch

#### Key Deliverables
1. **API Compatibility Testing**
   - Verify Gmail API format matching
   - Test Calendar API compatibility
   - Create switching mechanism
   - Document migration path

2. **UX Polish**
   - Morning planning flow
   - Smooth block transitions
   - Loading states
   - Empty states
   - Keyboard shortcuts

3. **RAG Optimization**
   - Tune embedding parameters
   - Optimize vector searches
   - Test context relevance
   - Performance benchmarks

4. **Documentation**
   - API migration guide
   - Daily planning workflow docs
   - RAG system architecture
   - Mock data specifications

## Key Workflows

### Daily Planning Workflow (Morning Routine)
1. **Trigger**: User opens app in the morning or clicks "Plan My Day"
2. **Analysis Phase**:
   - Fetch existing calendar events
   - Check unread email count
   - Review incomplete tasks from yesterday
   - Retrieve user patterns from RAG
3. **Generation Phase**:
   - Place fixed meetings
   - Add morning email triage (30 min)
   - Insert deep work blocks (2-4 hours each)
   - Add lunch break
   - Place evening email triage
   - Create one "open meeting" slot
   - Block remaining time
4. **Task Assignment**:
   - Analyze backlog priorities
   - Match tasks to deep work blocks
   - Suggest 2-3 tasks per block
   - Consider task dependencies
5. **Calendar Protection**:
   - Block all assigned time in calendar
   - Mark as "Busy" or "Do Not Disturb"
   - Leave open slot available

### Email Triage Workflow
1. **During Triage Block**:
   - AI presents emails by importance
   - Quick decisions: Now/Tomorrow/Never
   - "Now" → Create task in today's blocks
   - "Tomorrow" → Add to tomorrow's queue
   - "Never" → Archive/Unsubscribe
2. **RAG Enhancement**:
   - Remember sender importance
   - Learn response patterns
   - Predict action needed

## Mock Data Specifications

### Gmail API Compatible Structure
```typescript
// Matches Gmail API v1 format
interface MockGmailAPI {
  messages: {
    list: (params: {userId: string; q?: string}) => Promise<{
      messages: Array<{id: string; threadId: string}>;
      nextPageToken?: string;
    }>;
    get: (params: {userId: string; id: string}) => Promise<GmailMessage>;
  };
}
```

### Calendar API Compatible Structure
```typescript
// Matches Google Calendar API v3 format
interface MockCalendarAPI {
  events: {
    list: (params: {
      calendarId: string;
      timeMin: string;
      timeMax: string;
    }) => Promise<{
      items: CalendarEvent[];
      nextPageToken?: string;
    }>;
    insert: (params: {calendarId: string; resource: CalendarEvent}) => Promise<CalendarEvent>;
  };
}
```

## RAG System Architecture

### Embedding Strategy
1. **What to Embed**:
   - User commands and interactions
   - Email triage decisions
   - Task completion patterns
   - Schedule modifications
   - Time preferences

2. **Retrieval Context**:
   - Last 7 days of patterns
   - Similar past situations
   - User preference evolution
   - Decision history

3. **Usage in Workflows**:
   - Enhance email importance scoring
   - Improve task prioritization
   - Personalize schedule generation
   - Predict user needs

## Migration Path to Real APIs

### Phase 1: Mock APIs (Epic 2)
- Full Gmail/Calendar API compatibility
- Local data storage
- Instant responses

### Phase 2: Hybrid Mode (Future)
- Real API calls with caching
- Fallback to mock data
- Progressive enhancement

### Phase 3: Full Integration (Future)
- Direct Gmail/Calendar access
- Real-time sync
- Offline support

## Updated Risk Mitigation

### New Risks
1. **RAG Performance**
   - Mitigation: Limit context window
   - Index optimization
   - Caching strategies

2. **API Compatibility**
   - Mitigation: Extensive testing
   - Type checking
   - Version documentation

3. **Daily Planning Complexity**
   - Mitigation: Simple rules first
   - User override options
   - Iterative improvement

## Definition of Done

### Epic Completion Criteria
- [ ] All success criteria met
- [ ] Daily planning workflow functional
- [ ] RAG system providing context
- [ ] Mock APIs match Gmail/Calendar format
- [ ] Seamless morning routine experience
- [ ] Demo ready with realistic data
- [ ] Migration path documented
- [ ] Performance: <100ms RAG queries
- [ ] Calendar protection working 