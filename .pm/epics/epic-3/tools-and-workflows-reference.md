# Tools and Workflows Reference

## Overview
This document provides a comprehensive reference of all tools and workflows in the dayli system after Sprint 03.015, 03.016 and the NEW architecture for Sprints 03.02-03.04.

### Architecture Evolution
- **Sprint 03.02 NEW**: Domain Tools & Operations (stateless, single-purpose)
- **Sprint 03.03 NEW**: RAG Memory System (learning and context)
- **Sprint 03.04 NEW**: Time-Based Workflows (SOD, Midday, EOD)

---

## AI Tools Inventory (Post Sprint 03.015 & 03.016 + NEW Domain Tools)

### Tool Organization
All tools are now organized by domain under `apps/web/modules/ai/tools/` with automatic registration via the Tool Registry pattern.

### 1. Schedule Management Tools (14 tools)
**Location**: `apps/web/modules/ai/tools/schedule/`

**Existing Tools (10)**:
- `createTimeBlock` - Create a new time block
- `moveTimeBlock` - Move existing block to new time
- `deleteTimeBlock` - Remove a time block
- `getSchedule` - Display schedule for a specific date
- `assignTaskToBlock` - Assign task to a time block
- `completeTask` - Mark task as done
- `getUnassignedTasks` - Get tasks from both tables with intelligent scoring ✨
- `findTimeBlock` - Locate blocks by description
- `regenerateSchedule` - Optimize schedule for better time management
- `suggestTasksForBlock` - Intelligently suggest tasks for a specific block ✨

**NEW Domain Tools (Sprint 03.02)**:
- `findScheduleGaps` - Find gaps in schedule
- `detectScheduleInefficiencies` - Detect inefficiencies
- `calculateFocusTime` - Calculate total/continuous/fragmented focus time
- `findBestTimeSlot` - Find optimal slot for activity

### 2. Email Operations Tools (12 tools)
**Location**: `apps/web/modules/ai/tools/email/`

**Existing Tools (4)**:
- `readEmailContent` - Read full email with attachments
- `draftEmailResponse` - Create email drafts with AI assistance
- `processEmailToTask` - Convert email to scheduled task
- `listEmails` - List emails from inbox with basic information

**NEW Domain Tools (Sprint 03.02)**:
- `analyzeSingleEmail` - Analyze importance/urgency of email
- `batchEmailsByStrategy` - Batch emails by importance/urgency matrix
- `calculateEmailProcessingTime` - Estimate time needed for emails
- `extractActionItems` - Extract action items from email content
- `updateEmailBacklog` - Manage email backlog
- `getEmailBacklogSummary` - Get backlog statistics
- `analyzeSenderPatterns` - Analyze patterns from specific senders
- `findSimilarEmails` - Find related emails

### 3. Task Management Tools (10 tools)
**Location**: `apps/web/modules/ai/tools/task/`

**Existing Tools (4)**:
- `createTask` - Create new task via natural language
- `editTask` - Modify existing task properties
- `deleteTask` - Remove task with confirmation
- `findTasks` - Search tasks by criteria (understands "pending", "todo", etc.)

**NEW Domain Tools (Sprint 03.02)**:
- `scoreTask` - Score task based on multiple factors
- `findTasksForTimeSlot` - Match tasks to available time
- `analyzeTaskPatterns` - Analyze completion patterns
- `updateTaskBacklog` - Manage task backlog
- `getTaskBacklogHealth` - Get backlog health metrics
- `batchSimilarTasks` - Group similar tasks

### 4. Calendar Tools (7 tools)
**Location**: `apps/web/modules/ai/tools/calendar/`

**Existing Tools (3)**:
- `scheduleMeeting` - Create meeting with smart time finding
- `rescheduleMeeting` - Move meeting with notifications
- `handleMeetingConflict` - Intelligently resolve meeting conflicts

**NEW Domain Tools (Sprint 03.02)**:
- `detectConflicts` - Find calendar conflicts
- `suggestConflictResolution` - Suggest conflict resolutions
- `findOptimalMeetingTime` - Find best time for all attendees
- `protectCalendarTime` - Block time on Google Calendar (placeholder for API)

### 5. Preference Tools (2 tools)
**Location**: `apps/web/modules/ai/tools/preference/`
- `updatePreference` - Update user preferences based on natural language
- `getPreferences` - Get current user preferences

### 6. Workflow Tools (4 tools)
**Location**: `apps/web/modules/ai/tools/workflow/`

**Existing Tools (1)**:
- `scheduleDay` - Run adaptive daily planning workflow

