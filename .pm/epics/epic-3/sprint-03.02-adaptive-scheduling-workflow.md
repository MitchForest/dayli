# Sprint 03.02: Adaptive Scheduling Workflow

## ⚠️ IMPORTANT: Sprint 03.015 Prerequisites

**This sprint depends on architectural changes from Sprint 03.015. Before implementing:**

1. **All workflow tools MUST return standardized `ToolResult` format**:
   ```typescript
   import { toolSuccess, toolError, toolConfirmation } from '@/modules/ai/tools/types';
   
   // Example for scheduleDay tool:
   return toolSuccess(data, {
     type: 'schedule',
     content: proposedChanges
   }, {
     confirmationRequired: true,
     confirmationId,
     suggestions: ['Confirm changes', 'Show details']
   });
   ```

2. **Use the new standardized tools from Sprint 03.015**:
   - Email operations: `readEmailContent`, `draftEmailResponse`, `processEmailToTask`
   - Task operations: `createTask`, `editTask`, `deleteTask`, `findTasks`
   - Meeting operations: `scheduleMeeting`, `rescheduleMeeting`
   - Smart blocks: `createWorkBlock`, `createEmailBlock`

3. **Tool Registry is now used** - no manual tool imports needed in chat route

4. **ServiceFactory always returns real services** - no mock services

---

## Sprint Overview

**Sprint Number**: 03.02  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: IN PROGRESS

### Sprint Goal
Build an intelligent LangGraph workflow that adapts to any schedule state - whether empty, partially filled, or needing optimization. This workflow will be the brain behind dayli's scheduling, making smart decisions about when to place tasks, how to protect breaks, and how to optimize existing schedules.

### Context for Executor
In Sprint 03.01, we built individual tools (createTimeBlock, assignTaskToBlock, etc.) that the AI can call. Now we're combining these tools into a sophisticated workflow using LangGraph. Think of it as building a smart scheduling assistant that:
- Looks at the current schedule
- Understands what strategy to use (full planning vs filling gaps vs optimizing)
- Makes intelligent decisions about task placement
- Always protects lunch breaks
- Learns from user patterns stored in RAG (to be implemented in Sprint 03.04)

The workflow should handle ANY state gracefully - from "I have nothing scheduled" to "my day is packed, help me optimize."

## Prerequisites from Sprint 03.01

Before starting this sprint, verify:
- [x] All CRUD tools are working (createTimeBlock, moveTimeBlock, etc.) - VERIFIED
- [x] Chat endpoint successfully calls tools with `streamText` - VERIFIED
- [x] Database migrations for backlogs are complete - VERIFIED (task_backlog table exists)
- [x] Basic tool execution shows in the UI - VERIFIED (in ChatPanel.tsx)

## Implementation Plan (Executor Analysis)

### Investigation Findings
1. **Existing Workflow Pattern**: Found `dailyPlanning.ts` and `emailTriage.ts` using LangGraph with StateGraph
2. **Tool Integration**: All schedule tools properly implemented in `schedule-tools.ts`
3. **Database Schema**: 
   - `task_backlog` table exists with priority/urgency fields
   - `user_preferences` has new JSONB fields for break_schedule, open_time_preferences
4. **Service Architecture**: ServiceFactory pattern in place for data abstraction
5. **Type System**: Strong typing throughout with proper interfaces

### Technical Approach

#### Step 1: Create the Adaptive Scheduling Workflow
- **Files**: Create `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`
- **Pattern**: Follow existing LangGraph workflow patterns from `dailyPlanning.ts`
- **Details**: 
  - Implement state interface with all required fields
  - Create nodes: fetchData, analyzeState, determineStrategy, fullPlanning, partialPlanning, optimization, taskAssignment, protectBreaks, validateSchedule, generateSummary
  - Use conditional edges for strategy routing
  - Ensure proper TypeScript typing throughout

#### Step 2: Create Workflow Tools Integration
- **Files**: Create `apps/web/modules/ai/tools/workflow-tools.ts`
- **Pattern**: Follow existing tool patterns from `schedule-tools.ts` using AI SDK's `tool` function
- **Details**: 
  - Create `scheduleDay` tool that invokes the workflow
  - Create `confirmScheduleChanges` tool for applying proposed changes
  - Store proposals in memory with TTL
  - Return confirmation IDs for two-step process

#### Step 3: Create Helper Functions
- **Files**: Create `apps/web/modules/workflows/utils/scheduleHelpers.ts`
- **Pattern**: Pure utility functions similar to existing utils
- **Details**: 
  - Time parsing/formatting functions
  - Gap finding algorithm
  - Conflict detection
  - Schedule analysis helpers
  - Summary generation

#### Step 4: Create Calendar Protection Service (Mock)
- **Files**: Create `apps/web/modules/schedule/services/calendarProtection.ts`
- **Pattern**: Service class with interface for future Google Calendar integration
- **Details**: 
  - Mock implementation that simulates calendar blocking
  - Prepared interface for real implementation in Sprint 03.05
  - Auto-decline logic placeholder

#### Step 5: Update Tool Exports
- **Files**: Update `apps/web/modules/ai/tools/index.ts`
- **Pattern**: Add new tool exports alongside existing ones
- **Details**: Export scheduleDay and confirmScheduleChanges

#### Step 6: Integrate with Chat Endpoint
- **Files**: Update `apps/web/app/api/chat/route.ts`
- **Pattern**: Add new tools to the tools object
- **Details**: Import and include workflow tools in the tool registry

### Database Operations
- No new migrations needed - all required tables exist
- Will use existing `time_blocks`, `task_backlog`, and `user_preferences` tables
- Preference JSONB fields already support break_schedule and open_time_preferences

### Type Definitions
```typescript
// New types to create in workflow file
interface SchedulingState {
  userId: string;
  date: string;
  currentSchedule: TimeBlock[];
  unassignedTasks: Task[];
  taskBacklog: TaskBacklog[];
  userPreferences: UserPreferences;
  ragContext?: RAGContext; // Optional for now
  strategy?: "full" | "partial" | "optimize" | "task_only";
  proposedChanges: ScheduleChange[];
  messages: BaseMessage[];
}

interface ScheduleChange {
  action: "create" | "move" | "delete" | "assign";
  description: string;
  details: any; // Will be properly typed based on action
}

interface TimeGap {
  startTime: string;
  endTime: string;
  duration: number; // in minutes
}

interface RAGContext {
  patterns?: any[]; // Placeholder for Sprint 03.04
  recentDecisions?: any[];
}
```

