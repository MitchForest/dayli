# Sprint 03.01: Core AI Chat & Tools

## Sprint Overview

**Sprint Number**: 03.01  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: NOT STARTED

### Sprint Goal
Transform dayli from button-based interactions to an AI-first chat interface where all actions are performed through natural language. This sprint lays the foundation by implementing the core AI SDK integration and basic CRUD tools.

### Context for Executor
dayli is an AI-powered productivity assistant that manages tasks, emails, and schedules. In Epic 2, we built the UI with buttons like "Plan My Day". Now we're removing ALL buttons and making everything work through chat. The AI should be able to understand requests like "schedule my day", "move my meeting to 3pm", or "what should I work on now?" and execute the appropriate actions.

## Key Deliverables

### 1. Refactor Chat Endpoint to Use AI SDK's `streamText` with Tools

**Current State**: Basic chat endpoint exists but doesn't do anything useful.

**Target State**: Full AI SDK integration with tool calling capabilities.

**Implementation Details**:

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Define all tools (see section 2 for tool definitions)
const tools = {
  createTimeBlock,
  moveTimeBlock,
  deleteTimeBlock,
  assignTaskToBlock,
  completeTask,
  getSchedule,
  getUnassignedTasks,
  updatePreference,
};

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    tools,
    maxSteps: 5, // Allow multi-step operations
    system: `You are dayli, an AI executive assistant that helps users manage their schedule, tasks, and emails.
    
    Current time: ${new Date().toLocaleString()}
    
    IMPORTANT BEHAVIORS:
    - If it's morning (before 10am), proactively suggest planning the day
    - If user has unscheduled tasks, suggest scheduling them
    - Be concise but friendly
    - Always explain what you're doing when using tools
    - If you need to make multiple changes, explain the plan first
    
    NEVER:
    - Show raw data structures to the user
    - Mention tool names explicitly
    - Ask the user to use buttons or UI elements (everything is through chat)`,
    onStepFinish: async ({ toolCalls, toolResults }) => {
      // This callback fires after each tool execution
      // Use this to update UI with progress
      console.log('Tool executed:', toolCalls);
    },
  });
  
  return result.toDataStreamResponse();
}
```

**Key Features to Implement**:
- `maxSteps: 5` - Allows chaining multiple tools (e.g., get schedule → find gap → create block)
- `onStepFinish` - Provides real-time progress updates
- Smart system prompt that's time-aware
- Proper error handling for tool failures

### 2. Implement Basic CRUD Tools

**Tools to Create**:

```typescript
// modules/ai/tools/schedule-tools.ts

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['focus', 'email', 'break', 'meeting', 'blocked']),
    title: z.string(),
    startTime: z.string().describe('Time in HH:MM format'),
    endTime: z.string().describe('Time in HH:MM format'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ type, title, startTime, endTime, date }) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    
    // Call the existing schedule service
    const block = await scheduleService.createTimeBlock({
      type,
      title,
      startTime: parseTime(startTime),
      endTime: parseTime(endTime),
      date: targetDate,
      userId: getCurrentUserId(),
    });
    
    return {
      success: true,
      blockId: block.id,
      message: `Created ${type} block "${title}" from ${startTime} to ${endTime}`,
    };
  },
});

export const moveTimeBlock = tool({
  description: 'Move an existing time block to a new time',
  parameters: z.object({
    blockId: z.string(),
    newStartTime: z.string().describe('New start time in HH:MM format'),
    newEndTime: z.string().optional().describe('New end time in HH:MM format'),
  }),
  execute: async ({ blockId, newStartTime, newEndTime }) => {
    // Implementation here
  },
});

export const deleteTimeBlock = tool({
  description: 'Delete a time block from the schedule',
  parameters: z.object({
    blockId: z.string(),
    reason: z.string().optional(),
  }),
  execute: async ({ blockId, reason }) => {
    // Implementation here
  },
});

export const assignTaskToBlock = tool({
  description: 'Assign a task to a specific time block',
  parameters: z.object({
    taskId: z.string(),
    blockId: z.string(),
  }),
  execute: async ({ taskId, blockId }) => {
    // Implementation here
  },
});

export const completeTask = tool({
  description: 'Mark a task as completed',
  parameters: z.object({
    taskId: z.string(),
  }),
  execute: async ({ taskId }) => {
    // Implementation here
  },
});

export const getSchedule = tool({
  description: 'Get the current schedule for a specific date',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ date }) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    const schedule = await scheduleService.getScheduleForDate(targetDate);
    
    // Format for AI consumption, not direct display
    return {
      date: targetDate,
      blocks: schedule.blocks.map(formatBlockForAI),
      unscheduledTasks: schedule.unscheduledTasks,
    };
  },
});

