# Sprint 03.03: Email, Task & Calendar Workflows

## ⚠️ IMPORTANT: Sprint 03.015 Prerequisites

**This sprint depends on architectural changes from Sprint 03.015. Before implementing:**

1. **All workflow tools MUST return standardized `ToolResult` format**:
   ```typescript
   import { toolSuccess, toolError, toolConfirmation } from '@/modules/ai/tools/types';
   
   // Example for manageEmails tool:
   return toolSuccess({
     batches: emailBatches,
     proposedBlocks: scheduleBlocks,
     archivedCount: archived.length
   }, {
     type: 'email',
     content: emailBatches
   }, {
     suggestions: ['Schedule email blocks', 'Show urgent only', 'Process backlog']
   });
   ```

2. **Use existing tools from Sprint 03.015**:
   - Email: `readEmailContent`, `draftEmailResponse`, `processEmailToTask`, `createEmailBlock`
   - Tasks: `createTask`, `editTask`, `deleteTask`, `findTasks` (with natural language)
   - Calendar: `scheduleMeeting`, `rescheduleMeeting`
   - All tools handle API integration - don't recreate

3. **ServiceFactory returns real services** - no mocks

4. **Use WorkflowPersistenceService** for all workflows

5. **Rich message components** for display from Sprint 03.015

---

## Sprint Overview

**Sprint Number**: 03.03  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: PLANNING

### Sprint Goal
Build THREE intelligent workflows that work together to manage the user's digital life:
1. **Email Management Workflow** - Intelligent triage, batching, and backlog management
2. **Task Management Workflow** - Smart prioritization, creation, and assignment
3. **Calendar Management Workflow** - Meeting scheduling, conflict resolution, and optimization

These workflows orchestrate the tools from Sprint 03.015 to provide intelligent, multi-step operations.

### What Changed from Original Plan
Based on architectural review:
- **Three workflows instead of two** - Added Calendar Management Workflow
- **Use existing tools** - Don't recreate email/task/calendar operations
- **Workflow persistence** - All workflows can be interrupted and resumed
- **Standardized patterns** - Follow the same patterns as Adaptive Scheduling from Sprint 03.02

### Context for Executor
In Sprint 03.015, we built individual tools for operations (create task, read email, schedule meeting).
In Sprint 03.02, we created the Adaptive Scheduling Workflow that orchestrates multiple tools.
Now we're adding three more workflows that handle email, tasks, and calendar intelligently.

Think of workflows as the "brain" that coordinates multiple tools to achieve complex goals:
- Tools = Single operations (create a task)
- Workflows = Multi-step processes (analyze all emails, batch them, create schedule blocks)

## Prerequisites from Previous Sprints

Before starting, verify:
- [x] All email/task/calendar tools from Sprint 03.015 working
- [x] Adaptive scheduling workflow functional (Sprint 03.02)
- [x] WorkflowPersistenceService available
- [x] LangGraph patterns established
- [x] ToolResult format implemented

## Key Concepts

### Workflow vs Tools
- **Tools**: Single-purpose operations (e.g., `createTask`, `readEmailContent`)
- **Workflows**: Multi-step processes that coordinate tools intelligently
- **Example**: Email workflow uses `listEmails` → analyzes → batches → calls `createEmailBlock`

### Three Core Workflows

#### 1. Email Management Workflow
- Fetches emails using existing tools
- Analyzes by importance/urgency dimensions
- Batches similar emails
- Creates schedule blocks using `createEmailBlock`
- Maintains backlog

#### 2. Task Management Workflow  
- Fetches tasks using `findTasks` (understands natural language)
- Scores based on priority, age, energy level
- Matches to available time
- Can create new tasks or edit existing ones
- Provides intelligent recommendations

#### 3. Calendar Management Workflow
- Manages meetings and calendar events
- Detects and resolves conflicts
- Optimizes meeting schedules
- Protects focus time
- Handles rescheduling intelligently

### Persistence Pattern
All workflows use `WorkflowPersistenceService`:
```typescript
const baseWorkflow = createEmailManagementWorkflow();
const workflow = createPersistentWorkflow(baseWorkflow, 'email');
```

## Key Deliverables

