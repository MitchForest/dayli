# Sprint 4.5: UI Enhancement

**Sprint Goal**: Create rich UI components for core entities (blocks, tasks, emails) in chat  
**Duration**: 3 days  
**Status**: PLANNING

## Objectives

1. Create rich entity components for chat display
2. Add interactive capabilities to entities
3. Implement real-time updates
4. Polish animations and transitions

## Day 1: Core Entity Components

### TimeBlockCard Component
```typescript
// Rich display for schedule blocks in chat
interface TimeBlockCardProps {
  block: TimeBlock;
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
// Rich display for tasks in chat
interface TaskCardProps {
  task: Task;
  showBacklogInfo?: boolean;
  onAction?: (action: string) => void;
}

// Features:
- Priority badge (High/Med/Low)
- Age indicator for backlog items
- Estimated time with icon
- Quick complete checkbox
- Click to edit details
```

### EmailPreview Component
```typescript
// Rich display for emails in chat
interface EmailPreviewProps {
  email: Email;
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

## Day 2: Interactive Schedule Display

### ScheduleTimeline Component
```typescript
// Visual timeline for full day schedule
interface ScheduleTimelineProps {
  blocks: TimeBlock[];
  currentTime?: boolean;
  onBlockClick?: (block: TimeBlock) => void;
}

// Visual: Horizontal timeline with blocks
// Colors: Type-based with patterns for conflicts
// Interactions: Drag to move, click to edit
// Shows gaps and overlaps clearly
```

### WorkflowProgress Component
```typescript
// Shows real-time workflow execution
interface WorkflowProgressProps {
  workflowId: string;
  stages: WorkflowStage[];
  currentStage: string;
  progress: number;
}

// Visual: Progress bar with stage indicators
// Updates via streaming response
// Shows what's happening in real-time
```

### ProposedChanges Component
```typescript
// Before/after comparison for schedule changes
interface ProposedChangesProps {
  current: TimeBlock[];
  proposed: TimeBlock[];
  onConfirm: () => void;
  onReject: () => void;
}

// Visual: Side-by-side or diff view
// Highlights: Added, Removed, Modified
// Clear Accept/Reject buttons
```

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

### Entity Recognition in Messages
```typescript
// Automatically detect and enhance entities in AI responses
function enhanceMessage(content: string): ReactNode {
  // Patterns to detect entities
  const patterns = {
    timeBlock: /\b(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM)):\s*([^,\n]+)/gi,
    task: /task:\s*"([^"]+)"/gi,
    email: /email from\s+([^:,\n]+)/gi
  };
  
  // Replace with rich components
  return content.replace(patterns.timeBlock, (match, start, end, title) => (
    <TimeBlockCard 
      block={{ startTime: start, endTime: end, title }}
      interactive={true}
    />
  ));
}
```

### Loading States
```typescript
// Skeleton loaders that match entity shapes
<Skeleton className="h-20 w-full rounded-lg" /> // Block skeleton
<Skeleton className="h-16 w-full rounded-md" />  // Task skeleton
<Skeleton className="h-24 w-full rounded-lg" /> // Email skeleton
```

## Success Criteria

- [ ] All entities have rich UI components
- [ ] Interactive actions work smoothly
- [ ] Real-time updates implemented
- [ ] Animations are polished
- [ ] Performance remains fast

## Next Sprint
Sprint 4.6: Integration & Polish 