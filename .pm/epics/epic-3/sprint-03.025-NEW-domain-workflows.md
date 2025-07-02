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

## Prerequisites & Current State

### What's Already Built (Sprint 03.01 & 03.015-03.017)
1. **Structured Tool Response System** ✅
   - All tools return `UniversalToolResponse` format
   - `buildToolResponse`, `buildErrorResponse`, `buildToolConfirmation` helpers
   - Rich UI components auto-render in chat
   
2. **Tool Registry** ✅
   - Auto-discovery on first chat request
   - 23+ tools registered and working
   - Categories: email_, task_, schedule_, calendar_, preference_, workflow_

3. **Service Factory** ✅
   - Real services (no mocks)
   - Configured with authenticated Supabase client
   - Services: ScheduleService, TaskService, GmailService, PreferenceService

4. **Existing Tools You'll Use** ✅
   ```typescript
   // Schedule tools
   - createTimeBlock - Basic block creation
   - moveTimeBlock - Move blocks (uses flexible time parsing)
   - deleteTimeBlock - Delete with confirmation flow
   - assignTaskToBlock - Assign tasks to blocks
   - findTimeBlock - Search blocks flexibly
   - getSchedule - Get full schedule with tasks
   
   // Task tools  
   - findTasks - Natural language support ("pending", "todo", etc.)
   - createTask - Create with auto-scheduling for high priority
   - editTask - Update task properties
   - completeTask - Mark as done
   - getUnassignedTasks - Get backlog with scoring
   
   // Email tools
   - listEmails - Get email list
   - readEmailContent - Full content with action extraction
   - draftEmailResponse - Create drafts
   - processEmailToTask - Convert to task
   - analyzeSingleEmail - AI importance/urgency (NEW in 03.02)
   - batchEmailsByStrategy - Group emails (NEW in 03.02)
   
   // Calendar tools
   - scheduleMeeting - Create meetings
   - rescheduleMeeting - Move meetings
   - handleMeetingConflict - Resolve conflicts (placeholder)
   ```

5. **Time Parsing** ✅
   - `toMilitaryTime()` - Converts "2pm", "14:00", etc. to 24hr
   - `parseNaturalDateTime()` - Handles "tomorrow at 3pm"
   - All schedule tools use flexible parsing

6. **Confirmation Flow** ✅ (Partial)
   - `storeProposedChanges()` in utils/helpers.ts
   - 5-minute TTL with Map storage
   - Used by `deleteTimeBlock` and `scheduleDay`

### What's Being Built (Sprint 03.02 - IN PROGRESS)
1. **Smart Block Creation Tools** 🚧
   - `createWorkBlock` - Intelligent work block with task assignment
   - `createEmailBlock` - Email processing blocks

2. **Additional Email Tools** 🚧
   - `extractActionItems` - Get tasks from emails
   - `calculateEmailProcessingTime` - Time estimates
   - Email backlog management tools

3. **WorkflowPersistenceService** 🚧
   - Will wrap workflows for interruption/resume
   - Not ready yet - workflows will save state directly for now

### What to Deprecate
1. **Existing Workflows** (reference only, then delete)
   - `apps/web/modules/workflows/graphs/dailyPlanning.ts`
   - `apps/web/modules/workflows/graphs/emailTriage.ts`
   - These are incomplete and use old patterns
   - Look at them for LangGraph syntax, then create new ones

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

## Critical Implementation Patterns

### 1. Error Handling Pattern (REQUIRED for all nodes)
```typescript
async function someNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    // Your node logic here
    return { ...updates };
  } catch (error) {
    console.error(`[${workflowName}] Error in someNode:`, error);
    // IMPORTANT: Don't throw! Return state with error message
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error in ${nodeName}: ${error.message}. Continuing with partial results.`)
      ]
    };
  }
}
```

### 2. Service Usage Pattern
```typescript
// ALWAYS use ServiceFactory - it's already configured
import { ServiceFactory } from '@/services/factory/service.factory';

