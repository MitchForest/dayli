# Sprint 03.025: Domain Workflows

## Sprint Overview

**Sprint Number**: 03.025  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 3 days  
**Status**: PLANNING

### Sprint Goal
Build four intelligent domain workflows that orchestrate the stateless tools from Sprint 03.02, integrate RAG memory from Sprint 03.03, and provide the foundation for time-based workflows in Sprint 03.04. These workflows represent the core intelligence of dayli, handling scheduling, email, tasks, and calendar optimization.

### Key Architecture
- **Four Domain Workflows**: Adaptive Scheduling, Email Management, Task Intelligence, Calendar Optimization
- **Stateless but Context-Aware**: Fetch context at runtime, no internal state
- **Composable**: Can be used independently or orchestrated by time-based workflows
- **Persistent**: All workflows support interruption and resumption

## Architectural Decisions

### 1. Workflow Hierarchy
```
Tools (Sprint 03.02) → Domain Workflows (This Sprint) → Time-Based Workflows (Sprint 03.04)
   ↓                            ↓                              ↓
Single operations      Domain-specific logic         Daily orchestration
```

### 2. Standardized Interfaces
All domain workflows follow consistent patterns:

```typescript
interface DomainWorkflowResult<T> {
  success: boolean;
  data: T;
  proposedChanges: Change[];
  insights: Insight[];
  ragContext: RAGContext;
  executionTime: number;
  nextSteps: string[];
}

interface DomainWorkflowState<T> {
  userId: string;
  intent?: string;
  ragContext?: RAGContext;
  data: T;
  proposedChanges: Change[];
  messages: BaseMessage[];
}
```

### 3. Integration Pattern
```typescript
// Domain workflows can be called directly
const result = await adaptiveSchedulingWorkflow.invoke({ userId, date });

// Or composed by time-based workflows
const sodWorkflow = async (state) => {
  const scheduling = await adaptiveSchedulingWorkflow.invoke(state);
  const tasks = await taskIntelligenceWorkflow.invoke(state);
  const emails = await emailManagementWorkflow.invoke(state);
  return combineResults(scheduling, tasks, emails);
};
```

## The Four Domain Workflows

### 1. Adaptive Scheduling Workflow

**Purpose**: Intelligently create, adjust, or optimize daily schedules based on current state

**Key Features**:
- Four strategies: full, partial, optimize, task-only
- Always protects breaks and preferences
- Considers energy levels and patterns
- Integrates with task and email backlogs

**Nodes**:
1. `fetchScheduleData` - Get current schedule, preferences, gaps
2. `analyzeScheduleState` - Detect inefficiencies, calculate metrics
3. `determineStrategy` - Choose approach based on state
4. `fetchRAGContext` - Get relevant patterns and decisions
5. `executeStrategy` - Run strategy-specific logic
6. `protectTimeBlocks` - Ensure breaks and focus time
7. `validateSchedule` - Check for conflicts
8. `generateProposal` - Create change summary

### 2. Email Management Workflow

**Purpose**: Triage, batch, and schedule email processing efficiently

**Key Features**:
- Two-dimensional analysis (importance × urgency)
- Smart batching for similar emails
- Backlog management with aging
- Time block creation for email work

**Nodes**:
1. `fetchEmails` - Get new and backlog emails
2. `fetchRAGContext` - Get sender patterns, response times
3. `analyzeEmails` - Categorize by importance/urgency
4. `detectPatterns` - Find sender patterns, topics
5. `batchEmails` - Group for efficient processing
6. `createEmailBlocks` - Schedule processing time
7. `updateBacklog` - Age and prioritize remaining
8. `generateSummary` - Explain triage decisions

### 3. Task Intelligence Workflow

**Purpose**: Score, prioritize, and intelligently assign tasks

**Key Features**:
- Multi-factor scoring (priority, urgency, age, energy)
- Smart task-to-block matching
- Backlog health monitoring
- Task combination suggestions

**Nodes**:
1. `fetchTasks` - Get all pending tasks and backlog
2. `fetchRAGContext` - Get completion patterns
3. `scoreTasks` - Calculate urgency scores
4. `analyzeCapacity` - Check available time/energy
5. `matchTasksToTime` - Find optimal assignments
6. `suggestCombinations` - Group related tasks
7. `updateBacklog` - Manage task aging
8. `generateRecommendations` - Explain priorities

