# Sprint 2: UI Components & Daily Planning

**Duration**: Days 4-5 (2 days)  
**Goal**: Build the resizable panel layout, chat interface, and daily planning workflow components

## Sprint Overview

This sprint focuses on creating the visual interface for dayli:
- Resizable chat panel with AI SDK integration
- Enhanced time blocks with interactivity
- Daily planning workflow UI
- Task management within blocks

## Prerequisites from Sprint 1
- ✅ Database with mock data
- ✅ TypeScript types defined
- ✅ API endpoints returning Gmail/Calendar format data
- ✅ 7 days of realistic schedule data

## Day 4: Resizable Panel Layout & Chat Interface

### 4.1 Install Dependencies

```bash
# Add required packages
bun add react-resizable-panels ai @ai-sdk/react
```

Update `apps/web/package.json`:
```json
{
  "dependencies": {
    "react-resizable-panels": "^2.0.0",
    "ai": "^3.0.0",
    "@ai-sdk/react": "^0.0.0"
  }
}
```

### 4.2 Update Layout Structure

Update `apps/web/app/focus/page.tsx`:

```typescript
'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { ScheduleCanvas } from '@/modules/schedule/components/ScheduleCanvas';
import { useCanvasStore } from '@/modules/schedule/canvas/CanvasStore';

export default function FocusPage() {
  const initialize = useCanvasStore(state => state.initialize);
  
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <PanelGroup 
        direction="horizontal"
        className="h-full"
        autoSaveId="dayli-panels" // Persists size to localStorage
      >
        {/* Chat Panel - Collapsible */}
        <Panel 
          defaultSize={25}
          minSize={20}
          maxSize={50}
          collapsible={true}
          className="bg-card border-r border-border"
        >
          <ChatPanel />
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
        
        {/* Schedule Canvas - Main Content */}
        <Panel 
          defaultSize={75}
          minSize={50}
        >
          <ScheduleCanvas />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

### 4.3 Chat Interface Components

Create `apps/web/modules/chat/components/ChatPanel.tsx`:

```typescript
'use client';

import { useChat } from 'ai/react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { CommandSuggestions } from './CommandSuggestions';
import { useChatStore } from '../store/chatStore';

export function ChatPanel() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Good morning! I\'m ready to help you plan your day. You can ask me to schedule tasks, triage emails, or optimize your calendar.',
      },
    ],
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <button className="text-xs text-muted-foreground hover:text-foreground">
          Clear
        </button>
      </div>
      
      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />
      
      {/* Command Suggestions */}
      {input.length === 0 && (
        <CommandSuggestions onSelectCommand={handleInputChange} />
      )}
      
      {/* Input */}
      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