### UI/UX Implementation
- Text-based summaries of proposed changes (no visual preview)
- Streaming progress updates via onStepFinish
- Clear indication of which strategy was selected
- Natural language explanations of all changes

## Questions Requiring Clarification - WITH REVIEWER GUIDANCE

### 1. RAG Context Interface
**Finding**: Sprint doc mentions RAG context will be populated in Sprint 03.04
**Question**: Should I create a placeholder RAGContext interface now or leave it as `any`?
**Recommendation**: Create minimal interface with optional fields:
```typescript
interface RAGContext {
  patterns?: UserPattern[];
  recentDecisions?: Decision[];
  similarDays?: DayContext[];
}
```
This can be expanded in Sprint 03.04 without breaking changes.

**✅ REVIEWER GUIDANCE**: Your recommendation is correct. Create the minimal interface exactly as shown. Define the sub-types as empty interfaces for now:
```typescript
interface UserPattern {}
interface Decision {}
interface DayContext {}
```
This provides type safety while allowing Sprint 03.04 to expand them without breaking changes.

### 2. Calendar Protection Implementation
**Finding**: Need to auto-decline meetings during protected time
**Question**: Should this be a full mock or just interface definitions?
**Recommendation**: Create a mock service that:
- Simulates calendar event creation
- Logs auto-decline actions
- Returns mock calendar event IDs
- Has full interface ready for Google Calendar API

**✅ REVIEWER GUIDANCE**: Your recommendation is perfect. Create a full mock implementation that:
1. Logs all actions to console with `[MOCK CALENDAR]` prefix
2. Returns realistic mock data (event IDs like `mock_event_${Date.now()}`)
3. Simulates delays with `await new Promise(resolve => setTimeout(resolve, 100))`
4. Implements the full interface that Sprint 03.05 will use
5. Add TODO comments at each method indicating what the real implementation will do

### 3. Proposed Changes Storage
**Finding**: Need to store proposals between tool calls
**Question**: In-memory Map or database storage?
**Recommendation**: Use in-memory Map with 5-minute TTL:
```typescript
const proposalStore = new Map<string, {
  changes: ScheduleChange[];
  timestamp: Date;
  userId: string;
}>();
```
Simple, fast, and sufficient for MVP. Can migrate to Redis/DB later if needed.

**✅ REVIEWER GUIDANCE**: Correct approach. Additionally:
1. Create a cleanup function that runs every minute to remove expired entries
2. Use crypto.randomUUID() for confirmation IDs
3. Add a maximum store size limit (100 entries) to prevent memory leaks
4. Log when proposals expire for debugging

### 4. Error Recovery Strategy
**Finding**: Workflow needs graceful failure handling
**Question**: Full rollback or partial success on errors?
**Recommendation**: Partial success with clear reporting:
- Continue processing remaining changes
- Track failed changes separately
- Return summary indicating successes and failures
- Let user decide whether to retry failed changes

**✅ REVIEWER GUIDANCE**: Good recommendation. Enhance it with:
1. Wrap each change execution in try-catch
2. Categorize errors: 
   - Recoverable (retry automatically once)
   - Non-recoverable (skip and report)
3. Include error details in the summary
4. Store failed changes separately so user can retry specific ones
5. Never leave the schedule in an inconsistent state

### 5. Strategy Determination Logic
**Finding**: Need smart routing based on schedule state
**Question**: Should strategy determination use LLM or rule-based logic?
**Recommendation**: Hybrid approach:
- Rule-based for clear cases (empty schedule → full planning)
- LLM for ambiguous cases (partially filled with complex constraints)
- This balances speed with intelligence

**✅ REVIEWER GUIDANCE**: Excellent approach. Implement like this:
```typescript
// First try rules
if (state.currentSchedule.length === 0) return "full";
if (state.currentSchedule.length >= 8 && state.unassignedTasks.length === 0) return "optimize";
if (state.unassignedTasks.length > 0 && hasAvailableFocusBlocks(state)) return "task_only";

// Fall back to LLM for complex cases
return await determineLLMStrategy(state);
```
This ensures fast, predictable behavior for common cases while maintaining flexibility.

### 6. Lunch Break Timing
**Finding**: User preferences have lunch_start_time but workflow needs to handle conflicts
**Question**: If lunch time is occupied, how far should we move it?
**Recommendation**: 
- Try ±30 minutes first
- Then ±1 hour
- If still no space, ask user for preference
- Never skip lunch entirely

