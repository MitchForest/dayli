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
   - Task operations: `createTask`, `editTask`, `deleteTask`, `findTasks` (with natural language support)
   - Meeting operations: `scheduleMeeting`, `rescheduleMeeting`
   - Smart blocks: `createWorkBlock`, `createEmailBlock`
   - Workflow persistence: `WorkflowPersistenceService`

3. **Tool Registry is now used** - no manual tool imports needed in chat route

4. **ServiceFactory always returns real services** - no mock services

---

## Sprint Overview

**Sprint Number**: 03.02  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: PLANNING

### Sprint Goal
Build ONE intelligent LangGraph workflow that adapts to any schedule state - whether empty, partially filled, or needing optimization. This workflow will be the brain behind dayli's scheduling, making smart decisions about when to place tasks, how to protect breaks, and how to optimize existing schedules.

### What Changed from Original Plan
Based on architectural review, we're:
- **Combining** the two workflows (adaptive + optimization) into one intelligent system
- **Leveraging** smart tools from Sprint 03.015 instead of recreating functionality
- **Removing** mock calendar service (moved to Sprint 03.05)
- **Integrating** with WorkflowPersistenceService for state management
- **Building on** existing `scheduleDay` tool rather than starting from scratch

### Context for Executor
In Sprint 03.015, we built:
- Individual tools (createTimeBlock, assignTaskToBlock, etc.)
- Smart block creation tools (createWorkBlock, createEmailBlock)
- Enhanced task finding with natural language understanding
- Workflow persistence infrastructure

Now we're combining these tools into a sophisticated LangGraph workflow. Think of it as building a smart scheduling assistant that:
- Analyzes the current schedule state
- Intelligently chooses a strategy (create, fill, optimize, or just assign tasks)
- Uses smart tools to execute the strategy
- Always protects lunch breaks
- Learns from patterns (preparation for Sprint 03.04 RAG integration)

## Prerequisites from Sprint 03.015

Before starting this sprint, verify:
- [x] ToolResult format implemented for all tools
- [x] Tool Registry with auto-discovery working
- [x] Smart block creation tools (`createWorkBlock`, `createEmailBlock`)
- [x] Enhanced task finding with natural language support
- [x] WorkflowPersistenceService available
- [x] All services are real (no mocks)
- [x] Chat endpoint using `streamText` with tool registry

## Implementation Plan (Updated)

### Technical Approach - Single Adaptive Workflow

#### Step 1: Enhance Existing scheduleDay Tool
- **Files**: Update `apps/web/modules/ai/tools/workflow/scheduleDay.ts`
- **Pattern**: Build on existing tool, add LangGraph workflow internally
- **Details**: 
  - Keep existing tool interface
  - Replace simple logic with adaptive LangGraph workflow
  - Integrate with smart tools from Sprint 03.015
  - Add workflow persistence

#### Step 2: Create the Adaptive Scheduling Workflow
- **Files**: Create `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`
- **Pattern**: Follow existing LangGraph patterns from `dailyPlanning.ts`
- **Details**: 
  - Single workflow with multiple strategies
  - Strategies: `full`, `partial`, `optimize`, `task_only`
  - Nodes: fetchData, analyzeState, determineStrategy, executeStrategy, protectBreaks, validateSchedule, generateSummary
  - Use conditional edges for strategy routing
  - Call smart tools instead of manual block creation

#### Step 3: Create Helper Functions
- **Files**: Create `apps/web/modules/workflows/utils/scheduleHelpers.ts`
- **Pattern**: Pure utility functions for schedule analysis
- **Details**: 
  - Time parsing/formatting functions
  - Gap finding algorithm
  - Inefficiency detection (for optimize strategy)
  - Conflict detection
  - Summary generation

#### Step 4: Integrate with Workflow Persistence
- **Files**: Update workflow to use `WorkflowPersistenceService`
- **Pattern**: Wrap workflow with `createPersistentWorkflow`
- **Details**: 
  - Save state between nodes
  - Allow resuming interrupted workflows
  - Track execution history
  - 5-minute TTL for proposals

