# Sprint 03.015: Core Operations & Chat UI Polish

## Sprint Overview

**Sprint Number**: 03.015  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 4 days  
**Status**: PLANNING

### Sprint Goal
Complete the foundational building blocks that future sprints depend on, fix the service architecture, and polish the AI chat UI/UX to make it truly feel like an executive assistant rather than a basic chatbot.

### Context for Executor
We discovered that Sprints 03.02-03.04 assume capabilities we haven't built yet:
- Can't read full email content (only metadata)
- Can't create or edit tasks via chat
- Can't manage meetings or calendar events
- Mock services don't match real services
- Chat UI is too basic for an "executive assistant"

This sprint fills these gaps and elevates the chat experience to match our vision.

### Key Architectural Improvements (NEW)
Based on AI SDK best practices and architecture review, this sprint now includes:
1. **Tool Registry Pattern** - Automatic tool discovery, no manual imports
2. **Standardized Tool Results** - Consistent return format for all tools
3. **Enhanced Chat Route** - Multi-step execution, progress streaming
4. **Clear Architecture** - Tools (AI SDK) for single operations, Workflows (LangGraph) for multi-step processes

## Prerequisites from Sprint 03.01

Before starting, verify:
- [x] Basic CRUD tools are working
- [x] Chat endpoint successfully calls tools
- [x] Database migrations complete
- [x] Real services implemented (no more mocks)

## Why This Sprint is Critical

### 1. **Technical Debt Prevention**
Building complex workflows (03.02-03.04) on incomplete foundations will create massive refactoring needs later.

### 2. **User Experience Gap**
Current chat feels like a command line, not an executive assistant. Users can't even select/copy text or see visual differentiation.

