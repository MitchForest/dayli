# Sprint 3: Core Functionality & Workflows

**Duration**: Days 6-7 (2 days)  
**Goal**: Implement email triage, daily planning workflow, and schedule management

## Sprint Overview

This sprint connects the UI to real functionality:
- Daily planning workflow with LangGraph
- Email triage system with decision interface
- Schedule data integration with real-time updates
- Task assignment and management

## Prerequisites from Sprint 2
- ✅ Resizable panel layout complete
- ✅ Chat interface with AI SDK
- ✅ Interactive time blocks
- ✅ Daily planning UI components

## Day 6: Daily Planning Workflow & Schedule Generation

### 6.1 Install LangGraph Dependencies

```bash
# Add LangGraph and dependencies
bun add @langchain/langgraph @langchain/openai zod
```

### 6.2 Create Daily Planning Workflow

Create `apps/web/modules/workflows/graphs/dailyPlanning.ts`:

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// Define the state schema
const DailyPlanningState = z.object({
  userId: z.string(),
  date: z.string(),
  userPreferences: z.object({
    workStartTime: z.string(),
    workEndTime: z.string(),
    lunchStartTime: z.string(),
    lunchDuration: z.number(),
    targetDeepWorkBlocks: z.number(),
    deepWorkDuration: z.number(),
  }).nullable(),
  existingMeetings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    attendees: z.array(z.string()),
  })),
  unreadEmails: z.object({
    count: z.number(),
    urgent: z.number(),
    newsletters: z.number(),
  }),
  backlogTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    estimatedMinutes: z.number(),
    source: z.string(),
  })),
  generatedSchedule: z.array(z.object({
    type: z.enum(['focus', 'meeting', 'email', 'break', 'blocked', 'open-meeting']),
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    tasks: z.array(z.string()).optional(),
  })),
});

type DailyPlanningStateType = z.infer<typeof DailyPlanningState>;