#### Step 5: Update Tool Registry
- **Files**: Ensure `scheduleDay` is properly exported
- **Pattern**: Tool already in registry via auto-discovery
- **Details**: Just verify it's in the workflow directory

### Key Changes from Original Plan

1. **ONE Workflow**: No separate optimization workflow - it's a strategy
2. **Smart Tools**: Use `createWorkBlock` and `createEmailBlock` instead of manual creation
3. **No Mocks**: No calendar protection service - just add `protected: boolean` flag
4. **Persistence**: Integrate with WorkflowPersistenceService from day one
5. **Natural Language**: Leverage enhanced `findTasks` that understands "pending", "todo", etc.

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
- [ ] All TypeScript types properly defined (no `any` except RAGContext placeholder)
- [ ] Zero lint errors/warnings
- [ ] Follows existing LangGraph patterns from `dailyPlanning.ts`
- [ ] Proper error handling at each node
- [ ] Workflow completes in <3 seconds
- [ ] Lunch break always protected
- [ ] Natural language summaries using user's terminology
- [ ] Confirmation flow working with WorkflowPersistenceService
- [ ] Uses `createWorkBlock` and `createEmailBlock` for smart block creation
- [ ] Uses enhanced `findTasks` with natural language support
- [ ] All strategies (full/partial/optimize/task_only) implemented in ONE workflow
- [ ] Optimization strategy finds and fixes inefficiencies
- [ ] Time helper functions have unit tests
- [ ] Integrates with standardized ToolResult format
- [ ] Works with Tool Registry auto-discovery

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

### 1. Enhanced scheduleDay Tool

**File**: `apps/web/modules/ai/tools/workflow/scheduleDay.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation } from '../types';
import { createAdaptiveSchedulingWorkflow } from '@/modules/workflows/graphs/adaptiveScheduling';
import { createPersistentWorkflow } from '@/modules/workflows/services/workflowPersistence';

export const scheduleDay = tool({
  description: "Intelligently plan, adjust, or optimize your daily schedule",
  parameters: z.object({
    date: z.string().optional().describe("YYYY-MM-DD format, defaults to today"),
    intent: z.enum(['plan', 'optimize', 'auto']).default('auto').describe("Hint for workflow strategy"),
    includeBacklog: z.boolean().default(true).describe("Include high-priority tasks from backlog"),
    preferences: z.object({
      protectLunch: z.boolean().default(true),
      consolidateFocus: z.boolean().default(true),
      preferMorningFocus: z.boolean().default(true),
    }).optional(),
  }),
  execute: async ({ date, intent, includeBacklog, preferences }) => {
    try {
      // Create workflow with persistence
      const baseWorkflow = createAdaptiveSchedulingWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'scheduling');
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const userId = await getCurrentUserId();
      
      // Run the adaptive workflow
      const result = await workflow.invoke({
        userId,
        date: targetDate,
        intentHint: intent,
        includeBacklog,
        userPreferences: preferences,
        proposedChanges: [],
        messages: [],
      });
      
      // Handle results based on what happened
      if (result.proposedChanges.length === 0) {
        return toolSuccess(
          { message: 'Your schedule is already well-optimized!', strategy: result.strategy },
          { type: 'text', content: 'No changes needed - your schedule looks great!' },
          { suggestions: ['Show my schedule', 'Add a new task', 'Check tomorrow'] }
        );
      }
      
      // Store proposals and return confirmation
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedChanges);
      
      return toolConfirmation(
        {
          proposedChanges: result.proposedChanges,
          strategy: result.strategy,
          summary: result.summary,
        },
        confirmationId,
        result.summary // Natural language summary from workflow
      );
      
    } catch (error) {
      return toolError(
        'SCHEDULE_WORKFLOW_FAILED',
        `Failed to process schedule: ${error.message}`,
        error
      );
    }
  },
});
```

### 2. Create the Single Adaptive Scheduling Workflow