### 3. **Missing MVP Features**
The PRD promises features we can't deliver without these tools:
- "Reply to Sarah about timeline" (can't read/send emails)
- "Create task: Review Q4 metrics" (can't create tasks)
- "Move meeting to 3pm" (can't manage calendar)

## Sprint Structure

### Part A: Core Operations (2 days)
1. Email Operations
2. Task Management
3. Meeting Management
4. Service Architecture Cleanup

### Part B: Chat UI/UX Polish (2 days)
1. Rich Message Components
2. Structured Data Display
3. Interactive Elements
4. Visual Differentiation

## Part A: Core Operations (Days 1-2)

### A1. Email Operations

#### Current State
- ❌ Can only read email metadata (subject, from, snippet)
- ❌ No email body access
- ❌ Can't send or draft emails
- ❌ No attachment handling

#### Target State
- ✅ Full email content reading
- ✅ AI-powered response generation
- ✅ Draft creation and sending
- ✅ Attachment awareness

#### Implementation

**File**: `apps/web/modules/ai/tools/email-operations.ts`

```typescript
export const readEmailContent = tool({
  description: "Read the full content of an email including body and attachments",
  parameters: z.object({
    emailId: z.string().describe("Gmail message ID"),
    includeAttachments: z.boolean().default(false),
  }),
  execute: async ({ emailId, includeAttachments }) => {
    const gmailService = ServiceFactory.getInstance().getGmailService();
    const email = await gmailService.getMessage(emailId, {
      format: 'full',
      includeAttachments
    });
    
    // Extract and parse email body (handle HTML/plain text)
    const body = parseEmailBody(email);
    const attachments = includeAttachments ? parseAttachments(email) : [];
    
    // Extract action items using AI
    const actionItems = await extractActionItems(body);
    
    return {
      id: emailId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      body,
      attachments,
      actionItems,
      receivedAt: email.date,
    };
  },
});

export const draftEmailResponse = tool({
  description: "Create a draft email response with AI assistance",
  parameters: z.object({
    replyTo: z.string().optional().describe("Email ID to reply to"),
    to: z.array(z.string()).optional().describe("Recipients if new email"),
    subject: z.string().optional(),
    tone: z.enum(['professional', 'friendly', 'brief', 'detailed']).default('professional'),
    keyPoints: z.array(z.string()).describe("Main points to include"),
    sendImmediately: z.boolean().default(false),
  }),
  execute: async (params) => {
    const gmailService = ServiceFactory.getInstance().getGmailService();
    
    // Get context if replying
    let context = '';
    if (params.replyTo) {
      const original = await readEmailContent.execute({ 
        emailId: params.replyTo 
      });
      context = original.body;
    }
    
    // Generate response with AI
    const draft = await generateEmailDraft({
      context,
      tone: params.tone,
      keyPoints: params.keyPoints,
    });
    
    // Create Gmail draft
    const draftId = await gmailService.createDraft({
      to: params.to,
      subject: params.subject,
      body: draft.body,
      replyTo: params.replyTo,
    });
    
    if (params.sendImmediately) {
      await gmailService.sendDraft(draftId);
      return { sent: true, draftId };
    }
    
    return { 
      sent: false, 
      draftId,
      preview: draft.body.substring(0, 200) + '...'
    };
  },
});

export const processEmailToTask = tool({
  description: "Convert an email into a scheduled task",
  parameters: z.object({
    emailId: z.string(),
    taskTitle: z.string().optional().describe("Override auto-generated title"),
    schedule: z.enum(['today', 'tomorrow', 'next_week', 'backlog']).default('today'),
  }),
  execute: async ({ emailId, taskTitle, schedule }) => {
    // Read email content
    const email = await readEmailContent.execute({ emailId });
    
    // Create task
    const task = await createTask.execute({
      title: taskTitle || email.actionItems[0] || `Follow up: ${email.subject}`,
      notes: `From: ${email.from}\nEmail: ${email.subject}`,
      metadata: {
        source: 'email',
        emailId,
        from: email.from,
      }
    });
    
    // Schedule based on preference
    if (schedule !== 'backlog') {
      await scheduleTask.execute({
        taskId: task.id,
        when: schedule,
      });
    }
    
    // Archive the email
    await gmailService.archiveMessage(emailId);
    
    return {
      task,
      scheduled: schedule !== 'backlog',
      emailArchived: true,
    };
  },
});
```

### A2. Task Management Operations

#### Current State
- ❌ No task creation via chat
- ❌ Can't edit existing tasks
- ❌ No task deletion
- ❌ No task details/notes

#### Target State
- ✅ Natural language task creation
- ✅ Edit any task property
- ✅ Safe deletion with confirmation
- ✅ Rich task metadata

#### Implementation

**File**: `apps/web/modules/ai/tools/task-operations.ts`

```typescript
export const createTask = tool({
  description: "Create a new task from natural language",
  parameters: z.object({
    title: z.string().describe("Task title"),
    estimatedMinutes: z.number().optional().default(30),
    notes: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
    metadata: z.record(z.any()).optional(),
  }),
  execute: async (params) => {
    const taskService = ServiceFactory.getInstance().getTaskService();
    
    const task = await taskService.createTask({
      title: params.title,
      estimated_minutes: params.estimatedMinutes,
      notes: params.notes,
      priority: params.priority,
      status: 'pending',
      metadata: params.metadata || {},
      user_id: await getCurrentUserId(),
    });
    
    // Add to today's task list if high priority
    if (params.priority === 'high') {
      await scheduleTask.execute({
        taskId: task.id,
        when: 'today',
      });
    }
    
    return {
      task,
      message: `Created task: "${task.title}"`,
      scheduled: params.priority === 'high',
    };
  },
});

export const editTask = tool({
  description: "Edit an existing task",
  parameters: z.object({
    taskId: z.string(),
    updates: z.object({
      title: z.string().optional(),
      estimatedMinutes: z.number().optional(),
      notes: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    }),
  }),
  execute: async ({ taskId, updates }) => {
    const taskService = ServiceFactory.getInstance().getTaskService();
    
    // Get current task
    const currentTask = await taskService.getTask(taskId);
    if (!currentTask) {
      throw new Error('Task not found');
    }
    
    // Update task
    const updated = await taskService.updateTask(taskId, {
      title: updates.title || currentTask.title,
      estimated_minutes: updates.estimatedMinutes || currentTask.estimated_minutes,
      notes: updates.notes !== undefined ? updates.notes : currentTask.notes,
      priority: updates.priority || currentTask.priority,
    });
    
    // Reschedule if priority changed to high
    if (updates.priority === 'high' && currentTask.priority !== 'high') {
      await scheduleTask.execute({
        taskId,
        when: 'today',
      });
    }
    
    return {
      task: updated,
      changes: Object.keys(updates),
      message: `Updated task: "${updated.title}"`,
    };
  },
});

export const deleteTask = tool({
  description: "Delete a task (requires confirmation)",
  parameters: z.object({
    taskId: z.string(),
    confirm: z.boolean().default(false),
  }),
  execute: async ({ taskId, confirm }) => {
    if (!confirm) {
      const task = await taskService.getTask(taskId);
      return {
        requiresConfirmation: true,
        task,
        message: `Are you sure you want to delete "${task.title}"? Run again with confirm: true`,
      };
    }
    
    await taskService.deleteTask(taskId);
    
    return {
      deleted: true,
      message: 'Task deleted successfully',
    };
  },
});

export const findTasks = tool({
  description: "Search for tasks by various criteria",
  parameters: z.object({
    query: z.string().optional().describe("Search in title or notes"),
    status: z.enum(['pending', 'completed', 'all']).optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    source: z.enum(['email', 'calendar', 'manual', 'all']).optional(),
    limit: z.number().optional().default(10),
  }),
  execute: async (params) => {
    const tasks = await taskService.searchTasks({
      query: params.query,
      filters: {
        status: params.status !== 'all' ? params.status : undefined,
        priority: params.priority,
        source: params.source !== 'all' ? params.source : undefined,
      },
      limit: params.limit,
    });
    
    return {
      tasks,
      count: tasks.length,
      message: tasks.length > 0 
        ? `Found ${tasks.length} matching tasks`
        : 'No tasks found matching criteria',
    };
  },
});
```

### A3. Meeting/Calendar Management

#### Current State
- ❌ Can't create meetings
- ❌ Can't reschedule meetings
- ❌ No meeting prep blocks
- ❌ No conflict resolution

#### Target State
- ✅ Natural language meeting scheduling
- ✅ Smart rescheduling with conflict detection
- ✅ Automatic prep time blocking
- ✅ Attendee notification handling

#### Implementation

**File**: `apps/web/modules/ai/tools/calendar-operations.ts`

```typescript
export const scheduleMeeting = tool({
  description: "Schedule a new meeting with smart time finding",
  parameters: z.object({
    title: z.string(),
    attendees: z.array(z.string()).describe("Email addresses"),
    duration: z.number().default(30).describe("Duration in minutes"),
    description: z.string().optional(),
    preferredTimes: z.array(z.string()).optional().describe("Preferred time slots"),
    needsPrepTime: z.boolean().default(false),
  }),
  execute: async (params) => {
    const calendarService = ServiceFactory.getInstance().getCalendarService();
    const scheduleService = ServiceFactory.getInstance().getScheduleService();
    
    // Find available slots
    const availableSlots = await calendarService.findAvailableSlots({
      duration: params.duration,
      attendees: params.attendees,
      preferredTimes: params.preferredTimes,
      workingHours: await getUserWorkingHours(),
    });
    
    if (availableSlots.length === 0) {
      return {
        success: false,
        message: 'No available slots found. Try different times or duration.',
        suggestedActions: ['Show my calendar', 'Find conflicts'],
      };
    }
    
    // Create the meeting
    const meeting = await calendarService.createEvent({
      summary: params.title,
      description: params.description,
      start: availableSlots[0].start,
      end: availableSlots[0].end,
      attendees: params.attendees.map(email => ({ email })),
    });
    
    // Add prep time if needed
    if (params.needsPrepTime) {
      const prepDuration = Math.min(15, params.duration / 2);
      await createTimeBlock.execute({
        type: 'prep',
        title: `Prep: ${params.title}`,
        startTime: subtractMinutes(meeting.start, prepDuration),
        endTime: meeting.start,
      });
    }
    
    return {
      success: true,
      meeting,
      message: `Scheduled "${params.title}" for ${formatDateTime(meeting.start)}`,
      prepTimeAdded: params.needsPrepTime,
    };
  },
});

export const rescheduleMeeting = tool({
  description: "Reschedule an existing meeting",
  parameters: z.object({
    eventId: z.string().describe("Calendar event ID"),
    newTime: z.string().describe("New time in natural language"),
    reason: z.string().optional(),
    notifyAttendees: z.boolean().default(true),
  }),
  execute: async ({ eventId, newTime, reason, notifyAttendees }) => {
    const calendarService = ServiceFactory.getInstance().getCalendarService();
    
    // Get current event
    const event = await calendarService.getEvent(eventId);
    if (!event) {
      throw new Error('Meeting not found');
    }
    
    // Parse new time
    const parsed = parseNaturalTime(newTime);
    const duration = event.end.getTime() - event.start.getTime();
    
    // Check conflicts
    const conflicts = await calendarService.checkConflicts({
      start: parsed,
      end: new Date(parsed.getTime() + duration),
      excludeEventId: eventId,
    });
    
    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        message: `Cannot reschedule - conflicts with: ${conflicts.map(c => c.summary).join(', ')}`,
        suggestedAlternatives: await findAlternativeSlots(parsed, duration),
      };
    }
    
    // Update the event
    const updated = await calendarService.updateEvent(eventId, {
      start: parsed,
      end: new Date(parsed.getTime() + duration),
      description: event.description + 
        `\n\nRescheduled from ${formatDateTime(event.start)}` +
        (reason ? ` - Reason: ${reason}` : ''),
    });
    
    // Notify attendees if requested
    if (notifyAttendees && event.attendees?.length > 0) {
      await calendarService.sendUpdateNotification(eventId, {
        message: `Meeting rescheduled to ${formatDateTime(updated.start)}` +
          (reason ? ` - ${reason}` : ''),
      });
    }
    
    return {
      success: true,
      meeting: updated,
      message: `Rescheduled to ${formatDateTime(updated.start)}`,
      attendeesNotified: notifyAttendees,
    };
  },
});

export const handleMeetingConflict = tool({
  description: "Intelligently resolve meeting conflicts",
  parameters: z.object({
    meetingId: z.string(),
    conflictingBlockId: z.string(),
    resolution: z.enum(['move_meeting', 'move_block', 'shorten_both', 'cancel_block']),
  }),
  execute: async ({ meetingId, conflictingBlockId, resolution }) => {
    // Implementation for different resolution strategies
    switch (resolution) {
      case 'move_meeting':
        // Find next available slot for meeting
        break;
      case 'move_block':
        // Reschedule the conflicting block
        break;
      case 'shorten_both':
        // Reduce duration of both to fit
        break;
      case 'cancel_block':
        // Remove the conflicting block
        break;
    }
  },
});

### A4. Workflow Persistence

#### Current State
- ❌ Workflows lose state if interrupted
- ❌ No way to resume failed workflows
- ❌ No debugging visibility into workflow execution
- ❌ Can't track workflow history

#### Target State
- ✅ Persist workflow state between nodes
- ✅ Resume interrupted workflows
- ✅ Track workflow execution history
- ✅ Debug workflow failures

#### Implementation

**File**: `apps/web/modules/workflows/services/workflowPersistence.ts`

```typescript
interface WorkflowState {
  id: string;
  userId: string;
  type: 'scheduling' | 'email_triage' | 'daily_review';
  state: Record<string, any>;
  currentNode: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class WorkflowPersistenceService {
  async saveWorkflowState(
    workflowId: string,
    state: Partial<WorkflowState>
  ): Promise<void> {
    await db.from('workflow_states')
      .upsert({
        id: workflowId,
        ...state,
        updated_at: new Date(),
      });
  }
  
  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    const { data } = await db.from('workflow_states')
      .select('*')
      .eq('id', workflowId)
      .single();
    
    return data;
  }
  
  async resumeWorkflow(workflowId: string): Promise<any> {
    const saved = await this.getWorkflowState(workflowId);
    if (!saved) throw new Error('Workflow not found');
    
    // Reconstruct workflow and resume from saved node
    const workflow = this.getWorkflowByType(saved.type);
    return workflow.resume(saved.state, saved.currentNode);
  }
  
  async getWorkflowHistory(
    userId: string,
    options?: { limit?: number; type?: string }
  ): Promise<WorkflowState[]> {
    let query = db.from('workflow_states')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (options?.type) {
      query = query.eq('type', options.type);
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    const { data } = await query;
    return data || [];
  }
}

// Enhance existing workflows with persistence
export function createPersistentWorkflow<T>(
  workflow: StateGraph<T>,
  type: string
): StateGraph<T> {
  const persistence = new WorkflowPersistenceService();
  const workflowId = crypto.randomUUID();
  
  // Wrap each node with persistence
  workflow.beforeNode = async (nodeName: string, state: T) => {
    await persistence.saveWorkflowState(workflowId, {
      currentNode: nodeName,
      state: state as any,
      status: 'in_progress',
    });
  };
  
  workflow.afterNode = async (nodeName: string, state: T, result: any) => {
    await persistence.saveWorkflowState(workflowId, {
      state: { ...state, ...result },
      status: nodeName === END ? 'completed' : 'in_progress',
    });
  };
  
  workflow.onError = async (error: Error, nodeName: string, state: T) => {
    await persistence.saveWorkflowState(workflowId, {
      status: 'failed',
      error: error.message,
      currentNode: nodeName,
    });
  };
  
  return workflow;
}
```

**File**: `apps/web/modules/ai/tools/workflow-management.ts`

```typescript
export const resumeWorkflow = tool({
  description: "Resume an interrupted workflow",
  parameters: z.object({
    workflowId: z.string(),
  }),
  execute: async ({ workflowId }) => {
    const persistence = new WorkflowPersistenceService();
    
    try {
      const result = await persistence.resumeWorkflow(workflowId);
      return {
        success: true,
        result,
        message: 'Workflow resumed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to resume workflow',
      };
    }
  },
});

export const showWorkflowHistory = tool({
  description: "Show recent workflow executions",
  parameters: z.object({
    type: z.enum(['scheduling', 'email_triage', 'daily_review']).optional(),
    limit: z.number().default(5),
  }),
  execute: async ({ type, limit }) => {
    const persistence = new WorkflowPersistenceService();
    const userId = await getCurrentUserId();
    
    const history = await persistence.getWorkflowHistory(userId, {
      type,
      limit,
    });
    
    return {
      workflows: history.map(w => ({
        id: w.id,
        type: w.type,
        status: w.status,
        startedAt: w.createdAt,
        completedAt: w.status === 'completed' ? w.updatedAt : null,
        error: w.error,
      })),
      message: `Found ${history.length} workflow${history.length !== 1 ? 's' : ''}`,
    };
  },
});
```

### A5. Smart Block Creation from Backlog

#### Current State
- ❌ Can't create focused work blocks with backlog items
- ❌ No intelligent task selection for time slots
- ❌ Can't batch urgent emails into blocks
- ❌ Manual backlog management

#### Target State
- ✅ Create work blocks filled with best-fit tasks
- ✅ Create email blocks with urgent items
- ✅ AI selects optimal items from backlog
- ✅ Respect time constraints and priorities

#### Implementation

**File**: `apps/web/modules/ai/tools/smart-block-creation.ts`

```typescript
export const createWorkBlock = tool({
  description: "Create a focused work block and fill it with high-priority tasks from backlog",
  parameters: z.object({
    duration: z.number().describe("Duration in minutes"),
    timePreference: z.string().optional().describe("When to schedule (e.g., 'afternoon', '2pm', 'next free slot')"),
    taskTypes: z.array(z.string()).optional().describe("Preferred task types or tags"),
    maxTasks: z.number().default(3).describe("Maximum tasks to include"),
  }),
  execute: async ({ duration, timePreference, taskTypes, maxTasks }) => {
    const userId = await getCurrentUserId();
    const scheduleService = ServiceFactory.getInstance().getScheduleService();
    const taskService = ServiceFactory.getInstance().getTaskService();
    
    // Find available time slot
    const slot = await findAvailableSlot({
      duration,
      preference: timePreference || 'next_available',
      userId,
    });
    
    if (!slot) {
      return {
        success: false,
        message: "No available time slot found. Try a shorter duration or different time.",
      };
    }
    
    // Get high-priority tasks from backlog that fit
    const backlogTasks = await db.from('task_backlog')
      .select('*')
      .eq('user_id', userId)
      .gte('priority', 70) // High priority only
      .order('priority', { ascending: false })
      .order('days_in_backlog', { ascending: false });
    
    // Filter and select best tasks
    const selectedTasks = selectOptimalTasks({
      tasks: backlogTasks.data || [],
      availableMinutes: duration,
      maxTasks,
      preferredTypes: taskTypes,
    });
    
    if (selectedTasks.length === 0) {
      return {
        success: false,
        message: "No suitable tasks found in backlog. Try creating some tasks first.",
      };
    }
    
    // Create the work block
    const block = await createTimeBlock.execute({
      type: 'focus',
      title: `Deep Work: ${selectedTasks.length} High-Priority Tasks`,
      startTime: slot.startTime,
      endTime: slot.endTime,
      description: `Focus block with ${selectedTasks.length} tasks from backlog`,
    });
    
    // Assign tasks to the block
    for (const task of selectedTasks) {
      await assignTaskToBlock.execute({
        taskId: task.id,
        blockId: block.id,
      });
      
      // Remove from backlog
      await db.from('task_backlog')
        .delete()
        .eq('id', task.id);
    }
    
    return {
      success: true,
      block,
      tasks: selectedTasks,
      message: `Created ${duration}-minute work block at ${formatTime(slot.startTime)} with ${selectedTasks.length} high-priority tasks`,
      summary: selectedTasks.map(t => `• ${t.title} (${t.estimated_minutes}min)`).join('\n'),
    };
  },
});

export const createEmailBlock = tool({
  description: "Create an email response block filled with urgent emails needing replies",
  parameters: z.object({
    duration: z.number().default(30).describe("Duration in minutes"),
    timePreference: z.string().optional().describe("When to schedule"),
    emailTypes: z.array(z.enum(['urgent', 'important', 'quick_reply'])).optional(),
    maxEmails: z.number().optional().describe("Maximum emails to include"),
  }),
  execute: async ({ duration, timePreference, emailTypes, maxEmails }) => {
    const userId = await getCurrentUserId();
    
    // Find available slot
    const slot = await findAvailableSlot({
      duration,
      preference: timePreference || 'next_available',
      userId,
    });
    
    if (!slot) {
      return {
        success: false,
        message: "No available time slot found for email block.",
      };
    }
    
    // Get urgent emails from backlog
    let query = db.from('email_backlog')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    // Apply type filters
    if (emailTypes?.includes('urgent')) {
      query = query.eq('urgency', 'urgent');
    }
    if (emailTypes?.includes('important')) {
      query = query.eq('importance', 'important');
    }
    
    const { data: emails } = await query
      .order('urgency', { ascending: true }) // urgent first
      .order('days_in_backlog', { ascending: false })
      .limit(maxEmails || Math.floor(duration / 5)); // ~5 min per email
    
    if (!emails || emails.length === 0) {
      return {
        success: false,
        message: "No urgent emails found in backlog.",
      };
    }
    
    // Create email block
    const block = await createTimeBlock.execute({
      type: 'email',
      title: `Email Responses: ${emails.length} Urgent`,
      startTime: slot.startTime,
      endTime: slot.endTime,
      metadata: {
        emailIds: emails.map(e => e.email_id),
        emailCount: emails.length,
      },
    });
    
    // Prepare email summaries
    const emailSummaries = emails.map(e => ({
      from: e.from_email,
      subject: e.subject,
      daysOld: e.days_in_backlog,
      urgency: e.urgency,
    }));
    
    return {
      success: true,
      block,
      emails: emailSummaries,
      message: `Created ${duration}-minute email block at ${formatTime(slot.startTime)} with ${emails.length} urgent emails`,
      summary: emails.map(e => 
        `• From ${e.from_email}: ${e.subject} (${e.days_in_backlog} days old)`
      ).join('\n'),
    };
  },
});

// Helper function to select optimal tasks
function selectOptimalTasks({
  tasks,
  availableMinutes,
  maxTasks,
  preferredTypes,
}: {
  tasks: TaskBacklog[];
  availableMinutes: number;
  maxTasks: number;
  preferredTypes?: string[];
}): TaskBacklog[] {
  // Score tasks based on multiple factors
  const scoredTasks = tasks.map(task => {
    let score = task.priority; // Base score
    
    // Boost score for older tasks
    score += Math.min(task.days_in_backlog * 5, 20);
    
    // Boost for preferred types
    if (preferredTypes && task.tags) {
      const hasPreferredTag = preferredTypes.some(type => 
        task.tags.includes(type)
      );
      if (hasPreferredTag) score += 15;
    }
    
    // Penalty for tasks that are too long for the block
    if (task.estimated_minutes > availableMinutes) {
      score -= 50;
    }
    
    return { ...task, score };
  });
  
  // Sort by score and select best fitting tasks
  const selected: TaskBacklog[] = [];
  let remainingMinutes = availableMinutes;
  
  scoredTasks
    .sort((a, b) => b.score - a.score)
    .forEach(task => {
      if (
        selected.length < maxTasks &&
        task.estimated_minutes <= remainingMinutes &&
        task.score > 0
      ) {
        selected.push(task);
        remainingMinutes -= task.estimated_minutes;
      }
    });
  
  return selected;
}

// Helper to find available time slots
async function findAvailableSlot({
  duration,
  preference,
  userId,
}: {
  duration: number;
  preference: string;
  userId: string;
}): Promise<{ startTime: string; endTime: string } | null> {
  const scheduleService = ServiceFactory.getInstance().getScheduleService();
  const today = new Date();
  
  // Parse preference
  let searchStart = new Date();
  let searchEnd = new Date();
  searchEnd.setHours(18, 0, 0, 0); // Default end of work day
  
  if (preference === 'afternoon') {
    searchStart.setHours(13, 0, 0, 0);
  } else if (preference === 'morning') {
    searchStart.setHours(9, 0, 0, 0);
    searchEnd.setHours(12, 0, 0, 0);
  } else if (preference.includes(':')) {
    // Specific time like "2pm" or "14:00"
    const parsed = parseTime(preference);
    searchStart = parsed;
    searchEnd = new Date(parsed.getTime() + 4 * 60 * 60 * 1000); // 4 hours window
  }
  
  // Get existing blocks
  const { blocks } = await scheduleService.getScheduleForDate(
    format(today, 'yyyy-MM-dd'),
    userId
  );
  
  // Find gaps
  const gaps = findScheduleGaps(blocks, {
    workStartTime: format(searchStart, 'HH:mm'),
    workEndTime: format(searchEnd, 'HH:mm'),
  });
  
  // Find first gap that fits
  const suitableGap = gaps.find(gap => gap.duration >= duration);
  
  if (!suitableGap) return null;
  
  return {
    startTime: suitableGap.startTime,
    endTime: format(
      addMinutes(parseTime(suitableGap.startTime), duration),
      'HH:mm'
    ),
  };
}
```

### A6. Service Architecture Cleanup

#### Current Issues
- Mock and real services with different interfaces
- No proper error handling
- No offline queue
- Incomplete Gmail/Calendar integration

#### Implementation Plan

**File**: `apps/web/services/interfaces/index.ts`

```typescript
// Define common interfaces for all services
export interface IEmailService {
  getMessage(id: string, options?: GetMessageOptions): Promise<Email>;
  listMessages(query: string, options?: ListOptions): Promise<Email[]>;
  createDraft(draft: DraftParams): Promise<string>;
  sendDraft(draftId: string): Promise<void>;
  archiveMessage(id: string): Promise<void>;
  // ... other methods
}

export interface ITaskService {
  createTask(task: CreateTaskParams): Promise<Task>;
  updateTask(id: string, updates: UpdateTaskParams): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  searchTasks(params: SearchTaskParams): Promise<Task[]>;
  // ... other methods
}

export interface ICalendarService {
  createEvent(event: CreateEventParams): Promise<CalendarEvent>;
  updateEvent(id: string, updates: UpdateEventParams): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
  getEvent(id: string): Promise<CalendarEvent | null>;
  findAvailableSlots(params: FindSlotsParams): Promise<TimeSlot[]>;
  checkConflicts(params: ConflictCheckParams): Promise<CalendarEvent[]>;
  // ... other methods
}
```

**File**: `apps/web/services/factory/service.factory.ts`

```typescript
export class ServiceFactory {
  private static instance: ServiceFactory;
  private emailService: IEmailService;
  private taskService: ITaskService;
  private calendarService: ICalendarService;
  private scheduleService: IScheduleService;
  
  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }
  
  constructor() {
    // Always use real services now
    this.emailService = new GmailService();
    this.taskService = new SupabaseTaskService();
    this.calendarService = new GoogleCalendarService();
    this.scheduleService = new SupabaseScheduleService();
  }
  
  // Add proper error handling and retries
  getEmailService(): IEmailService {
    return new ErrorHandlingProxy(this.emailService);
  }
  
  // ... similar for other services
}

// Error handling wrapper
class ErrorHandlingProxy<T> implements ProxyHandler<T> {
  constructor(private target: T) {}
  
  get(target: T, prop: string | symbol): any {
    const original = target[prop];
    if (typeof original === 'function') {
      return async (...args: any[]) => {
        try {
          return await withRetry(() => original.apply(target, args));
        } catch (error) {
          // Log error
          console.error(`Service error in ${String(prop)}:`, error);
          
          // Queue for offline if network error
          if (isNetworkError(error)) {
            await queueForOffline({ service: target, method: prop, args });
          }
          
          throw new ServiceError(
            `Failed to ${String(prop)}: ${error.message}`,
            error
          );
        }
      };
    }
    return original;
  }
}
```

### A7. Tool Registry Pattern (High Priority)

#### Current State
- ❌ Manual imports of every tool in chat route
- ❌ No automatic tool discovery
- ❌ Lots of import boilerplate

#### Target State
- ✅ Automatic tool registration
- ✅ Dynamic tool discovery
- ✅ Clean chat route with minimal imports

#### Implementation

**File**: `apps/web/modules/ai/tools/registry.ts`

```typescript
import { CoreTool } from 'ai';

export class ToolRegistry {
  private tools = new Map<string, CoreTool<any, any>>();
  
  register(name: string, tool: CoreTool<any, any>) {
    this.tools.set(name, tool);
  }
  
  registerMany(tools: Record<string, CoreTool<any, any>>) {
    Object.entries(tools).forEach(([name, tool]) => {
      this.register(name, tool);
    });
  }
  
  getAll(): Record<string, CoreTool<any, any>> {
    return Object.fromEntries(this.tools);
  }
  
  getByCategory(category: string): Record<string, CoreTool<any, any>> {
    const filtered = Array.from(this.tools.entries())
      .filter(([name]) => name.startsWith(`${category}.`));
    return Object.fromEntries(filtered);
  }
  
  // Auto-register all tools from subdirectories
  async autoRegister() {
    const modules = import.meta.glob('./*/index.ts');
    
    for (const [path, loader] of Object.entries(modules)) {
      const module = await loader() as any;
      const category = path.split('/')[1]; // Extract category from path
      
      // Register each exported tool with category prefix
      Object.entries(module).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`${category}.${name}`, tool as CoreTool<any, any>);
        }
      });
    }
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
```

**Update tool files to export properly**:

```typescript
// apps/web/modules/ai/tools/schedule-tools/index.ts
export { viewSchedule } from './viewSchedule';
export { createTimeBlock } from './createTimeBlock';
export { moveTimeBlock } from './moveTimeBlock';
export { deleteTimeBlock } from './deleteTimeBlock';
export { findTimeBlock } from './findTimeBlock';
export { assignTaskToBlock } from './assignTaskToBlock';
export { completeTask } from './completeTask';

// Similar for other tool categories
```

### A8. Standardized Tool Results (High Priority)

#### Current State
- ❌ Inconsistent return formats across tools
- ❌ Different error handling patterns
- ❌ UI has to handle many different shapes

#### Target State
- ✅ All tools return ToolResult<T>
- ✅ Consistent error handling
- ✅ UI can reliably parse results
- ✅ Better streaming support

#### Implementation

**File**: `apps/web/modules/ai/tools/types.ts`

```typescript
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration?: number;
    affectedItems?: string[];
    suggestions?: string[];
    confirmationRequired?: boolean;
    confirmationId?: string;
  };
  display?: {
    type: 'text' | 'list' | 'schedule' | 'email' | 'task' | 'confirmation';
    content: any;
  };
}