**NEW Time-Based Workflow Tools (Sprint 03.04)**:
- `startMyDay` - Run Start of Day (SOD) workflow
- `adjustMyDay` - Run Midday Adjustment workflow
- `reviewMyDay` - Run End of Day (EOD) workflow

### 7. RAG Tools (2 tools) - NEW Sprint 03.03
**Location**: `apps/web/modules/ai/tools/rag/`
- `storeUserFeedback` - Store feedback/corrections for learning
- `getPersonalizedContext` - Retrieve personalized context

### 8. Smart Block Creation Tools (2 tools) - NEW Sprint 03.02
**Location**: `apps/web/modules/ai/tools/schedule/`
- `createWorkBlock` - Create work block filled with best-fit tasks from backlog
- `createEmailBlock` - Create email block with urgent items

### Total: 49 Tools (All with standardized ToolResult format)

---

## NEW Domain Tools Details (Sprint 03.02)

### Email Operations
```typescript
analyzeSingleEmail(email) → { importance, urgency, suggestedAction }
batchEmailsByStrategy(emails, strategy) → EmailBatch[]
calculateEmailProcessingTime(emails) → { totalMinutes, breakdown }
extractActionItems(emailContent) → ActionItem[]
```

### Task Operations
```typescript
scoreTask(task, context) → { score, factors, reasoning }
findTasksForTimeSlot(tasks, minutes, energy) → Task[]
analyzeTaskPatterns(userId, tasks) → { velocity, preferredTimes }
```

### Calendar Operations
```typescript
detectConflicts(events, timeRange) → Conflict[]
suggestConflictResolution(conflict) → Resolution[]
protectCalendarTime(block, userId) → { protected: true, eventId }
```

### Schedule Operations
```typescript
findScheduleGaps(blocks, workingHours) → Gap[]
detectScheduleInefficiencies(blocks) → Inefficiency[]
balanceScheduleLoad(blocks) → BalancedSchedule
```

---

## LangGraph Workflows Inventory (NEW Architecture)

### 1. Adaptive Scheduling Workflow (Enhanced)
**Location**: `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`
**Sprint**: 03.02
**Purpose**: ONE intelligent workflow that adapts to any schedule state

**Nodes**:
- `fetchData` → Fetch current schedule, tasks, preferences
- `analyzeState` → Determine schedule fullness and inefficiencies
- `determineStrategy` → Smart routing (rules + LLM)
- `executeStrategy` → Execute based on strategy
- `protectBreaks` → Ensure lunch is protected
- `validateSchedule` → No conflicts
- `generateSummary` → Human-readable response

**Strategies**:
- `full`: Empty schedule needs complete planning
- `partial`: Fill gaps in existing schedule
- `optimize`: Improve existing full schedule (fix inefficiencies)
- `task_only`: Just assign tasks to existing blocks

**RAG Integration**: Every node enhanced with user patterns and recent decisions

### 2. Start of Day (SOD) Workflow - NEW Sprint 03.04
**Location**: `apps/web/modules/workflows/graphs/startOfDay.ts`
**Purpose**: Morning planning with overnight review

**Nodes**:
- `fetchOvernightData` → Get overnight emails, calendar changes, backlogs
- `enhanceWithRAG` → Load user patterns and preferences
- `prioritizeItems` → Score and rank all items needing attention
- `generateSchedule` → Create optimal schedule using domain tools
- `optimizeSchedule` → Fine-tune the schedule
- `protectTimeBlocks` → Protect focus time and breaks
- `generateSummary` → Natural language summary

**Key Features**:
- Reviews overnight changes
- Pulls from task/email backlogs
- Uses RAG patterns for personalization
- Creates balanced schedule

### 3. Midday Adjustment Workflow - NEW Sprint 03.04
**Location**: `apps/web/modules/workflows/graphs/middayAdjustment.ts`
**Purpose**: Dynamic adaptation based on morning progress

**Nodes**:
- `analyzeMorningProgress` → Check completion rate
- `checkNewUrgentItems` → Find new urgent tasks/emails
- `assessCurrentEnergy` → Determine energy level
- `enhanceWithRAG` → Load patterns for afternoon
- `generateAdjustments` → Create schedule adjustments
- `optimizeAfternoon` → Rebalance remaining work
- `generateSummary` → Explain changes

**Key Features**:
- Adapts to actual vs planned
- Handles new urgent items
- Energy-aware scheduling
- Non-destructive adjustments

### 4. End of Day (EOD) Workflow - NEW Sprint 03.04
**Location**: `apps/web/modules/workflows/graphs/endOfDay.ts`
**Purpose**: Review, learn, and prepare tomorrow