export const getUnassignedTasks = tool({
  description: 'Get all tasks that are not yet scheduled',
  parameters: z.object({}),
  execute: async () => {
    const tasks = await taskService.getUnassignedTasks();
    return { tasks: tasks.map(formatTaskForAI) };
  },
});
```

### 3. Implement Preference Update Tool

```typescript
// modules/ai/tools/preference-tools.ts

export const updatePreference = tool({
  description: 'Update user preferences based on request or learned behavior',
  parameters: z.object({
    preference: z.enum(['lunch_time', 'work_hours', 'break_schedule']),
    value: z.any(),
    reason: z.string().describe('Why this change is being made'),
  }),
  execute: async ({ preference, value, reason }) => {
    const userId = getCurrentUserId();
    
    // Map preference to database column
    const updates: Record<string, any> = {};
    
    switch (preference) {
      case 'lunch_time':
        updates.lunch_start_time = value.startTime;
        updates.lunch_duration_minutes = value.duration || 60;
        break;
      case 'work_hours':
        updates.work_start_time = value.startTime;
        updates.work_end_time = value.endTime;
        break;
      // Add other cases
    }
    
    await updateUserPreferences(userId, updates);
    
    // Log to RAG for learning (to be implemented in Sprint 03.04)
    // await ragService.logPreferenceChange(userId, preference, value, reason);
    
    return {
      success: true,
      message: `Updated ${preference} to ${JSON.stringify(value)}. Reason: ${reason}`,
    };
  },
});
```

### 4. Remove "Plan My Day" Button

**File**: `apps/web/modules/schedule/components/DailyPlanningTrigger.tsx`

**Action**: Delete this file entirely or replace with a message component:

```typescript
export function DailyPlanningTrigger() {
  return (
    <div className="text-sm text-muted-foreground p-4 text-center">
      <p>Use the chat to plan your day. Try saying "Plan my day" or "What should I work on?"</p>
    </div>
  );
}
```

### 5. Update Chat UI to Show Tool Executions

**File**: `apps/web/modules/chat/components/MessageList.tsx`

**Add Tool Execution Display**:

```typescript
interface ToolExecutionDisplay {
  toolName: string;
  status: 'running' | 'completed' | 'failed';
  description: string;
}

// In the message rendering logic, add:
{message.toolExecutions?.map((execution, index) => (
  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground my-2">
    {execution.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
    {execution.status === 'completed' && <Check className="h-3 w-3 text-green-500" />}
    {execution.status === 'failed' && <X className="h-3 w-3 text-red-500" />}
    <span>{execution.description}</span>
  </div>
))}
```

### 6. Advanced System Prompt

```typescript
const systemPrompt = `You are dayli, an AI executive assistant that helps users manage their schedule, tasks, and emails.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

BEHAVIORAL RULES:

1. TIME-AWARE RESPONSES:
   - Morning (before 10am): Proactively suggest daily planning
   - Late morning (10am-12pm): Focus on deep work scheduling
   - Afternoon (12pm-5pm): Check on progress, suggest email time
   - Evening (after 5pm): Suggest wrapping up, planning tomorrow

2. STATE-AWARE ACTIONS:
   - Empty schedule: Suggest comprehensive planning
   - Partially scheduled: Fill gaps intelligently
   - Fully scheduled: Offer optimization
   - Overbooked: Suggest what to defer

3. NATURAL LANGUAGE:
   - Never mention tool names
   - Explain actions in human terms
   - Example: Instead of "I'll use the createTimeBlock tool", say "I'll schedule a focus block for you from 9-11am"

4. MULTI-STEP OPERATIONS:
   - Always explain the plan before executing multiple steps
   - Example: "I'll first check your schedule, then find a good time for deep work, and finally assign your top priority task to that block."

5. PREFERENCE LEARNING:
   - Notice patterns (user always moves lunch earlier)
   - Suggest preference updates with reason
   - Example: "I notice you often move lunch to 11:30. Would you like me to update your default lunch time?"

EXAMPLES OF GOOD RESPONSES:
- "I'll schedule a 2-hour focus block this morning for your strategy deck, followed by 30 minutes for emails."
- "Your afternoon is free. Shall I add time for the project review?"
- "You have 3 unscheduled tasks. Let me find the best times for them based on your energy patterns."

NEVER:
- Show JSON or data structures
- Use technical jargon
- Mention databases or systems
- Ask users to click buttons`;
```

### 7. Database Schema Updates

**Create Migration**: `migrations/005_epic3_backlogs.sql`

```sql
-- Task Backlog for future scheduling
CREATE TABLE IF NOT EXISTS public.task_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  urgency INTEGER DEFAULT 50 CHECK (urgency >= 0 AND urgency <= 100),
  source TEXT CHECK (source IN ('email', 'chat', 'calendar', 'manual')),
  source_id TEXT, -- Reference to email_id, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deferred_until DATE,
  estimated_minutes INTEGER,
  tags TEXT[],
  
  INDEX idx_task_backlog_user_priority (user_id, priority DESC),
  INDEX idx_task_backlog_deferred (user_id, deferred_until)
);

