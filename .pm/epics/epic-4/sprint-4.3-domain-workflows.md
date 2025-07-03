# Sprint 4.3: Domain Workflows

**Sprint Goal**: Implement 4 powerful AI SDK workflows that orchestrate tools with multi-step operations  
**Duration**: 5 days  
**Status**: PLANNING - REVISED FOR AI SDK  
**Dependencies**: Sprint Fix-AI must be completed first

## Objectives

1. Implement Adaptive Scheduling workflow using AI SDK's multi-step capabilities
2. Implement Email Management workflow with intelligent tool orchestration
3. Implement Task Intelligence workflow with dynamic scoring and recommendations
4. Implement Calendar Optimization workflow with conflict resolution
5. Add streaming progress using AI SDK's native streaming support

## Architecture Overview

Instead of LangGraph's explicit state machines, we'll use AI SDK's powerful patterns:
- **Multi-Step Operations**: Using `maxSteps` parameter for complex workflows
- **Tool Orchestration**: Workflows are tools that intelligently call other tools
- **Dynamic Flow**: AI determines the optimal sequence based on context
- **Native Streaming**: Built-in progress updates with `onStepFinish`
- **Implicit Graphs**: The AI creates the flow graph dynamically

## Key Principles

1. **Workflows as Tools**: Each workflow is exposed as a single tool to the orchestration layer
2. **Composable Sub-Tools**: Break down workflow steps into focused tools
3. **AI-Driven Flow**: Let the model decide which tools to use and when
4. **Progress Visibility**: Use streaming to show workflow progress
5. **Pure Data Returns**: All tools return domain data, no UI instructions

## Day 1-2: Adaptive Scheduling Workflow

### Architecture
Uses LangGraph for state management with pure data returns (no UniversalToolResponse).

```typescript
// Workflow state
interface AdaptiveSchedulingState {
  // Input
  userId: string;
  date: string;
  preferences: UserPreferences;
  
  // Fetched data
  currentSchedule: TimeBlock[];
  unscheduledTasks: Task[];
  emailBacklog: Email[];
  calendarEvents: CalendarEvent[];
  
  // Analysis
  gaps: ScheduleGap[];
  inefficiencies: Inefficiency[];
  urgentEmails: Email[];
  highPriorityTasks: Task[];
  
  // Strategy
  strategy: 'full' | 'optimize' | 'gaps-only' | 'minimal';
  
  // Output
  proposedChanges: ScheduleChange[];
  metrics: OptimizationMetrics;
}
```

### Workflow Implementation