**Nodes**:
- `fetchTodayData` → Get complete day's data
- `analyzeScheduleAdherence` → Compare planned vs actual
- `extractPatterns` → Find productivity/behavior patterns
- `reviewBacklogs` → Analyze backlog health
- `updateRAGLearnings` → Store patterns and decisions
- `prepareTomorrow` → Generate tomorrow's suggestions
- `generateReviewSummary` → Complete review with insights

**Key Features**:
- Extracts learnable patterns
- Updates RAG system
- Manages backlogs
- Prepares tomorrow

### 5. Email Management Workflow - Sprint 03.03
**Location**: `apps/web/modules/workflows/graphs/emailManagement.ts`
**Purpose**: Intelligent email triage and batching

**Nodes**:
- `fetchEmails` → Get new emails
- `fetchBacklog` → Get email backlog
- `analyzeEmails` → 2D analysis (importance × urgency)
- `batchByStrategy` → Group by action type
- `createScheduleBlocks` → Create time blocks
- `updateBacklog` → Update email backlog
- `generateSummary` → Summary of actions

### 6. Task Management Workflow - Sprint 03.03
**Location**: `apps/web/modules/workflows/graphs/taskManagement.ts`
**Purpose**: Smart task prioritization and recommendations

**Nodes**:
- `fetchTasks` → Get all tasks
- `analyzeContext` → Consider time, energy
- `scoreTasks` → Multi-factor scoring
- `generateRecommendations` → Create recommendations
- `proposeActions` → Suggest actions

### 7. Calendar Management Workflow - Sprint 03.03
**Location**: `apps/web/modules/workflows/graphs/calendarManagement.ts`
**Purpose**: Conflict resolution and optimization

**Nodes**:
- `fetchCalendar` → Get calendar events
- `detectConflicts` → Find overlaps
- `analyzeSchedule` → Determine issues
- `resolveConflicts` → Smart resolution
- `optimizeMeetings` → Consolidate/optimize
- `protectFocusTime` → Ensure deep work
- `generateProposal` → Present changes

---

## RAG System Architecture (Sprint 03.03)

### Core Components

1. **RAGContextService**
   - Stores context with embeddings (OpenAI text-embedding-3-small)
   - Retrieves multi-layer context
   - Vector similarity search with pgvector

2. **LearningPatternsService**
   - Learns from schedule changes
   - Learns from email decisions
   - Learns from rejections (critical!)
   - Learns from task completions
   - Extracts patterns when threshold met

3. **ContextEnhancer**
   - Enhances any workflow state with RAG
   - Adds patterns, recent decisions, similar situations
   - Checks for rejection patterns to avoid

### Context Types
```typescript
type ContextEntry = {
  type: 'pattern' | 'decision' | 'preference' | 'rejection';
  content: string;
  embedding: number[]; // 1536 dimensions
  metadata: Record<string, any>;
}
```

### Three-Layer Context System
1. **Pattern Layer**: Long-term behavioral patterns
2. **Recent Layer**: Last 7 days of decisions
3. **Similar Layer**: Vector similarity to current situation

### Integration with Workflows
Every workflow node can be enhanced:
```typescript
const enhancedState = await contextEnhancer.enhanceWorkflowState(
  userId,
  workflowType, // 'sod', 'midday', 'eod', etc.
  currentState
);
```

---

## Workflow-Tool Integration Patterns

### How Workflows Use Domain Tools
```typescript
// Workflows orchestrate tools, never reimplement
const emailBatches = await batchEmailsByStrategy(emails, 'importance_urgency');
const workBlock = await createWorkBlock({ duration: 120, tasks });
const conflicts = await detectConflicts(meetings);
```

### Tool Composition in Workflows
1. **SOD Workflow** uses:
   - Email tools: `listEmails`, `analyzeSingleEmail`, `batchEmailsByStrategy`
   - Task tools: `getTaskBacklogHealth`, `scoreTask`, `findTasksForTimeSlot`
   - Schedule tools: `createWorkBlock`, `createEmailBlock`, `findScheduleGaps`

2. **Midday Workflow** uses:
   - Schedule tools: `getSchedule`, `detectScheduleInefficiencies`
   - Task tools: `findTasksForTimeSlot`, `scoreTask`
   - Calendar tools: `detectConflicts`, `suggestConflictResolution`

3. **EOD Workflow** uses:
   - All analysis tools for pattern extraction
   - RAG tools: `storeUserFeedback`, `getPersonalizedContext`
   - Backlog tools: `updateTaskBacklog`, `updateEmailBacklog`