// Create the workflow
export function createDailyPlanningWorkflow() {
  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0.3,
  });

  const workflow = new StateGraph<DailyPlanningStateType>({
    channels: DailyPlanningState.shape,
  });

  // Node: Fetch user context from RAG
  workflow.addNode('fetchUserContext', async (state) => {
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', state.userId)
      .single();

    // Fetch user patterns from embeddings
    const { data: patterns } = await supabase.rpc('get_user_patterns', {
      user_id: state.userId,
      pattern_type: 'focus_time',
    });

    return {
      ...state,
      userPreferences: preferences,
    };
  });

  // Node: Analyze existing meetings
  workflow.addNode('analyzeMeetings', async (state) => {
    const { data: events } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', state.userId)
      .eq('type', 'meeting')
      .gte('start_time', `${state.date}T00:00:00`)
      .lte('start_time', `${state.date}T23:59:59`);

    return {
      ...state,
      existingMeetings: events || [],
    };
  });

  // Node: Generate optimal time blocks
  workflow.addNode('generateTimeBlocks', async (state) => {
    const prompt = `
      Generate an optimal daily schedule based on:
      - Work hours: ${state.userPreferences?.workStartTime} to ${state.userPreferences?.workEndTime}
      - Existing meetings: ${JSON.stringify(state.existingMeetings)}
      - Target deep work blocks: ${state.userPreferences?.targetDeepWorkBlocks}
      - Unread emails: ${state.unreadEmails.count} (${state.unreadEmails.urgent} urgent)
      
      Rules:
      1. Add morning email triage (30 min) if emails > 10
      2. Add ${state.userPreferences?.targetDeepWorkBlocks} deep work blocks (${state.userPreferences?.deepWorkDuration} hours each)
      3. Add lunch break at ${state.userPreferences?.lunchStartTime} for ${state.userPreferences?.lunchDuration} minutes
      4. Add evening email triage if urgent emails > 0
      5. Leave one 30-min "open meeting" slot for last-minute requests
      6. Block remaining time to prevent meeting overload
      
      Return as JSON array of time blocks.
    `;

    const response = await model.invoke(prompt);
    const schedule = JSON.parse(response.content as string);

    return {
      ...state,
      generatedSchedule: schedule,
    };
  });

  // Node: Assign tasks to blocks
  workflow.addNode('assignTasks', async (state) => {
    const deepWorkBlocks = state.generatedSchedule.filter(b => b.type === 'focus');
    const highPriorityTasks = state.backlogTasks
      .filter(t => t.priority === 'high')
      .sort((a, b) => b.estimatedMinutes - a.estimatedMinutes);

    // Distribute tasks across deep work blocks
    let taskIndex = 0;
    const scheduleWithTasks = state.generatedSchedule.map(block => {
      if (block.type === 'focus' && taskIndex < highPriorityTasks.length) {
        const tasksForBlock = [];
        let remainingMinutes = state.userPreferences?.deepWorkDuration ? state.userPreferences.deepWorkDuration * 60 : 120;
        
        while (taskIndex < highPriorityTasks.length && remainingMinutes > 30) {
          const task = highPriorityTasks[taskIndex];
          if (task.estimatedMinutes <= remainingMinutes) {
            tasksForBlock.push(task.id);
            remainingMinutes -= task.estimatedMinutes;
            taskIndex++;
          } else {
            break;
          }
        }
        
        return { ...block, tasks: tasksForBlock };
      }
      return block;
    });

    return {
      ...state,
      generatedSchedule: scheduleWithTasks,
    };
  });

  // Node: Protect calendar time
  workflow.addNode('protectCalendar', async (state) => {
    // Create calendar blocks for all generated time blocks
    const calendarBlocks = state.generatedSchedule.map(block => ({
      user_id: state.userId,
      daily_schedule_id: null, // Will be set when creating daily schedule
      start_time: `${state.date}T${block.startTime}:00`,
      end_time: `${state.date}T${block.endTime}:00`,
      type: block.type,
      title: block.title,
      source: 'ai' as const,
      metadata: {
        protected: true,
        tasks: block.tasks,
      },
    }));

    // Insert blocks into database
    const { data: schedule } = await supabase
      .from('daily_schedules')
      .upsert({
        user_id: state.userId,
        schedule_date: state.date,
        stats: {
          emailsProcessed: 0,
          tasksCompleted: 0,
          focusMinutes: state.generatedSchedule
            .filter(b => b.type === 'focus')
            .reduce((acc, b) => {
              const start = new Date(`2024-01-01T${b.startTime}`);
              const end = new Date(`2024-01-01T${b.endTime}`);
              return acc + (end.getTime() - start.getTime()) / 60000;
            }, 0),
        },
      })
      .select()
      .single();

    if (schedule) {
      const blocksWithScheduleId = calendarBlocks.map(b => ({
        ...b,
        daily_schedule_id: schedule.id,
      }));

      await supabase.from('time_blocks').insert(blocksWithScheduleId);
    }

    return state;
  });

  // Define the workflow edges
  workflow.addEdge('fetchUserContext', 'analyzeMeetings');
  workflow.addEdge('analyzeMeetings', 'generateTimeBlocks');
  workflow.addEdge('generateTimeBlocks', 'assignTasks');
  workflow.addEdge('assignTasks', 'protectCalendar');
  workflow.addEdge('protectCalendar', END);

  return workflow.compile();
}
```

### 6.3 Create Workflow API Endpoint

Create `apps/web/app/api/workflows/daily-planning/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createDailyPlanningWorkflow } from '@/modules/workflows/graphs/dailyPlanning';
import { getServerSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await request.json();
    const workflow = createDailyPlanningWorkflow();

    // Get initial state
    const initialState = {
      userId: session.user.id,
      date: date || new Date().toISOString().split('T')[0],
      userPreferences: null,
      existingMeetings: [],
      unreadEmails: {
        count: 42, // From mock data
        urgent: 3,
        newsletters: 15,
      },
      backlogTasks: [], // Will be fetched
      generatedSchedule: [],
    };

    // Fetch backlog tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'backlog')
      .order('priority', { ascending: true });

    initialState.backlogTasks = tasks || [];

    // Run the workflow
    const result = await workflow.invoke(initialState);

    return NextResponse.json({
      success: true,
      schedule: result.generatedSchedule,
    });
  } catch (error) {
    console.error('Daily planning error:', error);
    return NextResponse.json(
      { error: 'Failed to generate schedule' },
      { status: 500 }
    );
  }
}
```

### 6.4 Hook for Daily Planning

Create `apps/web/modules/schedule/hooks/useDailyPlanning.ts`:

```typescript
import { useState } from 'react';
import { useCanvasStore } from '../canvas/CanvasStore';
import { useChatStore } from '@/modules/chat/store/chatStore';

