# Epic 3: AI-First Chat & Intelligent Workflows Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: TBD  
**Target End Date**: TBD  
**Actual End Date**: -

**Epic Goal**: Transform dayli into an AI-first application where all interactions happen through natural language chat, powered by intelligent LangGraph workflows and context-aware RAG system

**User Stories Addressed**:
- Story 1: Morning Planning - "What should I work on today?" with context-aware suggestions
- Story 2: Email to Tasks - Natural language email triage with learning
- Story 3: Protected Focus Time - AI manages calendar intelligently
- Story 4: Quick Decisions - Conversational email processing
- Story 5: AI Assistant Control - Everything through chat, no separate buttons

**PRD Reference**: Evolution from Epic 2 based on learnings - true AI-first approach

## Sprint Breakdown

| Sprint # | Sprint Name | Duration | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|----------|--------|------------|----------|-----------------|
| 03.01 | Core AI Chat & Tools | 2 days | NOT STARTED | - | - | AI SDK chat with basic tools + backlog schema |
| 03.02 | Adaptive Scheduling Workflow | 2 days | NOT STARTED | - | - | Smart scheduling with lunch protection |
| 03.03 | Email Triage & Task Workflows | 2 days | NOT STARTED | - | - | Two-dimensional email triage |
| 03.04 | RAG System & Learning | 2 days | NOT STARTED | - | - | Pattern learning & context awareness |
| 03.05 | Gmail & Calendar API Integration | 2 days | NOT STARTED | - | - | Real API integration with OAuth |
| 03.06 | Change Preview & UX Polish | 2 days | NOT STARTED | - | - | Visual previews and polish |

**Total Duration**: 12 days

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
```
┌─────────────────────────────────────────┐
│           Chat Interface                 │
│      (AI SDK useChat + streaming)       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      AI Orchestration Layer             │
│  ┌─────────────────────────────────┐   │
│  │ • streamText with tools         │   │
│  │ • maxSteps for chaining         │   │
│  │ • Routing based on context      │   │
│  │ • Parallel tool execution       │   │
│  │ • onStepFinish callbacks        │   │
│  └─────────────────────────────────┘   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│     LangGraph Workflows (Tools)         │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ │
│  │Adaptive │ │ Email   │ │   Task   │ │
│  │Schedule │ │ Triage  │ │Prioritize│ │
│  └─────────┘ └─────────┘ └──────────┘ │
│  ┌─────────┐ ┌─────────┐              │
│  │Optimize │ │ Review  │              │
│  │Schedule │ │  Day    │              │
│  └─────────┘ └─────────┘              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│          RAG Context Layer              │
│    (pgvector + Embedding Service)       │
└─────────────────────────────────────────┘
```

### Key Design Decisions

1. **Hybrid AI SDK + LangGraph Architecture**
   - Alternatives considered: Pure LangGraph, Pure AI SDK
   - Rationale: Best of both - AI SDK's streaming UX + LangGraph's workflow power
   - Trade-offs: Slightly more complex integration, but much more flexible

2. **Workflows as Tools**
   - Alternatives considered: Separate workflow triggers, button-based UI
   - Rationale: Natural language is the primary interface
   - Trade-offs: Need good intent detection, but better UX

3. **Change Proposal System**
   - Alternatives considered: Direct application of changes, undo system
   - Rationale: Builds trust, gives control, enables learning from rejections
   - Trade-offs: Extra step in flow, but critical for user confidence

4. **Multi-Layer RAG**
   - Alternatives considered: Simple keyword search, no memory
   - Rationale: Context-aware responses improve over time
   - Trade-offs: More complex to implement, but essential for intelligence

5. **AI-Managed Preferences (No Settings UI)**
   - Alternatives considered: Manual settings page, hybrid approach
   - Rationale: True AI assistant learns and adapts without manual configuration
   - Trade-offs: Less direct control, but aligns with "AI decides" philosophy

### Dependencies
**External Dependencies**:
- `ai`: ^3.0.0 - Vercel AI SDK for chat and streaming
- `@langchain/langgraph`: ^0.2.0 - Workflow orchestration
- `openai`: ^4.0.0 - LLM and embeddings
- `zod`: ^3.0.0 - Schema validation for tools

