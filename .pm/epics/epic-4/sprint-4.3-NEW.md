# Sprint 4.3 NEW: Simplified Domain Workflows (80/20)

**Sprint Goal**: Implement 3 simplified AI workflows that work together to manage the user's day  
**Duration**: 3 days  
**Status**: IN PROGRESS - Schedule Workflow  
**Dependencies**: Sprint Fix-AI patterns must be followed

## Context

We're building three interconnected workflows that work together:
1. **Schedule Workflow** - Creates and manages time blocks for the day
2. **Task Workflow** - Fills work blocks with appropriate tasks
3. **Email Workflow** - Fills email blocks with emails to process

No backwards compatibility needed - this is a fresh implementation.

## The Three Workflows

### 1. Schedule Workflow (`workflow_schedule`)

**Purpose**: Creates and manages the TIME BLOCK structure of the day

**What it does**:
- Creates different types of blocks: work, meetings, email, breaks, blocked time
- Can work with empty schedule or reorganize existing blocks
- Responds to user feedback (e.g., "I want a 2-hour lunch")
- Smart about existing commitments

**Input**:
```typescript
{
  date?: string;              // defaults to today
  preferences?: {
    workStart?: string;       // "09:00"
    workEnd?: string;         // "17:00"
    lunchDuration?: number;   // minutes (default: 60)
    breakDuration?: number;   // minutes (default: 15)
  };
  feedback?: string;          // "I need a 2-hour lunch and blocked time in afternoon"
}
```

**Output**:
```typescript
{
  success: boolean;
  date: string;
  blocks: Array<{
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'lunch' | 'blocked';
    title: string;
    startTime: string;        // "09:00"
    endTime: string;          // "11:00"
    duration: number;         // minutes
    isProtected?: boolean;    // can't be moved (e.g., existing meetings)
  }>;
  changes: Array<{
    action: 'created' | 'moved' | 'removed';
    block: string;            // block title
    reason: string;
  }>;
  summary: string;            // "Created 3 work blocks, 1 email block, lunch, and 2 breaks"
}
```

### 2. Task Workflow (`workflow_fillWorkBlock`)

**Purpose**: Determines which tasks should go into a specific work block

**What it does**:
- Takes a work block and fills it with appropriate tasks
- Uses simple scoring: priority + age
- Matches task duration to block duration
- Returns tasks that fit well together

**Input**:
```typescript
{
  blockId: string;            // ID of the work block to fill
  blockDuration: number;      // minutes available
  blockTime?: string;         // "morning" | "afternoon" (for context)
}
```

**Output**:
```typescript
{
  success: boolean;
  blockId: string;
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    priority: 'high' | 'medium' | 'low';
    score: number;            // simple 0-100
    reason: string;           // "High priority, fits time slot"
  }>;
  totalMinutes: number;       // sum of task durations
  fitQuality: 'perfect' | 'good' | 'acceptable';
}
```

### 3. Email Workflow (`workflow_fillEmailBlock`)

**Purpose**: Determines which emails to process during an email block

**What it does**:
- Identifies urgent emails that need response
- Batches emails by sender for efficiency
- Auto-archives old emails (>3 days)
- Returns emails to handle in the time available

**Input**:
```typescript
{
  blockId: string;            // ID of the email block to fill
  blockDuration: number;      // minutes available
}
```

**Output**:
```typescript
{
  success: boolean;
  blockId: string;
  urgent: Array<{
    id: string;
    from: string;
    subject: string;
    reason: string;           // "From manager" | "Contains deadline"
  }>;
  batched: Array<{
    sender: string;
    count: number;
    emails: Array<{
      id: string;
      subject: string;
    }>;
  }>;
  archived: number;           // count of auto-archived emails
  totalToProcess: number;
}
```

## Implementation Plan - REVISED

### Phase 1: Schedule Workflow (Day 1) - COMPLETED ✅
- [x] Remove old optimizeSchedule workflow completely
- [x] Create new schedule workflow from scratch
- [x] Implement block creation logic
- [x] Add support for existing blocks
- [x] Add user feedback parsing
- [x] Test thoroughly before moving on

### Phase 2: Task Workflow (Day 2) - COMPLETED ✅
- [x] Remove old prioritizeTasks workflow completely
- [x] Create new task workflow (fillWorkBlock)
- [x] Implement simple scoring (priority + age)
- [x] Add duration matching logic
- [x] Test with various block sizes

### Phase 3: Email Workflow (Day 2) - COMPLETED ✅
- [x] Remove old triageEmails workflow completely
- [x] Create new email workflow (fillEmailBlock)
- [x] Implement urgent detection
- [x] Add sender batching
- [x] Add auto-archive logic

### Phase 4: Cleanup & Integration (Day 3) - COMPLETED ✅
- [x] Remove optimizeCalendar workflow completely
- [x] Remove any unused helper functions
- [x] Update response types
- [x] Update exports and registry
- [x] Full integration testing (linter + typecheck pass)

## Technical Requirements

### Clean Implementation
- **No technical debt**: Remove all old code before implementing new
- **No unused tools**: Clean up any helper tools from old workflows
- **Simple and clear**: Each workflow should be <200 lines
- **Fast execution**: <2 seconds per workflow

### Follow Patterns
```typescript
export const schedule = registerTool(
  createTool<typeof parameters, ScheduleResponse>({
    name: 'workflow_schedule',
    description: 'Create and manage time blocks for your day',
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Schedule Day',
      requiresConfirmation: true,  // user should approve schedule
      supportsStreaming: true
    },
    execute: async (params) => {
      // Simple, clear implementation
    }
  })
);
```

## Example Usage Flow

### Morning Planning
```
User: "Plan my day"
Assistant: [Calls schedule workflow]
"I've created your schedule:
- 9:00-11:00: Deep Work Block
- 11:00-11:15: Break
- 11:15-12:00: Work Block
- 12:00-1:00: Lunch
- 1:00-2:30: Focus Block
- 2:30-3:00: Email Block
- 3:00-3:15: Break
- 3:15-5:00: Work Block"

User: "What should I work on first?"
Assistant: [Calls task workflow for 9:00-11:00 block]
"For your 9:00-11:00 Deep Work Block:
1. Design API architecture (90 min) - High priority project
2. Write test cases (30 min) - Maintains code quality"

User: "Actually, I need a 2-hour lunch today"
Assistant: [Calls schedule workflow with feedback]
"I've adjusted your schedule:
- Extended lunch to 12:00-2:00
- Moved afternoon blocks accordingly
- Kept your 5:00 end time"
```

## Key Differences from Original Plan

1. **Workflows are interconnected**: Schedule creates structure, others fill it
2. **No backwards compatibility**: Clean slate implementation
3. **Schedule workflow can reorganize**: Responds to user feedback
4. **Focus on one at a time**: Complete schedule workflow before moving on

---

**Status Updates**:
- Created: [Original Date]
- Last Updated: [Current Date]
- Sprint Status: IN PROGRESS - Implementing Schedule Workflow 