const factory = ServiceFactory.getInstance();
const scheduleService = factory.getScheduleService();
const taskService = factory.getTaskService();
const gmailService = factory.getGmailService();
const preferenceService = factory.getPreferenceService();
```

### 3. Tool Calling Pattern
```typescript
// Import tools directly - they're already in the registry
import { createTimeBlock, findTasks, assignTaskToBlock } from '@/modules/ai/tools';

// Call tools and handle UniversalToolResponse
const result = await createTimeBlock.execute({
  type: 'work',
  title: 'Deep Focus',
  startTime: '9:00am',  // Tool handles flexible parsing
  endTime: '11:00am',
  date: '2024-01-15'
});

if (result.error) {
  // Handle error
} else {
  // Use result.data
}
```

### 4. Parallel Data Fetching (REQUIRED for performance)
```typescript
async function fetchDataNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // ALWAYS fetch in parallel when possible
  const [schedule, tasks, preferences, emails] = await Promise.all([
    scheduleService.getScheduleForDate(state.date),
    taskService.getUnassignedTasks(),
    preferenceService.getUserPreferences(),
    gmailService.listMessages({ maxResults: 20 })
  ]);
  
  return {
    currentSchedule: schedule.blocks,
    availableTasks: tasks,
    userPreferences: preferences,
    unreadEmails: emails
  };
}
```

### 5. RAG Context Pattern (Placeholder for Sprint 03.04)
```typescript
// Define minimal interface now
interface RAGContext {
  patterns?: UserPattern[];
  recentDecisions?: Decision[];
  similarDays?: DayContext[];
}

// Empty interfaces for now
interface UserPattern {}
interface Decision {}
interface DayContext {}

// In nodes, make it optional
const ragContext = state.ragContext || {};
const patterns = ragContext.patterns || [];
```

### 6. Confirmation Flow Pattern
```typescript
// For operations needing confirmation
if (proposedChanges.length > 0) {
  const confirmationId = crypto.randomUUID();
  
  // Store changes for later execution
  await storeProposedChanges(confirmationId, proposedChanges);
  
  return {
    proposedChanges,
    confirmationRequired: true,
    confirmationId,
    summary: generateNaturalSummary(proposedChanges)
  };
}
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

## Helper Functions to Create

**File**: `apps/web/modules/workflows/utils/scheduleHelpers.ts`