### 1. Email Management Workflow

**File**: `apps/web/modules/workflows/graphs/emailManagement.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { 
  listEmails, 
  readEmailContent, 
  processEmailToTask,
  createEmailBlock 
} from "@/modules/ai/tools/email";

interface EmailManagementState {
  userId: string;
  emails: Email[];
  backlogEmails: EmailBacklog[];
  analyzedEmails: AnalyzedEmail[];
  emailBatches: EmailBatch[];
  proposedBlocks: ScheduleBlock[];
  archivedCount: number;
  filter?: "urgent" | "important" | "all";
  messages: BaseMessage[];
}

interface AnalyzedEmail {
  emailId: string;
  subject: string;
  from: string;
  snippet: string;
  importance: "important" | "not_important" | "archive";
  urgency: "urgent" | "can_wait" | "no_response";
  suggestedAction: string;
  estimatedResponseTime: number;
}

export function createEmailManagementWorkflow() {
  const workflow = new StateGraph<EmailManagementState>({
    channels: {
      userId: null,
      emails: [],
      backlogEmails: [],
      analyzedEmails: [],
      emailBatches: [],
      proposedBlocks: [],
      archivedCount: 0,
      filter: null,
      messages: [],
    },
  });

  // Add nodes - each is a step in the process
  workflow.addNode("fetchEmails", fetchEmailsNode);
  workflow.addNode("fetchBacklog", fetchBacklogNode);
  workflow.addNode("analyzeEmails", analyzeEmailsNode);
  workflow.addNode("batchByStrategy", batchByStrategyNode);
  workflow.addNode("createScheduleBlocks", createScheduleBlocksNode);
  workflow.addNode("updateBacklog", updateBacklogNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Define the flow
  workflow.addEdge("fetchEmails", "fetchBacklog");
  workflow.addEdge("fetchBacklog", "analyzeEmails");
  workflow.addEdge("analyzeEmails", "batchByStrategy");
  workflow.addEdge("batchByStrategy", "createScheduleBlocks");
  workflow.addEdge("createScheduleBlocks", "updateBacklog");
  workflow.addEdge("updateBacklog", "generateSummary");
  workflow.addEdge("generateSummary", END);

  workflow.setEntryPoint("fetchEmails");

  return workflow.compile();
}
```

### 2. Task Management Workflow

**File**: `apps/web/modules/workflows/graphs/taskManagement.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { 
  findTasks, 
  createTask, 
  editTask,
  assignTaskToBlock 
} from "@/modules/ai/tools/task";

interface TaskManagementState {
  userId: string;
  intent: "prioritize" | "create" | "manage";
  availableTime?: number;
  currentEnergy?: "high" | "medium" | "low";
  tasks: Task[];
  scoredTasks: ScoredTask[];
  recommendations: TaskRecommendation[];
  proposedActions: TaskAction[];
  messages: BaseMessage[];
}

interface ScoredTask extends Task {
  score: number;
  reasoning: string;
}

export function createTaskManagementWorkflow() {
  const workflow = new StateGraph<TaskManagementState>({
    channels: {
      userId: null,
      intent: null,
      availableTime: null,
      currentEnergy: null,
      tasks: [],
      scoredTasks: [],
      recommendations: [],
      proposedActions: [],
      messages: [],
    },
  });

  // Nodes
  workflow.addNode("fetchTasks", fetchTasksNode);
  workflow.addNode("analyzeContext", analyzeContextNode);
  workflow.addNode("scoreTasks", scoreTasksNode);
  workflow.addNode("generateRecommendations", generateRecommendationsNode);
  workflow.addNode("proposeActions", proposeActionsNode);

  // Flow
  workflow.addEdge("fetchTasks", "analyzeContext");
  workflow.addEdge("analyzeContext", "scoreTasks");
  workflow.addEdge("scoreTasks", "generateRecommendations");
  workflow.addEdge("generateRecommendations", "proposeActions");
  workflow.addEdge("proposeActions", END);

  workflow.setEntryPoint("fetchTasks");

  return workflow.compile();
}
```

### 3. Calendar Management Workflow