**Internal Dependencies**:
- Requires: Database schema and mock data from Epic 2
- Provides: Complete AI-first experience replacing Epic 2's approach

## Sprint Details

### Sprint 03.01: Core AI Chat & Tools (2 days)

**Goal**: Replace button-based interactions with AI chat that can execute actions

**Key Deliverables**:
1. Refactor chat endpoint to use `streamText` with tools
   - Implement `maxSteps` for multi-step operations
   - Add `onStepFinish` callbacks for progress updates
   - Enable parallel tool execution
2. **NEW: Implement ServiceFactory for data-source agnostic architecture**
   - Create service interfaces for Gmail, Calendar, Schedule, Tasks
   - Factory pattern returns appropriate implementation
   - Enables seamless transition to real APIs in Sprint 03.05
3. Implement basic CRUD tools:
   - `createTimeBlock`
   - `moveTimeBlock` 
   - `deleteTimeBlock`
   - `assignTaskToBlock`
   - `completeTask`
   - `getSchedule`
   - `getUnassignedTasks`
4. Implement orchestration patterns:
   - **Routing**: Context-aware tool selection
   - **Parallel Processing**: Multiple tools at once
   - **Structured Outputs**: Answer tool pattern
5. Remove "Plan My Day" button
6. Update chat UI to show:
   - Tool executions in real-time
   - Progress indicators for multi-step operations
   - Which tools are being used
7. Advanced system prompt with:
   - Time-aware routing (morning vs afternoon)
   - User state detection
   - Intent classification
8. **Database Schema Updates** for backlogs:
   - Add `task_backlog` table with priority/urgency scoring
   - Add `email_backlog` table with category and aging
   - Update `user_preferences` with break schedule and open time preferences
   - Migration scripts for new tables
9. **Remove Manual Settings UI**:
   - Remove settings page (keep route returning "AI manages your preferences")
   - Keep database preferences structure but make it AI-managed only
   - Add tools for AI to update preferences based on behavior
   - Natural language preference updates ("I prefer lunch at 11 now")

**Success Criteria**:
- User can create/modify schedule through chat
- Tool executions visible in UI with progress
- AI can chain multiple tools intelligently
- Context-aware responses based on time/state
- Backlog tables created and functional

### Sprint 03.02: Adaptive Scheduling Workflow (2 days)

**Goal**: Create intelligent scheduling that adapts to current state

**Key Deliverables**:
1. `createAdaptiveSchedulingWorkflow` with nodes:
   - `fetchRAGContext` - Get user patterns first
   - `analyzeCurrentState` - What's already scheduled
   - `determineStrategy` (router node) - Smart routing based on state
   - `generateTimeBlocks` - Only if needed
   - `protectBreakTime` - Ensure lunch break
   - `assignTasksToBlocks` - Smart task distribution
   - `pullFromBacklog` - Consider high-priority backlog tasks
   - `validateSchedule` - Conflict checking
   - `generateTextSummary` - Return changes as text
2. Strategies: 
   - **Full planning**: Empty calendar
   - **Partial planning**: Add to existing
   - **Task assignment**: Just assign to blocks
   - **Optimization**: Rearrange for efficiency
3. **Simplified Break Management**:
   - Default lunch break (12-1pm or learned)
   - Auto-protect lunch in calendar
   - Learn actual break patterns over time
4. **Basic Calendar Protection**:
   - All scheduled blocks auto-decline invites
   - Simple block types: focus, email, break, meeting
5. Sequential execution initially:
   - Clear step-by-step flow
   - Add parallelization later if needed
6. Respect for:
   - Existing meetings/blocks
   - User patterns from RAG
   - Protected lunch time

**Success Criteria**:
- Works with any schedule state
- Lunch break always protected
- Calendar blocks prevent double-booking
- Learns from user patterns
- Returns clear text summaries

### Sprint 03.03: Email Triage & Task Workflows (2 days)

**Goal**: Natural language email processing with simplified triage