export function useDailyPlanning() {
  const [isPlanning, setIsPlanning] = useState(false);
  const addMessage = useChatStore(state => state.addMessage);
  const refreshSchedule = useCanvasStore(state => state.refreshSchedule);

  const triggerDailyPlanning = async () => {
    setIsPlanning(true);
    
    // Add planning message to chat
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: 'I\'m analyzing your calendar and emails to create the perfect schedule for today...',
    });

    try {
      const response = await fetch('/api/workflows/daily-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ I've created your schedule for today:
          
• ${data.schedule.filter(b => b.type === 'focus').length} deep work blocks
• ${data.schedule.filter(b => b.type === 'email').length} email triage sessions
• Protected time for lunch and breaks
• 1 open slot for urgent meetings

Your calendar has been blocked to protect your focus time. Ready to start your day?`,
        });

        // Refresh the schedule view
        await refreshSchedule();
      }
    } catch (error) {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while planning your day. Please try again.',
      });
    } finally {
      setIsPlanning(false);
    }
  };

  return { triggerDailyPlanning, isPlanning };
}
```

## Day 7: Email Triage & Task Management

### 7.1 Email Triage Workflow

Create `apps/web/modules/workflows/graphs/emailTriage.ts`:

```typescript
import { StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const EmailTriageState = z.object({
  userId: z.string(),
  emails: z.array(z.object({
    id: z.string(),
    from: z.string(),
    subject: z.string(),
    preview: z.string(),
    receivedAt: z.string(),
  })),
  decisions: z.array(z.object({
    emailId: z.string(),
    decision: z.enum(['now', 'tomorrow', 'never']),
    actionType: z.enum(['quick_reply', 'thoughtful_response', 'archive', 'no_action']),
    reasoning: z.string(),
    taskTitle: z.string().optional(),
  })),
  senderPatterns: z.record(z.object({
    importance: z.number(),
    responseTime: z.number(),
    lastInteraction: z.string(),
  })),
});

export function createEmailTriageWorkflow() {
  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0.2,
  });

  const workflow = new StateGraph<z.infer<typeof EmailTriageState>>({
    channels: EmailTriageState.shape,
  });

  // Node: Fetch sender patterns from RAG
  workflow.addNode('fetchSenderPatterns', async (state) => {
    const senderEmails = [...new Set(state.emails.map(e => e.from))];
    
    // Get embeddings for sender patterns
    const patterns: Record<string, any> = {};
    for (const sender of senderEmails) {
      const { data } = await supabase.rpc('get_sender_pattern', {
        user_id: state.userId,
        sender_email: sender,
      });
      if (data) {
        patterns[sender] = data;
      }
    }

    return { ...state, senderPatterns: patterns };
  });

  // Node: Analyze and decide on emails
  workflow.addNode('analyzeEmails', async (state) => {
    const decisions = [];

    for (const email of state.emails) {
      const senderPattern = state.senderPatterns[email.from];
      
      const prompt = `
        Analyze this email and decide how to handle it:
        
        From: ${email.from}
        Subject: ${email.subject}
        Preview: ${email.preview}
        
        Sender history: ${senderPattern ? JSON.stringify(senderPattern) : 'Unknown sender'}
        
        Decide:
        1. When to handle: "now" (urgent), "tomorrow" (can wait), or "never" (archive)
        2. Action type: "quick_reply", "thoughtful_response", "archive", or "no_action"
        3. If creating a task, suggest a title
        
        Return as JSON with: decision, actionType, reasoning, taskTitle (if applicable)
      `;

      const response = await model.invoke(prompt);
      const decision = JSON.parse(response.content as string);
      
      decisions.push({
        emailId: email.id,
        ...decision,
      });
    }

    return { ...state, decisions };
  });

  // Node: Create tasks and update email status
  workflow.addNode('processDecisions', async (state) => {
    const tasksToCreate = [];
    const emailUpdates = [];

    for (const decision of state.decisions) {
      // Update email decision
      emailUpdates.push({
        id: decision.emailId,
        decision: decision.decision,
        action_type: decision.actionType,
        processed_at: new Date().toISOString(),
      });

      // Create task if needed
      if (decision.decision === 'now' && decision.taskTitle) {
        tasksToCreate.push({
          user_id: state.userId,
          title: decision.taskTitle,
          source: 'email' as const,
          email_id: decision.emailId,
          status: 'backlog' as const,
          priority: 'high' as const,
        });
      }
    }

    // Batch update emails
    if (emailUpdates.length > 0) {
      await supabase.from('emails').upsert(emailUpdates);
    }

    // Create tasks
    if (tasksToCreate.length > 0) {
      await supabase.from('tasks').insert(tasksToCreate);
    }

    // Store patterns for learning
    await storeEmailPatterns(state.userId, state.decisions);

    return state;
  });

  workflow.addEdge('fetchSenderPatterns', 'analyzeEmails');
  workflow.addEdge('analyzeEmails', 'processDecisions');

  return workflow.compile();
}
```

### 7.2 Email Triage UI Integration

Update `apps/web/modules/email/components/EmailTriageBlock.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { Mail, Clock, Archive, Reply } from 'lucide-react';
import { EmailDecisionCard } from './EmailDecisionCard';
import { useEmailTriage } from '../hooks/useEmailTriage';

interface EmailTriageBlockProps {
  blockId: string;
  startTime: string;
  endTime: string;
  onComplete: () => void;
}

export function EmailTriageBlock({ blockId, startTime, endTime, onComplete }: EmailTriageBlockProps) {
  const [isActive, setIsActive] = useState(false);
  const { emails, processEmail, isLoading, stats } = useEmailTriage(blockId);

  const handleDecision = async (emailId: string, decision: 'now' | 'tomorrow' | 'never') => {
    await processEmail(emailId, decision);
    
    // Check if all emails processed
    if (emails.filter(e => !e.decision).length === 1) {
      onComplete();
    }
  };

  if (!isActive) {
    return (
      <button
        onClick={() => setIsActive(true)}
        className="w-full p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="text-purple-600" size={20} />
            <span className="font-medium">Start Email Triage</span>
          </div>
          <span className="text-sm text-purple-600">
            {emails.length} emails to process
          </span>
        </div>
      </button>
    );
  }

  const currentEmail = emails.find(e => !e.decision);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-gray-200 rounded-full h-2">
        <div 
          className="bg-purple-600 h-2 rounded-full transition-all"
          style={{ width: `${(stats.processed / emails.length) * 100}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between text-sm text-gray-600">
        <span>{stats.processed} / {emails.length} processed</span>
        <span>{stats.tasksCreated} tasks created</span>
      </div>

      {/* Current email */}
      {currentEmail ? (
        <EmailDecisionCard
          email={currentEmail}
          onDecision={(decision) => handleDecision(currentEmail.id, decision)}
          isProcessing={isLoading}
        />
      ) : (
        <div className="text-center py-8">
          <Archive className="mx-auto text-gray-400 mb-2" size={48} />
          <p className="text-gray-600">All emails processed!</p>
          <button
            onClick={onComplete}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Complete Triage
          </button>
        </div>
      )}
    </div>
  );
}
```

### 7.3 Task Management Integration

Create `apps/web/modules/schedule/hooks/useTaskManagement.ts`:

```typescript
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Task } from '../types/schedule.types';