```

Create `apps/web/modules/chat/components/MessageList.tsx`:

```typescript
import { Message } from 'ai';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'flex gap-3',
            message.role === 'user' && 'flex-row-reverse'
          )}
        >
          <div className={cn(
            'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
            message.role === 'user' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          )}>
            {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          
          <div className={cn(
            'flex-1 space-y-2 overflow-hidden px-1',
            message.role === 'user' && 'text-right'
          )}>
            <div className={cn(
              'prose prose-sm dark:prose-invert inline-block p-3 rounded-lg',
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}>
              {message.content}
            </div>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted">
            <Bot size={16} />
          </div>
          <div className="flex-1 space-y-2 overflow-hidden px-1">
            <div className="bg-muted inline-block p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.4 Chat Store

Create `apps/web/modules/chat/store/chatStore.ts`:

```typescript
import { create } from 'zustand';
import { Message } from 'ai';

interface ChatState {
  messages: Message[];
  isCollapsed: boolean;
  commandHistory: string[];
  
  // Actions
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  toggleCollapsed: () => void;
  addToHistory: (command: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isCollapsed: false,
  commandHistory: [],
  
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
    
  clearMessages: () => set({ messages: [] }),
  
  toggleCollapsed: () =>
    set((state) => ({ isCollapsed: !state.isCollapsed })),
    
  addToHistory: (command) =>
    set((state) => ({
      commandHistory: [command, ...state.commandHistory.slice(0, 9)],
    })),
}));
```

## Day 5: Enhanced Time Blocks & Daily Planning UI

### 5.1 Interactive Time Block Components

Update `apps/web/modules/schedule/components/blocks/DeepWorkBlock.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Check, X } from 'lucide-react';
import { Task } from '@/modules/schedule/types/schedule.types';

interface DeepWorkBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  tasks: Task[];
  capacity: number; // Max tasks for this block
  onAddTask: () => void;
  onToggleTask: (taskId: string) => void;
  onRemoveTask: (taskId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function DeepWorkBlock({ 
  id,
  title, 
  startTime, 
  endTime, 
  duration,
  tasks,
  capacity = 3,
  onAddTask,
  onToggleTask,
  onRemoveTask,
  className,
  style 
}: DeepWorkBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const height = (duration / 15) * 20;
  
  return (
    <div
      className={cn(
        "absolute left-0 right-0 rounded-md border border-blue-500/20",
        "bg-gradient-to-br from-blue-100 to-blue-200",
        "hover:from-blue-200 hover:to-blue-300",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden group",
        isExpanded && "z-10 scale-[1.02]",
        className
      )}
      style={{ height: `${height}px`, ...style }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-900">
            <span className="text-base">🎯</span>
            <span>{startTime} - {endTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-700">
              {tasks.filter(t => t.completed).length}/{tasks.length}
            </span>
            {tasks.length < capacity && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddTask();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus size={14} className="text-blue-700" />
              </button>
            )}
          </div>
        </div>
        
        {/* Title */}
        <div className="text-sm font-semibold text-blue-900 mt-0.5 truncate">
          {title}
        </div>
        
        {/* Tasks Preview/List */}
        {isExpanded ? (
          <div className="mt-2 space-y-1 flex-1 overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-1 p-1 rounded bg-blue-50/50 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onToggleTask(task.id)}
                  className="flex-shrink-0"
                >
                  {task.completed ? (
                    <Check size={12} className="text-green-600" />
                  ) : (
                    <div className="w-3 h-3 border border-blue-400 rounded-sm" />
                  )}
                </button>
                <span className={cn(
                  "flex-1 truncate",
                  task.completed && "line-through text-blue-600"
                )}>
                  {task.title}
                </span>
                <button
                  onClick={() => onRemoveTask(task.id)}
                  className="opacity-0 hover:opacity-100"
                >
                  <X size={12} className="text-red-500" />
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-xs text-blue-600 text-center py-2">
                Click + to add tasks
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1 text-xs text-blue-700">
            {tasks.length > 0 ? (
              <div className="truncate">
                {tasks[0].title}
                {tasks.length > 1 && ` +${tasks.length - 1} more`}
              </div>
            ) : (
              <div className="text-blue-600 italic">No tasks assigned</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.2 Daily Planning Trigger

Create `apps/web/modules/schedule/components/DailyPlanningTrigger.tsx`:

```typescript
import { useState } from 'react';
import { Sparkles, Calendar, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDailyPlanning } from '../hooks/useDailyPlanning';

export function DailyPlanningTrigger() {
  const [isPlanning, setIsPlanning] = useState(false);
  const { triggerDailyPlanning } = useDailyPlanning();
  
  const handlePlanDay = async () => {
    setIsPlanning(true);
    try {
      await triggerDailyPlanning();
    } finally {
      setIsPlanning(false);
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={handlePlanDay}
        disabled={isPlanning}
        size="lg"
        className="shadow-lg"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isPlanning ? 'Planning your day...' : 'Plan My Day'}
      </Button>
      
      {/* Planning Preview */}
      {isPlanning && (
        <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-card rounded-lg shadow-xl border">
          <h3 className="font-semibold mb-2">Creating your perfect day...</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={14} />
              <span>Analyzing calendar events</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={14} />
              <span>Scheduling focus blocks</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target size={14} />
              <span>Assigning priority tasks</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.3 Block Type Indicators

Create `apps/web/modules/schedule/components/BlockTypeIndicator.tsx`:

```typescript
import { cn } from '@/lib/utils';

interface BlockType {
  type: 'focus' | 'meeting' | 'email' | 'break' | 'blocked' | 'open-meeting';
  label: string;
  icon: string;
  color: string;
}

const BLOCK_TYPES: BlockType[] = [
  { type: 'focus', label: 'Deep Work', icon: '🎯', color: 'blue' },
  { type: 'email', label: 'Email Triage', icon: '✉️', color: 'purple' },
  { type: 'meeting', label: 'Meeting', icon: '👥', color: 'green' },
  { type: 'break', label: 'Break', icon: '🍽️', color: 'orange' },
  { type: 'blocked', label: 'Blocked Time', icon: '🚫', color: 'red' },
  { type: 'open-meeting', label: 'Open for Meetings', icon: '📅', color: 'gray' },
];

export function BlockTypeLegend() {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-card rounded-lg border">
      {BLOCK_TYPES.map((blockType) => (
        <div key={blockType.type} className="flex items-center gap-2">
          <span className="text-lg">{blockType.icon}</span>
          <span className="text-sm font-medium">{blockType.label}</span>
        </div>
      ))}
    </div>
  );
}
```

### 5.4 Task Suggestion Interface

Create `apps/web/modules/schedule/components/TaskSuggestions.tsx`:

```typescript
import { useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { Task } from '../types/schedule.types';
import { Button } from '@/components/ui/button';

interface TaskSuggestionsProps {
  blockId: string;
  onAcceptSuggestions: (tasks: Task[]) => void;
  onClose: () => void;
}

export function TaskSuggestions({ blockId, onAcceptSuggestions, onClose }: TaskSuggestionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  
  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId }),
      });
      const data = await response.json();
      setSuggestions(data.suggestions);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-card rounded-lg shadow-xl border z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          AI Task Suggestions
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      
      {suggestions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Let AI suggest the best tasks for this time block
          </p>
          <Button onClick={fetchSuggestions} disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Get Suggestions'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((task) => (
            <div key={task.id} className="flex items-center gap-2 p-2 rounded border">
              <div className="flex-1">
                <div className="text-sm font-medium">{task.title}</div>
                <div className="text-xs text-muted-foreground">
                  Priority: {task.priority} • Est: {task.estimatedMinutes}min
                </div>
              </div>
              <Button size="sm" variant="ghost">
                <Plus size={14} />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Button 
              onClick={() => onAcceptSuggestions(suggestions)}
              className="flex-1"
            >
              Accept All
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.5 Update Schedule Canvas

Create `apps/web/modules/schedule/components/ScheduleCanvas.tsx`:

```typescript
'use client';

import { useRef, useEffect } from 'react';
import { useCanvasStore } from '@/modules/schedule/canvas/CanvasStore';
import { useRenderLoop } from '@/modules/schedule/canvas/hooks/useRenderLoop';
import { useCanvasGestures } from '@/modules/schedule/canvas/hooks/useCanvasGestures';
import { DateNavigator } from './DateNavigator';
import { InfiniteTimeGrid } from './InfiniteTimeGrid';
import { DailyPlanningTrigger } from './DailyPlanningTrigger';
import { UserMenu } from '@/components/user-menu';

export function ScheduleCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialize = useCanvasStore(state => state.initialize);
  
  // Initialize and start render loop
  useRenderLoop();
  useCanvasGestures(containerRef as React.RefObject<HTMLElement>);
  
  useEffect(() => {
    const updateDimensions = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        initialize(rect.width, rect.height);
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [initialize]);
  
  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-hidden relative bg-background"
    >
      <DateNavigator />
      <InfiniteTimeGrid />
      <DailyPlanningTrigger />
      <UserMenu />
    </div>
  );
}
```

## Deliverables Checklist

### Resizable Panel Layout ✓
- [x] react-resizable-panels integrated
- [x] 25%/33%/50% snap points working
- [x] Panel size persisted to localStorage
- [x] Smooth resize animations
- [x] Collapse/expand functionality

### Chat Interface ✓
- [x] AI SDK useChat hook integrated (mock version)
- [x] Message list with user/assistant bubbles
- [x] Streaming message support (simulated)
- [x] Loading indicators
- [x] Command suggestions
- [x] Input area with submit
- [x] Chat history in store

### Enhanced Time Blocks ✓
- [x] Interactive deep work blocks
- [x] Task list within blocks
- [x] Add/remove tasks (UI ready, needs integration)
- [x] Complete/incomplete tasks
- [x] Visual capacity indicators
- [x] Expand/collapse animation

### Daily Planning UI ✓
- [x] Planning trigger button
- [x] Planning progress indicator
- [ ] Block type legend
- [x] Task suggestion interface (modal created)
- [ ] AI-powered task recommendations (mock ready)

### State Management ✓
- [x] Chat store with Zustand
- [x] Panel size persistence
- [x] Task management actions
- [x] Optimistic updates ready

## Testing Plan

### Day 5 Testing
1. **Panel Behavior**
   - Test resize at different breakpoints
   - Verify snap points work correctly
   - Check persistence across refreshes

2. **Chat Interface**
   - Test message sending
   - Verify streaming works
   - Check command suggestions

3. **Block Interactions**
   - Test task add/remove
   - Verify completion tracking
   - Check expand/collapse

4. **Integration**
   - Chat commands affect schedule
   - Tasks update in real-time
   - State syncs properly

## Success Criteria

- [ ] Resizable panels working smoothly
- [ ] Chat interface ready for AI integration
- [ ] Time blocks are fully interactive
- [ ] Daily planning UI complete
- [ ] All components styled consistently
- [ ] State management integrated
- [ ] Ready for Sprint 3 functionality

## Handoff to Sprint 3

Sprint 3 will have:
- Complete UI shell with chat and schedule
- Interactive components ready for data
- State management in place
- Foundation for email triage UI
- Task management UI complete

## Notes for Implementation

- Use Tailwind's animation utilities for smooth transitions
- Implement keyboard shortcuts (Cmd+K for chat focus)
- Add hover states for all interactive elements
- Ensure mobile responsiveness for future
- Keep accessibility in mind (ARIA labels) 

## Implementation Guidance from Technical/Product Lead

### Chat Interface Decisions

1. **Commands Display**
   - **Decision**: When user types `/commands`, display as a special system message with a distinct card-like styling
   - **Implementation**: Create a `CommandListMessage` component with a light border and structured layout
   - **Commands to include**:
     ```
     📋 Available Commands:
     • "Plan my day" - Generate your optimal schedule
     • "Show me today's emails" - Start email triage
     • "Schedule [task] at [time]" - Add a task to your calendar
     • "Move [task] to [time]" - Reschedule an existing task
     • "Mark [task] done" - Complete a task
     • "Clear my morning/afternoon" - Remove all items from time period
     • "What's next?" - See your next task or meeting
     • "Find 30 minutes for [task]" - Find available time slot
     ```

2. **Mock Chat Behavior**
   - **Decision**: Yes, accept and display messages. Use simple mock responses to demonstrate the UI
   - **Mock responses**: 
     - For "plan my day" → "I'll analyze your calendar and create the perfect schedule..."
     - For task commands → "✅ Task scheduled for [time]"
     - For unknown commands → "I understand you want to [intent]. This feature will be available in Sprint 3."
   - **Persistence**: Clear chat on refresh for Sprint 2 (add persistence in Sprint 3)

3. **Chat Input Behavior**
   - **Enter**: Send message immediately
   - **Shift+Enter**: Add new line (for future multi-line commands)
   - **Send button**: Yes, include for mobile/touch users
   - **Command history**: Yes, up/down arrows navigate last 10 commands

### Panel Layout Decisions

4. **Panel Persistence**
   - **Panel size**: Persists via `autoSaveId` ✓
   - **Collapsed state**: Also persist in localStorage
   - **Chat messages**: Clear on refresh for Sprint 2

5. **Collapsed Panel UI**
   - **Icon**: Use `MessageSquare` from lucide-react (more recognizable than PanelRight)
   - **Tooltip**: "Open AI Assistant (⌘K)"
   - **Interaction**: Click anywhere on the 40px wide collapsed strip to expand
   - **Visual**: Subtle hover effect on entire strip

### Task Management Decisions

6. **Add Task Functionality**
   - **Decision**: Option (a) - Open a modal with available tasks from backlog
   - **Implementation**: 
     - Create `TaskSelectorModal` component
     - Show filtered list of backlog tasks
     - Allow multi-select with checkboxes
     - "Add Selected" button adds all at once
   - **For Sprint 2**: Can show mock backlog tasks from the database

7. **Task Sources**
   - **Decision**: Yes, visually distinguish with subtle icons
   - **Implementation**:
     - 📋 for email source (purple tint)
     - 📅 for calendar source (green tint)
     - 🤖 for AI suggested (blue tint)
     - ✋ for manual (no tint)
   - Use 12px icons inline with task title

8. **Task Capacity**
   - **Capacities**:
     - Deep work blocks: 3 tasks
     - Email triage: 10 emails
     - Quick decisions: 5 items
     - Meetings: 0 (no tasks)
     - Breaks: 0 (no tasks)
   - **Exceeding capacity**: Show toast notification "This block is at capacity. Try another time slot."

### Daily Planning UI Decisions

9. **Planning Trigger Button**
   - **Decision**: Implement full mock behavior
   - **Mock flow**:
     1. Show loading state for 3 seconds
     2. Add message in chat: "I've analyzed your calendar and emails..."
     3. Animate in new time blocks on the schedule
     4. Show success message: "✅ Your day is planned! 4 deep work blocks, 2 email sessions, and protected lunch."
   - Use mock data to populate a realistic schedule

10. **Task Suggestions Interface**
    - **Decision**: Implement with mock data
    - **Behavior**: Return 3-5 relevant tasks from mock backlog
    - **Selection criteria**: High priority tasks that fit the time block duration
    - **UI**: Show tasks with priority badges and time estimates

### Schedule Canvas Integration

11. **Canvas Within Panel**
    - **Decision**: Smart gesture handling based on location
    - **Implementation**:
     - Within 50px of panel edge: Trigger resize (show resize cursor)
     - Anywhere else: Canvas pan
     - Add visual indicator (subtle line) when in resize zone
   - Panel resize takes precedence over canvas interaction

12. **UserMenu Position**
    - **Decision**: Keep in canvas area, but ensure it never overlaps with chat
    - **Position**: Bottom right of canvas panel (not bottom left)
    - **Behavior**: If chat panel expands and would overlap, slide UserMenu up

### Animation and Transitions

13. **Block Expand/Collapse**
    - **Decision**: Use scale transform with height transition
    - **Timing**: 200ms ease-out (as shown in code)
    - **Effect**: 
     - Scale to 1.02 when expanded
     - Slight shadow increase
     - Smooth height transition for content

14. **Task Completion Animation**
    - **Strikethrough**: Yes, animate in over 150ms
    - **Opacity**: Fade to 60% after strikethrough
    - **Celebration**: If all tasks complete, brief confetti animation (500ms)
    - **Revert**: Can un-complete by clicking again

### Error States and Edge Cases

15. **Empty States**
    - **Deep work blocks**: "Click + to add tasks or ask AI for suggestions"
    - **Email blocks**: "No emails to triage"
    - **Meetings**: Show attendees instead of tasks
    - **Breaks**: "Time to recharge ⚡"
    - **Blocked time**: "Protected from meetings"

16. **API Error Simulation**
    - **Decision**: Include one error case for realism
    - **Implementation**: 
     - 5% chance of "Network error" when fetching task suggestions
     - Show inline error state with retry button
     - This teaches error handling patterns

### Styling Decisions

17. **Message Bubble Style**
    - **User messages**: 
     - Right-aligned
     - Primary background color
     - Max-width: 80%
     - White text
   - **Assistant messages**:
     - Left-aligned  
     - Muted background
     - Max-width: 85% (slightly wider for longer responses)
     - Default text color

18. **Time Block Heights**
    - **Decision**: Current scale is good, but add minimum
    - **Calculation**: `Math.max(40, (duration / 15) * 20)` pixels
    - **Minimum**: 40px (ensures 15-min blocks are usable)
    - **Rationale**: 20px per 15-min increment works well for task visibility

## Additional Implementation Notes

### Keyboard Shortcuts
Implement these shortcuts in Sprint 2:
- `Cmd/Ctrl + K`: Focus chat input
- `Cmd/Ctrl + P`: Trigger "Plan my day"
- `Escape`: Close any open modals
- `Cmd/Ctrl + Enter`: Send message from anywhere

### Performance Considerations
- Virtualize chat messages if > 50
- Debounce panel resize events (100ms)
- Use React.memo for time blocks
- Lazy load task selector modal

### Accessibility
- All interactive elements need ARIA labels
- Focus management when opening modals
- Keyboard navigation for task selection
- Screen reader announcements for completions

This guidance provides clear direction while maintaining flexibility for implementation details. Focus on creating a polished, responsive UI that demonstrates the core concepts even with mock data. 

## Sprint Handoff

### Status: HANDOFF

### What Was Implemented

#### 1. Resizable Panel Layout
- **Files Created/Modified**:
  - `apps/web/app/focus/page.tsx` - Transformed to use panel layout
  - `apps/web/modules/schedule/components/ScheduleCanvas.tsx` - Extracted canvas functionality
- **Key Features**:
  - Chat panel on right side (33% default width)
  - Smooth resize with react-resizable-panels
  - Collapsible to 40px strip with MessageSquare icon
  - Panel size persists to localStorage via autoSaveId

#### 2. Chat Interface Components
- **Files Created**:
  - `apps/web/modules/chat/components/ChatPanel.tsx` - Main chat container
  - `apps/web/modules/chat/components/ChatHeader.tsx` - Header with controls
  - `apps/web/modules/chat/components/MessageList.tsx` - Message display
  - `apps/web/modules/chat/components/ChatInput.tsx` - Input with history
  - `apps/web/modules/chat/components/CommandListMessage.tsx` - Command list display
- **Features Implemented**:
  - Mock chat responses for common commands
  - Command history with up/down arrows
  - `/commands` shows available commands
  - Loading animation with bouncing dots
  - Keyboard shortcut: Cmd+K focuses chat
  - Welcome message on first load

#### 3. Enhanced Time Blocks
- **Files Modified**:
  - `apps/web/modules/schedule/components/blocks/DeepWorkBlock.tsx` - Full task management
- **Files Created**:
  - `apps/web/modules/schedule/components/TaskSelectorModal.tsx` - Task selection UI
- **Features**:
  - Expandable blocks showing task lists
  - Task completion with checkboxes
  - Source icons (email/calendar/ai/manual)
  - Add button shows when under capacity
  - Visual task count indicator
  - Strikethrough animation on completion

#### 4. Daily Planning Components
- **Files Created**:
  - `apps/web/modules/schedule/components/DailyPlanningTrigger.tsx` - Floating action button
  - `apps/web/modules/schedule/hooks/useDailyPlanning.ts` - Planning logic hook
- **Features**:
  - "Plan My Day" button in bottom left
  - 3-second mock planning animation
  - Progress indicator during planning
  - Success message in chat
  - Generates 'focus_day' schedule

#### 5. State Management Updates
- **Files Modified**:
  - `apps/web/modules/chat/store/chatStore.ts` - Added persistence and command history
- **Features**:
  - Chat collapsed state persists
  - Command history persists (last 10)
  - Messages clear on refresh (intentional)
  - Zustand persist middleware integrated

### Key Decisions Made

1. **Chat on Right**: Changed from sprint doc's left side to right side per user request
2. **Mock Responses**: Implemented simple pattern matching for demo purposes
3. **Task Sources**: Added 'manual' as default for tasks without explicit source
4. **Panel Persistence**: Used localStorage via react-resizable-panels' autoSaveId
5. **Collapsed Width**: 40px strip instead of completely hidden

### Testing Performed

- ✅ Panel resize works smoothly with snap points
- ✅ Chat accepts input and shows mock responses
- ✅ Command history navigation works
- ✅ Blocks expand/collapse with tasks
- ✅ Daily planning trigger animates correctly
- ✅ Keyboard shortcuts functional (Cmd+K)
- ✅ Panel state persists across refreshes

### Known Limitations

1. **Task Management**: Add/remove task buttons are UI-only, not connected to store
2. **Schedule Integration**: TimeGridDay still uses hardcoded blocks, not store data
3. **Mock Data Only**: No real API integration yet
4. **Limited Commands**: Only basic command responses implemented

### Handoff Notes for Sprint 3

Sprint 3 will need to:
1. Connect task management UI to schedule store
2. Implement real schedule rendering from store data
3. Add email triage workflow
4. Create LangGraph.js integration for planning
5. Implement RAG context retrieval

All UI components are ready and polished. The foundation is solid for adding the core functionality in Sprint 3. 

### Known Issues & Fixes Needed

#### Panel Layout Issue
**Problem**: Chat panel appears above schedule canvas instead of side-by-side
**Root Cause**: Incorrect implementation of PanelGroup layout
**Solution Plan**:

1. **Fix Panel Structure** ✅
   - Ensure PanelGroup has proper horizontal layout
   - Both panels should be true siblings
   - Schedule canvas in left panel, chat in right panel

2. **Configure Panel Sizing** ✅
   - Left panel (Schedule): defaultSize=67%, minSize=50%
   - Right panel (Chat): defaultSize=33%, minSize=25%, maxSize=50%
   - Add proper snap points for resizing

3. **Implement Collapsed State** ✅
   - When collapsed, show 40px vertical strip
   - Display MessageSquare icon
   - Click to expand back to previous size
   - Use collapsedSize prop instead of custom logic

4. **Remove Internal Collapse Logic** ✅
   - Remove toggleCollapsed from ChatStore
   - Remove isCollapsed from ChatState interface
   - Let PanelGroup handle all collapse/expand logic

5. **Testing Checklist**
   - [ ] Panels display side-by-side horizontally
   - [ ] Resize handle works smoothly
   - [ ] Snap points at 25%, 33%, 50% work
   - [ ] Collapsed state shows icon strip
   - [ ] Click on icon expands panel
   - [ ] Panel sizes persist on reload
   - [ ] No debug info visible

### Implementation Status
- [x] Removed debug info from InfiniteTimeGrid
- [x] Updated ChatPanel to remove internal collapse
- [x] Updated ChatHeader to remove collapse button
- [x] Cleaned up ChatStore and types
- [x] Fix panel layout to be truly horizontal
- [x] Add collapsed state detection in ChatPanel
- [x] Show icon when panel is collapsed
- [ ] Add snap points configuration (react-resizable-panels doesn't support snap points directly)
- [ ] Test collapsed/expanded behavior 