**File**: `apps/web/modules/workflows/graphs/calendarManagement.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { 
  scheduleMeeting, 
  rescheduleMeeting,
  handleMeetingConflict 
} from "@/modules/ai/tools/calendar";

interface CalendarManagementState {
  userId: string;
  date: string;
  intent: "schedule" | "reschedule" | "optimize" | "resolve_conflict";
  meetings: CalendarEvent[];
  conflicts: ConflictInfo[];
  proposedChanges: CalendarChange[];
  protectedBlocks: TimeBlock[];
  messages: BaseMessage[];
}

interface ConflictInfo {
  meeting1: CalendarEvent;
  meeting2: CalendarEvent;
  overlapMinutes: number;
  severity: "high" | "medium" | "low";
  suggestedResolution: string;
}

export function createCalendarManagementWorkflow() {
  const workflow = new StateGraph<CalendarManagementState>({
    channels: {
      userId: null,
      date: null,
      intent: null,
      meetings: [],
      conflicts: [],
      proposedChanges: [],
      protectedBlocks: [],
      messages: [],
    },
  });

  // Nodes
  workflow.addNode("fetchCalendar", fetchCalendarNode);
  workflow.addNode("detectConflicts", detectConflictsNode);
  workflow.addNode("analyzeSchedule", analyzeScheduleNode);
  workflow.addNode("resolveConflicts", resolveConflictsNode);
  workflow.addNode("optimizeMeetings", optimizeMeetingsNode);
  workflow.addNode("protectFocusTime", protectFocusTimeNode);
  workflow.addNode("generateProposal", generateProposalNode);

  // Conditional routing based on intent
  workflow.addConditionalEdges(
    "analyzeSchedule",
    (state) => state.intent,
    {
      schedule: "protectFocusTime",
      reschedule: "resolveConflicts",
      optimize: "optimizeMeetings",
      resolve_conflict: "resolveConflicts",
    }
  );

  // Flow
  workflow.addEdge("fetchCalendar", "detectConflicts");
  workflow.addEdge("detectConflicts", "analyzeSchedule");
  workflow.addEdge("resolveConflicts", "generateProposal");
  workflow.addEdge("optimizeMeetings", "generateProposal");
  workflow.addEdge("protectFocusTime", "generateProposal");
  workflow.addEdge("generateProposal", END);

  workflow.setEntryPoint("fetchCalendar");

  return workflow.compile();
}

## Implementation Details

### 4. Workflow Node Implementations

#### Email Management Workflow Nodes

```typescript
// Fetch emails using existing tool
async function fetchEmailsNode(state: EmailManagementState): Promise<Partial<EmailManagementState>> {
  const result = await listEmails.execute({
    maxResults: 50,
    includeSpam: false,
  });
  
  return {
    emails: result.data.emails,
    messages: [
      ...state.messages,
      new AIMessage(`Fetched ${result.data.emails.length} new emails`)
    ]
  };
}

// Analyze emails with AI
async function analyzeEmailsNode(state: EmailManagementState): Promise<Partial<EmailManagementState>> {
  const model = new ChatOpenAI({ temperature: 0 });
  const analyzedEmails: AnalyzedEmail[] = [];
  
  // Combine new and backlog
  const allEmails = [
    ...state.emails,
    ...state.backlogEmails.map(be => ({
      id: be.email_id,
      subject: be.subject,
      from: be.from_email,
      snippet: be.snippet,
    }))
  ];
  
  // Batch analyze
  for (const batch of chunk(allEmails, 10)) {
    const prompt = `Analyze these emails by importance and urgency.
    
Importance: important (needs thoughtful response), not_important (FYI/quick), archive (no action)
Urgency: urgent (today), can_wait (later), no_response (none needed)

${batch.map((e, i) => `${i+1}. From: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.snippet}`).join('\n\n')}`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    // Parse response and add to analyzedEmails
  }
  
  return { analyzedEmails };
}

