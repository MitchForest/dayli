# Sprint 03.02: Adaptive Scheduling Workflow

## Sprint Overview

**Sprint Number**: 03.02  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: NOT STARTED

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
- [ ] All CRUD tools are working (createTimeBlock, moveTimeBlock, etc.)
- [ ] Chat endpoint successfully calls tools with `streamText`
- [ ] Database migrations for backlogs are complete
- [ ] Basic tool execution shows in the UI

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