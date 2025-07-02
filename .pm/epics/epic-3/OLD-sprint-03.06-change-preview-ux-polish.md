# Sprint 03.06: Change Preview & UX Polish

## Sprint Overview

**Sprint Number**: 03.06  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: NOT STARTED

### Sprint Goal
Build a visual change preview system that shows users exactly what will happen before they confirm AI-suggested changes. Polish the entire UX to create a seamless, professional experience where users feel in control while benefiting from AI intelligence.

### Context for Executor
In previous sprints, we built:
- Sprint 03.01: Basic chat interface with tools
- Sprint 03.02: Adaptive scheduling workflow
- Sprint 03.03: Email triage workflows
- Sprint 03.04: RAG system for learning and personalization
- Sprint 03.05: Gmail & Calendar API integration

Now we're adding the final layer: **visual confidence**. Users need to SEE what the AI wants to do before it happens. This sprint transforms proposals from text descriptions to visual previews, making the AI feel trustworthy and predictable.

## Prerequisites from Previous Sprints

Before starting, verify:
- [ ] All workflows from previous sprints are functional
- [ ] RAG system is storing and retrieving context
- [ ] Chat interface supports streaming responses
- [ ] Schedule view and email components are working

## Key Concepts

### What is Change Preview?
Instead of the AI saying "I'll move your lunch to 11:30", it shows:
1. Current state (lunch at 12:00)
2. Proposed state (lunch at 11:30) 
3. Visual diff highlighting what changes
4. Reason for the change
5. Accept/Reject/Modify buttons

### Preview Types
1. **Schedule Changes**: Show before/after calendar with highlights
2. **Email Actions**: Show which emails will be affected
3. **Task Updates**: Show priority/status changes
4. **Bulk Operations**: Show summary of all changes

### UX Polish Areas
1. **Loading States**: Skeleton screens while AI thinks
2. **Progress Indicators**: Multi-step workflow progress
3. **Error Recovery**: Graceful handling of failures
4. **Undo System**: Reverse recent changes
5. **Keyboard Shortcuts**: Power user features

## Key Deliverables

### 1. Create Change Preview Components

**File**: `apps/web/modules/preview/components/ChangePreview.tsx`

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Edit2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface Change {
  id: string;
  type: 'schedule' | 'email' | 'task' | 'preference';
  title: string;
  description: string;
  reason: string;
  impact: 'low' | 'medium' | 'high';
  before: any;
  after: any;
  metadata?: Record<string, any>;
}

interface ChangePreviewProps {
  changes: Change[];
  onAccept: (changeIds: string[]) => void;
  onReject: (changeIds: string[]) => void;
  onModify: (changeId: string) => void;
  isProcessing?: boolean;
}