```typescript
import { format, parse, addMinutes, differenceInMinutes } from 'date-fns';
import { toMilitaryTime } from '@/modules/ai/utils/time-parser';

// Types
interface TimeGap {
  startTime: string;
  endTime: string;
  duration: number; // minutes
}

interface Inefficiency {
  type: 'gap' | 'fragmentation' | 'poor_timing' | 'task_mismatch';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedBlocks: string[];
}

// Find gaps in schedule
export function findScheduleGaps(
  blocks: TimeBlock[], 
  preferences: UserPreferences
): TimeGap[] {
  const gaps: TimeGap[] = [];
  const sortedBlocks = [...blocks].sort((a, b) => 
    parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime()
  );

  const workStart = parseTime(preferences.work_start_time || "9:00");
  const workEnd = parseTime(preferences.work_end_time || "17:00");

  // Check gap at start of day
  if (sortedBlocks.length === 0 || parseTime(sortedBlocks[0].startTime) > workStart) {
    const gapEnd = sortedBlocks[0] ? parseTime(sortedBlocks[0].startTime) : workEnd;
    gaps.push({
      startTime: format(workStart, 'HH:mm'),
      endTime: format(gapEnd, 'HH:mm'),
      duration: differenceInMinutes(gapEnd, workStart),
    });
  }

  // Check gaps between blocks
  for (let i = 0; i < sortedBlocks.length - 1; i++) {
    const currentEnd = parseTime(sortedBlocks[i].endTime);
    const nextStart = parseTime(sortedBlocks[i + 1].startTime);
    const gapDuration = differenceInMinutes(nextStart, currentEnd);

    if (gapDuration > 15) {
      gaps.push({
        startTime: sortedBlocks[i].endTime,
        endTime: sortedBlocks[i + 1].startTime,
        duration: gapDuration,
      });
    }
  }

  return gaps;
}

// Detect schedule inefficiencies
export function detectInefficiencies(blocks: TimeBlock[]): Inefficiency[] {
  const inefficiencies: Inefficiency[] = [];
  
  // Check for small gaps
  const gaps = findScheduleGaps(blocks, { work_start_time: '9:00', work_end_time: '17:00' });
  gaps.forEach(gap => {
    if (gap.duration >= 15 && gap.duration < 30) {
      inefficiencies.push({
        type: 'gap',
        description: `${gap.duration}-minute gap is too short for productive work`,
        severity: 'medium',
        affectedBlocks: [], // Would need block IDs
      });
    }
  });
  
  // Check for fragmented focus time
  const focusBlocks = blocks.filter(b => b.type === 'work');
  if (focusBlocks.length > 3) {
    inefficiencies.push({
      type: 'fragmentation',
      description: 'Focus time is fragmented across too many blocks',
      severity: 'high',
      affectedBlocks: focusBlocks.map(b => b.id),
    });
  }
  
  return inefficiencies;
}

// Calculate duration in minutes
export function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return differenceInMinutes(end, start);
}

// Check if block is lunch time
export function isLunchTime(block: TimeBlock): boolean {
  const blockStart = parseTime(block.startTime);
  const lunchStart = parseTime("11:30");
  const lunchEnd = parseTime("13:30");
  
  return blockStart >= lunchStart && blockStart <= lunchEnd && 
         block.type === "break";
}

// Parse time helper (uses existing time-parser)
function parseTime(timeStr: string): Date {
  const today = new Date();
  const militaryTime = toMilitaryTime(timeStr);
  const [hours, minutes] = militaryTime.split(':').map(Number);
  today.setHours(hours, minutes, 0, 0);
  return today;
}

// Check if schedule has available time slots
export function hasAvailableTimeSlots(data: SchedulingState['data']): boolean {
  const gaps = findScheduleGaps(data.currentSchedule, data.preferences);
  return gaps.some(gap => gap.duration >= 30);
}

// Generate natural language summary
export function generateNaturalSummary(changes: Change[]): string {
  const parts = [];
  
  // Group by type
  const creates = changes.filter(c => c.type === 'create');
  const moves = changes.filter(c => c.type === 'move');
  const deletes = changes.filter(c => c.type === 'delete');
  const assigns = changes.filter(c => c.type === 'assign');
  
  if (creates.length > 0) {
    parts.push(`Creating ${creates.length} new blocks`);
  }
  if (moves.length > 0) {
    parts.push(`Moving ${moves.length} blocks`);
  }
  if (deletes.length > 0) {
    parts.push(`Removing ${deletes.length} blocks`);
  }
  if (assigns.length > 0) {
    parts.push(`Assigning ${assigns.length} tasks`);
  }
  
  return parts.join(', ') + '.';
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

## Complete Implementation Details

### 1. Adaptive Scheduling Workflow (Full Implementation)

**File**: `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { ServiceFactory } from '@/services/factory/service.factory';
import { 
  createTimeBlock,
  moveTimeBlock,
  deleteTimeBlock,
  findTimeBlock,
  assignTaskToBlock,
  findTasks,
  getSchedule
} from "@/modules/ai/tools";
import { getCurrentUserId } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  findScheduleGaps, 
  detectInefficiencies, 
  calculateDuration,
  isLunchTime,
  hasAvailableTimeSlots,
  generateNaturalSummary
} from '../utils/scheduleHelpers';

// Types
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

  // Add all nodes
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