```typescript
// apps/web/modules/workflows/graphs/adaptiveScheduling.ts
import { StateGraph } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

// Create the workflow
const workflow = new StateGraph<AdaptiveSchedulingState>({
  channels: adaptiveSchedulingStateSchema
});

// Node 1: Fetch all required data
const fetchDataNode = async (state: AdaptiveSchedulingState) => {
  console.log('[Workflow] Fetching schedule data...');
  
  // Parallel fetch for efficiency
  const [schedule, tasks, emails, calendar] = await Promise.all([
    scheduleService.getScheduleForDate(state.date),
    taskService.getUnscheduledTasks(state.userId),
    emailService.getBacklog(state.userId),
    calendarService.getEventsForDate(state.date)
  ]);
  
  return {
    currentSchedule: schedule,
    unscheduledTasks: tasks,
    emailBacklog: emails,
    calendarEvents: calendar
  };
};

// Node 2: Analyze current state
const analyzeScheduleNode = async (state: AdaptiveSchedulingState) => {
  console.log('[Workflow] Analyzing schedule...');
  
  // Find gaps in schedule
  const gaps = findScheduleGaps(state.currentSchedule, state.preferences);
  
  // Identify inefficiencies
  const inefficiencies = analyzeInefficiencies(state.currentSchedule);
  
  // Filter urgent items
  const urgentEmails = state.emailBacklog.filter(e => e.urgency > 0.8);
  const highPriorityTasks = state.unscheduledTasks.filter(t => t.priority === 'high');
  
  return {
    gaps,
    inefficiencies,
    urgentEmails,
    highPriorityTasks
  };
};

// Node 3: Determine strategy
const determineStrategyNode = async (state: AdaptiveSchedulingState) => {
  console.log('[Workflow] Determining strategy...');
  
  const scheduleUtilization = calculateUtilization(state.currentSchedule);
  const hasUrgentWork = state.urgentEmails.length > 5 || state.highPriorityTasks.length > 0;
  
  let strategy: AdaptiveSchedulingState['strategy'];
  
  if (scheduleUtilization < 20) {
    strategy = 'full'; // Empty schedule, full planning
  } else if (state.inefficiencies.length > 3) {
    strategy = 'optimize'; // Reorganize existing
  } else if (state.gaps.length > 0 && hasUrgentWork) {
    strategy = 'gaps-only'; // Just fill gaps
  } else {
    strategy = 'minimal'; // Minor adjustments only
  }
  
  return { strategy };
};

// Node 4: Execute strategy (calls tools)
const executeStrategyNode = async (state: AdaptiveSchedulingState) => {
  console.log(`[Workflow] Executing ${state.strategy} strategy...`);
  
  const changes: ScheduleChange[] = [];
  
  switch (state.strategy) {
    case 'full':
      // Create full day plan
      changes.push(...await planFullDay(state));
      break;
      
    case 'optimize':
      // Reorganize existing blocks
      changes.push(...await optimizeExisting(state));
      break;
      
    case 'gaps-only':
      // Fill gaps with urgent work
      for (const gap of state.gaps) {
        if (gap.duration >= 30) {
          // Call the fillWorkBlock tool
          const result = await fillWorkBlock.execute({
            blockId: gap.adjacentBlockId,
            startTime: gap.startTime,
            endTime: gap.endTime,
            strategy: 'high-priority'
          });
          
          if (result.success) {
            changes.push({
              type: 'create',
              block: result.block,
              reason: `Filling ${gap.duration}min gap with high-priority work`
            });
          }
        }
      }
      break;
      
    case 'minimal':
      // Just handle urgent emails if needed
      if (state.urgentEmails.length >= 5) {
        changes.push({
          type: 'create',
          block: {
            type: 'email',
            title: 'Urgent Email Processing',
            startTime: findNextAvailable(state.currentSchedule, 30),
            duration: 30
          },
          reason: `${state.urgentEmails.length} urgent emails need attention`
        });
      }
      break;
  }
  
  return { proposedChanges: changes };
};

// Node 5: Validate and finalize
const validateChangesNode = async (state: AdaptiveSchedulingState) => {
  console.log('[Workflow] Validating changes...');
  
  // Check for conflicts
  const validated = validateProposedChanges(
    state.proposedChanges,
    state.currentSchedule,
    state.calendarEvents
  );
  
  // Calculate metrics
  const metrics = {
    blocksAdded: validated.filter(c => c.type === 'create').length,
    blocksModified: validated.filter(c => c.type === 'update').length,
    tasksScheduled: countScheduledTasks(validated),
    focusTimeAdded: calculateFocusTime(validated),
    emailsHandled: countEmailsHandled(validated)
  };
  
  return {
    proposedChanges: validated,
    metrics
  };
};

// Build the workflow
workflow.addNode('fetchData', fetchDataNode);
workflow.addNode('analyzeSchedule', analyzeScheduleNode);
workflow.addNode('determineStrategy', determineStrategyNode);
workflow.addNode('executeStrategy', executeStrategyNode);
workflow.addNode('validateChanges', validateChangesNode);

// Add edges
workflow.addEdge('__start__', 'fetchData');
workflow.addEdge('fetchData', 'analyzeSchedule');
workflow.addEdge('analyzeSchedule', 'determineStrategy');
workflow.addEdge('determineStrategy', 'executeStrategy');
workflow.addEdge('executeStrategy', 'validateChanges');
workflow.addEdge('validateChanges', '__end__');

// Compile the workflow
const adaptiveSchedulingWorkflow = workflow.compile();

// Export as tool for orchestration layer
export const optimizeSchedule = tool({
  description: 'Optimize daily schedule using adaptive scheduling workflow',
  parameters: z.object({
    date: z.string().describe('Date to optimize in YYYY-MM-DD format'),
    preferences: z.object({
      focusBlockDuration: z.number().default(120),
      emailBatchSize: z.number().default(10),
      protectLunch: z.boolean().default(true)
    }).optional()
  }),
  execute: async ({ date, preferences }) => {
    // Run the LangGraph workflow
    const result = await adaptiveSchedulingWorkflow.invoke({
      userId: getCurrentUserId(),
      date,
      preferences: preferences || getDefaultPreferences(),
      // Initialize other state fields
      currentSchedule: [],
      unscheduledTasks: [],
      emailBacklog: [],
      calendarEvents: [],
      gaps: [],
      inefficiencies: [],
      urgentEmails: [],
      highPriorityTasks: [],
      strategy: 'full',
      proposedChanges: [],
      metrics: {}
    });
    
    // Return pure data (no UniversalToolResponse)
    return {
      success: true,
      date: result.date,
      strategy: result.strategy,
      proposedChanges: result.proposedChanges,
      metrics: result.metrics,
      requiresConfirmation: result.proposedChanges.length > 0
    };
  }
});
```