// Helper functions for consistent returns
export function toolSuccess<T>(
  data: T, 
  display?: ToolResult['display'],
  metadata?: ToolResult['metadata']
): ToolResult<T> {
  return { 
    success: true, 
    data, 
    display,
    metadata
  };
}

export function toolError(
  code: string, 
  message: string,
  details?: any
): ToolResult {
  return { 
    success: false, 
    error: { code, message, details } 
  };
}

export function toolConfirmation<T>(
  data: T,
  confirmationId: string,
  message: string
): ToolResult<T> {
  return {
    success: true,
    data,
    metadata: {
      confirmationRequired: true,
      confirmationId
    },
    display: {
      type: 'confirmation',
      content: { message, data }
    }
  };
}
```

**Update all tools to use standardized results**:

```typescript
// Example: Update createTask tool
export const createTask = tool({
  description: "Create a new task from natural language",
  parameters: z.object({
    title: z.string().describe("Task title"),
    estimatedMinutes: z.number().optional().default(30),
    notes: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  }),
  execute: async (params) => {
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      const task = await taskService.createTask({
        title: params.title,
        estimated_minutes: params.estimatedMinutes,
        notes: params.notes,
        priority: params.priority,
        status: 'pending',
        user_id: await getCurrentUserId(),
      });
      
      return toolSuccess(task, {
        type: 'task',
        content: task
      }, {
        affectedItems: [task.id],
        suggestions: task.priority === 'high' 
          ? ['Schedule this task today', 'Add to focus block']
          : ['View all tasks', 'Create another task']
      });
      
    } catch (error) {
      return toolError(
        'TASK_CREATE_FAILED',
        `Failed to create task: ${error.message}`,
        error
      );
    }
  },
});
```

### A9. Enhanced Chat Route with AI SDK Best Practices

#### Implementation

**File**: `apps/web/app/api/chat/route.ts`

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { toolRegistry } from '@/modules/ai/tools/registry';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Auto-register all tools on first request
  if (toolRegistry.getAll().size === 0) {
    await toolRegistry.autoRegister();
  }
  
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    tools: toolRegistry.getAll(),
    maxSteps: 5, // Allow multi-step tool execution
    system: `You are an executive assistant AI that helps users manage their time, tasks, and emails efficiently. 
    
    When using tools:
    - Chain multiple tools together when needed
    - Always provide clear explanations of what you're doing
    - If a tool returns an error, try to recover gracefully
    - Use the display hints in tool results to format responses appropriately
    - When you see confirmationRequired in metadata, ask the user to confirm before proceeding
    
    Your responses should be concise but helpful, like a professional assistant.`,
    
    onStepFinish: async ({ toolCalls, toolResults }) => {
      // Log tool execution for debugging
      console.log('[AI] Tool step completed:', {
        tools: toolCalls.map(tc => tc.toolName),
        results: toolResults.map(tr => ({ 
          success: tr.result?.success,
          error: tr.result?.error 
        }))
      });
      
      // Could stream progress updates here if needed
    },
    
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-completion',
    },
  });

  return result.toDataStreamResponse();
}
```