**Key Deliverables**:
1. `createEmailTriageWorkflow`:
   - `fetchUnreadEmails` - Get new emails
   - `fetchBacklogEmails` - Get "later" emails from previous days
   - `analyzeEmails` - Two-dimensional analysis:
     - **Importance**: Important / Not Important / Archive
     - **Urgency**: Urgent (today) / Can wait / No response
   - `detectUrgency` - Smart urgency detection:
     - Keywords (ASAP, deadline, urgent)
     - Meeting invites for near future
     - Follow-up patterns
     - Sender importance
   - `generateSchedule` - Create time blocks based on urgency
   - `updateBacklog` - Save non-urgent for later
2. **Simplified Email Strategy**:
   - Important + Urgent → Today's email block
   - Important + Can wait → Tomorrow's list
   - Not Important + Urgent → Quick batch today
   - Archive → Auto-archive
3. `createTaskPrioritizationWorkflow`:
   - Pull from task backlog
   - Simple scoring: importance + age
   - Match tasks to available time
4. **Simple Backlog System**:
   - Track email age in days
   - Basic importance flag
   - No complex algorithms
5. Interactive email decisions in chat:
   - "Show me urgent emails"
   - "What's important today?"
   - "Archive all newsletters"

**Success Criteria**:
- Two-dimensional triage working smoothly
- Urgent emails never missed
- Simple, understandable categorization
- Natural language queries work well

### Sprint 03.04: RAG System & Learning (2 days)

**Goal**: Make the AI learn from user patterns and decisions

**Key Deliverables**:
1. RAG Context Service:
   - Store/retrieve user patterns
   - Embed decisions and interactions
   - Multi-layer context (patterns, recent, similar)
2. Integration with all workflows:
   - Fetch context at start
   - Update patterns after decisions
3. **Enhanced Learning Patterns**:
   - **Break patterns**: When user actually takes breaks vs scheduled
   - **Email patterns**: 
     - Which emails get quick vs thoughtful responses
     - Response time by sender/subject
     - Auto-archive patterns
   - **Task patterns**:
     - Completion rates by time of day
     - Task duration accuracy
     - Preferred focus times
   - **Meeting patterns**:
     - Preferred open slots
     - Meeting acceptance/decline patterns
   - **Backlog patterns**:
     - How long items stay in backlog
     - What gets promoted vs deferred
   - **Preference Evolution**:
     - Update database preferences based on patterns
     - Handle natural language updates ("I need lunch earlier now")
     - Seasonal adjustments (summer vs winter schedules)
     - Gradual shifts in work patterns
4. Context injection into prompts
5. **"Show me what's hidden" functionality**:
   - Query historical data through chat
   - Access past decisions and patterns
   - Understand why AI makes certain suggestions

**Success Criteria**:
- AI suggestions improve over time
- Break times adapt to actual usage
- Email categorization becomes more accurate
- Respects learned preferences
- Can query past decisions
- Patterns visible in responses

### Sprint 03.05: Gmail & Calendar API Integration (2 days)

**Goal**: Replace mock services with real Gmail and Google Calendar APIs

**Key Deliverables**:
1. OAuth2 Authentication:
   - Google OAuth flow implementation
   - Token storage in Supabase
   - Automatic token refresh
2. Gmail API Integration:
   - Fetch real emails with proper parsing
   - Batch operations for efficiency
   - Rate limiting and error handling
3. Google Calendar API:
   - Event fetching and creation
   - Free/busy queries
   - Timezone handling
4. Service Factory Pattern:
   - Automatic fallback to mock for users without OAuth
   - Seamless transition between mock and real data
5. Migration from Mock:
   - Remove all mock data generators
   - Update all service references

**Success Criteria**:
- OAuth flow works smoothly
- Real emails and calendar events display correctly
- Existing workflows continue functioning
- Graceful fallback for users without OAuth
- No mock data in production

### Sprint 03.06: Change Preview & UX Polish (2 days)

**Goal**: Build visual change preview system and polish entire UX

**Key Deliverables**:
1. Change Preview Components:
   - Visual before/after for schedule changes
   - Email action previews
   - Task update summaries
   - Accept/reject/modify interface