**✅ REVIEWER GUIDANCE**: Perfect approach. Additionally:
1. Always prefer moving lunch later rather than earlier
2. Check user's calendar patterns from previous days (when RAG is available)
3. If moving lunch, ensure at least 30 minutes gap from adjacent meetings
4. Add a comment in the summary explaining why lunch was moved
5. Store the lunch move decision for future learning (prepare the data structure even if RAG isn't ready)

## Success Criteria
- [ ] All TypeScript types properly defined (no `any` except where necessary)
- [ ] Zero lint errors/warnings
- [ ] Follows existing LangGraph patterns
- [ ] Proper error handling at each node
- [ ] Workflow completes in <3 seconds
- [ ] Lunch break always protected
- [ ] Natural language summaries
- [ ] Confirmation flow working
- [ ] High-priority backlog tasks included
- [ ] All strategies (full/partial/optimize/task_only) implemented
- [ ] Time helper functions have unit tests
- [ ] Mock calendar protection service ready for real implementation
- [ ] [ADDITION] Schedule Optimization Workflow implemented and tested
- [ ] [ADDITION] Optimization respects all constraints (meetings, lunch, work hours)
- [ ] [ADDITION] Both workflows share helper utilities effectively

## Key Concepts

### What is LangGraph?
LangGraph is a library for building stateful, multi-step workflows with LLMs. Unlike simple tool calling, it allows:
- **State Management**: Track data across multiple steps
- **Conditional Logic**: Different paths based on decisions
- **Error Recovery**: Handle failures gracefully
- **Streaming Updates**: Real-time progress to UI

### Workflow vs Tools
- **Tools**: Single-purpose functions (create a block, move a task)
- **Workflows**: Multi-step processes that coordinate tools intelligently

Example: "Plan my day" workflow:
1. Fetch current schedule and tasks
2. Analyze what's already scheduled
3. Decide strategy (full plan vs partial)
4. Create time blocks
5. Assign tasks to blocks
6. Validate no conflicts
7. Return summary

## Key Deliverables

### 1. Create the Adaptive Scheduling Workflow

**File**: `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// Define the state that flows through the workflow
interface SchedulingState {
  userId: string;
  date: string;
  currentSchedule: TimeBlock[];
  unassignedTasks: Task[];
  taskBacklog: TaskBacklog[];
  userPreferences: UserPreferences;
  ragContext?: RAGContext; // Will be populated in Sprint 03.04
  strategy?: "full" | "partial" | "optimize" | "task_only";
  proposedChanges: ScheduleChange[];
  messages: BaseMessage[];
}

// Define what changes we're proposing
interface ScheduleChange {
  action: "create" | "move" | "delete" | "assign";
  description: string;
  details: any;
}

export function createAdaptiveSchedulingWorkflow() {
  const workflow = new StateGraph<SchedulingState>({
    channels: {
      userId: null,
      date: null,
      currentSchedule: null,
      unassignedTasks: null,
      taskBacklog: null,
      userPreferences: null,
      ragContext: null,
      strategy: null,
      proposedChanges: [],
      messages: [],
    },
  });

  // Add nodes (each node is a step in the workflow)
  workflow.addNode("fetchData", fetchDataNode);
  workflow.addNode("analyzeState", analyzeCurrentStateNode);
  workflow.addNode("determineStrategy", determineStrategyNode);
  workflow.addNode("fullPlanning", fullPlanningNode);
  workflow.addNode("partialPlanning", partialPlanningNode);
  workflow.addNode("optimization", optimizationNode);
  workflow.addNode("taskAssignment", taskAssignmentNode);
  workflow.addNode("protectBreaks", protectBreaksNode);
  workflow.addNode("validateSchedule", validateScheduleNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Define the flow
  workflow.addEdge("fetchData", "analyzeState");
  workflow.addEdge("analyzeState", "determineStrategy");
  
  // Conditional routing based on strategy
  workflow.addConditionalEdges(
    "determineStrategy",
    (state) => state.strategy || "full",
    {
      full: "fullPlanning",
      partial: "partialPlanning",
      optimize: "optimization",
      task_only: "taskAssignment",
    }
  );

  // All strategies converge to break protection
  workflow.addEdge("fullPlanning", "protectBreaks");
  workflow.addEdge("partialPlanning", "protectBreaks");
  workflow.addEdge("optimization", "protectBreaks");
  workflow.addEdge("taskAssignment", "protectBreaks");
  
  workflow.addEdge("protectBreaks", "validateSchedule");
  workflow.addEdge("validateSchedule", "generateSummary");
  workflow.addEdge("generateSummary", END);

  workflow.setEntryPoint("fetchData");

  return workflow.compile();
}

### 2. Implement Workflow Nodes

Each node is a function that takes state and returns updated state. Here are the key nodes:

#### Fetch Data Node
```typescript
async function fetchDataNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // Fetch all necessary data in parallel for efficiency
  const [schedule, tasks, backlog, preferences] = await Promise.all([
    scheduleService.getScheduleForDate(state.date, state.userId),
    taskService.getUnassignedTasks(state.userId),
    taskService.getTaskBacklog(state.userId),
    preferencesService.getUserPreferences(state.userId),
  ]);

  return {
    currentSchedule: schedule.blocks,
    unassignedTasks: tasks,
    taskBacklog: backlog.filter(t => t.priority > 70), // Only high priority from backlog
    userPreferences: preferences,
  };
}
```

#### Analyze Current State Node
```typescript
async function analyzeCurrentStateNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const analysis = {
    totalScheduledHours: 0,
    hasLunchBreak: false,
    hasFocusTime: false,
    hasEmailTime: false,
    gaps: [] as TimeGap[],
    conflicts: [] as Conflict[],
  };

  // Analyze existing schedule
  state.currentSchedule.forEach(block => {
    const duration = calculateDuration(block.startTime, block.endTime);
    analysis.totalScheduledHours += duration;
    
    if (block.type === "break" && isLunchTime(block)) {
      analysis.hasLunchBreak = true;
    }
    if (block.type === "focus") {
      analysis.hasFocusTime = true;
    }
    if (block.type === "email") {
      analysis.hasEmailTime = true;
    }
  });

  // Find gaps in schedule
  analysis.gaps = findScheduleGaps(state.currentSchedule, state.userPreferences);

  // Add analysis to messages for the strategy determiner
  return {
    messages: [
      ...state.messages,
      new HumanMessage(`Schedule analysis: ${JSON.stringify(analysis)}`),
    ],
  };
}
```

#### Determine Strategy Node (Router)
```typescript
async function determineStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const model = new ChatOpenAI({ temperature: 0 });
  
  const prompt = `Based on the schedule analysis, determine the best strategy:
  
  Current state:
  - Scheduled hours: ${state.currentSchedule.length}
  - Unassigned tasks: ${state.unassignedTasks.length}
  - High priority backlog: ${state.taskBacklog.length}
  
  Strategies:
  - "full": Empty or nearly empty schedule, needs complete planning
  - "partial": Some blocks exist, fill in the gaps
  - "optimize": Full schedule but could be improved
  - "task_only": Just assign tasks to existing blocks
  
  Choose the most appropriate strategy.`;

  const response = await model.invoke([
    new SystemMessage(prompt),
    ...state.messages,
  ]);

  // Parse strategy from response
  const strategy = parseStrategy(response.content);

  return {
    strategy,
    messages: [...state.messages, response],
  };
}

#### Full Planning Node
```typescript
async function fullPlanningNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const proposedChanges: ScheduleChange[] = [];
  const workStart = parseTime(state.userPreferences.work_start_time);
  const workEnd = parseTime(state.userPreferences.work_end_time);
  
  // 1. Create morning focus block (2 hours)
  proposedChanges.push({
    action: "create",
    description: "Morning deep work session",
    details: {
      type: "focus",
      title: "Deep Work",
      startTime: workStart,
      endTime: addHours(workStart, 2),
    },
  });

  // 2. Add short break
  proposedChanges.push({
    action: "create",
    description: "Morning break",
    details: {
      type: "break",
      title: "Break",
      startTime: addHours(workStart, 2),
      endTime: addMinutes(addHours(workStart, 2), 15),
    },
  });

  // 3. Email triage block
  proposedChanges.push({
    action: "create",
    description: "Email and communication time",
    details: {
      type: "email",
      title: "Email Triage",
      startTime: addMinutes(addHours(workStart, 2), 15),
      endTime: addHours(workStart, 3),
    },
  });

  // 4. Lunch break (always protected)
  const lunchTime = parseTime(state.userPreferences.lunch_start_time || "12:00");
  proposedChanges.push({
    action: "create",
    description: "Lunch break",
    details: {
      type: "break",
      title: "Lunch",
      startTime: lunchTime,
      endTime: addMinutes(lunchTime, state.userPreferences.lunch_duration_minutes || 60),
    },
  });

  // 5. Afternoon focus block
  proposedChanges.push({
    action: "create",
    description: "Afternoon deep work",
    details: {
      type: "focus",
      title: "Deep Work",
      startTime: addHours(lunchTime, 1),
      endTime: addHours(lunchTime, 3),
    },
  });

  // 6. End of day email check
  proposedChanges.push({
    action: "create",
    description: "End of day emails",
    details: {
      type: "email",
      title: "Email Review",
      startTime: addHours(workEnd, -1),
      endTime: workEnd,
    },
  });

  return { proposedChanges };
}
```