### 4. Calendar Optimization Workflow

**Purpose**: Detect and resolve conflicts, optimize meeting schedules

**Key Features**:
- Conflict detection and resolution
- Meeting consolidation suggestions
- Focus time protection
- Smart rescheduling

**Nodes**:
1. `fetchCalendarData` - Get meetings and events
2. `detectConflicts` - Find overlaps and issues
3. `analyzeEfficiency` - Find optimization opportunities
4. `fetchRAGContext` - Get meeting patterns
5. `generateResolutions` - Create fix proposals
6. `optimizeMeetings` - Consolidate when possible
7. `protectFocusTime` - Ensure deep work blocks
8. `generateProposal` - Explain optimizations

## Implementation Details

### 1. Adaptive Scheduling Workflow

**File**: `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, AIMessage } from "@langchain/core/messages";
import { 
  createTimeBlock,
  moveTimeBlock,
  deleteTimeBlock,
  findTimeBlock,
  assignTaskToBlock,
  createWorkBlock,
  createEmailBlock
} from "@/modules/ai/tools/schedule";
import { RAGContextService } from "@/modules/rag/services/ragContext.service";

interface SchedulingState extends DomainWorkflowState<{
  date: string;
  currentSchedule: TimeBlock[];
  gaps: TimeGap[];
  inefficiencies: Inefficiency[];
  strategy?: "full" | "partial" | "optimize" | "task_only";
  preferences: UserPreferences;
  availableTasks: Task[];
  emailBacklog: EmailBacklog[];
}> {}

export function createAdaptiveSchedulingWorkflow() {
  const workflow = new StateGraph<SchedulingState>({
    channels: {
      userId: null,
      intent: null,
      ragContext: null,
      data: {
        date: null,
        currentSchedule: [],
        gaps: [],
        inefficiencies: [],
        strategy: null,
        preferences: null,
        availableTasks: [],
        emailBacklog: [],
      },
      proposedChanges: [],
      messages: [],
    },
  });

  // Add nodes
  workflow.addNode("fetchScheduleData", fetchScheduleDataNode);
  workflow.addNode("analyzeScheduleState", analyzeScheduleStateNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("determineStrategy", determineStrategyNode);
  workflow.addNode("executeStrategy", executeStrategyNode);
  workflow.addNode("protectTimeBlocks", protectTimeBlocksNode);
  workflow.addNode("validateSchedule", validateScheduleNode);
  workflow.addNode("generateProposal", generateProposalNode);

  // Define flow
  workflow.setEntryPoint("fetchScheduleData");
  workflow.addEdge("fetchScheduleData", "analyzeScheduleState");
  workflow.addEdge("analyzeScheduleState", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "determineStrategy");
  workflow.addEdge("determineStrategy", "executeStrategy");
  workflow.addEdge("executeStrategy", "protectTimeBlocks");
  workflow.addEdge("protectTimeBlocks", "validateSchedule");
  workflow.addEdge("validateSchedule", "generateProposal");
  workflow.addEdge("generateProposal", END);

  return workflow.compile();
}
```

### 2. Email Management Workflow

**File**: `apps/web/modules/workflows/graphs/emailManagement.ts`

```typescript
interface EmailState extends DomainWorkflowState<{
  emails: Email[];
  backlogEmails: EmailBacklog[];
  analyzedEmails: AnalyzedEmail[];
  emailBatches: EmailBatch[];
  senderPatterns: SenderPattern[];
}> {}

interface AnalyzedEmail extends Email {
  importance: "important" | "not_important" | "archive";
  urgency: "urgent" | "can_wait" | "no_response";
  estimatedResponseTime: number;
  suggestedAction: string;
}

export function createEmailManagementWorkflow() {
  const workflow = new StateGraph<EmailState>({
    channels: {
      userId: null,
      ragContext: null,
      data: {
        emails: [],
        backlogEmails: [],
        analyzedEmails: [],
        emailBatches: [],
        senderPatterns: [],
      },
      proposedChanges: [],
      messages: [],
    },
  });

  workflow.addNode("fetchEmails", fetchEmailsNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("analyzeEmails", analyzeEmailsNode);
  workflow.addNode("detectPatterns", detectPatternsNode);
  workflow.addNode("batchEmails", batchEmailsNode);
  workflow.addNode("createEmailBlocks", createEmailBlocksNode);
  workflow.addNode("updateBacklog", updateBacklogNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Flow
  workflow.setEntryPoint("fetchEmails");
  workflow.addEdge("fetchEmails", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "analyzeEmails");
  workflow.addEdge("analyzeEmails", "detectPatterns");
  workflow.addEdge("detectPatterns", "batchEmails");
  workflow.addEdge("batchEmails", "createEmailBlocks");
  workflow.addEdge("createEmailBlocks", "updateBacklog");
  workflow.addEdge("updateBacklog", "generateSummary");
  workflow.addEdge("generateSummary", END);

  return workflow.compile();
}
```