2. Loading States:
   - Skeleton screens
   - Progress indicators
   - Streaming updates
3. Undo System:
   - Track recent actions
   - One-click undo/redo
4. Keyboard Shortcuts:
   - Power user features
   - Shortcut help overlay
5. Final Polish:
   - Smooth animations
   - Error recovery
   - Mobile optimization

**Success Criteria**:
- Users can preview all changes before applying
- Loading states for all async operations
- Undo works for major actions
- Professional, polished feel
- Fast and responsive UI

## Implementation Notes

### AI SDK Patterns Being Implemented

1. **Multi-Step Tool Usage (`maxSteps`)**
   - AI can chain tools to accomplish complex tasks
   - Example: Analyze schedule → Find gaps → Create blocks → Assign tasks
   
2. **Routing Pattern**
   - AI decides which workflow based on context
   - Time-aware (morning routine vs afternoon optimization)
   - State-aware (busy vs free schedule)
   
3. **Sequential Processing (Initially)**
   - Start with clear, debuggable sequential flow
   - Optimize with parallelization only where measured
   - Simpler error handling and state management
   
4. **Simple Scoring**
   - Basic importance + urgency for emails
   - Age-based priority for backlogs
   - No complex algorithms
   
5. **Text-Based Confirmations**
   - Clear summaries instead of visual previews
   - Quick yes/no/modify responses
   - Natural conversation flow

6. **Streaming with Progress**
   - Use `onStepFinish` for real-time updates
   - Show which tools are running
   - Display intermediate results

### Core Workflows to Implement

1. **Adaptive Scheduling Workflow**
   - Most complex and important
   - Handles multiple scenarios
   - Must be flexible and intelligent

2. **Email Triage Workflow**
   - Critical for daily use
   - Needs good pattern recognition
   - Interactive decision flow

3. **Task Prioritization Workflow**
   - Runs frequently
   - Must be context-aware
   - Quick execution needed

4. **Schedule Optimization Workflow**
   - Non-destructive improvements
   - Clear explanations
   - Respects user preferences

5. **Daily Review Workflow**
   - Continuous learning
   - Pattern extraction
   - Tomorrow preparation
   - Backlog review and prioritization

### Workflow Node Additions

**Adaptive Scheduling Workflow**:
- `protectBreakTime` - Ensure lunch and optional breaks
- `maintainOpenSlots` - Keep time for ad-hoc meetings  
- `pullFromBacklog` - Consider high-priority backlog tasks
- `applyCalendarProtection` - Block calendar for all non-meeting blocks

**Email Triage Workflow**:
- `fetchBacklogEmails` - Get all "later" emails from previous days
- `categorizeByResponseType` - Sort into quick/thoughtful/no-response
- `batchByCategory` - Group similar emails for efficiency
- `updateBacklog` - Save deferred emails with priority decay
- `generateTimeBlocks` - Create appropriate email blocks by type

### Database Schema Updates

```typescript
// New tables for backlog management
interface TaskBacklog {
  id: string
  userId: string
  title: string
  description?: string
  priority: number // 0-100
  urgency: number // 0-100
  source: 'email' | 'chat' | 'calendar' | 'manual'
  sourceId?: string // emailId, etc.
  createdAt: Date
  updatedAt: Date
  deferredUntil?: Date
  estimatedMinutes?: number
  tags?: string[]
}

interface EmailBacklog {
  id: string
  userId: string
  emailId: string
  subject: string
  from: string
  importance: 'important' | 'not_important' | 'archive'
  urgency: 'urgent' | 'can_wait' | 'no_response'
  daysInBacklog: number
  lastReviewedAt: Date
  createdAt: Date
  snippet?: string // For quick preview
}

interface UserPreferences {
  // ... existing fields
  breakSchedule: {
    lunchTime: string // "12:00"
    lunchDuration: number // 60 minutes
    morningBreak?: { time: string, duration: number }
    afternoonBreak?: { time: string, duration: number }
    autoProtect: boolean // Auto-decline meetings during breaks
  }
  openTimePreferences: {
    dailyHours: number // How many hours to keep open
    preferredSlots: string[] // ["14:00-15:00", "16:00-17:00"]
    allowMeetingTypes: string[] // ["external", "1-on-1", "team"]
  }
  emailPreferences: {
    quickReplyTimeMinutes: number // Default 5
    batchProcessing: boolean // Group similar emails
    autoArchivePatterns: string[] // Regex patterns
  }
}
```