#### Partial Planning Node
```typescript
async function partialPlanningNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const proposedChanges: ScheduleChange[] = [];
  const gaps = findScheduleGaps(state.currentSchedule, state.userPreferences);
  
  // Fill gaps intelligently
  for (const gap of gaps) {
    if (gap.duration >= 120) { // 2+ hour gap
      proposedChanges.push({
        action: "create",
        description: `Fill ${gap.duration}min gap with focus time`,
        details: {
          type: "focus",
          title: "Deep Work",
          startTime: gap.startTime,
          endTime: gap.endTime,
        },
      });
    } else if (gap.duration >= 30) { // 30min+ gap
      proposedChanges.push({
        action: "create",
        description: `Use ${gap.duration}min gap for emails`,
        details: {
          type: "email",
          title: "Quick Emails",
          startTime: gap.startTime,
          endTime: gap.endTime,
        },
      });
    }
    // Gaps under 30min are left as buffer time
  }

  return { proposedChanges };
}
```

#### Protect Breaks Node
```typescript
async function protectBreaksNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const updatedChanges = [...state.proposedChanges];
  const lunchTime = parseTime(state.userPreferences.lunch_start_time || "12:00");
  const lunchDuration = state.userPreferences.lunch_duration_minutes || 60;
  
  // Check if lunch break exists in current schedule or proposed changes
  const hasLunchBreak = 
    state.currentSchedule.some(block => 
      block.type === "break" && isTimeOverlap(block, lunchTime, lunchDuration)
    ) ||
    updatedChanges.some(change => 
      change.action === "create" && 
      change.details.type === "break" &&
      isTimeOverlap(change.details, lunchTime, lunchDuration)
    );

  if (!hasLunchBreak) {
    // Find what's scheduled during lunch and move it
    const lunchConflicts = findConflicts(state.currentSchedule, lunchTime, lunchDuration);
    
    for (const conflict of lunchConflicts) {
      updatedChanges.push({
        action: "move",
        description: `Moving ${conflict.title} to make room for lunch`,
        details: {
          blockId: conflict.id,
          newStartTime: findNextAvailableTime(state.currentSchedule, conflict.duration),
        },
      });
    }

    // Add lunch break
    updatedChanges.push({
      action: "create",
      description: "Protected lunch break",
      details: {
        type: "break",
        title: "Lunch",
        startTime: formatTime(lunchTime),
        endTime: formatTime(addMinutes(lunchTime, lunchDuration)),
        protected: true, // This will auto-decline meetings
      },
    });
  }

  return { proposedChanges: updatedChanges };
}
```

#### Generate Summary Node
```typescript
async function generateSummaryNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // Group changes by type for cleaner summary
  const changesByType = {
    create: state.proposedChanges.filter(c => c.action === "create"),
    move: state.proposedChanges.filter(c => c.action === "move"),
    delete: state.proposedChanges.filter(c => c.action === "delete"),
    assign: state.proposedChanges.filter(c => c.action === "assign"),
  };

  // Generate human-readable summary
  const summary = generateReadableSummary(changesByType);
  
  // Add summary to state for the AI to use
  return {
    messages: [
      ...state.messages,
      new AIMessage(summary),
    ],
  };
}
```

### 3. Integrate Workflow as an AI Tool

**File**: `apps/web/modules/ai/tools/workflow-tools.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { createAdaptiveSchedulingWorkflow } from "@/modules/workflows/graphs/adaptiveScheduling";

export const scheduleDay = tool({
  description: "Intelligently plan or adjust the daily schedule",
  parameters: z.object({
    date: z.string().optional().describe("YYYY-MM-DD format, defaults to today"),
    includeBacklog: z.boolean().default(true).describe("Include high-priority backlog tasks"),
    preferences: z.object({
      focusTime: z.enum(["morning", "afternoon", "both"]).optional(),
      emailBatching: z.boolean().default(true),
    }).optional(),
  }),
  execute: async ({ date, includeBacklog, preferences }) => {
    const workflow = createAdaptiveSchedulingWorkflow();
    const targetDate = date || format(new Date(), "yyyy-MM-dd");
    
    // Run the workflow
    const result = await workflow.invoke({
      userId: getCurrentUserId(),
      date: targetDate,
      includeBacklog,
      preferences,
      proposedChanges: [],
      messages: [],
    });

    // Format the proposed changes for display
    const formattedSummary = formatWorkflowResult(result);
    
    // Store proposed changes for confirmation
    await storeProposedChanges(result.proposedChanges);
    
    return {
      success: true,
      summary: formattedSummary,
      changeCount: result.proposedChanges.length,
      requiresConfirmation: true,
      confirmationId: generateConfirmationId(),
    };
  },
});
```

### 4. Add Confirmation Tool

**File**: `apps/web/modules/ai/tools/workflow-tools.ts`

```typescript
export const confirmScheduleChanges = tool({
  description: "Confirm and apply proposed schedule changes",
  parameters: z.object({
    confirmationId: z.string(),
    confirmed: z.boolean(),
    modifications: z.array(z.object({
      changeIndex: z.number(),
      newDetails: z.any(),
    })).optional(),
  }),
  execute: async ({ confirmationId, confirmed, modifications }) => {
    if (!confirmed) {
      return { success: true, message: "Changes cancelled" };
    }

    const proposedChanges = await getProposedChanges(confirmationId);
    if (!proposedChanges) {
      return { success: false, message: "Confirmation expired or not found" };
    }

    // Apply modifications if any
    const finalChanges = modifications 
      ? applyModifications(proposedChanges, modifications)
      : proposedChanges;

    // Execute all changes
    const results = [];
    for (const change of finalChanges) {
      try {
        const result = await executeScheduleChange(change);
        results.push(result);
      } catch (error) {
        // Rollback on failure
        await rollbackChanges(results);
        throw error;
      }
    }

    return {
      success: true,
      message: `Applied ${results.length} changes to your schedule`,
      appliedChanges: results,
    };
  },
});
```