### A10. Simplified Workflow Tool Integration

Update workflow tools to use standardized results:

```typescript
// apps/web/modules/ai/tools/workflow-tools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { createAdaptiveSchedulingWorkflow } from '@/modules/workflows/graphs/adaptiveScheduling';

export const scheduleDay = tool({
  description: "Intelligently plan or adjust the daily schedule",
  parameters: z.object({
    date: z.string().optional().describe("YYYY-MM-DD format, defaults to today"),
    includeBacklog: z.boolean().default(true),
  }),
  execute: async ({ date, includeBacklog }) => {
    try {
      const workflow = createAdaptiveSchedulingWorkflow();
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      const result = await workflow.invoke({
        userId: getCurrentUserId(),
        date: targetDate,
        includeBacklog,
        proposedChanges: [],
        messages: [],
      });
      
      // Store proposed changes for confirmation
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedChanges);
      
      return toolSuccess(
        {
          proposedChanges: result.proposedChanges,
          summary: result.summary,
        },
        {
          type: 'schedule',
          content: result.proposedChanges
        },
        {
          confirmationRequired: true,
          confirmationId,
          suggestions: [
            'Confirm these changes',
            'Show me the details',
            'Try a different approach'
          ]
        }
      );
      
    } catch (error) {
      return toolError(
        'WORKFLOW_FAILED',
        `Failed to plan schedule: ${error.message}`,
        error
      );
    }
  },
});
```