export function useTaskManagement(blockId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('time_block_tasks')
        .select(`
          task_id,
          tasks (*)
        `)
        .eq('time_block_id', blockId);

      if (data) {
        setTasks(data.map(d => d.tasks).filter(Boolean));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const addTask = async (task: Partial<Task>) => {
    const { data: newTask } = await supabase
      .from('tasks')
      .insert({
        ...task,
        status: 'scheduled',
      })
      .select()
      .single();

    if (newTask) {
      await supabase.from('time_block_tasks').insert({
        time_block_id: blockId,
        task_id: newTask.id,
        position: tasks.length,
      });

      setTasks([...tasks, newTask]);
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', taskId);

    if (!error) {
      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ));
    }
  };

  const removeTask = async (taskId: string) => {
    await supabase
      .from('time_block_tasks')
      .delete()
      .eq('time_block_id', blockId)
      .eq('task_id', taskId);

    await supabase
      .from('tasks')
      .update({ status: 'backlog' })
      .eq('id', taskId);

    setTasks(tasks.filter(t => t.id !== taskId));
  };

  return {
    tasks,
    isLoading,
    loadTasks,
    addTask,
    toggleTask,
    removeTask,
  };
}
```

### 7.4 Real-time Schedule Updates

Update `apps/web/modules/schedule/canvas/CanvasStore.ts`:

```typescript
// Add to existing store
interface CanvasState {
  // ... existing state
  