### 5. Helper Functions

**File**: `apps/web/modules/workflows/utils/scheduleHelpers.ts`

```typescript
// Time parsing and manipulation
export function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function addHours(date: Date, hours: number): Date {
  return addHours(date, hours);
}

export function addMinutes(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

// Schedule analysis
export function findScheduleGaps(
  blocks: TimeBlock[], 
  preferences: UserPreferences
): TimeGap[] {
  const gaps: TimeGap[] = [];
  const sortedBlocks = [...blocks].sort((a, b) => 
    parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime()
  );

  const workStart = parseTime(preferences.work_start_time);
  const workEnd = parseTime(preferences.work_end_time);

  // Check gap at start of day
  if (sortedBlocks.length === 0 || parseTime(sortedBlocks[0].startTime) > workStart) {
    gaps.push({
      startTime: formatTime(workStart),
      endTime: sortedBlocks[0]?.startTime || formatTime(workEnd),
      duration: calculateDuration(workStart, sortedBlocks[0] ? parseTime(sortedBlocks[0].startTime) : workEnd),
    });
  }

  // Check gaps between blocks
  for (let i = 0; i < sortedBlocks.length - 1; i++) {
    const currentEnd = parseTime(sortedBlocks[i].endTime);
    const nextStart = parseTime(sortedBlocks[i + 1].startTime);
    const gapDuration = calculateDuration(currentEnd, nextStart);

    if (gapDuration > 15) { // Only gaps > 15 minutes
      gaps.push({
        startTime: sortedBlocks[i].endTime,
        endTime: sortedBlocks[i + 1].startTime,
        duration: gapDuration,
      });
    }
  }

  // Check gap at end of day
  const lastBlock = sortedBlocks[sortedBlocks.length - 1];
  if (lastBlock && parseTime(lastBlock.endTime) < workEnd) {
    gaps.push({
      startTime: lastBlock.endTime,
      endTime: formatTime(workEnd),
      duration: calculateDuration(parseTime(lastBlock.endTime), workEnd),
    });
  }

  return gaps;
}

// Conflict detection
export function findConflicts(
  blocks: TimeBlock[], 
  startTime: Date, 
  durationMinutes: number
): TimeBlock[] {
  const endTime = addMinutes(startTime, durationMinutes);
  
  return blocks.filter(block => {
    const blockStart = parseTime(block.startTime);
    const blockEnd = parseTime(block.endTime);
    
    return (
      (blockStart >= startTime && blockStart < endTime) ||
      (blockEnd > startTime && blockEnd <= endTime) ||
      (blockStart <= startTime && blockEnd >= endTime)
    );
  });
}

// Summary generation
export function generateReadableSummary(changesByType: ChangesByType): string {
  const parts = [];

  if (changesByType.create.length > 0) {
    parts.push(`I'll add ${changesByType.create.length} new blocks to your schedule:`);
    changesByType.create.forEach(change => {
      parts.push(`- ${change.description} from ${change.details.startTime} to ${change.details.endTime}`);
    });
  }

  if (changesByType.move.length > 0) {
    parts.push(`\nI'll move ${changesByType.move.length} existing blocks:`);
    changesByType.move.forEach(change => {
      parts.push(`- ${change.description}`);
    });
  }

  if (changesByType.assign.length > 0) {
    parts.push(`\nI'll assign ${changesByType.assign.length} tasks:`);
    changesByType.assign.forEach(change => {
      parts.push(`- ${change.description}`);
    });
  }

  parts.push('\nYour lunch break at 12:00 PM is protected. Is this schedule OK?');

  return parts.join('\n');
}
```

### 6. Calendar Protection Implementation

**File**: `apps/web/modules/schedule/services/calendarProtection.ts`

```typescript
import { google } from 'googleapis';

export class CalendarProtectionService {
  private calendar = google.calendar('v3');

  async protectTimeBlock(block: TimeBlock, userId: string) {
    const userCalendar = await getUserCalendarId(userId);
    
    // Create a calendar event that shows as "busy"
    const event = {
      summary: block.title,
      description: `Protected time: ${block.type}`,
      start: {
        dateTime: combineDateAndTime(block.date, block.startTime),
        timeZone: getUserTimezone(userId),
      },
      end: {
        dateTime: combineDateAndTime(block.date, block.endTime),
        timeZone: getUserTimezone(userId),
      },
      // This makes the time show as busy and auto-decline conflicts
      transparency: 'opaque',
      visibility: 'private',
      reminders: {
        useDefault: false,
      },
      // Custom property to identify dayli-managed blocks
      extendedProperties: {
        private: {
          dayliBlockId: block.id,
          dayliBlockType: block.type,
          autoDecline: 'true',
        },
      },
    };

    const response = await this.calendar.events.insert({
      calendarId: userCalendar,
      requestBody: event,
    });

    return response.data;
  }

  async handleIncomingMeetingRequest(event: CalendarEvent, userId: string) {
    // Check if the meeting conflicts with protected time
    const conflicts = await findProtectedTimeConflicts(
      event.start,
      event.end,
      userId
    );

    if (conflicts.length > 0) {
      // Auto-decline the meeting
      await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: event.id,
        requestBody: {
          attendees: [{
            email: getUserEmail(userId),
            responseStatus: 'declined',
            comment: 'This time is blocked for focused work. Please find another time.',
          }],
        },
      });

      // Notify the user via chat
      await notifyUserOfDeclinedMeeting(event, conflicts[0]);
    }
  }
}
```

### 7. [ADDITION] Schedule Optimization Workflow

**Note**: This workflow was identified as missing from the original sprint planning but is listed in the epic tracker under "Core Workflows to Implement". It complements the Adaptive Scheduling Workflow by providing non-destructive schedule improvements.

**File**: `apps/web/modules/workflows/graphs/scheduleOptimization.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

interface OptimizationState {
  userId: string;
  date: string;
  currentSchedule: TimeBlock[];
  userPreferences: UserPreferences;
  ragContext?: RAGContext;
  inefficiencies: Inefficiency[];
  optimizations: ScheduleOptimization[];
  messages: BaseMessage[];
}

interface Inefficiency {
  type: "gap" | "fragmentation" | "poor_timing" | "task_mismatch";
  description: string;
  blocks: TimeBlock[];
  impact: "low" | "medium" | "high";
}

interface ScheduleOptimization {
  description: string;
  changes: ScheduleChange[];
  benefit: string;
  estimatedTimeGain: number; // in minutes
}