## Part B: Chat UI/UX Polish (Days 3-4)

### B1. Rich Message Components

#### Current State
- ❌ Plain text messages with ** ** formatting
- ❌ No visual differentiation for different content types
- ❌ Can't select/copy text from AI responses
- ❌ No interactive elements

#### Target State
- ✅ Structured message components
- ✅ Visual badges/chips for entities
- ✅ Selectable text
- ✅ Interactive buttons for common actions

#### Implementation

**File**: `apps/web/modules/chat/components/MessageContent.tsx`

```typescript
interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
  metadata?: {
    entities?: Entity[];
    suggestions?: string[];
    actions?: Action[];
  };
}

interface Entity {
  type: 'task' | 'email' | 'meeting' | 'time' | 'person';
  value: string;
  id?: string;
  metadata?: Record<string, any>;
}

export function MessageContent({ content, role, metadata }: MessageContentProps) {
  // Parse content and identify entities
  const parsed = parseMessageContent(content, metadata?.entities);
  
  return (
    <div className={cn(
      "message-content",
      role === 'assistant' && "select-text" // Enable text selection
    )}>
      {parsed.segments.map((segment, idx) => {
        if (segment.type === 'text') {
          return <span key={idx}>{segment.value}</span>;
        }
        
        if (segment.type === 'entity') {
          return <EntityChip key={idx} entity={segment.entity} />;
        }
        
        if (segment.type === 'list') {
          return <StructuredList key={idx} items={segment.items} />;
        }
        
        if (segment.type === 'schedule') {
          return <SchedulePreview key={idx} blocks={segment.blocks} />;
        }
        
        return null;
      })}
      
      {metadata?.suggestions && (
        <SuggestionButtons suggestions={metadata.suggestions} />
      )}
      
      {metadata?.actions && (
        <ActionButtons actions={metadata.actions} />
      )}
    </div>
  );
}

// Entity chip component
function EntityChip({ entity }: { entity: Entity }) {
  const icons = {
    task: CheckSquare,
    email: Mail,
    meeting: Calendar,
    time: Clock,
    person: User,
  };
  
  const Icon = icons[entity.type];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={entity.type}
            className={cn(
              "inline-flex items-center gap-1 mx-1 cursor-pointer",
              "hover:shadow-sm transition-shadow"
            )}
            onClick={() => handleEntityClick(entity)}
          >
            <Icon className="w-3 h-3" />
            {entity.value}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <EntityDetails entity={entity} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Structured list for schedule/tasks
function StructuredList({ items }: { items: ListItem[] }) {
  return (
    <div className="my-3 space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg",
            "bg-muted/50 hover:bg-muted transition-colors"
          )}
        >
          {item.icon && <item.icon className="w-4 h-4 mt-0.5 text-muted-foreground" />}
          <div className="flex-1">
            <div className="font-medium">{item.title}</div>
            {item.subtitle && (
              <div className="text-sm text-muted-foreground">{item.subtitle}</div>
            )}
          </div>
          {item.time && (
            <Badge variant="outline" className="ml-auto">
              {item.time}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}
```