  // Schedule data
  timeBlocks: TimeBlock[];
  currentDate: Date;
  
  // Actions
  refreshSchedule: () => Promise<void>;
  updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => void;
  subscribeToUpdates: () => () => void;
}

// Add to store implementation
refreshSchedule: async () => {
  const { data: schedule } = await supabase
    .from('daily_schedules')
    .select(`
      *,
      time_blocks (
        *,
        time_block_tasks (
          tasks (*)
        )
      )
    `)
    .eq('schedule_date', get().currentDate.toISOString().split('T')[0])
    .single();

  if (schedule) {
    set({ timeBlocks: schedule.time_blocks });
  }
},

subscribeToUpdates: () => {
  const subscription = supabase
    .channel('schedule_updates')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'time_blocks' 
      }, 
      (payload) => {
        get().refreshSchedule();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
},
```

## Deliverables Checklist

### Daily Planning Workflow ✓
- [ ] LangGraph workflow created
- [ ] User context fetching from RAG
- [ ] Meeting analysis
- [ ] Optimal schedule generation
- [ ] Task assignment logic
- [ ] Calendar protection

### Email Triage System ✓
- [ ] Email triage workflow
- [ ] Sender pattern recognition
- [ ] Decision interface working
- [ ] Task creation from emails
- [ ] Batch processing UI
- [ ] Progress tracking

### Schedule Integration ✓
- [ ] Real-time updates via Supabase
- [ ] Time blocks connected to data
- [ ] Task management in blocks
- [ ] Optimistic updates
- [ ] Error recovery

### Task Management ✓
- [ ] Add tasks to blocks
- [ ] Remove tasks from blocks
- [ ] Toggle completion
- [ ] Backlog management
- [ ] Priority handling

## Testing Plan

### Workflow Testing
1. **Daily Planning**
   - Test with various meeting patterns
   - Verify optimal block placement
   - Check task assignment logic

2. **Email Triage**
   - Test decision accuracy
   - Verify task creation
   - Check pattern learning

3. **Integration**
   - Real-time updates work
   - State syncs properly
   - Error handling robust

## Success Criteria

- [ ] Daily planning generates optimal schedules
- [ ] Email triage processes efficiently
- [ ] Tasks properly assigned to blocks
- [ ] Real-time updates working
- [ ] Calendar protection functional
- [ ] All workflows integrated with UI

## Handoff to Sprint 4

Sprint 4 will have:
- Working daily planning system
- Functional email triage
- Task management integrated
- Real-time data updates
- Foundation for AI chat commands

## Notes for Implementation

- Use optimistic updates for smooth UX
- Implement proper error boundaries
- Add loading states for all async operations
- Consider offline support for future
- Log workflow execution for debugging 