### Helper Functions for Strategy Execution

```typescript
// Helper: Plan full day from scratch
async function planFullDay(state: AdaptiveSchedulingState): Promise<ScheduleChange[]> {
  const changes: ScheduleChange[] = [];
  const { preferences } = state;
  
  // Morning deep work block (9-11am default)
  const morningTasks = selectTasksForEnergy(state.highPriorityTasks, 'morning', 120);
  changes.push({
    type: 'create',
    block: {
      type: 'work',
      title: 'Morning Deep Work',
      startTime: preferences.workStartTime || '09:00',
      duration: 120,
      tasks: morningTasks
    },
    reason: 'Peak cognitive hours for complex work'
  });
  
  // Email batch if needed
  if (state.urgentEmails.length > 0) {
    changes.push({
      type: 'create',
      block: {
        type: 'email',
        title: `Process ${state.urgentEmails.length} urgent emails`,
        startTime: '11:00',
        duration: 30,
        emails: state.urgentEmails.slice(0, 10)
      },
      reason: 'Urgent emails require morning attention'
    });
  }
  
  // Protected lunch
  changes.push({
    type: 'create',
    block: {
      type: 'break',
      title: 'Lunch Break',
      startTime: preferences.lunchTime || '12:00',
      duration: 60
    },
    reason: 'Protected break time'
  });
  
  // Afternoon work block with easier tasks
  const afternoonTasks = selectTasksForEnergy(state.unscheduledTasks, 'afternoon', 90);
  changes.push({
    type: 'create',
    block: {
      type: 'work',
      title: 'Afternoon Tasks',
      startTime: '14:00',
      duration: 90,
      tasks: afternoonTasks
    },
    reason: 'Lower complexity tasks for post-lunch energy'
  });
  
  return changes;
}

// Helper: Select tasks based on energy level
function selectTasksForEnergy(tasks: Task[], timeOfDay: 'morning' | 'afternoon', duration: number): Task[] {
  const selected: Task[] = [];
  let totalMinutes = 0;
  
  // Sort by energy match
  const sorted = tasks.sort((a, b) => {
    const aScore = getEnergyScore(a, timeOfDay);
    const bScore = getEnergyScore(b, timeOfDay);
    return bScore - aScore;
  });
  
  for (const task of sorted) {
    if (totalMinutes + task.estimatedMinutes <= duration) {
      selected.push(task);
      totalMinutes += task.estimatedMinutes;
    }
  }
  
  return selected;
}

// Helper: Calculate energy score
function getEnergyScore(task: Task, timeOfDay: 'morning' | 'afternoon'): number {
  if (timeOfDay === 'morning') {
    // Morning favors complex, creative tasks
    return task.complexity * 1.5 + task.priority * 0.5;
  } else {
    // Afternoon favors routine, quick tasks
    return (1 - task.complexity) * 1.5 + task.priority * 0.5;
  }
}
```