### 3. Task Intelligence Workflow

**File**: `apps/web/modules/workflows/graphs/taskIntelligence.ts`

```typescript
interface TaskState extends DomainWorkflowState<{
  tasks: Task[];
  taskBacklog: TaskBacklog[];
  scoredTasks: ScoredTask[];
  availableTime: TimeSlot[];
  currentEnergy?: "high" | "medium" | "low";
  recommendations: TaskRecommendation[];
}> {}

interface ScoredTask extends Task {
  score: number;
  factors: {
    priority: number;
    urgency: number;
    age: number;
    energy: number;
    pattern: number;
  };
  reasoning: string;
}

export function createTaskIntelligenceWorkflow() {
  const workflow = new StateGraph<TaskState>({
    channels: {
      userId: null,
      ragContext: null,
      data: {
        tasks: [],
        taskBacklog: [],
        scoredTasks: [],
        availableTime: [],
        currentEnergy: "medium",
        recommendations: [],
      },
      proposedChanges: [],
      messages: [],
    },
  });

  workflow.addNode("fetchTasks", fetchTasksNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("scoreTasks", scoreTasksNode);
  workflow.addNode("analyzeCapacity", analyzeCapacityNode);
  workflow.addNode("matchTasksToTime", matchTasksToTimeNode);
  workflow.addNode("suggestCombinations", suggestCombinationsNode);
  workflow.addNode("updateBacklog", updateBacklogNode);
  workflow.addNode("generateRecommendations", generateRecommendationsNode);

  // Flow
  workflow.setEntryPoint("fetchTasks");
  workflow.addEdge("fetchTasks", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "scoreTasks");
  workflow.addEdge("scoreTasks", "analyzeCapacity");
  workflow.addEdge("analyzeCapacity", "matchTasksToTime");
  workflow.addEdge("matchTasksToTime", "suggestCombinations");
  workflow.addEdge("suggestCombinations", "updateBacklog");
  workflow.addEdge("updateBacklog", "generateRecommendations");
  workflow.addEdge("generateRecommendations", END);

  return workflow.compile();
}
```

### 4. Calendar Optimization Workflow

**File**: `apps/web/modules/workflows/graphs/calendarOptimization.ts`

```typescript
interface CalendarState extends DomainWorkflowState<{
  meetings: CalendarEvent[];
  conflicts: Conflict[];
  inefficiencies: CalendarInefficiency[];
  protectedBlocks: TimeBlock[];
  optimizationSuggestions: OptimizationSuggestion[];
}> {}

export function createCalendarOptimizationWorkflow() {
  const workflow = new StateGraph<CalendarState>({
    channels: {
      userId: null,
      ragContext: null,
      data: {
        meetings: [],
        conflicts: [],
        inefficiencies: [],
        protectedBlocks: [],
        optimizationSuggestions: [],
      },
      proposedChanges: [],
      messages: [],
    },
  });

  workflow.addNode("fetchCalendarData", fetchCalendarDataNode);
  workflow.addNode("detectConflicts", detectConflictsNode);
  workflow.addNode("analyzeEfficiency", analyzeEfficiencyNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("generateResolutions", generateResolutionsNode);
  workflow.addNode("optimizeMeetings", optimizeMeetingsNode);
  workflow.addNode("protectFocusTime", protectFocusTimeNode);
  workflow.addNode("generateProposal", generateProposalNode);

  // Flow
  workflow.setEntryPoint("fetchCalendarData");
  workflow.addEdge("fetchCalendarData", "detectConflicts");
  workflow.addEdge("detectConflicts", "analyzeEfficiency");
  workflow.addEdge("analyzeEfficiency", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "generateResolutions");
  workflow.addEdge("generateResolutions", "optimizeMeetings");
  workflow.addEdge("optimizeMeetings", "protectFocusTime");
  workflow.addEdge("protectFocusTime", "generateProposal");
  workflow.addEdge("generateProposal", END);

  return workflow.compile();
}
```