export function createScheduleOptimizationWorkflow() {
  const workflow = new StateGraph<OptimizationState>({
    channels: {
      userId: null,
      date: null,
      currentSchedule: null,
      userPreferences: null,
      ragContext: null,
      inefficiencies: [],
      optimizations: [],
      messages: [],
    },
  });

  // Add nodes
  workflow.addNode("analyzeEfficiency", analyzeEfficiencyNode);
  workflow.addNode("identifyOptimizations", identifyOptimizationsNode);
  workflow.addNode("respectConstraints", respectConstraintsNode);
  workflow.addNode("proposeChanges", proposeChangesNode);
  workflow.addNode("calculateBenefits", calculateBenefitsNode);

  // Define flow
  workflow.addEdge("analyzeEfficiency", "identifyOptimizations");
  workflow.addEdge("identifyOptimizations", "respectConstraints");
  workflow.addEdge("respectConstraints", "proposeChanges");
  workflow.addEdge("proposeChanges", "calculateBenefits");
  workflow.addEdge("calculateBenefits", END);

  workflow.setEntryPoint("analyzeEfficiency");

  return workflow.compile();
}

// Analyze current schedule for inefficiencies
async function analyzeEfficiencyNode(state: OptimizationState): Promise<Partial<OptimizationState>> {
  const inefficiencies: Inefficiency[] = [];
  
  // 1. Find small gaps (15-30 minutes) that are too short to be productive
  const gaps = findScheduleGaps(state.currentSchedule, state.userPreferences);
  gaps.forEach(gap => {
    if (gap.duration >= 15 && gap.duration < 30) {
      inefficiencies.push({
        type: "gap",
        description: `${gap.duration}-minute gap between blocks is too short for productive work`,
        blocks: getAdjacentBlocks(state.currentSchedule, gap),
        impact: "medium",
      });
    }
  });

  // 2. Find fragmented focus time (multiple small focus blocks instead of consolidated ones)
  const focusBlocks = state.currentSchedule.filter(b => b.type === "focus");
  if (focusBlocks.length > 2) {
    const totalFocusTime = focusBlocks.reduce((sum, block) => 
      sum + calculateDuration(block.startTime, block.endTime), 0
    );
    if (totalFocusTime < 240) { // Less than 4 hours total
      inefficiencies.push({
        type: "fragmentation",
        description: "Focus time is fragmented across multiple small blocks",
        blocks: focusBlocks,
        impact: "high",
      });
    }
  }

  // 3. Check for poor timing (e.g., deep work scheduled right after lunch)
  const lunchBlock = state.currentSchedule.find(b => 
    b.type === "break" && isLunchTime(b)
  );
  if (lunchBlock) {
    const postLunchBlock = state.currentSchedule.find(b => 
      b.startTime === lunchBlock.endTime && b.type === "focus"
    );
    if (postLunchBlock) {
      inefficiencies.push({
        type: "poor_timing",
        description: "Deep work scheduled immediately after lunch (low energy time)",
        blocks: [postLunchBlock],
        impact: "medium",
      });
    }
  }

  return { inefficiencies };
}

// Identify possible optimizations
async function identifyOptimizationsNode(state: OptimizationState): Promise<Partial<OptimizationState>> {
  const optimizations: ScheduleOptimization[] = [];

  // For each inefficiency, generate optimization suggestions
  state.inefficiencies.forEach(inefficiency => {
    switch (inefficiency.type) {
      case "gap":
        // Suggest extending adjacent blocks to fill gaps
        const [before, after] = inefficiency.blocks;
        if (before && before.type === "focus") {
          optimizations.push({
            description: "Extend focus block to eliminate unproductive gap",
            changes: [{
              action: "move",
              description: `Extend ${before.title} by ${inefficiency.description.match(/\d+/)[0]} minutes`,
              details: {
                blockId: before.id,
                newEndTime: after.startTime,
              },
            }],
            benefit: "Eliminates context switching and maximizes deep work time",
            estimatedTimeGain: 15,
          });
        }
        break;

      case "fragmentation":
        // Suggest consolidating focus blocks
        const focusBlocks = inefficiency.blocks;
        const totalDuration = focusBlocks.reduce((sum, b) => 
          sum + calculateDuration(b.startTime, b.endTime), 0
        );
        
        optimizations.push({
          description: "Consolidate fragmented focus time into 2 larger blocks",
          changes: [
            // This would be more complex in practice, showing simplified version
            {
              action: "delete",
              description: "Remove small focus blocks",
              details: { blockIds: focusBlocks.slice(2).map(b => b.id) },
            },
            {
              action: "move",
              description: "Extend morning focus block",
              details: {
                blockId: focusBlocks[0].id,
                newEndTime: addMinutes(parseTime(focusBlocks[0].startTime), totalDuration * 0.6),
              },
            },
          ],
          benefit: "Deeper focus with less context switching",
          estimatedTimeGain: 30,
        });
        break;

      case "poor_timing":
        // Suggest moving deep work to high-energy times
        optimizations.push({
          description: "Move deep work to morning high-energy time",
          changes: [{
            action: "move",
            description: "Swap post-lunch deep work with email time",
            details: {
              blockId: inefficiency.blocks[0].id,
              newStartTime: "09:00",
              newEndTime: "11:00",
            },
          }],
          benefit: "Align challenging work with peak mental energy",
          estimatedTimeGain: 20,
        });
        break;
    }
  });

  return { optimizations };
}

// Ensure optimizations respect constraints
async function respectConstraintsNode(state: OptimizationState): Promise<Partial<OptimizationState>> {
  // Filter out optimizations that would violate constraints
  const validOptimizations = state.optimizations.filter(opt => {
    // Never move or modify meetings
    const affectsMeetings = opt.changes.some(change => {
      const block = state.currentSchedule.find(b => b.id === change.details.blockId);
      return block?.type === "meeting";
    });
    if (affectsMeetings) return false;

    // Never touch lunch break
    const affectsLunch = opt.changes.some(change => {
      const block = state.currentSchedule.find(b => b.id === change.details.blockId);
      return block?.type === "break" && isLunchTime(block);
    });
    if (affectsLunch) return false;

    // Respect user preferences (e.g., no work before work_start_time)
    const respectsWorkHours = opt.changes.every(change => {
      if (change.details.newStartTime) {
        const time = parseTime(change.details.newStartTime);
        const workStart = parseTime(state.userPreferences.work_start_time);
        const workEnd = parseTime(state.userPreferences.work_end_time);
        return time >= workStart && time <= workEnd;
      }
      return true;
    });
    if (!respectsWorkHours) return false;

    return true;
  });

  return { optimizations: validOptimizations };
}