### Sophisticated Behaviors

1. **Energy-Aware Task Assignment**
   - Morning (before noon): Complex, creative, high-focus tasks
   - Early afternoon (12-3pm): Meetings, collaborative work
   - Late afternoon (3-5pm): Routine tasks, email, admin
   - Uses `getEnergyScore` to match tasks to time slots

2. **Smart Email Batching**
   - Creates email blocks only when threshold reached (5+ urgent)
   - Batches by sender for context switching efficiency
   - Limits email blocks to 30 minutes max
   - Schedules in energy valleys (11am, 3pm)

3. **Break Protection Logic**
   - Lunch always protected at user preference time
   - 5-minute buffers between back-to-back meetings
   - No blocks longer than 2 hours without breaks
   - Existing breaks are never overwritten

## Day 3: Email Management Workflow

### Workflow State
```typescript
interface EmailManagementState {
  // Input
  userId: string;
  includeBacklog: boolean;
  maxEmails: number;
  
  // Fetched data
  emails: Email[];
  senderPatterns: SenderPattern[];
  userPreferences: EmailPreferences;
  
  // Analysis
  scoredEmails: ScoredEmail[];
  emailBatches: EmailBatch[];
  
  // Output
  actions: EmailAction[];
  metrics: EmailMetrics;
}
```