// Batch by strategy
async function batchByStrategyNode(state: EmailManagementState): Promise<Partial<EmailManagementState>> {
  const batches: EmailBatch[] = [];
  
  // Group by importance + urgency
  const importantUrgent = state.analyzedEmails.filter(
    e => e.importance === "important" && e.urgency === "urgent"
  );
  
  if (importantUrgent.length > 0) {
    batches.push({
      type: "important_urgent",
      emails: importantUrgent,
      totalTime: importantUrgent.reduce((sum, e) => sum + e.estimatedResponseTime, 0),
    });
  }
  
  // Similar for other categories...
  
  return { emailBatches: batches };
}

// Create schedule blocks using existing tool
async function createScheduleBlocksNode(state: EmailManagementState): Promise<Partial<EmailManagementState>> {
  const proposedBlocks: ScheduleBlock[] = [];
  
  for (const batch of state.emailBatches) {
    if (batch.emails.length === 0) continue;
    
    const result = await createEmailBlock.execute({
      duration: Math.min(batch.totalTime, 90), // Cap at 90 minutes
      emailTypes: [batch.type === "important_urgent" ? "urgent" : "quick_reply"],
      maxEmails: batch.emails.length,
    });
    
    if (result.success) {
      proposedBlocks.push(result.data.block);
    }
  }
  
  return { proposedBlocks };
}
```

#### Task Management Workflow Nodes

```typescript
// Fetch tasks using natural language understanding
async function fetchTasksNode(state: TaskManagementState): Promise<Partial<TaskManagementState>> {
  const result = await findTasks.execute({
    status: 'pending', // The tool now understands "pending" means "backlog"
    limit: 50,
  });
  
  return {
    tasks: result.data.tasks,
    messages: [
      ...state.messages,
      new AIMessage(`Found ${result.data.count} pending tasks`)
    ]
  };
}

// Score tasks based on context
async function scoreTasksNode(state: TaskManagementState): Promise<Partial<TaskManagementState>> {
  const currentTime = new Date();
  const isAfternoon = currentTime.getHours() >= 14;
  
  const scoredTasks = state.tasks.map(task => {
    let score = task.priority === 'high' ? 100 : task.priority === 'medium' ? 50 : 25;
    
    // Age boost
    const daysOld = Math.floor(
      (currentTime.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    score += Math.min(daysOld * 5, 20);
    
    // Energy matching
    if (state.currentEnergy === "high" && task.estimated_minutes > 60) {
      score += 15; // Hard tasks when fresh
    } else if (state.currentEnergy === "low" && task.estimated_minutes <= 30) {
      score += 15; // Easy tasks when tired
    }
    
    // Time of day
    if (isAfternoon && task.metadata?.type === "admin") {
      score += 10;
    }
    
    return { 
      ...task, 
      score,
      reasoning: `Priority: ${task.priority}, Age: ${daysOld}d, Energy match: ${state.currentEnergy}`
    };
  });
  
  return { 
    scoredTasks: scoredTasks.sort((a, b) => b.score - a.score) 
  };
}
```

#### Calendar Management Workflow Nodes

```typescript
// Detect conflicts
async function detectConflictsNode(state: CalendarManagementState): Promise<Partial<CalendarManagementState>> {
  const conflicts: ConflictInfo[] = [];
  
  // Sort meetings by start time
  const sorted = [...state.meetings].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );
  
  // Check each pair
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    if (current.end > next.start) {
      const overlapMinutes = Math.floor(
        (current.end.getTime() - next.start.getTime()) / (1000 * 60)
      );
      
      conflicts.push({
        meeting1: current,
        meeting2: next,
        overlapMinutes,
        severity: overlapMinutes > 30 ? "high" : overlapMinutes > 15 ? "medium" : "low",
        suggestedResolution: overlapMinutes > 30 
          ? "Reschedule one meeting" 
          : "Shorten both meetings"
      });
    }
  }
  
  return { conflicts };
}