// Fetch all needed data in parallel
async function fetchScheduleDataNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  try {
    const factory = ServiceFactory.getInstance();
    const scheduleService = factory.getScheduleService();
    const preferenceService = factory.getPreferenceService();
    
    const [schedule, preferences, tasksResult] = await Promise.all([
      scheduleService.getScheduleForDate(state.data.date, state.userId),
      preferenceService.getUserPreferences(state.userId),
      findTasks.execute({
        status: 'pending',
        priority: 'high',
        limit: 20
      })
    ]);
    
    return {
      data: {
        ...state.data,
        currentSchedule: schedule.blocks,
        preferences,
        availableTasks: tasksResult.data?.results || [],
      },
      messages: [
        ...state.messages,
        new AIMessage(`Fetched ${schedule.blocks.length} blocks and ${tasksResult.data?.results?.length || 0} tasks`)
      ]
    };
  } catch (error) {
    console.error('[adaptiveScheduling] Error in fetchScheduleData:', error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error fetching data: ${error.message}. Continuing with defaults.`)
      ]
    };
  }
}

// Analyze current state
async function analyzeScheduleStateNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  try {
    const gaps = findScheduleGaps(state.data.currentSchedule, state.data.preferences);
    const inefficiencies = detectInefficiencies(state.data.currentSchedule);
    
    return {
      data: {
        ...state.data,
        gaps,
        inefficiencies,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Found ${gaps.length} gaps and ${inefficiencies.length} inefficiencies`)
      ]
    };
  } catch (error) {
    console.error('[adaptiveScheduling] Error in analyzeScheduleState:', error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error analyzing schedule: ${error.message}`)
      ]
    };
  }
}

// Placeholder for RAG context (Sprint 03.04)
async function fetchRAGContextNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // For now, just pass through
  return {
    ragContext: {
      patterns: [],
      recentDecisions: [],
      similarDays: [],
    }
  };
}

// Execute chosen strategy
async function executeStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const proposedChanges: Change[] = [];
  
  try {
    switch (state.data.strategy) {
      case "full":
        // Create complete schedule
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            type: "work",
            title: "Morning Deep Work",
            startTime: "09:00",
            endTime: "11:00",
          },
          reason: "Starting your day with focused work",
        });
        
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            type: "email",
            title: "Email Processing",
            startTime: "11:00",
            endTime: "11:30",
          },
          reason: "Dedicated time for email management",
        });
        
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            type: "break",
            title: "Lunch",
            startTime: state.data.preferences.lunch_start_time || "12:00",
            endTime: "13:00",
          },
          reason: "Protected lunch break",
        });
        break;
        
      case "optimize":
        // Fix inefficiencies
        state.data.inefficiencies.forEach(inefficiency => {
          if (inefficiency.type === "gap" && inefficiency.severity === "high") {
            proposedChanges.push({
              type: "consolidate",
              entity: "schedule",
              data: {
                affectedBlocks: inefficiency.affectedBlocks,
              },
              reason: inefficiency.description,
            });
          }
        });
        break;
        
      case "partial":
        // Fill gaps
        state.data.gaps.forEach(gap => {
          if (gap.duration >= 60) {
            proposedChanges.push({
              type: "create",
              entity: "block",
              data: {
                type: "work",
                title: "Focus Block",
                startTime: gap.startTime,
                endTime: gap.endTime,
              },
              reason: `Utilizing ${gap.duration}-minute gap`,
            });
          }
        });
        break;
        
      case "task_only":
        // Just assign tasks
        const workBlocks = state.data.currentSchedule.filter(b => b.type === "work");
        state.data.availableTasks.slice(0, 5).forEach((task, index) => {
          if (workBlocks[index]) {
            proposedChanges.push({
              type: "assign",
              entity: "task",
              data: {
                taskId: task.id,
                blockId: workBlocks[index].id,
              },
              reason: `Assigning high-priority task to work block`,
            });
          }
        });
        break;
    }
    
    return { proposedChanges };
  } catch (error) {
    console.error('[adaptiveScheduling] Error in executeStrategy:', error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error executing strategy: ${error.message}`)
      ]
    };
  }
}

// Ensure breaks are protected
async function protectTimeBlocksNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // Check if lunch is protected
  const hasLunch = state.proposedChanges.some(c => 
    c.entity === "block" && c.data?.type === "break"
  ) || state.data.currentSchedule.some(b => isLunchTime(b));
  
  if (!hasLunch && state.data.preferences.lunch_start_time) {
    state.proposedChanges.push({
      type: "create",
      entity: "block",
      data: {
        type: "break",
        title: "Lunch",
        startTime: state.data.preferences.lunch_start_time,
        endTime: format(
          new Date(`2000-01-01 ${state.data.preferences.lunch_start_time}`).getTime() + 60 * 60 * 1000,
          'HH:mm'
        ),
      },
      reason: "Protecting lunch break",
    });
  }
  
  return state;
}