// Create the tool for this workflow
export const optimizeScheduleTool = tool({
  description: 'Analyze and optimize an existing schedule for better efficiency',
  parameters: z.object({
    date: z.string().optional().describe("Date to optimize (defaults to today)"),
  }),
  execute: async (params) => {
    const workflow = createScheduleOptimizationWorkflow();
    const userId = await getCurrentUserId();
    
    const result = await workflow.invoke({
      userId,
      date: params.date || format(new Date(), 'yyyy-MM-dd'),
      currentSchedule: await scheduleService.getScheduleForDate(params.date, userId),
      userPreferences: await preferencesService.getUserPreferences(userId),
    });

    if (result.optimizations.length === 0) {
      return {
        message: "Your schedule looks well-optimized! No improvements needed.",
      };
    }

    // Store optimization proposal
    const proposalId = crypto.randomUUID();
    optimizationProposals.set(proposalId, {
      optimizations: result.optimizations,
      timestamp: new Date(),
      userId,
    });

    // Clean summary for user
    const totalTimeGain = result.optimizations.reduce((sum, opt) => sum + opt.estimatedTimeGain, 0);
    const summary = `I found ${result.optimizations.length} ways to optimize your schedule:

${result.optimizations.map((opt, i) => 
  `${i + 1}. ${opt.description}
   Benefit: ${opt.benefit}
   Time saved: ~${opt.estimatedTimeGain} minutes`
).join('\n\n')}

Total potential time savings: ${totalTimeGain} minutes

Would you like me to apply these optimizations? (Confirmation ID: ${proposalId})`;

    return { message: summary, proposalId };
  }
});
```

#### Integration with Adaptive Scheduling

The Schedule Optimization Workflow complements the Adaptive Scheduling Workflow:

1. **When to use each**:
   - **Adaptive Scheduling**: When creating or modifying schedule (morning planning, adding new tasks)
   - **Schedule Optimization**: When improving existing schedule (finding inefficiencies, consolidating blocks)

2. **Shared utilities**: Both workflows can use the same helper functions from `scheduleHelpers.ts`

3. **User experience**:
   - "Plan my day" → Adaptive Scheduling
   - "Optimize my schedule" → Schedule Optimization
   - "Make my day more efficient" → Schedule Optimization

4. **Key differences**:
   - Adaptive creates/fills, Optimization improves
   - Adaptive is constructive, Optimization is analytical
   - Adaptive handles any state, Optimization requires existing schedule

#### Testing the Optimization Workflow

**Test Case 1: Gap Elimination**
- Create schedule with 20-minute gaps between blocks
- Run optimization
- Should suggest extending blocks to fill gaps

**Test Case 2: Focus Consolidation**
- Create 4 small 45-minute focus blocks
- Run optimization  
- Should suggest combining into 2 larger blocks

**Test Case 3: Constraint Respect**
- Create schedule with meetings and lunch
- Run optimization
- Should never suggest moving meetings or lunch

**Test Case 4: Energy Alignment**
- Put deep work after lunch
- Run optimization
- Should suggest moving to morning

## Testing Guide

### Scenario 1: Empty Schedule (Full Planning)
**Test**: User says "Plan my day" with no existing blocks

**Expected Behavior**:
1. Workflow detects empty schedule
2. Creates full day structure:
   - 9:00-11:00 Deep Work
   - 11:00-11:15 Break
   - 11:15-12:00 Email Triage
   - 12:00-13:00 Lunch (protected)
   - 13:00-15:00 Deep Work
   - 16:00-17:00 Email Review
3. AI responds: "I'll create a complete schedule for today with 2 focus blocks, email time, and protected lunch. Is this OK?"

### Scenario 2: Partial Schedule (Gap Filling)
**Test**: User has a 9am meeting and 3pm meeting, says "Fill in my day"

**Expected Behavior**:
1. Workflow detects existing meetings
2. Identifies gaps:
   - 10:00-12:00 (2 hour gap)
   - 13:00-15:00 (2 hour gap)
3. Proposes:
   - 10:00-12:00 Deep Work
   - 12:00-13:00 Lunch
   - 13:00-15:00 Deep Work
4. AI responds with specific gap-filling plan

### Scenario 3: Lunch Protection
**Test**: User has a meeting scheduled 12-1pm, says "Plan my day"

**Expected Behavior**:
1. Workflow detects lunch conflict
2. Proposes moving the meeting
3. Creates protected lunch block
4. AI responds: "I notice you have a meeting during lunch. I'll move it to 2pm and protect your lunch break at noon."

### Scenario 4: Task Assignment Only
**Test**: User has full schedule but unassigned tasks, says "Schedule my tasks"

**Expected Behavior**:
1. Workflow detects full schedule with focus blocks
2. Assigns tasks to existing focus blocks
3. No new blocks created
4. AI responds: "I'll assign your 3 tasks to your existing focus blocks."

### Scenario 5: Optimization
**Test**: User has inefficient schedule (many small gaps), says "Optimize my schedule"

**Expected Behavior**:
1. Workflow analyzes current efficiency
2. Proposes consolidating blocks
3. Maintains meeting times
4. AI responds with optimization plan

## Common Issues & Solutions

### Issue: "Workflow not found" error
**Cause**: Workflow not properly imported in tools
**Solution**: 
```typescript
// In workflow-tools.ts
import { createAdaptiveSchedulingWorkflow } from "@/modules/workflows/graphs/adaptiveScheduling";
```

### Issue: Time parsing errors
**Cause**: Inconsistent time formats
**Solution**: Always use HH:MM format, validate with regex:
```typescript
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
if (!timeRegex.test(timeStr)) throw new Error("Invalid time format");
```

### Issue: Workflow hangs or times out
**Cause**: Infinite loop in conditional edges
**Solution**: Add maximum iteration check:
```typescript
if (state.iterations > 10) {
  return END;
}
```

### Issue: Calendar protection not working
**Cause**: Missing Google Calendar permissions
**Solution**: Ensure OAuth scope includes:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

## Debugging LangGraph Workflows

### Enable Debug Logging
```typescript
const workflow = createAdaptiveSchedulingWorkflow();
workflow.debug = true; // Shows each node execution

// Or use custom logging
workflow.beforeNode = async (nodeName, state) => {
  console.log(`Entering node: ${nodeName}`, state);
};
```

### Visualize Workflow Execution
```typescript
// Add to workflow creation
const trace = [];
workflow.afterNode = async (nodeName, state) => {
  trace.push({ node: nodeName, timestamp: Date.now() });
};