// Resolve conflicts using existing tools
async function resolveConflictsNode(state: CalendarManagementState): Promise<Partial<CalendarManagementState>> {
  const proposedChanges: CalendarChange[] = [];
  
  for (const conflict of state.conflicts) {
    if (conflict.severity === "high") {
      // Use rescheduleMeeting tool
      const result = await rescheduleMeeting.execute({
        eventId: conflict.meeting2.id,
        newTime: "next available slot after " + conflict.meeting1.end,
      });
      
      if (result.success) {
        proposedChanges.push({
          action: "reschedule",
          meetingId: conflict.meeting2.id,
          newTime: result.data.meeting.start,
          reason: "Conflict with " + conflict.meeting1.summary,
        });
      }
    }
  }
  
  return { proposedChanges };
}
```

### 5. Integrate Workflows as AI Tools

**File**: `apps/web/modules/ai/tools/workflow/index.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { toolSuccess, toolError, toolConfirmation } from "../types";
import { createPersistentWorkflow } from "@/modules/workflows/services/workflowPersistence";
import { createEmailManagementWorkflow } from "@/modules/workflows/graphs/emailManagement";
import { createTaskManagementWorkflow } from "@/modules/workflows/graphs/taskManagement";
import { createCalendarManagementWorkflow } from "@/modules/workflows/graphs/calendarManagement";

export const manageEmails = tool({
  description: "Intelligently triage and batch emails for efficient processing",
  parameters: z.object({
    includeBacklog: z.boolean().default(true),
    filter: z.enum(["urgent", "important", "all"]).optional(),
  }),
  execute: async ({ includeBacklog, filter }) => {
    try {
      const baseWorkflow = createEmailManagementWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'email');
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        filter,
        includeBacklog,
        emails: [],
        backlogEmails: [],
        analyzedEmails: [],
        emailBatches: [],
        proposedBlocks: [],
        archivedCount: 0,
        messages: [],
      });
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, {
        blocks: result.proposedBlocks,
        archivedEmails: result.archivedCount,
      });
      
      return toolConfirmation(
        {
          batches: result.emailBatches,
          proposedBlocks: result.proposedBlocks,
          archivedCount: result.archivedCount,
        },
        confirmationId,
        `I'll process ${result.analyzedEmails.length} emails: ${result.emailBatches.length} batches, ${result.archivedCount} to archive. Confirm?`
      );
      
    } catch (error) {
      return toolError(
        'EMAIL_WORKFLOW_FAILED',
        `Failed to manage emails: ${error.message}`,
        error
      );
    }
  },
});

export const manageTasks = tool({
  description: "Get intelligent task recommendations based on context and energy",
  parameters: z.object({
    intent: z.enum(["prioritize", "create", "manage"]).default("prioritize"),
    timeAvailable: z.number().optional().describe("Minutes available"),
    energy: z.enum(["high", "medium", "low"]).optional(),
  }),
  execute: async ({ intent, timeAvailable, energy }) => {
    try {
      const baseWorkflow = createTaskManagementWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'task');
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        intent,
        availableTime: timeAvailable,
        currentEnergy: energy || "medium",
        tasks: [],
        scoredTasks: [],
        recommendations: [],
        proposedActions: [],
        messages: [],
      });
      
      return toolSuccess(
        {
          recommendations: result.recommendations,
          topTasks: result.scoredTasks.slice(0, 5),
        },
        {
          type: 'task',
          content: result.recommendations
        },
        {
          suggestions: [
            'Create a work block with these tasks',
            'Show different tasks',
            'Mark task as complete'
          ]
        }
      );
      
    } catch (error) {
      return toolError(
        'TASK_WORKFLOW_FAILED',
        `Failed to manage tasks: ${error.message}`,
        error
      );
    }
  },
});