### B2. Schedule Display Component

**File**: `apps/web/modules/chat/components/SchedulePreview.tsx`

```typescript
interface SchedulePreviewProps {
  blocks: TimeBlock[];
  interactive?: boolean;
}

export function SchedulePreview({ blocks, interactive = true }: SchedulePreviewProps) {
  const sortedBlocks = blocks.sort((a, b) => 
    parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime()
  );
  
  return (
    <Card className="my-4 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Today's Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {sortedBlocks.map((block) => (
            <ScheduleBlockRow
              key={block.id}
              block={block}
              interactive={interactive}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleBlockRow({ block, interactive }: { block: TimeBlock; interactive: boolean }) {
  const typeConfig = {
    focus: { icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    meeting: { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    email: { icon: Mail, color: 'text-green-600', bg: 'bg-green-50' },
    break: { icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50' },
  };
  
  const config = typeConfig[block.type] || typeConfig.focus;
  const Icon = config.icon;
  
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3",
        "hover:bg-muted/50 transition-colors",
        interactive && "cursor-pointer"
      )}
      onClick={() => interactive && handleBlockClick(block)}
    >
      <div className={cn("p-2 rounded-lg", config.bg)}>
        <Icon className={cn("w-4 h-4", config.color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{block.title}</div>
        {block.tasks && block.tasks.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {block.tasks.length} task{block.tasks.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {formatTimeRange(block.startTime, block.endTime)}
      </div>
      
      {interactive && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(block)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleMove(block)}>
              Move
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDelete(block)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
```

### B3. Enhanced Message Parser

**File**: `apps/web/modules/chat/utils/messageParser.ts`