## Key Node Implementations

### Adaptive Scheduling - Strategy Determination

```typescript
async function determineStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const { currentSchedule, inefficiencies, availableTasks } = state.data;
  const { patterns } = state.ragContext || {};
  
  let strategy: SchedulingState['data']['strategy'];
  
  // Rule-based determination
  if (currentSchedule.length === 0) {
    strategy = "full";
  } else if (inefficiencies.length >= 3 && inefficiencies.some(i => i.severity === "high")) {
    strategy = "optimize";
  } else if (availableTasks.length > 0 && hasAvailableTimeSlots(state.data)) {
    strategy = "task_only";
  } else if (state.data.gaps.some(g => g.duration >= 60)) {
    strategy = "partial";
  } else {
    // Check RAG patterns for user preference
    const preferredStrategy = patterns?.find(p => 
      p.type === 'preference' && p.content.includes('scheduling strategy')
    );
    strategy = preferredStrategy ? "optimize" : "task_only";
  }
  
  return {
    data: {
      ...state.data,
      strategy,
    },
    messages: [
      ...state.messages,
      new AIMessage(`Selected ${strategy} strategy based on schedule analysis`),
    ],
  };
}
```

### Email Management - Two-Dimensional Analysis

```typescript
async function analyzeEmailsNode(state: EmailState): Promise<Partial<EmailState>> {
  const { emails, backlogEmails, ragContext } = state;
  const analyzedEmails: AnalyzedEmail[] = [];
  
  for (const email of [...emails, ...backlogEmails]) {
    // Check sender patterns from RAG
    const senderPattern = ragContext?.patterns?.find(p => 
      p.type === 'sender' && p.metadata?.email === email.from
    );
    
    let importance: AnalyzedEmail['importance'] = "not_important";
    let urgency: AnalyzedEmail['urgency'] = "can_wait";
    
    if (senderPattern) {
      importance = senderPattern.metadata?.importance || "not_important";
      urgency = senderPattern.metadata?.typicalUrgency || "can_wait";
    } else {
      // Analyze based on content
      importance = analyzeImportance(email);
      urgency = analyzeUrgency(email);
    }
    
    analyzedEmails.push({
      ...email,
      importance,
      urgency,
      estimatedResponseTime: calculateResponseTime(importance, urgency),
      suggestedAction: determineEmailAction(importance, urgency),
    });
  }
  
  return {
    data: {
      ...state.data,
      analyzedEmails,
    },
  };
}
```

### Task Intelligence - Multi-Factor Scoring

```typescript
async function scoreTasksNode(state: TaskState): Promise<Partial<TaskState>> {
  const { tasks, taskBacklog, ragContext, currentEnergy } = state.data;
  const scoredTasks: ScoredTask[] = [];
  
  for (const task of [...tasks, ...taskBacklog]) {
    const factors = {
      priority: task.priority === 'high' ? 100 : task.priority === 'medium' ? 50 : 25,
      urgency: task.urgency || 50,
      age: Math.min(task.days_in_backlog * 5, 20),
      energy: calculateEnergyMatch(task, currentEnergy),
      pattern: calculatePatternMatch(task, ragContext),
    };
    
    const totalScore = Object.values(factors).reduce((sum, val) => sum + val, 0);
    
    scoredTasks.push({
      ...task,
      score: totalScore,
      factors,
      reasoning: generateTaskReasoning(factors, task),
    });
  }
  
  return {
    data: {
      ...state.data,
      scoredTasks: scoredTasks.sort((a, b) => b.score - a.score),
    },
  };
}
```

### Calendar Optimization - Conflict Resolution