// After execution
console.log("Workflow trace:", trace);
```

### Test Individual Nodes
```typescript
// Test a node in isolation
const testState = {
  currentSchedule: [],
  userPreferences: mockPreferences,
  // ... other required state
};

const result = await fullPlanningNode(testState);
console.log("Node output:", result);
```

## Integration Checklist

- [ ] LangGraph workflow file created
- [ ] All nodes implemented and tested
- [ ] Workflow integrated as AI tool
- [ ] Confirmation flow working
- [ ] Helper functions tested
- [ ] Calendar protection enabled
- [ ] Time parsing handles edge cases
- [ ] Lunch break always protected
- [ ] Text summaries are clear and natural
- [ ] Error handling for all failure modes

## Success Criteria

1. **Adaptive Behavior**: Workflow correctly identifies and executes appropriate strategy
2. **Lunch Protection**: Lunch break is never double-booked
3. **Natural Summaries**: AI explains changes in human terms
4. **Quick Execution**: Workflow completes in <3 seconds
5. **Error Recovery**: Failures don't leave schedule in broken state
6. **Calendar Sync**: Protected blocks appear as busy in Google Calendar
7. **Backlog Integration**: High-priority tasks from backlog are included

## Next Sprint Preview

Sprint 03.03 will implement email triage workflows that:
- Analyze importance and urgency
- Batch similar emails
- Create appropriate time blocks
- Maintain email backlog

The scheduling workflow from this sprint will be enhanced to automatically create email blocks when needed.

---

**Remember**: This workflow is the brain of dayli's scheduling. It should feel intelligent and adaptive, not rigid or rule-based. Test with various schedule states to ensure it handles edge cases gracefully. 

## Reviewer Guidance - Additional Implementation Notes

### Critical Implementation Details

#### 1. Import Organization
Ensure clean imports following the existing pattern:
```typescript
// External imports first
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { format, addHours, addMinutes } from "date-fns";

// Internal imports grouped by feature
import { scheduleService } from "@/services/factory/service.factory";
import { TimeBlock, Task, TaskBacklog, UserPreferences } from "@/modules/schedule/types/schedule.types";
import { getCurrentUserId } from "@/lib/utils";
```

#### 2. Error Handling Pattern
Every node should follow this pattern:
```typescript
async function someNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  try {
    // Node logic here
    return { /* updates */ };
  } catch (error) {
    console.error(`[adaptiveScheduling] Error in someNode:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error in scheduling: ${error.message}. Continuing with partial results.`)
      ]
    };
  }
}
```

#### 3. Time Utility Functions
Fix the circular reference in the helper functions:
```typescript
import { addHours as dateFnsAddHours, addMinutes as dateFnsAddMinutes } from "date-fns";

export function addHours(date: Date, hours: number): Date {
  return dateFnsAddHours(date, hours);
}
```

#### 4. Testing Requirements
Create a test file `adaptiveScheduling.test.ts` that covers:
- Each strategy path (full, partial, optimize, task_only)
- Lunch break protection scenarios
- Error recovery
- Time parsing edge cases
- Proposal storage and retrieval

#### 5. Performance Optimization
1. Use `Promise.all()` for parallel data fetching in fetchDataNode
2. Implement caching for user preferences (they don't change during workflow)
3. Add timing logs for each node to ensure <3 second completion
4. Limit the number of proposed changes to 20 to prevent UI overload

#### 6. Type Safety Enhancements
Replace the `any` in ScheduleChange details with a discriminated union:
```typescript
type ScheduleChangeDetails = 
  | { action: "create"; type: BlockType; title: string; startTime: string; endTime: string; }
  | { action: "move"; blockId: string; newStartTime: string; newEndTime: string; }
  | { action: "delete"; blockId: string; }
  | { action: "assign"; taskId: string; blockId: string; };

interface ScheduleChange {
  action: "create" | "move" | "delete" | "assign";
  description: string;
  details: ScheduleChangeDetails;
}
```

#### 7. Workflow Debugging
Add a debug mode that can be enabled via environment variable:
```typescript
const DEBUG_WORKFLOW = process.env.NEXT_PUBLIC_DEBUG_WORKFLOW === 'true';

if (DEBUG_WORKFLOW) {
  workflow.beforeNode = async (nodeName, state) => {
    console.log(`[WORKFLOW] Entering ${nodeName}`, {
      scheduleCount: state.currentSchedule.length,
      changesCount: state.proposedChanges.length,
      strategy: state.strategy
    });
  };
}
```

#### 8. Summary Generation Enhancement
Make summaries more conversational:
- Use "your" instead of "the" (e.g., "your lunch break" not "the lunch break")
- Add time context (e.g., "this morning" instead of just times)
- Include total hours scheduled
- Mention if this gives a good work-life balance

#### 9. Integration Points
Ensure these files are updated:
1. `apps/web/modules/ai/tools/index.ts` - Export both new tools
2. `apps/web/app/api/chat/route.ts` - Import and include in tools object
3. Create `apps/web/modules/workflows/utils/index.ts` for clean exports

#### 10. Mock Calendar Service Structure
```typescript
export class MockCalendarProtectionService implements ICalendarProtectionService {
  async protectTimeBlock(block: TimeBlock, userId: string): Promise<CalendarEvent> {
    console.log(`[MOCK CALENDAR] Protecting time block:`, block);
    await this.simulateApiDelay();
    
    // TODO: In Sprint 03.05, this will create actual Google Calendar events
    return {
      id: `mock_event_${Date.now()}`,
      status: 'confirmed',
      htmlLink: `https://calendar.google.com/mock/${Date.now()}`
    };
  }
  
  private async simulateApiDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Final Review Checklist
Before marking this sprint complete:
1. Run `bun run lint` - must show 0 errors, 0 warnings
2. Run `bun run typecheck` - must show 0 errors  
3. Test all 5 scenarios in the Testing Guide
4. Verify workflow completes in <3 seconds
5. Ensure natural language summaries read well
6. Confirm lunch protection works in all cases
7. Check that high-priority backlog items are included

### Common Pitfalls to Avoid
1. Don't use `any` types except in the RAGContext placeholder
2. Don't forget to handle timezone differences
3. Don't create blocks that overlap
4. Don't modify the existing schedule directly - only propose changes
5. Don't skip error handling in any node

Remember: This is the brain of dayli. Make it smart, but keep it simple and maintainable. Good luck! 🚀 