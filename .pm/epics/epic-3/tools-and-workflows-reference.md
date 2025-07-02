# Tools and Workflows Reference

## Overview
This document provides a high-level reference of all tools and workflows in the dayli system after Sprint 03.015 and the planned Sprints 03.02-03.04.

---

## AI Tools Inventory

### 1. Schedule Management Tools
**Location**: `apps/web/modules/ai/tools/schedule-tools.ts`
- `viewSchedule` - Display today's schedule
- `createTimeBlock` - Create a new time block
- `moveTimeBlock` - Move existing block to new time
- `deleteTimeBlock` - Remove a time block
- `findTimeBlock` - Locate blocks by description
- `regenerateSchedule` - Recover lost schedule data
- `assignTaskToBlock` - Assign task to a time block
- `completeTask` - Mark task as done

### 2. Email Operations Tools
**Location**: `apps/web/modules/ai/tools/email-operations.ts`
- `readEmailContent` - Read full email with attachments
- `draftEmailResponse` - Create/send email drafts with AI
- `processEmailToTask` - Convert email to scheduled task
- `triageEmails` - Process and categorize emails (Sprint 03.03)

### 3. Task Management Tools
**Location**: `apps/web/modules/ai/tools/task-operations.ts`
- `createTask` - Create new task via natural language
- `editTask` - Modify existing task properties
- `deleteTask` - Remove task with confirmation
- `findTasks` - Search tasks by criteria
- `getUnassignedTasks` - View tasks not yet scheduled

### 4. Meeting/Calendar Tools
**Location**: `apps/web/modules/ai/tools/calendar-operations.ts`
- `scheduleMeeting` - Create meeting with conflict detection
- `rescheduleMeeting` - Move meeting with notifications
- `handleMeetingConflict` - Resolve scheduling conflicts

### 5. Smart Block Creation Tools
**Location**: `apps/web/modules/ai/tools/smart-block-creation.ts`
- `createWorkBlock` - Create focus block with best-fit tasks from backlog
- `createEmailBlock` - Create email block with urgent items

### 6. Workflow Management Tools
**Location**: `apps/web/modules/ai/tools/workflow-management.ts`
- `resumeWorkflow` - Resume interrupted workflow
- `showWorkflowHistory` - View workflow execution history

### 7. Workflow Execution Tools
**Location**: `apps/web/modules/ai/tools/workflow-tools.ts`
- `scheduleDay` - Run adaptive scheduling workflow (Sprint 03.02)
- `confirmScheduleChanges` - Apply proposed schedule changes (Sprint 03.02)
- `optimizeSchedule` - Run schedule optimization workflow (Sprint 03.02)
- `dailyReview` - Run end-of-day review workflow (Sprint 03.04)

### 8. Preference Tools
**Location**: `apps/web/modules/ai/tools/preference-tools.ts`
- `updatePreferences` - Modify user preferences
- `viewPreferences` - Show current preferences

---

## LangGraph Workflows Inventory

### 1. Adaptive Scheduling Workflow
**Location**: `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`
**Sprint**: 03.02
**Purpose**: Intelligently plan daily schedule based on current state

**Nodes**:
- fetchData → analyzeState → determineStrategy
- Strategy branches: fullPlanning | partialPlanning | optimization | taskAssignment
- All converge to: protectBreaks → validateSchedule → generateSummary

**Strategies**:
- `full`: Empty schedule needs complete planning
- `partial`: Fill gaps in existing schedule
- `optimize`: Improve existing full schedule
- `task_only`: Just assign tasks to existing blocks

### 2. Schedule Optimization Workflow
**Location**: `apps/web/modules/workflows/graphs/scheduleOptimization.ts`
**Sprint**: 03.02
**Purpose**: Non-destructive schedule improvements

**Nodes**:
- analyzeEfficiency → identifyOptimizations → respectConstraints → proposeChanges → calculateBenefits

**Optimizations**:
- Gap elimination
- Focus time consolidation
- Energy-based timing
- Task reordering

### 3. Email Triage Workflow
**Location**: `apps/web/modules/workflows/graphs/emailTriage.ts`
**Sprint**: 03.03
**Purpose**: Analyze and batch emails by importance/urgency

**Nodes**:
- fetchEmails → fetchBacklog → mergeAndPrioritize → analyzeEmails
- → detectUrgency → batchEmails → generateSchedule → updateBacklog → generateSummary

**Analysis Dimensions**:
- Importance: important | not_important | archive
- Urgency: urgent | can_wait | no_response