export function ChangePreview({
  changes,
  onAccept,
  onReject,
  onModify,
  isProcessing = false,
}: ChangePreviewProps) {
  const [selectedChanges, setSelectedChanges] = React.useState<Set<string>>(
    new Set(changes.map(c => c.id))
  );

  const toggleChange = (changeId: string) => {
    const newSelected = new Set(selectedChanges);
    if (newSelected.has(changeId)) {
      newSelected.delete(changeId);
    } else {
      newSelected.add(changeId);
    }
    setSelectedChanges(newSelected);
  };

  const handleAcceptSelected = () => {
    onAccept(Array.from(selectedChanges));
  };

  const handleRejectAll = () => {
    onReject(changes.map(c => c.id));
  };

  const getImpactColor = (impact: Change['impact']) => {
    switch (impact) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Proposed Changes</h3>
          <p className="text-sm text-muted-foreground">
            Review and approve the changes before applying
          </p>
        </div>
        <Badge variant="outline" className="ml-2">
          {selectedChanges.size} of {changes.length} selected
        </Badge>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {changes.map((change) => (
            <motion.div
              key={change.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ChangeItem
                change={change}
                isSelected={selectedChanges.has(change.id)}
                onToggle={() => toggleChange(change.id)}
                onModify={() => onModify(change.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleRejectAll}
          disabled={isProcessing}
        >
          <X className="w-4 h-4 mr-2" />
          Reject All
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSelectedChanges(new Set())}
            disabled={isProcessing || selectedChanges.size === 0}
          >
            Clear Selection
          </Button>
          
          <Button
            onClick={handleAcceptSelected}
            disabled={isProcessing || selectedChanges.size === 0}
          >
            <Check className="w-4 h-4 mr-2" />
            Accept Selected ({selectedChanges.size})
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface ChangeItemProps {
  change: Change;
  isSelected: boolean;
  onToggle: () => void;
  onModify: () => void;
}

function ChangeItem({ change, isSelected, onToggle, onModify }: ChangeItemProps) {
  return (
    <div
      className={`
        relative p-4 rounded-lg border transition-all cursor-pointer
        ${isSelected 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50'
        }
      `}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="mt-1"
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{change.title}</h4>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={getImpactColor(change.impact)}
              >
                {change.impact} impact
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onModify();
                }}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {change.description}
          </p>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            <span>{change.reason}</span>
          </div>
          
          <ChangeVisualizer change={change} />
        </div>
      </div>
    </div>
  );
}

function ChangeVisualizer({ change }: { change: Change }) {
  switch (change.type) {
    case 'schedule':
      return <ScheduleChangeVisual change={change} />;
    case 'email':
      return <EmailChangeVisual change={change} />;
    case 'task':
      return <TaskChangeVisual change={change} />;
    default:
      return <GenericChangeVisual change={change} />;
  }
}
```

### 2. Schedule Change Visualizer

**File**: `apps/web/modules/preview/components/ScheduleChangeVisual.tsx`

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

export function ScheduleChangeVisual({ change }: { change: Change }) {
  const { before, after } = change;
  
  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-md">
      <div className="flex items-center gap-4">
        {/* Before State */}
        <div className="flex-1">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Current
          </div>
          <TimeBlock
            time={before.time}
            title={before.title}
            duration={before.duration}
            color="bg-gray-200"
          />
        </div>
        
        {/* Arrow */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </motion.div>
        
        {/* After State */}
        <div className="flex-1">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Proposed
          </div>
          <TimeBlock
            time={after.time}
            title={after.title}
            duration={after.duration}
            color="bg-primary/20"
            isNew
          />
        </div>
      </div>
      
      {/* Conflict Resolution */}
      {after.conflicts && after.conflicts.length > 0 && (
        <div className="mt-2 text-xs text-amber-600">
          <span className="font-medium">Conflicts resolved:</span>
          {after.conflicts.map((conflict: any, i: number) => (
            <span key={i}> {conflict.title}</span>
          ))}
        </div>
      )}
    </div>
  );
}

interface TimeBlockProps {
  time: string;
  title: string;
  duration: number;
  color: string;
  isNew?: boolean;
}

function TimeBlock({ time, title, duration, color, isNew }: TimeBlockProps) {
  return (
    <motion.div
      className={`
        relative p-3 rounded-md border
        ${isNew ? 'border-primary' : 'border-transparent'}
        ${color}
      `}
      initial={isNew ? { scale: 0.9, opacity: 0 } : {}}
      animate={isNew ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        <Clock className="w-3 h-3" />
        <span className="text-sm font-medium">{time}</span>
      </div>
      <div className="text-sm mt-1">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {duration} minutes
      </div>
    </motion.div>
  );
}
```

### 3. Email Change Visualizer

**File**: `apps/web/modules/preview/components/EmailChangeVisual.tsx`

```tsx
import React from 'react';
import { Mail, Archive, Trash2, Star, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function EmailChangeVisual({ change }: { change: Change }) {
  const { before, after } = change;
  const emails = after.emails || [];
  
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'archive': return <Archive className="w-3 h-3" />;
      case 'delete': return <Trash2 className="w-3 h-3" />;
      case 'star': return <Star className="w-3 h-3" />;
      case 'snooze': return <Clock className="w-3 h-3" />;
      default: return <Mail className="w-3 h-3" />;
    }
  };
  
  const getActionColor = (action: string) => {
    switch (action) {
      case 'archive': return 'bg-blue-100 text-blue-700';
      case 'delete': return 'bg-red-100 text-red-700';
      case 'star': return 'bg-yellow-100 text-yellow-700';
      case 'snooze': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        {emails.length} emails will be {after.action}
      </div>
      
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {emails.slice(0, 5).map((email: any, index: number) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs"
          >
            <div className={`p-1 rounded ${getActionColor(after.action)}`}>
              {getActionIcon(after.action)}
            </div>
            <div className="flex-1 truncate">
              <span className="font-medium">{email.sender}</span>
              <span className="text-muted-foreground"> - {email.subject}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {email.importance}/{email.urgency}
            </Badge>
          </div>
        ))}
        
        {emails.length > 5 && (
          <div className="text-xs text-muted-foreground text-center py-1">
            ... and {emails.length - 5} more
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4. Integration with Chat Interface

**File**: `apps/web/modules/chat/components/ProposalMessage.tsx`

```tsx
import React from 'react';
import { ChangePreview } from '@/modules/preview/components/ChangePreview';
import { useWorkflowExecution } from '@/modules/workflows/hooks/useWorkflowExecution';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ProposalMessageProps {
  proposal: {
    id: string;
    changes: Change[];
    workflowId: string;
    metadata?: Record<string, any>;
  };
  onComplete: (result: any) => void;
}

export function ProposalMessage({ proposal, onComplete }: ProposalMessageProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { executeWorkflow } = useWorkflowExecution();
  
  const handleAccept = async (changeIds: string[]) => {
    setIsProcessing(true);
    try {
      // Filter accepted changes
      const acceptedChanges = proposal.changes.filter(c => 
        changeIds.includes(c.id)
      );
      
      // Execute the workflow with accepted changes
      const result = await executeWorkflow({
        workflowId: proposal.workflowId,
        action: 'apply',
        changes: acceptedChanges,
        metadata: proposal.metadata,
      });
      
      // Learn from acceptance
      await fetch('/api/rag/learn', {
        method: 'POST',
        body: JSON.stringify({
          learningType: 'acceptance',
          data: {
            proposalId: proposal.id,
            acceptedChanges,
            workflowId: proposal.workflowId,
          },
        }),
      });
      
      onComplete({ status: 'accepted', result });
    } catch (error) {
      console.error('Error applying changes:', error);
      onComplete({ status: 'error', error });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleReject = async (changeIds: string[]) => {
    // Learn from rejection
    const rejectedChanges = proposal.changes.filter(c => 
      changeIds.includes(c.id)
    );
    
    await fetch('/api/rag/learn', {
      method: 'POST',
      body: JSON.stringify({
        learningType: 'rejection',
        data: {
          proposalId: proposal.id,
          rejectedChanges,
          workflowId: proposal.workflowId,
        },
      }),
    });
    
    onComplete({ status: 'rejected' });
  };
  
  const handleModify = (changeId: string) => {
    // Open modification dialog
    console.log('Modify change:', changeId);
    // Implementation depends on your dialog system
  };
  
  if (isProcessing) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Applying changes...</span>
        </div>
      </Card>
    );
  }
  
  return (
    <ChangePreview
      changes={proposal.changes}
      onAccept={handleAccept}
      onReject={handleReject}
      onModify={handleModify}
      isProcessing={isProcessing}
    />
  );
}
```

### 5. Loading States and Skeleton Screens

**File**: `apps/web/modules/ui/components/SkeletonLoaders.tsx`

```tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ScheduleBlockSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-16 w-full rounded-md"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

export function EmailListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
```

### 6. Progress Indicators for Multi-Step Workflows

**File**: `apps/web/modules/ui/components/WorkflowProgress.tsx`

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  currentStepId?: string;
}

export function WorkflowProgress({ steps, currentStepId }: WorkflowProgressProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStepId);
  
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStepId;
        const isCompleted = currentIndex > index || step.status === 'completed';
        const isPending = currentIndex < index && step.status === 'pending';
        
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              flex items-start gap-3 p-3 rounded-lg transition-colors
              ${isActive ? 'bg-primary/10' : ''}
              ${isCompleted ? 'opacity-60' : ''}
            `}
          >
            <div className="mt-0.5">
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" />
                </motion.div>
              )}
              {isActive && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              )}
              {isPending && (
                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="font-medium text-sm">{step.title}</div>
              {step.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
```

### 7. Undo System Implementation

**File**: `apps/web/modules/undo/stores/undoStore.ts`

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UndoableAction {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
  data: any;
  reverseData: any;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
}

interface UndoStore {
  history: UndoableAction[];
  redoStack: UndoableAction[];
  maxHistorySize: number;
  
  addAction: (action: UndoableAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export const useUndoStore = create<UndoStore>()(
  devtools(
    (set, get) => ({
      history: [],
      redoStack: [],
      maxHistorySize: 50,
      
      addAction: (action) => {
        set((state) => ({
          history: [...state.history.slice(-state.maxHistorySize + 1), action],
          redoStack: [], // Clear redo stack on new action
        }));
      },
      
      undo: async () => {
        const { history, redoStack } = get();
        if (history.length === 0) return;
        
        const action = history[history.length - 1];
        await action.undo();
        
        set({
          history: history.slice(0, -1),
          redoStack: [...redoStack, action],
        });
      },
      
      redo: async () => {
        const { history, redoStack } = get();
        if (redoStack.length === 0) return;
        
        const action = redoStack[redoStack.length - 1];
        await action.execute();
        
        set({
          history: [...history, action],
          redoStack: redoStack.slice(0, -1),
        });
      },
      
      canUndo: () => get().history.length > 0,
      canRedo: () => get().redoStack.length > 0,
      
      clearHistory: () => set({ history: [], redoStack: [] }),
    }),
    {
      name: 'undo-store',
    }
  )
);

// Helper to create undoable actions
export function createUndoableAction(
  type: string,
  description: string,
  data: any,
  reverseData: any,
  execute: () => Promise<void>,
  undo: () => Promise<void>
): UndoableAction {
  return {
    id: `${type}-${Date.now()}`,
    type,
    description,
    timestamp: new Date(),
    data,
    reverseData,
    execute,
    undo,
  };
}
```

### 8. Keyboard Shortcuts

**File**: `apps/web/modules/ui/hooks/useKeyboardShortcuts.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUndoStore } from '@/modules/undo/stores/undoStore';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

const shortcuts: ShortcutConfig[] = [
  {
    key: 'k',
    ctrl: true,
    action: () => document.getElementById('chat-input')?.focus(),
    description: 'Focus chat input',
  },
  {
    key: 'z',
    ctrl: true,
    action: () => useUndoStore.getState().undo(),
    description: 'Undo last action',
  },
  {
    key: 'z',
    ctrl: true,
    shift: true,
    action: () => useUndoStore.getState().redo(),
    description: 'Redo last action',
  },
  {
    key: '/',
    action: () => document.getElementById('command-menu')?.click(),
    description: 'Open command menu',
  },
  {
    key: 'Escape',
    action: () => document.body.click(), // Close any open modals
    description: 'Close modal/dialog',
  },
];

export function useKeyboardShortcuts() {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    
    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : true;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      
      if (
        event.key === shortcut.key &&
        ctrlMatch &&
        shiftMatch &&
        altMatch
      ) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  }, []);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return { shortcuts };
}

// Keyboard shortcuts help component
export function KeyboardShortcutsHelp() {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Keyboard Shortcuts</h3>
      <div className="space-y-1">
        {shortcuts.map((shortcut) => (
          <div
            key={`${shortcut.key}-${shortcut.ctrl}-${shortcut.shift}`}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">
              {shortcut.description}
            </span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
              {shortcut.ctrl && '⌘+'}
              {shortcut.shift && '⇧+'}
              {shortcut.alt && '⌥+'}
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing Guide

### 1. Test Change Preview

```typescript
// Test creating and displaying a change preview
const testChangePreview = () => {
  const mockChanges: Change[] = [
    {
      id: '1',
      type: 'schedule',
      title: 'Move Deep Work Block',
      description: 'Shifting deep work to avoid conflict with new meeting',
      reason: 'New urgent meeting scheduled at 9am',
      impact: 'medium',
      before: {
        time: '9:00 AM',
        title: 'Deep Work',
        duration: 120,
      },
      after: {
        time: '2:00 PM',
        title: 'Deep Work',
        duration: 120,
        conflicts: [],
      },
    },
  ];
  
  // Render preview component with mock data
  // Test accept/reject functionality
};
```

### 2. Test Loading States

```typescript
// Test skeleton screens during loading
const testLoadingStates = async () => {
  // Trigger a workflow that takes time
  // Verify skeleton screens appear
  // Verify they're replaced with real content
  // Check animation timing
};
```

### 3. Test Undo System

```typescript
// Test undo/redo functionality
const testUndoSystem = async () => {
  // Perform an action (e.g., move a task)
  const action = createUndoableAction(
    'schedule-move',
    'Moved lunch to 11:30',
    { blockId: '123', newTime: '11:30' },
    { blockId: '123', oldTime: '12:00' },
    async () => { /* execute */ },
    async () => { /* undo */ }
  );
  
  useUndoStore.getState().addAction(action);
  
  // Test undo
  await useUndoStore.getState().undo();
  
  // Test redo
  await useUndoStore.getState().redo();
};
```

## Common Issues & Solutions

### Issue 1: Animation Performance
**Problem**: Janky animations on lower-end devices
**Solution**: 
```tsx
// Use CSS transforms instead of layout properties
// Use will-change sparingly
// Reduce motion for users who prefer it
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;
```

### Issue 2: Preview State Sync
**Problem**: Preview doesn't match actual state after changes
**Solution**: Always fetch fresh state before generating previews

### Issue 3: Undo Stack Memory
**Problem**: Undo history grows too large
**Solution**: Implement max history size and cleanup old actions

### Issue 4: Keyboard Shortcut Conflicts
**Problem**: Shortcuts interfere with browser defaults
**Solution**: Check for active input elements before handling

## Success Criteria

- [ ] Change previews clearly show before/after states
- [ ] Users can selectively accept/reject changes
- [ ] Loading states appear during all async operations
- [ ] Workflow progress is clearly indicated
- [ ] Undo/redo works for all major actions
- [ ] Keyboard shortcuts enhance power user experience
- [ ] Animations are smooth (60fps)
- [ ] Error states are handled gracefully
- [ ] Mobile experience is polished

## UX Polish Checklist

### Visual Polish
- [ ] Consistent spacing and alignment
- [ ] Smooth animations and transitions
- [ ] Clear visual hierarchy
- [ ] Appropriate use of color and contrast
- [ ] Loading states for all async operations

### Interaction Polish
- [ ] Immediate feedback for all actions
- [ ] Clear affordances (what's clickable)
- [ ] Keyboard navigation support
- [ ] Touch-friendly on mobile
- [ ] Graceful error handling

### Performance Polish
- [ ] Fast initial load (<3s)
- [ ] Smooth scrolling
- [ ] No layout shifts
- [ ] Optimized animations
- [ ] Efficient re-renders

## Next Steps

After completing this sprint:
1. Conduct user testing sessions
2. Gather feedback on preview clarity
3. Measure acceptance/rejection rates
4. Analyze undo usage patterns
5. Prepare for Epic 4 planning

## Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [React Loading States](https://web.dev/loading-states/)
- [Undo/Redo Patterns](https://redux.js.org/usage/implementing-undo-history)
- [Keyboard UX Guidelines](https://www.nngroup.com/articles/keyboard-accessibility/) 