### Implementation
```typescript
// Create the workflow
const emailWorkflow = new StateGraph<EmailManagementState>({
  channels: emailManagementStateSchema
});

// Node 1: Fetch emails and patterns
const fetchEmailsNode = async (state: EmailManagementState) => {
  console.log('[Email Workflow] Fetching emails...');
  
  // Get emails
  const emails = await emailService.getEmails({
    userId: state.userId,
    includeBacklog: state.includeBacklog,
    limit: state.maxEmails,
    status: ['unread', 'starred']
  });
  
  // Get sender patterns from RAG
  const senderPatterns = await ragService.getSenderPatterns(state.userId);
  
  // Get user preferences
  const userPreferences = await preferenceService.getEmailPreferences(state.userId);
  
  return {
    emails,
    senderPatterns,
    userPreferences
  };
};

// Node 2: Score emails on 2D matrix
const analyzeEmailsNode = async (state: EmailManagementState) => {
  console.log('[Email Workflow] Analyzing emails...');
  
  const scoredEmails = await Promise.all(
    state.emails.map(async (email) => {
      // Calculate importance (based on sender, content, patterns)
      const importance = calculateImportance(email, state.senderPatterns);
      
      // Calculate urgency (based on keywords, time sensitivity)
      const urgency = calculateUrgency(email);
      
      // Determine quadrant
      const quadrant = getQuadrant(importance, urgency);
      
      return {
        ...email,
        importance,
        urgency,
        quadrant,
        suggestedAction: getDefaultAction(quadrant)
      };
    })
  );
  
  return { scoredEmails };
};

// Node 3: Batch emails intelligently
const batchEmailsNode = async (state: EmailManagementState) => {
  console.log('[Email Workflow] Batching emails...');
  
  const batches: EmailBatch[] = [];
  
  // Group by quadrant
  const quadrants = {
    'urgent-important': state.scoredEmails.filter(e => e.quadrant === 'urgent-important'),
    'important-not-urgent': state.scoredEmails.filter(e => e.quadrant === 'important-not-urgent'),
    'urgent-not-important': state.scoredEmails.filter(e => e.quadrant === 'urgent-not-important'),
    'not-urgent-not-important': state.scoredEmails.filter(e => e.quadrant === 'not-urgent-not-important')
  };
  
  // Create batches with time estimates
  if (quadrants['urgent-important'].length > 0) {
    batches.push({
      type: 'immediate',
      emails: quadrants['urgent-important'],
      estimatedMinutes: quadrants['urgent-important'].length * 5,
      suggestedTime: 'next-available',
      priority: 'high'
    });
  }
  
  if (quadrants['important-not-urgent'].length > 0) {
    batches.push({
      type: 'scheduled',
      emails: quadrants['important-not-urgent'],
      estimatedMinutes: quadrants['important-not-urgent'].length * 3,
      suggestedTime: 'tomorrow-morning',
      priority: 'medium'
    });
  }
  
  // Batch by sender for efficiency
  const senderBatches = groupBySender(quadrants['urgent-not-important']);
  batches.push(...senderBatches);
  
  return { emailBatches: batches };
};

// Node 4: Create actionable plan
const createActionsNode = async (state: EmailManagementState) => {
  console.log('[Email Workflow] Creating action plan...');
  
  const actions: EmailAction[] = [];
  
  for (const batch of state.emailBatches) {
    switch (batch.type) {
      case 'immediate':
        // Create time block today
        actions.push({
          type: 'create-time-block',
          emails: batch.emails,
          duration: batch.estimatedMinutes,
          when: 'today',
          priority: 'high',
          title: `Process ${batch.emails.length} urgent emails`
        });
        break;
        
      case 'scheduled':
        // Add to tomorrow's list
        actions.push({
          type: 'schedule-for-later',
          emails: batch.emails,
          when: 'tomorrow',
          priority: 'medium'
        });
        break;
        
      case 'sender-batch':
        // Quick replies in batch
        actions.push({
          type: 'batch-reply',
          emails: batch.emails,
          templates: await generateQuickReplies(batch.emails),
          estimatedMinutes: batch.emails.length * 2
        });
        break;
        
      case 'archive':
        // Auto-archive low priority
        actions.push({
          type: 'archive',
          emails: batch.emails,
          reason: 'Low priority - no action needed'
        });
        break;
    }
  }
  
  // Calculate metrics
  const metrics = {
    totalProcessed: state.emails.length,
    immediateActions: actions.filter(a => a.when === 'today').length,
    deferredActions: actions.filter(a => a.when === 'tomorrow').length,
    archived: actions.filter(a => a.type === 'archive').length,
    estimatedTimeSaved: calculateTimeSaved(actions)
  };
  
  return { actions, metrics };
};

// Build workflow
emailWorkflow.addNode('fetchEmails', fetchEmailsNode);
emailWorkflow.addNode('analyzeEmails', analyzeEmailsNode);
emailWorkflow.addNode('batchEmails', batchEmailsNode);
emailWorkflow.addNode('createActions', createActionsNode);

// Add edges
emailWorkflow.addEdge('__start__', 'fetchEmails');
emailWorkflow.addEdge('fetchEmails', 'analyzeEmails');
emailWorkflow.addEdge('analyzeEmails', 'batchEmails');
emailWorkflow.addEdge('batchEmails', 'createActions');
emailWorkflow.addEdge('createActions', '__end__');

// Export as tool
export const triageEmails = tool({
  description: 'Intelligently triage and batch process emails',
  parameters: z.object({
    includeBacklog: z.boolean().default(true),
    maxEmails: z.number().default(50)
  }),
  execute: async (params) => {
    const result = await emailWorkflow.invoke({
      userId: getCurrentUserId(),
      ...params,
      emails: [],
      senderPatterns: [],
      userPreferences: {},
      scoredEmails: [],
      emailBatches: [],
      actions: [],
      metrics: {}
    });
    
    return {
      success: true,
      processed: result.metrics.totalProcessed,
      actions: result.actions,
      metrics: result.metrics,
      requiresConfirmation: result.actions.some(a => a.type === 'create-time-block')
    };
  }
});
```