### 4. Task Prioritization Workflow
**Location**: `apps/web/modules/workflows/graphs/taskPrioritization.ts`
**Sprint**: 03.03
**Purpose**: Smart task selection based on context

**Nodes**:
- fetchBacklog → analyzeContext → scoreTasks → matchToTime → generateRecommendations

**Scoring Factors**:
- Base priority
- Age in backlog
- Energy matching
- Time of day alignment

### 5. Daily Review Workflow
**Location**: `apps/web/modules/workflows/graphs/dailyReview.ts`
**Sprint**: 03.04
**Purpose**: End-of-day analysis and tomorrow prep

**Nodes**:
- fetchTodayData → extractTodayPatterns → analyzeProductivity
- → reviewBacklog → prepareTomorrow → updateLearnings → generateReviewSummary

**Outputs**:
- Productivity patterns
- Tomorrow's priorities
- Backlog status
- Learning updates for RAG

---

## Service Architecture

### Core Services
**Location**: `apps/web/services/`

1. **EmailService** (IEmailService)
   - Gmail API integration
   - Full email CRUD operations

2. **TaskService** (ITaskService)
   - Task management
   - Backlog operations

3. **CalendarService** (ICalendarService)
   - Google Calendar integration
   - Conflict detection
   - Event management

4. **ScheduleService** (IScheduleService)
   - Time block management
   - Schedule queries

5. **PreferenceService** (IPreferenceService)
   - User preferences
   - Work hours, lunch time, etc.

### Supporting Services

1. **RAGContextService**
   - Store/retrieve embeddings
   - Multi-layer context (patterns, recent, similar)

2. **WorkflowPersistenceService**
   - Save workflow state
   - Resume interrupted workflows
   - Track history

3. **LearningPatternsService**
   - Extract patterns from decisions
   - Update RAG with learnings

4. **CalendarProtectionService** (Mock → Real in Sprint 03.05)
   - Auto-decline during protected time
   - Calendar blocking

---

## Architecture Patterns

### 1. Service Factory Pattern
```typescript
ServiceFactory.getInstance()
  .getEmailService()
  .getTaskService()
  // etc.
```

### 2. Tool Pattern (AI SDK)
```typescript
tool({
  description: "...",
  parameters: z.object({...}),
  execute: async (params) => {...}
})
```

### 3. LangGraph State Pattern
```typescript
StateGraph<StateType>({
  channels: {...}
})
.addNode(...)
.addEdge(...)
.addConditionalEdges(...)
```

### 4. Error Handling Proxy
```typescript
new ErrorHandlingProxy(service)
// Wraps all methods with retry logic
```

### 5. Workflow Persistence Wrapper
```typescript
createPersistentWorkflow(workflow, type)
// Adds state saving to any workflow
```

---

## Integration Points

### 1. Chat → Tools
- AI SDK handles tool calling
- Tools return structured responses
- Chat UI renders rich components

### 2. Tools → Workflows
- Tools can invoke workflows
- Workflows compose multiple tool calls
- Two-step confirmation pattern

### 3. Workflows → Services
- Workflows use ServiceFactory
- Services handle data operations
- Services integrate with external APIs

### 4. Services → External APIs
- Gmail API for emails
- Google Calendar API for events
- OpenAI API for embeddings/chat
- Supabase for data persistence

---

## Missing Tools/Workflows?

Based on PRD requirements, we have coverage for:
- ✅ Daily planning
- ✅ Email triage
- ✅ Task management
- ✅ Meeting scheduling
- ✅ Schedule optimization
- ✅ Focus time protection
- ✅ Backlog management
- ✅ Learning/adaptation

Potential additions:
- Break management tools (move lunch, adjust breaks)
- Batch operations (complete multiple tasks)
- Emergency rescheduling (when day goes off-track)

---

## Workflows NOT Being Built

Based on analysis, these were mentioned but are NOT needed:

### ❌ Email Response Workflow
- **Reason**: `draftEmailResponse` tool handles this completely
- **No workflow needed** - single tool is sufficient

### ❌ Meeting Prep Workflow
- **Reason**: Existing tools can be composed
- **Use**: `scheduleMeeting` + `createTimeBlock` tools

### ❌ Overflow Management Workflow
- **Reason**: Adaptive Scheduling Workflow already handles this
- **Use**: `scheduleDay` with "optimize" strategy

---

## Notes

1. All tools follow consistent patterns
2. Workflows handle complex multi-step operations
3. Services abstract data/API complexity
4. RAG provides memory/learning layer
5. Architecture supports future expansion
6. **Clear distinction**: Use tools for single operations, workflows for multi-step processes 