**File**: `apps/web/modules/workflows/graphs/adaptiveScheduling.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ServiceFactory } from "@/services/factory/service.factory";
import { 
  createWorkBlock, 
  createEmailBlock, 
  findTasks,
  assignTaskToBlock 
} from "@/modules/ai/tools";

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
      inefficiencies: [],
      proposedChanges: [],
      messages: [],
    },
  });

  // Add nodes
  workflow.addNode("fetchData", fetchDataNode);
  workflow.addNode("analyzeState", analyzeStateNode);
  workflow.addNode("determineStrategy", determineStrategyNode);
  workflow.addNode("executeStrategy", executeStrategyNode);
  workflow.addNode("protectBreaks", protectBreaksNode);
  workflow.addNode("validateSchedule", validateScheduleNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Define the flow
  workflow.addEdge("fetchData", "analyzeState");
  workflow.addEdge("analyzeState", "determineStrategy");
  workflow.addEdge("determineStrategy", "executeStrategy");
  workflow.addEdge("executeStrategy", "protectBreaks");
  workflow.addEdge("protectBreaks", "validateSchedule");
  workflow.addEdge("validateSchedule", "generateSummary");
  workflow.addEdge("generateSummary", END);

  workflow.setEntryPoint("fetchData");

  return workflow.compile();
}
```

### 3. Implement Key Workflow Nodes

#### Fetch Data Node - Uses Smart Tools
```typescript
async function fetchDataNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const factory = ServiceFactory.getInstance();
  const scheduleService = factory.getScheduleService();
  const preferencesService = factory.getPreferencesService();
  
  // Fetch schedule and preferences in parallel
  const [schedule, preferences] = await Promise.all([
    scheduleService.getScheduleForDate(state.date, state.userId),
    preferencesService.getUserPreferences(state.userId),
  ]);
  
  // Use enhanced findTasks to get both unassigned and backlog
  const taskResult = await findTasks.execute({
    status: 'pending', // Will be mapped to 'backlog' by the tool
    priority: 'high',
    limit: 20,
  });
  
  return {
    currentSchedule: schedule.blocks,
    unassignedTasks: taskResult.data.tasks.filter(t => !t.blockId),
    taskBacklog: taskResult.data.tasks,
    userPreferences: preferences,
  };
}
```

#### Analyze State Node - Detects Inefficiencies
```typescript
async function analyzeStateNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const analysis = {
    totalScheduledHours: 0,
    hasLunchBreak: false,
    hasFocusTime: false,
    hasEmailTime: false,
    gaps: [] as TimeGap[],
    inefficiencies: [] as Inefficiency[],
  };

  // Basic analysis
  state.currentSchedule.forEach(block => {
    const duration = calculateDuration(block.startTime, block.endTime);
    analysis.totalScheduledHours += duration / 60;
    
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

  // Find gaps
  analysis.gaps = findScheduleGaps(state.currentSchedule, state.userPreferences);
  
  // Detect inefficiencies for optimization
  if (state.currentSchedule.length > 0) {
    // Small unproductive gaps
    analysis.gaps.forEach(gap => {
      if (gap.duration >= 15 && gap.duration < 30) {
        analysis.inefficiencies.push({
          type: "gap",
          description: `${gap.duration}-minute gap is too short for productive work`,
          severity: "medium",
          affectedBlocks: getAdjacentBlockIds(state.currentSchedule, gap),
        });
      }
    });
    
    // Fragmented focus time
    const focusBlocks = state.currentSchedule.filter(b => b.type === "focus");
    if (focusBlocks.length > 2) {
      analysis.inefficiencies.push({
        type: "fragmentation",
        description: "Focus time is fragmented across multiple blocks",
        severity: "high",
        affectedBlocks: focusBlocks.map(b => b.id),
      });
    }
  }

  return {
    messages: [
      ...state.messages,
      new HumanMessage(`Schedule analysis: ${JSON.stringify(analysis)}`),
    ],
    inefficiencies: analysis.inefficiencies,
  };
}
```