### Helper Functions
```typescript
// Calculate importance based on sender patterns and content
function calculateImportance(email: Email, patterns: SenderPattern[]): number {
  let score = 0.5; // baseline
  
  // Check sender patterns
  const senderPattern = patterns.find(p => p.email === email.from);
  if (senderPattern) {
    score = senderPattern.averageImportance;
  }
  
  // Boost for keywords
  const importantKeywords = ['urgent', 'asap', 'deadline', 'critical'];
  const hasImportantKeyword = importantKeywords.some(k => 
    email.subject.toLowerCase().includes(k) || 
    email.preview.toLowerCase().includes(k)
  );
  if (hasImportantKeyword) score += 0.2;
  
  // Boost for direct mentions
  if (email.to.length === 1) score += 0.1;
  
  return Math.min(score, 1.0);
}

// Calculate urgency based on time sensitivity
function calculateUrgency(email: Email): number {
  let score = 0.3; // baseline
  
  // Time-based urgency
  const ageHours = (Date.now() - email.receivedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 2) score += 0.3;
  else if (ageHours < 24) score += 0.1;
  
  // Keyword urgency
  const urgentKeywords = ['today', 'eod', 'asap', 'urgent', 'immediately'];
  const matches = urgentKeywords.filter(k => 
    email.subject.toLowerCase().includes(k) || 
    email.preview.toLowerCase().includes(k)
  ).length;
  score += matches * 0.15;
  
  return Math.min(score, 1.0);
}

// Get quadrant based on scores
function getQuadrant(importance: number, urgency: number): string {
  if (importance > 0.7 && urgency > 0.7) return 'urgent-important';
  if (importance > 0.7 && urgency <= 0.7) return 'important-not-urgent';
  if (importance <= 0.7 && urgency > 0.7) return 'urgent-not-important';
  return 'not-urgent-not-important';
}
```

## Day 4: Task Intelligence Workflow

### Implementation
```typescript
// Workflow stages:
1. fetchTasks - All pending + backlog
2. scoreTasks - Multi-factor scoring
3. analyzeCapacity - Available time/energy
4. matchTasksToTime - Optimal assignments
5. suggestCombinations - Task batching
6. generateRecommendations - Top tasks with reasons
```

### Sophisticated Scoring
```typescript
score = (priority * 0.6) + (urgency * 0.4) + ageBonus
// Age bonus: min(daysInBacklog * 5, 20)
// Energy matching: +15 points for alignment
// Context batching: +10 points for similar tasks
```

## Day 5: Calendar Optimization & Integration

### Calendar Optimization
```typescript
// Workflow stages:
1. fetchCalendarData - Meetings for date range
2. detectConflicts - Find overlaps/issues
3. analyzeEfficiency - Pattern detection
4. generateResolutions - Conflict solutions
5. optimizeMeetings - Consolidation opportunities
6. protectFocusTime - Block calendar
```

### Sophisticated Behaviors
- **Meeting Consolidation**: Same attendees, similar topics
- **Travel Time**: Auto-detect location changes
- **Energy Optimization**: No deep work after 4 back-to-back meetings
- **Focus Protection**: Block calendar for scheduled focus time

### Integration Testing
- Test all workflows end-to-end
- Verify streaming updates
- Check orchestration routing

## Streaming Implementation

### LangGraph Streaming Support
```typescript
// Enable streaming for all workflows
const workflowWithStreaming = workflow.compile({
  streamMode: 'values',
  checkpointer: new MemorySaver() // For resumability
});

// Stream progress updates
for await (const state of workflowWithStreaming.stream(initialState)) {
  // Send progress to client
  yield {
    progress: calculateProgress(state),
    stage: getCurrentNode(state),
    partialResult: state
  };
}
```

### Progress Calculation
```typescript
function calculateProgress(state: WorkflowState): number {
  const stages = ['fetchData', 'analyze', 'strategy', 'execute', 'validate'];
  const currentStage = state._currentNode;
  const stageIndex = stages.indexOf(currentStage);
  return Math.round((stageIndex + 1) / stages.length * 100);
}
```

## Key Differences from Regular Tools

1. **State Management**: LangGraph maintains state across nodes
2. **Conditional Routing**: Can branch based on analysis results
3. **Resumability**: Can pause and resume workflows
4. **Complex Logic**: Multi-step operations with dependencies
5. **Tool Calls**: Workflows can call the new pure-data tools

## Success Criteria

- [ ] All 4 workflows use LangGraph architecture
- [ ] Return pure data (no UniversalToolResponse)
- [ ] Streaming progress updates work
- [ ] Can call updated tools that use factory pattern
- [ ] Exposed as tools to orchestration layer
- [ ] Performance under 5s for all workflows

## Next Sprint
Sprint 4.4: RAG & Learning 