```typescript
interface ParsedSegment {
  type: 'text' | 'entity' | 'list' | 'schedule' | 'code';
  value?: string;
  entity?: Entity;
  items?: ListItem[];
  blocks?: TimeBlock[];
  language?: string;
}

export function parseMessageContent(
  content: string,
  entities?: Entity[]
): { segments: ParsedSegment[] } {
  const segments: ParsedSegment[] = [];
  
  // Patterns to identify different content types
  const patterns = {
    // Time patterns: "at 2pm", "from 10am to 11am"
    time: /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi,
    
    // Email patterns: "email from John"
    email: /\bemail\s+from\s+([^,\.\n]+)/gi,
    
    // Task patterns: "task: Do something"
    task: /\btask:\s*([^\n]+)/gi,
    
    // List patterns: Lines starting with - or *
    list: /^[\-\*]\s+(.+)$/gm,
    
    // Schedule block pattern
    schedule: /^(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)):\s*(.+)$/gm,
  };
  
  // First, extract structured content
  let processedContent = content;
  
  // Extract schedule blocks
  const scheduleMatches = Array.from(content.matchAll(patterns.schedule));
  if (scheduleMatches.length > 0) {
    const blocks: TimeBlock[] = scheduleMatches.map(match => ({
      id: generateId(),
      startTime: match[1],
      endTime: match[2],
      title: match[3].trim(),
      type: inferBlockType(match[3]),
    }));
    
    segments.push({
      type: 'schedule',
      blocks,
    });
    
    // Remove from content
    processedContent = processedContent.replace(patterns.schedule, '');
  }
  
  // Extract lists
  const listLines = processedContent.split('\n').filter(line => 
    line.trim().startsWith('-') || line.trim().startsWith('*')
  );
  
  if (listLines.length > 0) {
    const items: ListItem[] = listLines.map(line => {
      const text = line.replace(/^[\-\*]\s+/, '').trim();
      return {
        title: text,
        icon: inferIcon(text),
      };
    });
    
    segments.push({
      type: 'list',
      items,
    });
    
    // Remove list items from content
    listLines.forEach(line => {
      processedContent = processedContent.replace(line, '');
    });
  }
  
  // Process remaining text with entity highlighting
  const words = processedContent.split(/(\s+)/);
  let currentText = '';
  
  words.forEach(word => {
    // Check if word matches any entity
    const entity = findMatchingEntity(word, entities);
    
    if (entity) {
      // Add accumulated text
      if (currentText) {
        segments.push({ type: 'text', value: currentText });
        currentText = '';
      }
      
      // Add entity
      segments.push({ type: 'entity', entity });
    } else {
      currentText += word;
    }
  });
  
  // Add remaining text
  if (currentText.trim()) {
    segments.push({ type: 'text', value: currentText });
  }
  
  return { segments };
}

function inferBlockType(title: string): TimeBlock['type'] {
  const lower = title.toLowerCase();
  if (lower.includes('meeting') || lower.includes('call')) return 'meeting';
  if (lower.includes('email') || lower.includes('inbox')) return 'email';
  if (lower.includes('break') || lower.includes('lunch')) return 'break';
  return 'focus';
}

function inferIcon(text: string): any {
  const lower = text.toLowerCase();
  if (lower.includes('email')) return Mail;
  if (lower.includes('meeting')) return Calendar;
  if (lower.includes('task')) return CheckSquare;
  if (lower.includes('break')) return Coffee;
  return Circle;
}
```

### B4. Interactive Suggestions

**File**: `apps/web/modules/chat/components/SuggestionButtons.tsx`

```typescript
interface SuggestionButtonsProps {
  suggestions: string[];
  onSelect?: (suggestion: string) => void;
}

export function SuggestionButtons({ suggestions, onSelect }: SuggestionButtonsProps) {
  const { sendMessage } = useChat();
  
  const handleClick = (suggestion: string) => {
    onSelect?.(suggestion);
    sendMessage(suggestion);
  };
  
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((suggestion, idx) => (
        <Button
          key={idx}
          variant="outline"
          size="sm"
          onClick={() => handleClick(suggestion)}
          className="text-xs"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}

// Common suggestions based on context
export function useContextualSuggestions(lastMessage: string): string[] {
  if (lastMessage.includes('schedule')) {
    return [
      "Show my schedule",
      "What's next?",
      "Move my next meeting",
      "Clear my afternoon",
    ];
  }
  
  if (lastMessage.includes('email')) {
    return [
      "Show urgent emails",
      "Process emails",
      "Archive all newsletters",
      "Draft response",
    ];
  }
  
  if (lastMessage.includes('task')) {
    return [
      "Show today's tasks",
      "Mark as complete",
      "Add a new task",
      "What's most important?",
    ];
  }
  
  return [
    "What should I focus on?",
    "Show my day",
    "Any urgent emails?",
  ];
}
```

### B5. Enhanced Chat Panel

**File**: `apps/web/modules/chat/components/ChatPanel.tsx` (Update existing)

```typescript
export function ChatPanel() {
  const { messages, isLoading, sendMessage } = useChat();
  const [selectedText, setSelectedText] = useState('');
  
  // Enable text selection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString());
    }
  };
  
  return (
    <div 
      className="flex flex-col h-full"
      onMouseUp={handleTextSelection}
    >
      {/* Selection toolbar */}
      {selectedText && (
        <SelectionToolbar
          text={selectedText}
          onCopy={() => navigator.clipboard.writeText(selectedText)}
          onCreateTask={() => {
            sendMessage(`Create task: ${selectedText}`);
            setSelectedText('');
          }}
          onDismiss={() => setSelectedText('')}
        />
      )}
      
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLoading={isLoading && message === messages[messages.length - 1]}
            />
          ))}
        </div>
      </ScrollArea>
      
      {/* Contextual suggestions */}
      <div className="border-t p-3">
        <SuggestionButtons
          suggestions={useContextualSuggestions(
            messages[messages.length - 1]?.content || ''
          )}
        />
      </div>
      
      {/* Input */}
      <ChatInput onSendMessage={sendMessage} />
    </div>
  );
}

// Enhanced message bubble with rich content
function MessageBubble({ message, isLoading }: MessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  
  return (
    <div
      className={cn(
        "flex gap-3",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && (
        <Avatar className="w-8 h-8">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isAssistant
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isLoading ? (
          <LoadingDots />
        ) : (
          <MessageContent
            content={message.content}
            role={message.role}
            metadata={message.metadata}
          />
        )}
      </div>
      
      {!isAssistant && (
        <Avatar className="w-8 h-8">
          <AvatarFallback>ME</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
```

### B6. Type Definitions

**File**: `apps/web/modules/chat/types/chat.types.ts` (Update existing)

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  entities?: Entity[];
  suggestions?: string[];
  actions?: Action[];
  toolCalls?: ToolCall[];
  error?: string;
}

export interface Entity {
  type: 'task' | 'email' | 'meeting' | 'time' | 'person' | 'block';
  value: string;
  id?: string;
  metadata?: {
    taskId?: string;
    emailId?: string;
    eventId?: string;
    blockId?: string;
    email?: string;
  };
}

export interface Action {
  label: string;
  action: string;
  params?: Record<string, any>;
  variant?: 'default' | 'primary' | 'destructive';
}

export interface ListItem {
  title: string;
  subtitle?: string;
  icon?: any;
  time?: string;
  metadata?: Record<string, any>;
}
```

## Testing Guide

### Part A: Core Operations Testing

#### 1. Email Operations
```typescript
// Test: Read full email content
"Read the email from Sarah about the Q4 report"
// Expected: Full email body displayed with action items extracted