#### Determine Strategy Node - Smart Routing
```typescript
async function determineStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const { currentSchedule, unassignedTasks, inefficiencies, intentHint } = state;
  
  let strategy: SchedulingState['strategy'];
  
  // Rule-based strategy selection
  if (currentSchedule.length === 0) {
    strategy = "full";
  } else if (inefficiencies.length > 2 && currentSchedule.length >= 4) {
    strategy = "optimize";
  } else if (unassignedTasks.length > 0 && hasAvailableFocusBlocks(currentSchedule)) {
    strategy = "task_only";
  } else if (hasSignificantGaps(state)) {
    strategy = "partial";
  } else if (intentHint === 'optimize') {
    strategy = "optimize";
  } else {
    strategy = "task_only"; // Default to least disruptive
  }
  
  return {
    strategy,
    messages: [
      ...state.messages,
      new AIMessage(`Selected strategy: ${strategy}`),
    ],
  };
}
```

#### Execute Strategy Node - Uses Smart Tools
```typescript
async function executeStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const proposedChanges: ScheduleChange[] = [];
  
  switch (state.strategy) {
    case "full":
      // Use smart tools to create a full day
      const morningBlock = await createWorkBlock.execute({
        duration: 120,
        timePreference: 'morning',
        maxTasks: 3,
      });
      
      if (morningBlock.data.success) {
        proposedChanges.push({
          action: "create",
          description: "Morning deep work session",
          block: morningBlock.data.block,
        });
      }
      
      // Add email block
      const emailBlock = await createEmailBlock.execute({
        duration: 45,
        timePreference: '11:00am',
        emailTypes: ['urgent', 'important'],
      });
      
      if (emailBlock.data.success) {
        proposedChanges.push({
          action: "create",
          description: "Email triage time",
          block: emailBlock.data.block,
        });
      }
      
      // Always add lunch
      proposedChanges.push({
        action: "create",
        description: "Lunch break",
        block: {
          type: "break",
          title: "Lunch",
          startTime: state.userPreferences.lunch_start_time || "12:00",
          endTime: "13:00",
          protected: true,
        },
      });
      break;
      
    case "optimize":
      // Fix inefficiencies
      state.inefficiencies?.forEach(inefficiency => {
        if (inefficiency.type === "gap" && inefficiency.affectedBlocks.length === 2) {
          // Extend the first block to fill the gap
          const [beforeId, afterId] = inefficiency.affectedBlocks;
          const afterBlock = state.currentSchedule.find(b => b.id === afterId);
          
          if (afterBlock) {
            proposedChanges.push({
              action: "move",
              description: `Extend block to eliminate ${inefficiency.description}`,
              blockId: beforeId,
              newStartTime: state.currentSchedule.find(b => b.id === beforeId)!.startTime,
              newEndTime: afterBlock.startTime,
            });
          }
        }
        
        if (inefficiency.type === "fragmentation") {
          // Consolidate focus blocks
          const blocks = inefficiency.affectedBlocks
            .map(id => state.currentSchedule.find(b => b.id === id))
            .filter(Boolean);
          
          // Keep first two, remove others
          blocks.slice(2).forEach(block => {
            proposedChanges.push({
              action: "delete",
              description: "Remove fragmented focus block",
              blockId: block!.id,
            });
          });
        }
      });
      break;
      
    case "partial":
      // Fill significant gaps with smart blocks
      const gaps = findScheduleGaps(state.currentSchedule, state.userPreferences);
      for (const gap of gaps) {
        if (gap.duration >= 90) {
          const workBlock = await createWorkBlock.execute({
            duration: gap.duration,
            timePreference: gap.startTime,
            maxTasks: Math.floor(gap.duration / 30),
          });
          
          if (workBlock.data.success) {
            proposedChanges.push({
              action: "create",
              description: `Fill ${gap.duration}-minute gap with productive work`,
              block: workBlock.data.block,
            });
          }
        }
      }
      break;
      
    case "task_only":
      // Just assign tasks to existing blocks
      const focusBlocks = state.currentSchedule.filter(b => b.type === "focus");
      for (const task of state.unassignedTasks.slice(0, 5)) {
        const targetBlock = findBestBlockForTask(task, focusBlocks);
        if (targetBlock) {
          proposedChanges.push({
            action: "assign",
            description: `Assign "${task.title}" to ${targetBlock.title}`,
            taskId: task.id,
            blockId: targetBlock.id,
          });
        }
      }
      break;
  }
  
  return { proposedChanges };
}
```

### 4. Helper Functions

**File**: `apps/web/modules/workflows/utils/scheduleHelpers.ts`

