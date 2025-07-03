# Sprint 4.5: UI Enhancement

**Sprint Goal**: Create rich display components for pure tool response data in chat  
**Duration**: 3 days  
**Status**: PLANNING

## Objectives

1. Create rich display components for pure tool response data
2. Build ToolResultRenderer to route tool results to appropriate displays
3. Add interactive capabilities to entities  
4. Implement real-time updates
5. Polish animations and transitions

## Day 1: Core Entity Components

### TimeBlockCard Component
```typescript
// Rich display for schedule blocks from tool responses
interface TimeBlockCardProps {
  block: {
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    tasks?: Array<{
      id: string;
      title: string;
      completed: boolean;
    }>;
  };
  interactive?: boolean;
  onAction?: (action: string) => void;
}

// Features:
- Color-coded by type (work, email, break, meeting)
- Shows assigned tasks with completion status
- Quick actions: Move, Delete, Add Task
- Hover shows duration and conflicts
- Click to expand details
```

### TaskCard Component
```typescript
// Rich display for tasks from TaskListResponse
interface TaskCardProps {
  task: {
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    status: 'active' | 'completed' | 'backlog';
    score?: number;
    estimatedMinutes?: number;
    daysInBacklog?: number;
    description?: string;
    dueDate?: Date;
  };
  showBacklogInfo?: boolean;
  onAction?: (action: string) => void;
}

// Features:
- Priority badge (High/Med/Low)
- Age indicator for backlog items
- Estimated time with icon
- Quick complete checkbox
- Click to edit details
- Score display for prioritization
```

### EmailPreview Component
```typescript
// Rich display for emails from EmailListResponse
interface EmailPreviewProps {
  email: {
    id: string;
    from: string;
    fromEmail: string;
    subject: string;
    snippet: string;
    receivedAt: Date;
    isRead: boolean;
    hasAttachments: boolean;
    urgency?: 'urgent' | 'important' | 'normal';
    status: string;
  };
  showImportance?: boolean;
  onAction?: (action: string) => void;
}

// Features:
- Sender avatar/initial
- Subject with importance indicators
- Preview text (first 2 lines)
- Quick actions: Reply, Archive, Convert to Task
- Urgency badge if applicable
```

## Day 2: Interactive Schedule Display & Tool Result Router

### ToolResultRenderer Component
```typescript
// Main router that connects tool results to display components
interface ToolResultRendererProps {
  toolName: string;
  result: any; // Pure data from tool
  metadata?: any; // Tool metadata from factory
  isStreaming?: boolean;
  streamProgress?: number;
  onAction?: (action: string) => void;
}

// Lazy-loaded display components mapped by category
const displays = {
  schedule: lazy(() => import('./displays/ScheduleDisplay')),
  task: lazy(() => import('./displays/TaskListDisplay')),
  email: lazy(() => import('./displays/EmailListDisplay')),
  meeting: lazy(() => import('./displays/MeetingDisplay')),
  workflow: lazy(() => import('./displays/WorkflowResultDisplay')),
  confirmation: lazy(() => import('./displays/ConfirmationDisplay')),
  preference: lazy(() => import('./displays/PreferenceDisplay')),
  system: lazy(() => import('./displays/SystemDisplay')),
};
```

### ScheduleTimeline Component
```typescript
// Visual timeline for ScheduleViewResponse data
interface ScheduleTimelineProps {
  data: {
    date: string;
    blocks: Array<{
      id: string;
      type: string;
      title: string;
      startTime: Date;
      endTime: Date;
      tasks?: Array<{ id: string; title: string; completed: boolean }>;
    }>;
    stats?: {
      totalHours: number;
      utilization: number;
    };
  };
  currentTime?: boolean;
  onBlockClick?: (blockId: string) => void;
}

// Visual: Horizontal timeline with blocks
// Colors: Type-based with patterns for conflicts
// Interactions: Drag to move, click to edit
// Shows gaps and overlaps clearly
```

### WorkflowProgress Component
```typescript
// Shows real-time workflow execution with streaming
interface WorkflowProgressProps {
  toolName: string;
  progress: number;
  stage: string;
  partialResult?: any;
}

// Visual: Progress bar with stage indicators
// Updates via streaming response
// Shows what's happening in real-time
// Displays partial results as they come in
```

### ProposedChanges Component
```typescript
// Before/after comparison for workflow results
interface ProposedChangesProps {
  changes: Array<{
    type: 'create' | 'move' | 'delete' | 'modify';
    description: string;
    impact: string;
  }>;
  onConfirm: () => void;
  onReject: () => void;
}

// Visual: Side-by-side or diff view
// Highlights: Added, Removed, Modified
// Clear Accept/Reject buttons
```

## Display Components to Create