// Validate no conflicts
async function validateScheduleNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // Simple validation for now
  return {
    messages: [
      ...state.messages,
      new AIMessage(`Validated ${state.proposedChanges.length} proposed changes`)
    ]
  };
}

// Generate natural language proposal
async function generateProposalNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const summary = generateNaturalSummary(state.proposedChanges);
  
  return {
    messages: [
      ...state.messages,
      new AIMessage(summary)
    ],
    data: {
      ...state.data,
      summary,
    }
  };
}
```

### 2. Email Management Workflow (Full Implementation)

// ... existing code ...

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

## Critical Notes for Implementation

### 1. Import Paths
```typescript
// CORRECT - tools are exported from index
import { createTimeBlock, findTasks } from '@/modules/ai/tools';

// WRONG - don't import from subdirectories
import { createTimeBlock } from '@/modules/ai/tools/schedule/createTimeBlock';
```

### 2. Service Factory Usage
```typescript
// CORRECT - get instance and then services
const factory = ServiceFactory.getInstance();
const scheduleService = factory.getScheduleService();

// WRONG - ServiceFactory is not a namespace
const scheduleService = ServiceFactory.getScheduleService();
```

### 3. Tool Response Handling
```typescript
// CORRECT - check for error in response
const result = await findTasks.execute({ status: 'pending' });
if (result.error) {
  // Handle error
} else {
  const tasks = result.data?.results || [];
}

// WRONG - assuming success
const tasks = result.data.results; // Could throw if error
```

### 4. Workflow State Updates
```typescript
// CORRECT - return partial state updates
return {
  data: {
    ...state.data,
    newField: value
  }
};

// WRONG - mutating state
state.data.newField = value; // Don't mutate!
return state;
```

### 5. LangGraph Edge Definitions
```typescript
// CORRECT - use string node names
workflow.addEdge("fetchData", "analyzeData");

// WRONG - using function references
workflow.addEdge(fetchDataNode, analyzeDataNode);
```

## Common Pitfalls to Avoid

1. **Don't Call Tools Within Tools**
   - Tools should be atomic operations
   - Workflows orchestrate multiple tools

2. **Don't Forget Error Handling**
   - Every node needs try-catch
   - Return error in state, don't throw

3. **Don't Skip Parallel Fetching**
   - Use Promise.all for performance
   - 3 sequential calls = 3x slower

4. **Don't Hardcode User IDs**
   - Always get from state or getCurrentUserId()
   - Never assume a specific user

5. **Don't Mix Concerns**
   - Workflows orchestrate, tools execute
   - Keep domain logic in appropriate workflow

6. **Don't Forget Confirmation Flow**
   - Destructive operations need confirmation
   - Store proposals with TTL

7. **Don't Ignore Time Zones**
   - All times are in user's local time
   - Use date-fns for manipulation

## Debugging Tips

1. **Enable Workflow Logging**
```typescript
const DEBUG = true;
if (DEBUG) {
  workflow.beforeNode = async (node, state) => {
    console.log(`[Workflow] Entering ${node}`, state);
  };
}
```

2. **Test Individual Nodes**
```typescript
// Test node in isolation
const testState = { /* mock state */ };
const result = await fetchDataNode(testState);
console.log('Node result:', result);
```

3. **Check Tool Registry**
```typescript
// In chat route or test
console.log('Registered tools:', toolRegistry.listTools());
```

4. **Trace Execution Path**
```typescript
// Add to each node
console.log(`[${workflowName}] ${nodeName} executed`);
```

---

**Remember**: These workflows are the intelligence layer of dayli. They should make smart, context-aware decisions while remaining stateless and composable. Focus on clear domain boundaries and consistent interfaces.

The executor should reference the old workflows for LangGraph syntax but create entirely new implementations following these patterns. Delete the old workflows after understanding their structure.