### Key Technical Patterns

```typescript
// Tool definition pattern with backlog
const schedulingTool = tool({
  description: 'Intelligently plan or adjust daily schedule',
  parameters: z.object({
    mode: z.enum(['full', 'partial', 'optimize']),
    date: z.string().optional(),
    includeBacklog: z.boolean().default(true),
  }),
  execute: async (params) => {
    const workflow = createAdaptiveSchedulingWorkflow();
    const result = await workflow.invoke({
      ...params,
      userId: currentUser.id,
      ragContext: await ragService.getContext(currentUser.id),
      taskBacklog: params.includeBacklog 
        ? await getTaskBacklog(currentUser.id)
        : [],
    });
    
    if (result.proposal) {
      // Update UI with proposal
      scheduleStore.setProposal(result.proposal);
    }
    
    return result;
  }
});

// Preference update tool
const updatePreferenceTool = tool({
  description: 'Update user preferences based on request or learned behavior',
  parameters: z.object({
    preference: z.enum(['lunch_time', 'break_schedule', 'work_hours', 'open_time']),
    value: z.any(),
    reason: z.string(), // Why the change is being made
  }),
  execute: async (params) => {
    // Update database preferences
    await updateUserPreferences(currentUser.id, {
      [params.preference]: params.value,
      updated_at: new Date(),
    });
    
    // Log to RAG for learning
    await ragService.logPreferenceChange(
      currentUser.id,
      params.preference,
      params.value,
      params.reason
    );
    
    return {
      success: true,
      message: `Updated ${params.preference} based on ${params.reason}`,
    };
  }
});

// Email triage with simplified categories
const emailTriageTool = tool({
  description: 'Process and categorize emails by importance and urgency',
  parameters: z.object({
    includeBacklog: z.boolean().default(true),
    filter: z.enum(['urgent', 'important', 'all']).optional(),
  }),
  execute: async (params) => {
    const workflow = createEmailTriageWorkflow();
    
    // Fetch both new and backlog emails (sequential is fine)
    const newEmails = await fetchUnreadEmails(currentUser.id);
    const backlogEmails = params.includeBacklog 
      ? await fetchEmailBacklog(currentUser.id)
      : [];
    
    const result = await workflow.invoke({
      emails: [...newEmails, ...backlogEmails],
      filter: params.filter,
      userId: currentUser.id,
      ragContext: await ragService.getContext(currentUser.id),
    });
    
    // Returns emails grouped by importance/urgency
    return result;
  }
});

// RAG pattern for every workflow
workflow.addNode('fetchContext', async (state) => {
  const context = await ragService.getContextForWorkflow(
    state.userId,
    'scheduling',
    {
      date: state.date,
      currentSchedule: state.schedule,
      userPreferences: state.userPreferences,
    }
  );
  
  return { ...state, ragContext: context };
});
```

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor intent detection | High | Strong system prompts, fallback to clarification |
| Workflow complexity | Medium | Start simple, add complexity gradually |
| RAG performance | Medium | Implement caching, limit context size |
| User trust | High | Change preview system, clear explanations |

## Success Metrics

- User can accomplish all tasks through chat
- AI suggestions accepted >70% of time
- Response time <2s for most operations
- Pattern learning improves suggestions
- Zero button clicks needed for core flows

## Epic Completion Checklist

- [ ] All chat-based interactions working
- [ ] Core workflows implemented and tested
- [ ] RAG system learning from interactions
- [ ] Change preview system functional
- [ ] UI polished and professional
- [ ] Performance optimized
- [ ] User can work entirely through chat
- [ ] Documentation updated

---

*Epic Created: December 30, 2024*  
*Epic Started: -* 
*Epic Completed: -* 