```typescript
import { format, parse, addMinutes, differenceInMinutes } from 'date-fns';

// Time parsing that handles multiple formats
export function parseTime(timeStr: string): Date {
  // Handle formats: "14:00", "2:00 PM", "2pm"
  const cleaned = timeStr.trim().toLowerCase();
  const today = new Date();
  
  // Try parsing different formats
  if (cleaned.includes(':')) {
    const [hours, minutes] = cleaned.replace(/[ap]m/i, '').split(':').map(Number);
    const isPM = cleaned.includes('pm');
    const adjustedHours = isPM && hours !== 12 ? hours + 12 : hours;
    today.setHours(adjustedHours, minutes, 0, 0);
  } else if (cleaned.match(/^\d{1,2}[ap]m$/)) {
    const hours = parseInt(cleaned);
    const isPM = cleaned.includes('pm');
    const adjustedHours = isPM && hours !== 12 ? hours + 12 : hours;
    today.setHours(adjustedHours, 0, 0, 0);
  }
  
  return today;
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

// Generate natural language summary
export function generateReadableSummary(
  changes: ScheduleChange[], 
  strategy: string
): string {
  const parts = [];
  
  // Strategy-specific intro
  switch (strategy) {
    case "full":
      parts.push("I'll create a complete schedule for your day:");
      break;
    case "partial":
      parts.push("I'll fill the gaps in your schedule:");
      break;
    case "optimize":
      parts.push("I'll optimize your schedule for better efficiency:");
      break;
    case "task_only":
      parts.push("I'll assign your tasks to existing time blocks:");
      break;
  }
  
  // Group changes by type
  const grouped = changes.reduce((acc, change) => {
    if (!acc[change.action]) acc[change.action] = [];
    acc[change.action].push(change);
    return acc;
  }, {} as Record<string, ScheduleChange[]>);
  
  // Describe changes
  if (grouped.create) {
    parts.push(`\n• Creating ${grouped.create.length} new blocks:`);
    grouped.create.forEach(change => {
      if (change.action === 'create') {
        parts.push(`  - ${change.block.title} at ${change.block.startTime}`);
      }
    });
  }
  
  if (grouped.move) {
    parts.push(`\n• Moving ${grouped.move.length} blocks:`);
    grouped.move.forEach(change => {
      parts.push(`  - ${change.description}`);
    });
  }
  
  if (grouped.assign) {
    parts.push(`\n• Assigning ${grouped.assign.length} tasks:`);
    grouped.assign.forEach(change => {
      parts.push(`  - ${change.description}`);
    });
  }
  
  parts.push('\n\nYour lunch break is protected. Would you like me to apply these changes?');
  
  return parts.join('\n');
}

// Check if block is lunch time
export function isLunchTime(block: TimeBlock): boolean {
  const blockStart = parseTime(block.startTime);
  const lunchStart = parseTime("11:30");
  const lunchEnd = parseTime("13:30");
  
  return blockStart >= lunchStart && blockStart <= lunchEnd && 
         block.type === "break";
}

// Find best block for a task
export function findBestBlockForTask(
  task: Task, 
  focusBlocks: TimeBlock[]
): TimeBlock | null {
  // Simple algorithm - find block with least tasks
  const blocksWithCapacity = focusBlocks.filter(block => {
    const duration = calculateDuration(block.startTime, block.endTime);
    const currentTaskTime = (block.tasks?.length || 0) * 30; // Assume 30 min per task
    return duration - currentTaskTime >= task.estimatedMinutes;
  });
  
  if (blocksWithCapacity.length === 0) return null;
  
  // Return block with fewest tasks
  return blocksWithCapacity.reduce((best, block) => 
    (block.tasks?.length || 0) < (best.tasks?.length || 0) ? block : best
  );
}
```

## Testing Guide

### Scenario 1: Empty Schedule (Full Planning Strategy)
**Test**: User says "Plan my day" with no existing blocks

**Expected Behavior**:
1. Workflow detects empty schedule → selects "full" strategy
2. Uses smart tools to create:
   - Morning work block with high-priority tasks
   - Email block with urgent emails
   - Protected lunch break
   - Afternoon work block