### ScheduleDisplay
- Renders ScheduleViewResponse data
- Shows timeline of blocks with stats
- Handles block interactions (click to edit, drag to move)

### TaskListDisplay  
- Renders TaskListResponse data
- Shows task cards with scores and priorities
- Quick complete checkboxes
- Filter/sort capabilities

### EmailListDisplay
- Renders EmailListResponse data
- Email preview cards with urgency indicators
- Quick actions (reply, archive, convert to task)

### WorkflowResultDisplay
- Renders workflow execution results (OptimizeScheduleResponse, etc.)
- Shows proposed changes with before/after
- Confirmation/rejection buttons

### ConfirmationDisplay
- Renders confirmation requests from tools
- Clear accept/reject UI
- Shows what will be changed

### MeetingDisplay
- Renders ScheduleMeetingResponse/RescheduleMeetingResponse
- Shows meeting details, attendees, location
- Calendar integration actions

### PreferenceDisplay
- Renders UpdatePreferencesResponse
- Shows before/after preference values
- Confirmation of changes

### SystemDisplay
- Renders system tool responses (patterns, history, etc.)
- Appropriate visualization for each type

## Day 3: Real-time Updates & Polish

### Real-time Entity Updates
```typescript
// Subscribe to entity changes
useEffect(() => {
  const subscription = supabase
    .channel('schedule-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'time_blocks',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      // Update UI immediately
      updateBlockInUI(payload);
    })
    .subscribe();
    
  return () => subscription.unsubscribe();
}, [userId]);
```

### Streaming Support
```typescript
// ToolResultRenderer handles streaming
if (isStreaming && streamProgress !== undefined && streamProgress < 100) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {result?.stage || 'Processing...'}
        </span>
        <span className="text-muted-foreground">{streamProgress}%</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${streamProgress}%` }}
        />
      </div>
      {result?.partialResult && (
        <StreamingPartialResult data={result.partialResult} />
      )}
    </div>
  );
}
```

### Animations & Transitions
```typescript
// Smooth transitions for entity state changes
const blockVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20 }
};

// Stagger children for lists
const listVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
```

### Quick Actions & Shortcuts
```typescript
// Keyboard shortcuts for common actions
useHotkeys('cmd+k', () => openCommandPalette());
useHotkeys('t', () => createQuickTask());
useHotkeys('e', () => openEmailTriage());

// Context menus on right-click
<ContextMenu>
  <ContextMenuItem onClick={editBlock}>Edit Block</ContextMenuItem>
  <ContextMenuItem onClick={moveBlock}>Move Block</ContextMenuItem>
  <ContextMenuItem onClick={deleteBlock}>Delete Block</ContextMenuItem>
</ContextMenu>
```

## Implementation Details

### Component Architecture
- All display components receive pure data from tools
- ToolResultRenderer handles routing based on tool metadata
- Components are lazy-loaded for performance
- Consistent action handling through onAction callbacks

### Data Flow
1. Tool returns pure data (e.g., ScheduleViewResponse)
2. MessageList detects tool results in message.toolInvocations
3. ToolResultRenderer receives result and tool metadata
4. Appropriate display component is lazy-loaded and rendered
5. User interactions trigger onAction callbacks

### Tool Result Rendering in Messages
```typescript
// MessageList renders tool results directly, no parsing needed
const renderToolResults = (message: Message) => {
  if (!message.toolInvocations || message.toolInvocations.length === 0) {
    return null;
  }
  
  return message.toolInvocations
    .filter(inv => inv.state === 'result' || inv.state === 'partial-call')
    .map((invocation, idx) => {
      const isStreaming = invocation.state === 'partial-call';
      const progress = invocation.progress || (isStreaming ? 50 : 100);
      
      return (
        <ToolResultRenderer
          key={`${message.id}-tool-${idx}`}
          toolName={invocation.toolName}
          result={invocation.result}
          metadata={getToolMetadata(invocation.toolName)}
          isStreaming={isStreaming}
          streamProgress={progress}
          onAction={handleToolAction}
        />
      );
    });
};
```

### Loading States
```typescript
// Skeleton loaders that match entity shapes
<Skeleton className="h-20 w-full rounded-lg" /> // Block skeleton
<Skeleton className="h-16 w-full rounded-md" />  // Task skeleton
<Skeleton className="h-24 w-full rounded-lg" /> // Email skeleton
```

## Success Criteria

- [ ] ToolResultRenderer correctly routes all 25 tool results
- [ ] All display components render pure data correctly
- [ ] Interactive actions work through onAction callbacks
- [ ] Real-time updates implemented via Supabase subscriptions
- [ ] Streaming progress shown for long operations
- [ ] Lazy loading improves initial render performance
- [ ] No parsing of AI-generated text needed
- [ ] Animations are polished
- [ ] Performance remains fast

## Next Sprint
Sprint 4.6: Integration & Polish 