-- Email Backlog for deferred emails
CREATE TABLE IF NOT EXISTS public.email_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL,
  importance TEXT CHECK (importance IN ('important', 'not_important', 'archive')),
  urgency TEXT CHECK (urgency IN ('urgent', 'can_wait', 'no_response')),
  days_in_backlog INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  snippet TEXT,
  
  UNIQUE(user_id, email_id),
  INDEX idx_email_backlog_importance_urgency (user_id, importance, urgency)
);

-- Update user_preferences to add AI-managed fields
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS 
  break_schedule JSONB DEFAULT '{"lunchTime": "12:00", "lunchDuration": 60, "autoProtect": true}'::jsonb;

ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS
  open_time_preferences JSONB DEFAULT '{"dailyHours": 2, "preferredSlots": ["14:00-15:00", "16:00-17:00"]}'::jsonb;

ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS
  email_preferences JSONB DEFAULT '{"quickReplyMinutes": 5, "batchProcessing": true}'::jsonb;

-- Enable RLS
ALTER TABLE public.task_backlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_backlog ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own task backlog" ON public.task_backlog
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own email backlog" ON public.email_backlog
  FOR ALL USING (auth.uid() = user_id);
```

### 8. Remove Manual Settings UI

**File**: `apps/web/app/settings/page.tsx`

**Update to**:

```typescript
export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/focus">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Focus
            </Button>
          </Link>
        </div>
        
        <h1 className="text-3xl font-semibold mb-8">Settings</h1>
        
        <div className="bg-card rounded-lg p-8 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-medium">AI-Managed Preferences</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Your AI assistant learns and adapts to your preferences automatically.
          </p>
          <p className="text-sm text-muted-foreground">
            Just tell me what you'd like to change! For example:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground ml-4">
            <li>• "I prefer lunch at 11:30 now"</li>
            <li>• "I want to start work at 8:30am"</li>
            <li>• "Block my calendar during focus time"</li>
            <li>• "I need longer breaks on Fridays"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

## Testing Checklist

### Tool Testing
- [ ] Create time block via chat: "Schedule a 2-hour focus block at 9am"
- [ ] Move time block: "Move my strategy meeting to 3pm"
- [ ] Delete time block: "Cancel my afternoon email time"
- [ ] Assign task: "Add the budget review to my morning focus block"
- [ ] Complete task: "Mark the strategy deck as done"
- [ ] Get schedule: "What's my schedule today?"
- [ ] Get unassigned tasks: "What tasks need scheduling?"

### Multi-Step Operations
- [ ] "Plan my day" - Should check schedule, get tasks, create blocks, assign tasks
- [ ] "Clear my morning" - Should identify and remove/move morning blocks
- [ ] "I need 2 hours for deep work" - Should find time and create block

### Preference Updates
- [ ] "I want lunch at 11:30 from now on" - Should update preference with reason
- [ ] "I prefer working until 6pm" - Should update work hours
- [ ] Natural detection: After user moves lunch 3 times, AI should suggest updating default

### UI Updates
- [ ] Chat shows tool execution progress
- [ ] No "Plan My Day" button visible
- [ ] Settings page shows AI-managed message
- [ ] Tool failures show user-friendly errors

### Edge Cases
- [ ] Handle overlapping time blocks
- [ ] Prevent scheduling outside work hours
- [ ] Handle invalid time formats gracefully
- [ ] Multi-step operation failures should rollback

## Migration Guide from Epic 2

### For Users
1. The "Plan My Day" button is gone - just type "plan my day" in chat
2. All schedule changes happen through chat now
3. Settings are managed by AI - just tell it what you want

### For Developers
1. All button click handlers should be removed
2. Actions that were triggered by buttons now happen via tools
3. The chat is the primary interface - ensure all functionality is accessible through it
4. Tools should return data for the AI, not formatted for display

## Common Issues & Solutions

**Issue**: "Tool not found" errors  
**Solution**: Ensure all tools are properly imported and added to the tools object in the chat endpoint