---

## Service Architecture (Enhanced)

### Core Services
**Location**: `apps/web/services/`

1. **GmailService** (IGmailService)
2. **TaskService** (ITaskService)
3. **CalendarService** (ICalendarService)
4. **ScheduleService** (IScheduleService)
5. **PreferenceService** (IPreferenceService)

### NEW Supporting Services (Sprint 03.03)

1. **RAGContextService**
   ```typescript
   storeContext(params) → ContextEntry
   getContext(userId, query, options) → RAGContext
   generateEmbedding(text) → number[]
   ```

2. **LearningPatternsService**
   ```typescript
   learnFromScheduleChange(params) → void
   learnFromEmailDecision(params) → void
   learnFromRejection(params) → void // Critical!
   learnFromTaskCompletion(params) → void
   ```

3. **WorkflowPersistenceService** (Enhanced)
   ```typescript
   saveWorkflowState(workflowId, state) → void
   getWorkflowState(workflowId) → WorkflowState
   resumeWorkflow(workflowId) → any
   cleanupExpiredWorkflows() → number
   ```

---

## Key Architectural Patterns

### 1. Tool Registry Pattern (Auto-Discovery)
```typescript
const registry = ToolRegistry.getInstance();
await registry.autoRegister(); // Discovers all tools
const tools = registry.getAll();
```

### 2. Standardized Tool Result
```typescript
interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; };
  metadata?: { 
    suggestions?: string[];
    confirmationRequired?: boolean;
    confirmationId?: string;
  };
  display?: { type: string; content: any };
}
```

### 3. Workflow Persistence Pattern
```typescript
const baseWorkflow = createSODWorkflow();
const workflow = createPersistentWorkflow(baseWorkflow, 'sod');
// Can be interrupted and resumed
```

### 4. RAG Enhancement Pattern
```typescript
// Every workflow decision enhanced with context
const enhancedState = await enhanceWithRAG(state);
// Now includes patterns, recent decisions, similar situations
```

### 5. Proposal Storage Pattern
```typescript
// Store proposals with TTL
proposalStore.store(confirmationId, proposal);
// Retrieve and execute later
const proposal = proposalStore.retrieve(confirmationId);
```

---

## Database Schema Updates

### Existing Tables
1. **workflow_states** - Workflow persistence
2. **task_backlog** - Tasks with numeric priority/urgency (0-100)
3. **email_backlog** - Email triage queue

### NEW Tables (Sprint 03.03)
1. **rag_context** - Vector embeddings and context
   ```sql
   - id, user_id, type, content, metadata
   - embedding vector(1536)
   - created_at
   ```

2. **Vector Search Function**
   ```sql
   search_similar_contexts(
     query_embedding, 
     user_id, 
     match_count, 
     threshold
   )
   ```

---

## Integration Flow Example

### User: "Plan my day"
1. **Chat Layer** → Selects `startMyDay` tool
2. **Tool Execution** → Creates SOD workflow
3. **SOD Workflow**:
   - Fetches data using domain tools
   - Enhances with RAG context
   - Uses `createWorkBlock`, `createEmailBlock`
   - Uses `findScheduleGaps`, `scoreTask`
   - Generates proposal
4. **Proposal Storage** → Stores with confirmationId
5. **Response** → Streams summary with confirmation
6. **Learning** → Stores decisions in RAG

---

## Time-Based Triggers

### Automatic Workflow Suggestions
- **Morning (6-10am)**: Suggest SOD if not run
- **Midday (11am-2pm)**: Suggest adjustment if needed
- **Evening (5-8pm)**: Suggest EOD if not run

### Workflow Persistence
- All workflows can be interrupted
- State saved after each node
- 24-hour TTL on saved states
- Automatic cleanup of expired states

---

## Testing Considerations

### Domain Tools
- Test stateless operation
- Test error handling
- Test with various inputs

### Workflows
- Test each node independently
- Test strategy routing
- Test RAG enhancement
- Test persistence/resume

### RAG System
- Test embedding generation
- Test similarity search
- Test pattern extraction
- Test rejection learning

---

## Notes

1. **Clear Architecture**: Tools are stateless, workflows are stateful
2. **RAG Integration**: Every workflow decision is smarter
3. **Learning from Rejections**: Critical for not repeating mistakes
4. **Time-Based Design**: Matches natural work rhythm
5. **Proposal Pattern**: All changes preview before applying
6. **49 Total Tools**: Comprehensive coverage of all operations 