```typescript
async function generateResolutionsNode(state: CalendarState): Promise<Partial<CalendarState>> {
  const { conflicts, inefficiencies, ragContext } = state.data;
  const proposedChanges: Change[] = [];
  
  for (const conflict of conflicts) {
    // Check RAG for user's conflict resolution preferences
    const preferredResolution = ragContext?.patterns?.find(p => 
      p.type === 'conflict_resolution'
    );
    
    if (conflict.severity === "high") {
      // Must resolve
      const resolution = preferredResolution?.metadata?.strategy || "reschedule_lower_priority";
      
      proposedChanges.push({
        type: "reschedule",
        entity: "meeting",
        data: {
          meetingId: conflict.lowerPriorityMeeting.id,
          newTime: findNextAvailableSlot(conflict.lowerPriorityMeeting),
        },
        reason: `Resolving conflict with ${conflict.higherPriorityMeeting.title}`,
      });
    }
  }
  
  return { proposedChanges };
}
```

## Workflow Integration Tools

**File**: `apps/web/modules/ai/tools/workflow/domain-workflows.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { toolSuccess, toolError, toolConfirmation } from "../types";
import { createPersistentWorkflow } from "@/modules/workflows/services/workflowPersistence";

export const optimizeSchedule = tool({
  description: "Intelligently analyze and optimize your daily schedule",
  parameters: z.object({
    date: z.string().optional(),
    focus: z.enum(["efficiency", "balance", "focus_time"]).optional(),
  }),
  execute: async ({ date, focus }) => {
    try {
      const workflow = createPersistentWorkflow(
        createAdaptiveSchedulingWorkflow(),
        'adaptive_scheduling'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        date: date || format(new Date(), 'yyyy-MM-dd'),
        intent: focus,
      });
      
      if (result.proposedChanges.length === 0) {
        return toolSuccess({
          message: "Your schedule is already well-optimized!",
          insights: result.insights,
        });
      }
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedChanges);
      
      return toolConfirmation(
        result,
        confirmationId,
        `I found ${result.proposedChanges.length} ways to optimize your schedule.`
      );
    } catch (error) {
      return toolError('SCHEDULE_OPTIMIZATION_FAILED', error.message);
    }
  },
});

export const triageEmails = tool({
  description: "Analyze and batch emails for efficient processing",
  parameters: z.object({
    includeBacklog: z.boolean().default(true),
    maxMinutes: z.number().optional(),
  }),
  execute: async ({ includeBacklog, maxMinutes }) => {
    try {
      const workflow = createPersistentWorkflow(
        createEmailManagementWorkflow(),
        'email_management'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        includeBacklog,
        maxProcessingTime: maxMinutes,
      });
      
      return toolSuccess({
        batches: result.data.emailBatches,
        insights: result.insights,
        proposedBlocks: result.proposedChanges.filter(c => c.type === "create"),
      }, {
        type: 'email',
        content: result.data.emailBatches,
      });
    } catch (error) {
      return toolError('EMAIL_TRIAGE_FAILED', error.message);
    }
  },
});

export const prioritizeTasks = tool({
  description: "Get intelligent task recommendations based on multiple factors",
  parameters: z.object({
    timeAvailable: z.number().optional(),
    energyLevel: z.enum(["high", "medium", "low"]).optional(),
    focusArea: z.string().optional(),
  }),
  execute: async ({ timeAvailable, energyLevel, focusArea }) => {
    try {
      const workflow = createPersistentWorkflow(
        createTaskIntelligenceWorkflow(),
        'task_intelligence'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        data: {
          currentEnergy: energyLevel || "medium",
          availableMinutes: timeAvailable,
          focusArea,
        },
      });
      
      return toolSuccess({
        recommendations: result.data.recommendations,
        topTasks: result.data.scoredTasks.slice(0, 5),
        insights: result.insights,
      }, {
        type: 'task',
        content: result.data.recommendations,
      });
    } catch (error) {
      return toolError('TASK_PRIORITIZATION_FAILED', error.message);
    }
  },
});

export const optimizeCalendar = tool({
  description: "Detect and resolve calendar conflicts and inefficiencies",
  parameters: z.object({
    date: z.string().optional(),
    includeNextDays: z.number().default(1),
  }),
  execute: async ({ date, includeNextDays }) => {
    try {
      const workflow = createPersistentWorkflow(
        createCalendarOptimizationWorkflow(),
        'calendar_optimization'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        startDate: date || format(new Date(), 'yyyy-MM-dd'),
        days: includeNextDays,
      });
      
      if (result.data.conflicts.length === 0 && result.data.inefficiencies.length === 0) {
        return toolSuccess({
          message: "Your calendar is conflict-free and well-organized!",
          insights: result.insights,
        });
      }
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedChanges);
      
      return toolConfirmation(
        result,
        confirmationId,
        `Found ${result.data.conflicts.length} conflicts and ${result.data.inefficiencies.length} optimization opportunities.`
      );
    } catch (error) {
      return toolError('CALENDAR_OPTIMIZATION_FAILED', error.message);
    }
  },
});
```