**Issue**: AI mentions tool names to user  
**Solution**: Update system prompt to be more explicit about natural language

**Issue**: Multi-step operations fail midway  
**Solution**: Implement proper error handling and consider transaction-like behavior

**Issue**: Time parsing errors  
**Solution**: Use consistent time format (HH:MM) and add validation in tool parameters

## UI Block Enhancements

### Streamlined Block UI Improvements

Based on user feedback, we're implementing minimal but high-impact UI improvements to blocks:

#### 1. Meeting Blocks
- **Add video link support**: Show "Join Call" button when expanded if meeting has video link
- **Simple metadata structure**:
  ```typescript
  interface MeetingMetadata {
    attendeeCount?: number;
    videoLink?: string;
    location?: string; // Only physical locations
  }
  ```

#### 2. Work/Focus Blocks  
- **Keep tasks simple**: Just show title, source icon, and completion state
- **Expandable view**: Show first 2-3 tasks when collapsed, all when expanded
- **One-click complete**: Satisfying checkmark animation

#### 3. Email Blocks
- **Minimal preview**: "12 emails to process" (maybe "3 urgent" if categorized)
- **Keep current triage flow**: Click to start interactive triage

#### 4. Universal Improvements
- **All blocks expandable**: Consistent interaction pattern
- **Smooth animations**: Expand/collapse with spring animation
- **Completed state**: Fade to 70% opacity when done
- **Hover states**: Subtle elevation on hover

### Implementation Priority
1. Make all blocks expandable (currently only DeepWork)
2. Add video link to meeting blocks with "Join Call" button
3. Polish animations and hover states
4. Update completed block styling

### Mock Data and UI Fixes

#### Critical Issues to Fix

Based on user feedback, we need to fix fundamental issues with mock data and block display:

##### 1. **Fix Terrible Mock Data**

**Current Issues**:
- Nonsensical meeting names ("Conflicting Customer Call")
- Only one 15-minute work block (unrealistic)
- Too many meetings, not enough variety
- No demonstration of 3-4 column layout capability

**Fix Implementation**:

```typescript
// Update MockScheduleService to use proper scenarios
// services/mock/schedule.service.ts
private initializeMockData(): void {
  const today = format(new Date(), 'yyyy-MM-dd');
  const scenario = this.getScenarioForToday(); // Vary by day
  const schedule = generateMockSchedule(scenario);
  
  // Convert generated blocks to TimeBlock format
  schedule.timeBlocks.forEach(block => {
    const timeBlock: TimeBlock = {
      id: `mock-${generateId()}`,
      userId: this.userId,
      startTime: this.parseTimeToDate(block.startTime, today),
      endTime: this.parseTimeToDate(block.endTime, today),
      type: block.type,
      title: block.title,
      description: block.description,
      source: block.source || 'ai',
      metadata: block.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.mockTimeBlocks.set(timeBlock.id, timeBlock);
  });
}
```

**Realistic Meeting Names**:
- "Weekly Team Standup"
- "Product Review Meeting"
- "1:1 with Sarah Chen"
- "Sprint Planning"
- "Client Check-in Call"
- "Engineering Sync"
- "Design Review"
- "Quarterly Planning"

**Overlapping Blocks Pattern** (to show 3-4 columns):
```typescript
// Example of overlapping meetings
{
  id: generateId(),
  startTime: '09:00',
  endTime: '10:00',
  type: 'meeting',
  title: 'Strategy Review',
},
{
  id: generateId(),
  startTime: '09:30',
  endTime: '10:30',
  type: 'meeting',
  title: 'Product Sync',
},
{
  id: generateId(),
  startTime: '10:00',
  endTime: '11:00',
  type: 'work',
  title: 'Code Review',
}
```

##### 2. **Fix Block Height and Grid Alignment**

**Critical Issue**: Blocks can overflow their grid cells causing visual bugs.

**Solution**:
```typescript
// constants/grid-constants.ts
export const HOUR_HEIGHT = 120; // 4 × 30px for 15-min cells
export const CELL_HEIGHT = 30; // 15-minute cell
export const MIN_BLOCK_HEIGHT = 60; // Minimum 2 cells (30 minutes)

// In block components, ensure height is multiple of CELL_HEIGHT
const calculateBlockHeight = (duration: number): number => {
  const cells = Math.ceil(duration / 15); // Number of 15-min cells
  const height = cells * CELL_HEIGHT;
  return Math.max(height, MIN_BLOCK_HEIGHT);
};
```

##### 3. **Smart Content Display Based on Height**

**Implementation for All Block Components**:

```typescript
// Example for WorkBlock component
const WorkBlock = ({ duration, tasks, title, ... }) => {
  const blockHeight = calculateBlockHeight(duration);
  const showTaskList = blockHeight >= 90; // 3+ cells
  const showTaskCount = blockHeight >= 60; // 2+ cells
  const showProgressBar = blockHeight >= 120 && tasks.length > 0; // 4+ cells
  
  return (
    <div style={{ height: `${blockHeight}px` }}>
      {/* Always show header with time */}
      <div className="block-header">
        <span className="time">{startTime} - {endTime}</span>
      </div>
      
      {/* Always show title */}
      <div className="block-title truncate">{title}</div>
      
      {/* Conditionally show content based on height */}
      {showTaskCount && tasks.length > 0 && (
        <div className="task-count">{tasks.length} tasks</div>
      )}
      
      {showTaskList && tasks.length > 0 && (
        <div className="task-list">
          {tasks.slice(0, 2).map(task => (
            <div key={task.id} className="task-item truncate">
              {task.title}
            </div>
          ))}
        </div>
      )}
      
      {showProgressBar && (
        <div className="progress-bar">...</div>
      )}
    </div>
  );
};
```

**Height-Based Content Rules**:
- **30-60px (1-2 cells)**: Time + Title only
- **60-90px (2-3 cells)**: Time + Title + Count/Status
- **90-120px (3-4 cells)**: Time + Title + 1-2 items
- **120px+ (4+ cells)**: Full content with progress

##### 4. **Mock Data Scenarios to Implement**

**Typical Day** (balanced):
```
09:00-09:30  Email Triage (30 min)
09:30-11:30  Deep Work: Project Alpha (2 hrs)
11:30-12:00  Team Standup (30 min)
12:00-13:00  Lunch Break (1 hr)
13:00-14:00  Code Review (1 hr) [overlaps with:]
13:30-14:30  Sprint Planning (1 hr)
14:30-15:00  Email Response (30 min)
15:00-16:30  Deep Work: Feature Dev (1.5 hrs)
16:30-17:00  Daily Wrap-up (30 min)
```

**Meeting Heavy** (shows columns):
```
09:00-10:00  Strategy Review
09:30-10:30  Product Sync [overlap]
10:00-11:00  Engineering Standup [overlap]
10:30-11:30  Design Review [overlap]
```

##### Implementation Priority

1. **First**: Fix `mockGenerator.ts` with realistic names and patterns
2. **Second**: Update `MockScheduleService` to use the generator properly
3. **Third**: Fix block height calculation to align with grid cells
4. **Fourth**: Implement smart content display in all block components
5. **Fifth**: Test overlapping blocks for column layout

##### Files to Update

1. `apps/web/modules/schedule/utils/mockGenerator.ts` - Fix meeting names and patterns
2. `apps/web/services/mock/schedule.service.ts` - Use mock generator
3. `apps/web/modules/schedule/constants/grid-constants.ts` - Add MIN_BLOCK_HEIGHT
4. `apps/web/modules/schedule/components/blocks/*.tsx` - All block components
5. `apps/web/modules/schedule/components/TimeGridDay.tsx` - Ensure proper height calculation

##### Success Criteria for UI Fixes

- [ ] All meeting names are realistic and professional
- [ ] Blocks never overflow their grid cells
- [ ] 3-4 column layout visible with overlapping blocks
- [ ] Short blocks (15-30 min) show only essential info
- [ ] No text is cut off in any block size
- [ ] Mock data includes variety of block types and durations
- [ ] Grid alignment is pixel-perfect

## Success Criteria

1. **All CRUD operations work through chat** - No buttons needed
2. **Multi-step operations complete successfully** - "Plan my day" works end-to-end
3. **Tool executions visible in UI** - Users see progress
4. **Preferences update automatically** - AI learns from behavior
5. **Natural language feels natural** - No technical jargon exposed
6. **Database migrations run cleanly** - All new tables created
7. **Zero errors in console** - Clean implementation
8. **Response time < 2s** - Fast tool execution
9. **Enhanced block UI** - All blocks expandable with essential info visible

## Next Sprint Preview

Sprint 03.02 will build the adaptive scheduling workflow using LangGraph. This sprint's tools will be wrapped into a sophisticated workflow that can:
- Analyze current schedule state
- Determine the best strategy (full planning, partial, optimization)
- Protect lunch breaks automatically
- Pull tasks from the backlog intelligently

Make sure all tools are working perfectly as they'll be the foundation for the workflow system.

---

**Remember**: This sprint transforms dayli from a button-based UI to an AI-first chat interface. Every action should feel like talking to a smart assistant, not operating software. 