3. AI responds: "I'll create a complete schedule for your day..."

### Scenario 2: Partial Schedule (Gap Filling Strategy)
**Test**: User has a 9am meeting and 3pm meeting, says "Fill in my day"

**Expected Behavior**:
1. Workflow detects gaps → selects "partial" strategy
2. Calls `createWorkBlock` for each significant gap
3. Respects existing meetings
4. AI responds: "I'll fill the gaps in your schedule..."

### Scenario 3: Schedule Optimization (Optimize Strategy)
**Test**: User has fragmented schedule with small gaps, says "Make my day more efficient"

**Expected Behavior**:
1. Workflow detects inefficiencies → selects "optimize" strategy
2. Finds:
   - 20-minute gaps (too small to be productive)
   - 4 separate 45-minute focus blocks
3. Proposes:
   - Extend blocks to eliminate gaps
   - Consolidate focus time into 2 larger blocks
4. AI responds: "I'll optimize your schedule for better efficiency..."

### Scenario 4: Task Assignment (Task Only Strategy)
**Test**: User has full schedule with empty focus blocks, says "Add my tasks to today"

**Expected Behavior**:
1. Workflow detects existing blocks → selects "task_only" strategy
2. Uses `findTasks` to get high-priority pending tasks
3. Assigns tasks to blocks with capacity
4. AI responds: "I'll assign your tasks to existing time blocks..."

### Scenario 5: Natural Language Understanding
**Test**: User says "I have too many small breaks, can you fix that?"

**Expected Behavior**:
1. Workflow understands intent → selects "optimize" strategy
2. Identifies and consolidates small gaps
3. AI responds with optimization plan

### Scenario 6: Lunch Protection Edge Case
**Test**: User has meeting at 12pm, workflow needs to plan day

**Expected Behavior**:
1. Any strategy will protect lunch
2. Proposes moving the meeting
3. Creates protected lunch block
4. AI explains: "I notice you have a meeting during lunch time..."

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

### Type Definitions

```typescript
// State that flows through the workflow
interface SchedulingState {
  userId: string;
  date: string;
  currentSchedule: TimeBlock[];
  unassignedTasks: Task[];
  taskBacklog: Task[]; // From enhanced findTasks tool
  userPreferences: UserPreferences;
  ragContext?: RAGContext; // Optional for now
  strategy?: "full" | "partial" | "optimize" | "task_only";
  proposedChanges: ScheduleChange[];
  inefficiencies?: Inefficiency[]; // For optimize strategy
  messages: BaseMessage[];
}

// Discriminated union for type-safe changes
type ScheduleChange = 
  | { action: "create"; description: string; block: Partial<TimeBlock>; }
  | { action: "move"; description: string; blockId: string; newStartTime: string; newEndTime: string; }
  | { action: "delete"; description: string; blockId: string; }
  | { action: "assign"; description: string; taskId: string; blockId: string; };

interface Inefficiency {
  type: "gap" | "fragmentation" | "poor_timing" | "task_mismatch";
  description: string;
  severity: "low" | "medium" | "high";
  affectedBlocks: string[]; // Block IDs
}

interface TimeGap {
  startTime: string;
  endTime: string;
  duration: number; // in minutes
}

// Placeholder interfaces for Sprint 03.04
interface RAGContext {
  patterns?: UserPattern[];
  recentDecisions?: Decision[];
  similarDays?: DayContext[];
}
interface UserPattern {}
interface Decision {}
interface DayContext {}
```

### Database Operations
- No new migrations needed - all required tables exist
- Will use existing tables:
  - `time_blocks` - for schedule blocks
  - `tasks` - for task management (status: 'backlog' | 'completed')
  - `user_preferences` - for work hours, lunch preferences
  - `workflow_states` - for persistence (from Sprint 03.015)
- Smart tools handle all database operations

### UI/UX Implementation
- Text-based summaries of proposed changes
- Streaming progress updates via `onStepFinish` in chat route
- Clear indication of strategy selected ("Planning your full day..." vs "Optimizing existing schedule...")
- Natural language explanations using user's terminology
- Confirmation flow with ability to modify proposals 