export const manageCalendar = tool({
  description: "Optimize calendar, resolve conflicts, and protect focus time",
  parameters: z.object({
    date: z.string().optional().describe("YYYY-MM-DD format"),
    intent: z.enum(["schedule", "reschedule", "optimize", "resolve_conflict"]).default("optimize"),
  }),
  execute: async ({ date, intent }) => {
    try {
      const baseWorkflow = createCalendarManagementWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'calendar');
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        date: targetDate,
        intent,
        meetings: [],
        conflicts: [],
        proposedChanges: [],
        protectedBlocks: [],
        messages: [],
      });
      
      if (result.proposedChanges.length > 0) {
        const confirmationId = crypto.randomUUID();
        await storeProposedChanges(confirmationId, result.proposedChanges);
        
        return toolConfirmation(
          result.proposedChanges,
          confirmationId,
          `Found ${result.conflicts.length} conflicts. I can make ${result.proposedChanges.length} changes to fix them.`
        );
      }
      
      return toolSuccess(
        {
          conflicts: result.conflicts,
          protectedTime: result.protectedBlocks,
        },
        {
          type: 'text',
          content: result.conflicts.length === 0 
            ? 'Your calendar is optimized with no conflicts!' 
            : `Found ${result.conflicts.length} conflicts that need attention.`
        }
      );
      
    } catch (error) {
      return toolError(
        'CALENDAR_WORKFLOW_FAILED',
        `Failed to manage calendar: ${error.message}`,
        error
      );
    }
  },
});
```

## Testing Guide

### Email Management Workflow Tests

#### Test 1: Mixed Email Batch
```
User: "Process my emails"
Expected:
- Fetches new + backlog emails
- Analyzes and batches by importance/urgency
- Creates schedule blocks for urgent items
- Archives junk automatically
- Shows confirmation with counts
```

#### Test 2: Urgent Only Filter
```
User: "Show only urgent emails"
Expected:
- Filters for urgent items only
- No "thoughtful response" batch
- Quick scheduling for today
```

### Task Management Workflow Tests

#### Test 1: Energy-Based Recommendations
```
User: "What should I work on? I'm tired"
Expected:
- Detects low energy state
- Recommends easy/admin tasks
- Avoids complex creative work
- Shows top 5 with reasoning
```

#### Test 2: Time-Boxed Suggestions
```
User: "I have 30 minutes, what can I do?"
Expected:
- Filters tasks ≤ 30 minutes
- Prioritizes by score
- Shows completable tasks only
```

### Calendar Management Workflow Tests

#### Test 1: Conflict Resolution
```
User: "Fix my calendar conflicts"
Expected:
- Detects overlapping meetings
- Proposes rescheduling options
- Protects lunch and focus time
- Shows confirmation before changes
```

#### Test 2: Focus Time Protection
```
User: "Protect my morning focus time"
Expected:
- Identifies morning slots
- Moves non-critical meetings
- Creates focus blocks
- Maintains meeting priorities
```

## Common Patterns Across Workflows

### 1. State Management
All workflows use typed state interfaces with channels for LangGraph compatibility.

### 2. Tool Orchestration
Workflows coordinate existing tools rather than reimplementing functionality.

### 3. Persistence
Every workflow can be interrupted and resumed using WorkflowPersistenceService.

### 4. Confirmation Flow
Destructive or multi-change operations require confirmation via `toolConfirmation`.

### 5. Error Handling
Consistent error patterns with `toolError` for failures.

## Implementation Checklist

### Day 1: Core Workflow Implementation
- [ ] Create Email Management Workflow structure
- [ ] Implement all email workflow nodes
- [ ] Create Task Management Workflow structure
- [ ] Implement all task workflow nodes
- [ ] Create Calendar Management Workflow structure
- [ ] Implement calendar conflict detection
- [ ] Add workflow persistence to all three

### Day 2: Integration & Testing
- [ ] Create workflow tool wrappers with ToolResult
- [ ] Add confirmation flows for multi-step changes
- [ ] Implement proposed change storage
- [ ] Test email batching strategies
- [ ] Test task scoring algorithm
- [ ] Test conflict resolution logic
- [ ] Add progress streaming for long operations
- [ ] Integration testing with chat UI
- [ ] Verify all tools return proper display hints

## Success Criteria

1. **All workflows use existing tools** - No reimplementation
2. **Standardized ToolResult format** - Consistent returns
3. **Persistence working** - Can interrupt/resume
4. **Natural language understanding** - Tools handle intent
5. **Smart batching** - Efficient email grouping
6. **Intelligent scoring** - Tasks ranked by context
7. **Conflict resolution** - Calendar issues fixed
8. **Confirmation flows** - User control maintained

## Next Sprint Preview

Sprint 03.04 will add:
- Daily Review Workflow combining all three
- RAG system for learning patterns
- Preference learning from user actions
- Workflow analytics and insights 

**Remember**: This sprint creates THREE intelligent workflows that orchestrate the tools from Sprint 03.015. The key is coordination - workflows are the "brain" that makes multiple tools work together intelligently. 