## Testing Strategy

### Day 1: Core Workflow Implementation
- [ ] Implement Adaptive Scheduling workflow structure and nodes
- [ ] Implement Email Management workflow structure and nodes
- [ ] Create shared utilities (time helpers, scoring functions)
- [ ] Set up workflow persistence wrapper

### Day 2: Intelligence Layer
- [ ] Implement Task Intelligence workflow
- [ ] Implement Calendar Optimization workflow
- [ ] Integrate RAG context in all workflows
- [ ] Add pattern detection and learning preparation

### Day 3: Integration and Testing
- [ ] Create workflow integration tools
- [ ] Test each workflow independently
- [ ] Test workflow composition
- [ ] Performance optimization
- [ ] Documentation

## Test Scenarios

### Adaptive Scheduling Tests
1. **Empty Schedule**: Should select "full" strategy
2. **Fragmented Schedule**: Should select "optimize" strategy
3. **Schedule with Gaps**: Should select "partial" strategy
4. **Full Schedule with Tasks**: Should select "task_only" strategy

### Email Management Tests
1. **Mixed Urgency**: Should create appropriate batches
2. **Sender Patterns**: Should use RAG context for known senders
3. **Backlog Aging**: Should prioritize old important emails
4. **Time Blocking**: Should create efficient email blocks

### Task Intelligence Tests
1. **Energy Matching**: Low energy → easy tasks
2. **Time of Day**: Morning → complex tasks
3. **Task Combinations**: Should find efficient groupings
4. **Backlog Health**: Should surface stale tasks

### Calendar Optimization Tests
1. **Conflict Detection**: Find overlapping meetings
2. **Back-to-Back**: Suggest buffer time
3. **Meeting Clusters**: Recommend consolidation
4. **Focus Protection**: Ensure deep work time

## Success Criteria

- [ ] All four workflows implemented with LangGraph
- [ ] RAG context integrated in decision-making
- [ ] Standardized interfaces across workflows
- [ ] Workflow persistence and resumption working
- [ ] Each workflow completes in <2 seconds
- [ ] Natural language summaries generated
- [ ] Proposed changes use confirmation flow
- [ ] Can be called independently or composed
- [ ] Pattern detection prepares data for learning
- [ ] Comprehensive test coverage

## Integration with Time-Based Workflows

These domain workflows will be orchestrated by time-based workflows in Sprint 03.04:

```typescript
// Example: Start of Day workflow composition
async function startOfDayOrchestration(userId: string) {
  // Run domain workflows in intelligent order
  const scheduling = await optimizeSchedule.execute({ 
    focus: "balance" 
  });
  
  const emails = await triageEmails.execute({ 
    includeBacklog: true 
  });
  
  const tasks = await prioritizeTasks.execute({ 
    energyLevel: "high" 
  });
  
  // Combine results for comprehensive morning planning
  return combineWorkflowResults(scheduling, emails, tasks);
}
```

## Architecture Benefits

1. **Separation of Concerns**: Domain logic separate from timing logic
2. **Reusability**: Workflows can be triggered any time, not just SOD/EOD
3. **Testability**: Each workflow tested independently
4. **Maintainability**: Clear boundaries between domains
5. **Scalability**: Easy to add new domain workflows

---

**Remember**: These workflows are the intelligence layer of dayli. They should make smart, context-aware decisions while remaining stateless and composable. Focus on clear domain boundaries and consistent interfaces.