// Test: Draft response
"Draft a response to Sarah saying I'll review by Friday"
// Expected: Draft created with professional tone

// Test: Convert to task
"Turn that email into a task for tomorrow"
// Expected: Task created, email archived
```

#### 2. Task Management
```typescript
// Test: Create task
"Create task: Review Q4 financial projections"
// Expected: Task created with default 30min estimate

// Test: Edit task
"Change that task to 1 hour"
// Expected: Task duration updated

// Test: Find tasks
"Show me all high priority tasks"
// Expected: Filtered list of high priority tasks
```

#### 3. Meeting Management
```typescript
// Test: Schedule meeting
"Schedule a 30 minute meeting with John tomorrow afternoon"
// Expected: Meeting created at available slot

// Test: Reschedule
"Move my 2pm meeting to 4pm"
// Expected: Meeting moved or conflict shown

// Test: Add prep time
"Add 15 minutes prep time before the team standup"
// Expected: Prep block created before meeting
```

#### 4. Smart Block Creation
```typescript
// Test: Create work block
"Create a 90 minute work block this afternoon and fill it with high priority tasks"
// Expected: Block created with 2-3 tasks that fit the time

// Test: Create email block
"Create a 30 minute email block and add urgent emails that need responses"
// Expected: Email block with 5-6 urgent emails

// Test: Specific time preference
"Create a 2 hour focus block at 2pm with my most important tasks"
// Expected: Block at 2pm with highest priority backlog tasks
```

### Part B: UI/UX Testing

#### 1. Text Selection
- Select any text in AI response
- Copy button should appear
- "Create task" option for selected text

#### 2. Entity Recognition
- Times should show as blue badges
- Email senders as person badges
- Tasks with checkmark icons

#### 3. Schedule Display
- Time blocks in visual cards
- Color coding by type
- Interactive hover states

#### 4. Suggestions
- Context-aware suggestions after each message
- Click to send immediately
- Updates based on conversation

## Success Criteria

### Technical Success
- [ ] All CRUD operations working for email, tasks, meetings
- [ ] Service interfaces properly abstracted
- [ ] Error handling with retries implemented
- [ ] Offline queue functional
- [ ] Full Gmail API integration (read, draft, send)
- [ ] Google Calendar integration complete
- [ ] Tool Registry auto-discovers all tools
- [ ] All tools return standardized ToolResult format
- [ ] Chat route uses registry (no manual imports)
- [ ] Multi-step tool execution working with maxSteps
- [ ] Workflow tools properly wrapped with ToolResult

### UX Success
- [ ] Text selection works in all AI messages
- [ ] Entity badges clickable and informative
- [ ] Schedule displays beautifully in chat
- [ ] Suggestions are contextually relevant from tool metadata
- [ ] Loading states smooth and clear
- [ ] Error messages helpful and actionable
- [ ] Tool confirmations display properly
- [ ] Progress updates stream during multi-step operations

### Performance
- [ ] Tool execution < 2 seconds
- [ ] Message parsing < 100ms
- [ ] No UI jank when rendering rich content
- [ ] Smooth scrolling with many messages
- [ ] Tool registry loads quickly on first request
- [ ] Multi-step operations show progress

### Architecture Success
- [ ] Clean separation: Tools (AI SDK) vs Workflows (LangGraph)
- [ ] Consistent error handling across all tools
- [ ] No code duplication between tools
- [ ] Easy to add new tools (just export from category)
- [ ] Type safety maintained throughout

## Implementation Checklist

### Day 1: Email & Task Operations + Tool Registry
- [ ] Create ToolRegistry class
- [ ] Create standardized ToolResult type and helpers
- [ ] Implement `readEmailContent` tool with ToolResult
- [ ] Implement `draftEmailResponse` tool with ToolResult
- [ ] Implement `processEmailToTask` tool with ToolResult
- [ ] Create Gmail service methods for full API
- [ ] Implement `createTask` tool with ToolResult
- [ ] Implement `editTask` tool with ToolResult
- [ ] Implement `deleteTask` tool with ToolResult
- [ ] Implement `findTasks` tool with ToolResult
- [ ] Update task service with new methods
- [ ] Create tool export index files for each category

### Day 2: Meeting, Smart Blocks & Architecture
- [ ] Implement `scheduleMeeting` tool with ToolResult
- [ ] Implement `rescheduleMeeting` tool with ToolResult
- [ ] Implement `handleMeetingConflict` tool with ToolResult
- [ ] Implement `createWorkBlock` tool with ToolResult
- [ ] Implement `createEmailBlock` tool with ToolResult
- [ ] Implement smart task selection algorithm
- [ ] Create Google Calendar service
- [ ] Create WorkflowPersistenceService
- [ ] Implement workflow state persistence
- [ ] Add `resumeWorkflow` and `showWorkflowHistory` tools with ToolResult
- [ ] Update workflow tools to use ToolResult
- [ ] Define service interfaces
- [ ] Implement ServiceFactory updates
- [ ] Add error handling proxy
- [ ] Create offline queue system
- [ ] Add workflow_states table migration
- [ ] Implement tool auto-registration in registry

### Day 3: Rich Message Components + Enhanced Chat Route
- [ ] Update chat route to use ToolRegistry
- [ ] Add maxSteps and onStepFinish support
- [ ] Add system prompt for executive assistant
- [ ] Create `MessageContent` component
- [ ] Create `EntityChip` component
- [ ] Create `StructuredList` component
- [ ] Create `SchedulePreview` component
- [ ] Implement message parser
- [ ] Add text selection handling
- [ ] Create selection toolbar
- [ ] Update ChatPanel with new features
- [ ] Update UI to handle standardized ToolResult format

### Day 4: Polish & Integration
- [ ] Create `SuggestionButtons` component
- [ ] Implement contextual suggestions from ToolResult metadata
- [ ] Add interactive actions to messages
- [ ] Update type definitions
- [ ] Test all tools return proper ToolResult format
- [ ] Test tool registry auto-discovery
- [ ] Test multi-step tool execution
- [ ] Integration testing
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Final polish pass

## Migration Notes

### Database Changes
No new migrations needed - using existing tables:
- `tasks` table supports new fields
- `time_blocks` table ready
- `email_backlog` exists

**UPDATE**: One new table needed for workflow persistence:

**File**: `migrations/007_workflow_persistence.sql`

```sql
-- Create workflow states table
CREATE TABLE IF NOT EXISTS public.workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('scheduling', 'email_triage', 'daily_review')),
  state JSONB NOT NULL DEFAULT '{}',
  current_node TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  
  INDEX idx_workflow_states_user (user_id),
  INDEX idx_workflow_states_status (status),
  INDEX idx_workflow_states_expires (expires_at)
);

-- Enable RLS
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage own workflows" ON public.workflow_states
  FOR ALL USING (auth.uid() = user_id);

-- Auto-cleanup old workflows
CREATE OR REPLACE FUNCTION cleanup_expired_workflows()
RETURNS void AS $$
BEGIN
  DELETE FROM public.workflow_states
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Breaking Changes
- ServiceFactory API changes (removal of `