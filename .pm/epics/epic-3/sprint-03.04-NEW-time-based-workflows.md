# Sprint 03.04 NEW: Time-Based Workflows

## Sprint Overview

**Sprint Number**: 03.04  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: PLANNING

### Sprint Goal
Build three intelligent workflows that match the natural rhythm of a workday, orchestrating domain tools and leveraging RAG memory to create an AI assistant that truly understands and adapts to each user's patterns.

### Key Architecture
- **Three Time-Based Workflows**: Start of Day (SOD), Midday Adjustment, End of Day (EOD)
- **Orchestration**: Workflows coordinate domain tools from Sprint 03.02
- **Intelligence**: All workflows use RAG context from Sprint 03.03
- **Persistence**: Workflows can be interrupted and resumed

## The Three Workflows

### 1. Start of Day (SOD) Workflow
**When**: Morning (or whenever user starts work)
**Purpose**: Intelligent daily planning based on patterns and priorities
**Key Features**:
- Reviews overnight emails and calendar changes
- Pulls high-priority items from task/email backlogs
- Uses RAG patterns for optimal scheduling
- Creates a balanced, personalized schedule

### 2. Midday Adjustment Workflow  
**When**: Midday or on-demand
**Purpose**: Dynamic schedule adaptation based on morning progress
**Key Features**:
- Analyzes morning completion rate
- Adjusts afternoon based on energy/progress
- Handles urgent items that appeared
- Rebalances remaining work

### 3. End of Day (EOD) Workflow
**When**: End of workday
**Purpose**: Review, learn, and prepare for tomorrow
**Key Features**:
- Analyzes what actually happened vs planned
- Extracts patterns and learnings
- Updates RAG system with new patterns
- Prepares intelligent suggestions for tomorrow
- Manages backlogs (tasks and emails)

## Integration Architecture

### How Workflows Use Domain Tools
```typescript
// Workflows orchestrate tools, they don't reimplement functionality
const emailBatches = await batchEmailsByStrategy(emails, 'importance_urgency');
const workBlock = await createWorkBlock({ duration: 120, tasks: highPriorityTasks });
const conflicts = await detectConflicts(meetings);
```

### How Workflows Use RAG
```typescript
// Every workflow decision is enhanced with context
const enhancedState = await contextEnhancer.enhanceWorkflowState(
  userId,
  'sod', // or 'midday' or 'eod'
  currentState
);
// Now state includes patterns, recent decisions, and similar situations
```

### Workflow Persistence
```typescript
// All workflows wrapped with persistence
const baseWorkflow = createSODWorkflow();
const workflow = createPersistentWorkflow(baseWorkflow, 'sod');
// Can be interrupted and resumed anytime
```

## Implementation Details

### Start of Day (SOD) Workflow

```typescript
// apps/web/modules/workflows/graphs/startOfDay.ts

interface SODState {
  userId: string;
  date: string;
  // Inputs
  overnightEmails: Email[];
  calendarChanges: CalendarEvent[];
  taskBacklog: Task[];
  emailBacklog: EmailBacklog[];
  userPreferences: UserPreferences;
  ragContext?: RAGContext;
  // Processing
  prioritizedItems: PrioritizedItem[];
  proposedSchedule: TimeBlock[];
  // Outputs
  finalSchedule: TimeBlock[];
  summary: string;
  messages: BaseMessage[];
}

export function createSODWorkflow() {
  const workflow = new StateGraph<SODState>({
    channels: {
      userId: null,
      date: null,
      overnightEmails: [],
      calendarChanges: [],
      taskBacklog: [],
      emailBacklog: [],
      userPreferences: null,
      ragContext: null,
      prioritizedItems: [],
      proposedSchedule: [],
      finalSchedule: [],
      summary: '',
      messages: [],
    },
  });

  // Nodes
  workflow.addNode("fetchOvernightData", fetchOvernightDataNode);
  workflow.addNode("enhanceWithRAG", enhanceWithRAGNode);
  workflow.addNode("prioritizeItems", prioritizeItemsNode);
  workflow.addNode("generateSchedule", generateScheduleNode);
  workflow.addNode("optimizeSchedule", optimizeScheduleNode);
  workflow.addNode("protectTimeBlocks", protectTimeBlocksNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Flow
  workflow.addEdge("fetchOvernightData", "enhanceWithRAG");
  workflow.addEdge("enhanceWithRAG", "prioritizeItems");
  workflow.addEdge("prioritizeItems", "generateSchedule");
  workflow.addEdge("generateSchedule", "optimizeSchedule");
  workflow.addEdge("optimizeSchedule", "protectTimeBlocks");
  workflow.addEdge("protectTimeBlocks", "generateSummary");
  workflow.addEdge("generateSummary", END);

  workflow.setEntryPoint("fetchOvernightData");

  return workflow.compile();
}

// Key nodes implementation

async function fetchOvernightDataNode(state: SODState): Promise<Partial<SODState>> {
  const [emails, calendar, taskBacklog, emailBacklog] = await Promise.all([
    // Get emails received overnight
    listEmails.execute({ 
      since: getYesterdayEOD(), 
      maxResults: 50 
    }),
    // Get calendar changes
    getCalendarChanges(state.userId, getYesterdayEOD()),
    // Get task backlog with aging
    getTaskBacklogSummary(state.userId),
    // Get email backlog
    getEmailBacklogSummary(state.userId),
  ]);

  return {
    overnightEmails: emails.data.emails,
    calendarChanges: calendar,
    taskBacklog: taskBacklog.tasks,
    emailBacklog: emailBacklog.emails,
  };
}

async function prioritizeItemsNode(state: SODState): Promise<Partial<SODState>> {
  const prioritizer = new ItemPrioritizer();
  
  // Combine all items that need attention
  const allItems: PrioritizedItem[] = [
    // High-priority aged tasks
    ...state.taskBacklog
      .filter(t => t.days_in_backlog > 3 || t.priority === 'high')
      .map(t => ({
        type: 'task' as const,
        item: t,
        score: calculateTaskUrgency(t),
        reason: `In backlog for ${t.days_in_backlog} days`,
      })),
    
    // Urgent emails from backlog
    ...state.emailBacklog
      .filter(e => e.urgency === 'urgent' && e.days_in_backlog > 1)
      .map(e => ({
        type: 'email' as const,
        item: e,
        score: calculateEmailUrgency(e),
        reason: 'Urgent email pending response',
      })),
    
    // New overnight items
    ...analyzeOvernightEmails(state.overnightEmails),
    
    // Calendar conflicts or important meetings
    ...analyzeCalendarChanges(state.calendarChanges),
  ];

  // Use RAG context to adjust priorities
  const adjusted = await adjustPrioritiesWithRAG(
    allItems, 
    state.ragContext
  );

  return {
    prioritizedItems: adjusted.sort((a, b) => b.score - a.score),
  };
}

async function generateScheduleNode(state: SODState): Promise<Partial<SODState>> {
  const scheduler = new IntelligentScheduler();
  const blocks: TimeBlock[] = [];

  // 1. First, handle must-do items (meetings, deadlines)
  const mustDoItems = state.prioritizedItems.filter(
    item => item.type === 'meeting' || item.score > 90
  );

  for (const item of mustDoItems) {
    const block = await createAppropriateBlock(item, state.userPreferences);
    blocks.push(block);
  }

  // 2. Create morning focus block with high-priority tasks
  const morningTasks = state.prioritizedItems
    .filter(item => item.type === 'task' && item.score > 70)
    .slice(0, 3);

  if (morningTasks.length > 0) {
    const focusBlock = await createWorkBlock.execute({
      duration: 120,
      timePreference: state.ragContext?.patterns.includes('morning person') 
        ? '9:00 AM' 
        : '10:00 AM',
      tasks: morningTasks.map(t => t.item),
    });
    blocks.push(focusBlock.data.block);
  }

  // 3. Schedule email block if needed
  const urgentEmails = state.prioritizedItems
    .filter(item => item.type === 'email')
    .slice(0, 10);

  if (urgentEmails.length >= 3) {
    const emailBlock = await createEmailBlock.execute({
      duration: Math.min(urgentEmails.length * 5, 45),
      emails: urgentEmails.map(e => e.item),
    });
    blocks.push(emailBlock.data.block);
  }

  // 4. Always protect lunch
  blocks.push({
    type: 'break',
    title: 'Lunch Break',
    startTime: state.userPreferences.lunch_start_time || '12:00',
    endTime: '13:00',
    protected: true,
  });

  // 5. Afternoon blocks based on energy patterns
  const afternoonStrategy = getAfternoonStrategy(state.ragContext);
  blocks.push(...await generateAfternoonBlocks(
    state.prioritizedItems,
    afternoonStrategy
  ));

  return { proposedSchedule: blocks };
}
```

### Midday Adjustment Workflow

```typescript
// apps/web/modules/workflows/graphs/middayAdjustment.ts

interface MiddayState {
  userId: string;
  morningSchedule: TimeBlock[];
  completedTasks: Task[];
  incompleteTasks: Task[];
  newUrgentItems: UrgentItem[];
  currentEnergy: 'high' | 'medium' | 'low';
  ragContext?: RAGContext;
  adjustments: ScheduleAdjustment[];
  summary: string;
}

export function createMiddayWorkflow() {
  const workflow = new StateGraph<MiddayState>({
    channels: {
      userId: null,
      morningSchedule: [],
      completedTasks: [],
      incompleteTasks: [],
      newUrgentItems: [],
      currentEnergy: 'medium',
      ragContext: null,
      adjustments: [],
      summary: '',
    },
  });

  workflow.addNode("analyzeMorningProgress", analyzeMorningProgressNode);
  workflow.addNode("checkNewUrgentItems", checkNewUrgentItemsNode);
  workflow.addNode("assessCurrentEnergy", assessCurrentEnergyNode);
  workflow.addNode("enhanceWithRAG", enhanceWithRAGNode);
  workflow.addNode("generateAdjustments", generateAdjustmentsNode);
  workflow.addNode("optimizeAfternoon", optimizeAfternoonNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Flow
  workflow.setEntryPoint("analyzeMorningProgress");
  workflow.addEdge("analyzeMorningProgress", "checkNewUrgentItems");
  workflow.addEdge("checkNewUrgentItems", "assessCurrentEnergy");
  workflow.addEdge("assessCurrentEnergy", "enhanceWithRAG");
  workflow.addEdge("enhanceWithRAG", "generateAdjustments");
  workflow.addEdge("generateAdjustments", "optimizeAfternoon");
  workflow.addEdge("optimizeAfternoon", "generateSummary");
  workflow.addEdge("generateSummary", END);

  return workflow.compile();
}

async function analyzeMorningProgressNode(state: MiddayState): Promise<Partial<MiddayState>> {
  const progress = {
    plannedTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    behindSchedule: false,
  };

  // Calculate morning performance
  state.morningSchedule.forEach(block => {
    if (block.tasks) {
      progress.plannedTasks += block.tasks.length;
    }
  });

  progress.completedTasks = state.completedTasks.length;
  progress.completionRate = progress.plannedTasks > 0 
    ? progress.completedTasks / progress.plannedTasks 
    : 0;
  progress.behindSchedule = progress.completionRate < 0.6;

  return {
    messages: [
      new AIMessage(`Morning completion rate: ${(progress.completionRate * 100).toFixed(0)}%`),
    ],
  };
}

async function generateAdjustmentsNode(state: MiddayState): Promise<Partial<MiddayState>> {
  const adjustments: ScheduleAdjustment[] = [];

  // 1. Handle incomplete morning tasks
  if (state.incompleteTasks.length > 0) {
    const carryOver = await findBestSlotsForTasks(
      state.incompleteTasks,
      'afternoon',
      state.currentEnergy
    );
    adjustments.push(...carryOver);
  }

  // 2. Add new urgent items
  for (const urgent of state.newUrgentItems) {
    const adjustment = await createUrgentAdjustment(urgent, state);
    adjustments.push(adjustment);
  }

  // 3. Adjust based on energy
  if (state.currentEnergy === 'low') {
    // Move complex tasks to tomorrow, keep simple ones
    const energyAdjustments = await adjustForLowEnergy(state);
    adjustments.push(...energyAdjustments);
  }

  // 4. Use RAG patterns for smart adjustments
  const patternAdjustments = await applyRAGPatterns(
    adjustments,
    state.ragContext
  );

  return { adjustments: patternAdjustments };
}
```

### End of Day (EOD) Workflow

```typescript
// apps/web/modules/workflows/graphs/endOfDay.ts

interface EODState {
  userId: string;
  date: string;
  // Today's data
  plannedSchedule: TimeBlock[];
  actualSchedule: TimeBlock[];
  completedTasks: Task[];
  incompleteTasks: Task[];
  emailStats: EmailStatistics;
  // Backlogs
  taskBacklog: TaskBacklogSummary;
  emailBacklog: EmailBacklogSummary;
  // Analysis
  patterns: Pattern[];
  deviations: ScheduleDeviation[];
  // Tomorrow prep
  tomorrowSuggestions: Suggestion[];
  reviewSummary: string;
  messages: BaseMessage[];
}

export function createEODWorkflow() {
  const workflow = new StateGraph<EODState>({
    channels: {
      userId: null,
      date: null,
      plannedSchedule: [],
      actualSchedule: [],
      completedTasks: [],
      incompleteTasks: [],
      emailStats: null,
      taskBacklog: null,
      emailBacklog: null,
      patterns: [],
      deviations: [],
      tomorrowSuggestions: [],
      reviewSummary: '',
      messages: [],
    },
  });

  workflow.addNode("fetchTodayData", fetchTodayDataNode);
  workflow.addNode("analyzeScheduleAdherence", analyzeScheduleAdherenceNode);
  workflow.addNode("extractPatterns", extractPatternsNode);
  workflow.addNode("reviewBacklogs", reviewBacklogsNode);
  workflow.addNode("updateRAGLearnings", updateRAGLearningsNode);
  workflow.addNode("prepareTomorrow", prepareTomorrowNode);
  workflow.addNode("generateReviewSummary", generateReviewSummaryNode);

  // Flow
  workflow.setEntryPoint("fetchTodayData");
  workflow.addEdge("fetchTodayData", "analyzeScheduleAdherence");
  workflow.addEdge("analyzeScheduleAdherence", "extractPatterns");
  workflow.addEdge("extractPatterns", "reviewBacklogs");
  workflow.addEdge("reviewBacklogs", "updateRAGLearnings");
  workflow.addEdge("updateRAGLearnings", "prepareTomorrow");
  workflow.addEdge("prepareTomorrow", "generateReviewSummary");
  workflow.addEdge("generateReviewSummary", END);

  return workflow.compile();
}

async function fetchTodayDataNode(state: EODState): Promise<Partial<EODState>> {
  const [schedule, tasks, emails, taskBacklog, emailBacklog] = await Promise.all([
    getScheduleComparison(state.userId, state.date),
    getTasksForDate(state.userId, state.date),
    getEmailStats(state.userId, state.date),
    getTaskBacklogHealth(state.userId),
    getEmailBacklogSummary(state.userId),
  ]);

  return {
    plannedSchedule: schedule.planned,
    actualSchedule: schedule.actual,
    completedTasks: tasks.filter(t => t.completed),
    incompleteTasks: tasks.filter(t => !t.completed),
    emailStats: emails,
    taskBacklog,
    emailBacklog,
  };
}

async function extractPatternsNode(state: EODState): Promise<Partial<EODState>> {
  const patterns: Pattern[] = [];

  // 1. Task completion patterns
  const tasksByTime = groupTasksByCompletionTime(state.completedTasks);
  const productiveTime = findMostProductiveTime(tasksByTime);
  
  if (productiveTime.confidence > 0.7) {
    patterns.push({
      type: 'productivity',
      description: `Most productive during ${productiveTime.period}`,
      confidence: productiveTime.confidence,
      actionable: true,
    });
  }

  // 2. Schedule deviation patterns
  state.deviations.forEach(deviation => {
    if (deviation.type === 'moved' && deviation.minutes > 30) {
      patterns.push({
        type: 'behavior',
        description: `Frequently moves ${deviation.blockType} blocks`,
        confidence: 0.8,
        actionable: true,
      });
    }
  });

  // 3. Email response patterns
  if (state.emailStats.averageResponseTime < 30) {
    patterns.push({
      type: 'behavior',
      description: 'Quick email responder - usually within 30 minutes',
      confidence: 0.9,
      actionable: false,
    });
  }

  // 4. Break patterns
  const lunchTaken = state.actualSchedule.find(b => 
    b.type === 'break' && isLunchTime(b)
  );
  
  if (!lunchTaken) {
    patterns.push({
      type: 'health',
      description: 'Skipped lunch break today',
      confidence: 1.0,
      actionable: true,
      priority: 'high',
    });
  }

  return { patterns };
}

async function reviewBacklogsNode(state: EODState): Promise<Partial<EODState>> {
  // Analyze task backlog health
  const taskBacklogAnalysis = {
    total: state.taskBacklog.total,
    stale: state.taskBacklog.tasks.filter(t => t.days_in_backlog > 7).length,
    highPriority: state.taskBacklog.tasks.filter(t => t.priority === 'high').length,
    growthRate: calculateBacklogGrowth(state.taskBacklog),
  };

  // Analyze email backlog
  const emailBacklogAnalysis = {
    total: state.emailBacklog.total,
    urgent: state.emailBacklog.emails.filter(e => e.urgency === 'urgent').length,
    avgAge: calculateAverageAge(state.emailBacklog.emails),
  };

  // Add patterns if backlogs are growing
  if (taskBacklogAnalysis.growthRate > 0.2) {
    state.patterns.push({
      type: 'workload',
      description: `Task backlog growing by ${(taskBacklogAnalysis.growthRate * 100).toFixed(0)}% daily`,
      confidence: 1.0,
      actionable: true,
      priority: 'high',
    });
  }

  // Update backlogs with today's incomplete items
  await updateTaskBacklog(state.userId, state.incompleteTasks);
  await updateEmailBacklog(state.userId, state.emailStats.unprocessed);

  return {
    messages: [
      ...state.messages,
      new AIMessage(`Backlog status: ${taskBacklogAnalysis.total} tasks, ${emailBacklogAnalysis.total} emails`),
    ],
  };
}

async function updateRAGLearningsNode(state: EODState): Promise<Partial<EODState>> {
  const learningService = new LearningPatternsService();
  const ragService = new RAGContextService();

  // 1. Store significant patterns
  for (const pattern of state.patterns) {
    if (pattern.confidence > 0.7 && pattern.actionable) {
      await ragService.storeContext({
        userId: state.userId,
        type: 'pattern',
        content: pattern.description,
        metadata: {
          date: state.date,
          patternType: pattern.type,
          confidence: pattern.confidence,
          priority: pattern.priority,
        },
      });
    }
  }

  // 2. Learn from task completions
  for (const task of state.completedTasks) {
    if (task.actual_duration) {
      await learningService.learnFromTaskCompletion({
        userId: state.userId,
        task,
        completedAt: task.completed_at,
        actualDuration: task.actual_duration,
        timeOfDay: getTimeOfDay(task.completed_at),
      });
    }
  }

  // 3. Learn from schedule deviations
  for (const deviation of state.deviations) {
    await learningService.learnFromScheduleChange({
      userId: state.userId,
      changeType: 'move',
      blockType: deviation.blockType,
      originalTime: deviation.plannedTime,
      newTime: deviation.actualTime,
      reason: deviation.reason,
    });
  }

  // 4. Store daily summary
  const summary = {
    date: state.date,
    completionRate: calculateCompletionRate(state),
    patterns: state.patterns.map(p => p.description),
    backlogHealth: {
      tasks: state.taskBacklog.total,
      emails: state.emailBacklog.total,
    },
  };

  await ragService.storeContext({
    userId: state.userId,
    type: 'decision',
    content: `Daily review: ${JSON.stringify(summary)}`,
    metadata: summary,
  });

  return { 
    messages: [
      ...state.messages,
      new AIMessage('Updated learning system with today\'s patterns'),
    ],
  };
}

async function prepareTomorrowNode(state: EODState): Promise<Partial<EODState>> {
  const suggestions: Suggestion[] = [];
  const ragService = new RAGContextService();

  // Get context for tomorrow planning
  const tomorrowContext = await ragService.getContext(
    state.userId,
    'Planning tomorrow based on today',
    { includeSimilar: true, includePatterns: true }
  );

  // 1. Address skipped lunch
  const skippedLunch = state.patterns.find(p => 
    p.description.includes('Skipped lunch')
  );
  if (skippedLunch) {
    suggestions.push({
      priority: 'high',
      category: 'health',
      description: 'Block lunch time in calendar',
      reasoning: 'You skipped lunch today - let\'s protect it tomorrow',
      action: {
        type: 'create_block',
        block: {
          type: 'break',
          title: 'Lunch Break',
          startTime: '12:00',
          duration: 60,
          protected: true,
        },
      },
    });
  }

  // 2. High-priority backlog items
  const urgentBacklogTasks = state.taskBacklog.tasks
    .filter(t => t.priority === 'high' || t.days_in_backlog > 5)
    .slice(0, 3);

  if (urgentBacklogTasks.length > 0) {
    suggestions.push({
      priority: 'high',
      category: 'productivity',
      description: `Schedule ${urgentBacklogTasks.length} overdue high-priority tasks`,
      reasoning: 'These tasks have been waiting too long',
      action: {
        type: 'create_focus_block',
        tasks: urgentBacklogTasks,
        preferredTime: tomorrowContext.patterns.find(p => 
          p.content.includes('productive')
        )?.content || 'morning',
      },
    });
  }

  // 3. Urgent emails
  const urgentEmails = state.emailBacklog.emails
    .filter(e => e.urgency === 'urgent')
    .slice(0, 5);

  if (urgentEmails.length >= 3) {
    suggestions.push({
      priority: 'high',
      category: 'communication',
      description: `Process ${urgentEmails.length} urgent emails`,
      reasoning: 'Important emails need responses',
      action: {
        type: 'create_email_block',
        emails: urgentEmails,
        duration: urgentEmails.length * 5,
      },
    });
  }

  // 4. Based on today's performance
  if (state.completedTasks.length < state.incompleteTasks.length) {
    suggestions.push({
      priority: 'medium',
      category: 'planning',
      description: 'Reduce tomorrow\'s workload',
      reasoning: 'Today was overloaded - let\'s be more realistic',
      action: {
        type: 'adjust_capacity',
        reduction: 0.8,
      },
    });
  }

  return { tomorrowSuggestions: suggestions };
}

async function generateReviewSummaryNode(state: EODState): Promise<Partial<EODState>> {
  const summary = `# Daily Review - ${formatDate(state.date)}

## 📊 Today's Performance
- ✅ Completed: ${state.completedTasks.length} tasks
- ⏳ Incomplete: ${state.incompleteTasks.length} tasks  
- 📧 Emails: ${state.emailStats.processed} processed, ${state.emailStats.received} received
- ⏰ Schedule adherence: ${calculateAdherenceRate(state)}%

## 🔍 Key Patterns
${state.patterns.map(p => `- ${getPatternEmoji(p.type)} ${p.description}`).join('\n')}

## 📚 Backlog Status
- Tasks: ${state.taskBacklog.total} total (${state.taskBacklog.stale} stale)
- Emails: ${state.emailBacklog.total} total (${state.emailBacklog.urgent} urgent)

## 🎯 Tomorrow's Priorities
${state.tomorrowSuggestions.map((s, i) => 
  `${i + 1}. [${s.priority.toUpperCase()}] ${s.description}
   → ${s.reasoning}`
).join('\n\n')}

## 💡 Quick Actions
- Say "Plan my day" tomorrow morning to implement these suggestions
- Say "Show backlog" to see all pending items
- Say "Adjust preferences" if patterns don't match your style`;

  return { reviewSummary: summary };
}
```

### 4. Workflow Integration Tools

**File**: `apps/web/modules/ai/tools/workflow/time-based.ts`

```typescript
export const startMyDay = tool({
  description: "Run the Start of Day workflow to plan your day intelligently",
  parameters: z.object({
    date: z.string().optional().describe("YYYY-MM-DD format, defaults to today"),
    includeIntentions: z.boolean().default(true),
  }),
  execute: async ({ date, includeIntentions }) => {
    try {
      const workflow = createPersistentWorkflow(
        createStartOfDayWorkflow(),
        'sod'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        date: date || format(new Date(), 'yyyy-MM-dd'),
        includeIntentions,
      });
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedSchedule);
      
      return toolConfirmation(
        {
          schedule: result.proposedSchedule,
          intentions: result.dailyIntentions,
          insights: formatMorningInsights(result),
        },
        confirmationId,
        `Good morning! I've prepared your schedule with ${result.proposedSchedule.length} blocks. Ready to start?`
      );
    } catch (error) {
      return toolError('SOD_FAILED', error.message);
    }
  },
});

export const adjustMyDay = tool({
  description: "Run midday adjustment to adapt your schedule based on morning progress",
  parameters: z.object({
    energyLevel: z.enum(['high', 'medium', 'low']).optional(),
  }),
  execute: async ({ energyLevel }) => {
    try {
      const workflow = createPersistentWorkflow(
        createMiddayAdjustmentWorkflow(),
        'midday'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        currentTime: format(new Date(), 'HH:mm'),
        energyLevel,
      });
      
      if (result.adjustments.length === 0) {
        return toolSuccess({
          message: "You're on track! No adjustments needed.",
        });
      }
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.adjustments);
      
      return toolConfirmation(
        result.adjustments,
        confirmationId,
        `I suggest ${result.adjustments.length} adjustments for your afternoon.`
      );
    } catch (error) {
      return toolError('MIDDAY_FAILED', error.message);
    }
  },
});

export const reviewMyDay = tool({
  description: "Run End of Day workflow to review today and prepare for tomorrow",
  parameters: z.object({
    includeDetailedAnalysis: z.boolean().default(true),
  }),
  execute: async ({ includeDetailedAnalysis }) => {
    try {
      const workflow = createPersistentWorkflow(
        createEndOfDayWorkflow(),
        'eod'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        date: format(new Date(), 'yyyy-MM-dd'),
        includeDetailedAnalysis,
      });
      
      return toolSuccess({
        summary: result.reviewSummary,
        patterns: result.patterns,
        tomorrowSuggestions: result.tomorrowSuggestions,
        learnings: result.learnings,
      }, {
        type: 'text',
        content: result.reviewSummary,
      }, {
        suggestions: [
          'Plan tomorrow morning',
          'See detailed metrics',
          'Review patterns',
        ],
      });
    } catch (error) {
      return toolError('EOD_FAILED', error.message);
    }
  },
});
```

## Implementation Guidelines

### 1. Workflow State Management
- Use typed interfaces for all state
- Keep state immutable between nodes
- Return only changed properties from nodes

### 2. RAG Integration Pattern
```typescript
// Every workflow should:
// 1. Load context early
const context = await loadRAGContext(userId, query);

// 2. Use context in decisions
if (context.patterns.some(p => p.content.includes('prefers morning'))) {
  // Apply morning preference
}

// 3. Store learnings at the end
await storeLearnings(decisions, outcomes);
```

### 3. Error Handling
- Each node should handle errors gracefully
- Use workflow persistence for recovery
- Provide meaningful error messages

## Testing Strategy

### 1. Workflow Tests
```typescript
describe('Start of Day Workflow', () => {
  it('should incorporate morning patterns', async () => {
    // Seed RAG with morning patterns
    await seedMorningPatterns(userId);
    
    const workflow = createStartOfDayWorkflow();
    const result = await workflow.invoke({
      userId,
      date: '2024-01-15',
    });
    
    expect(result.proposedSchedule).toContainEqual(
      expect.objectContaining({
        title: expect.stringContaining('Morning Routine'),
      })
    );
  });
});
```

### 2. Integration Tests
- Test full workflow execution
- Verify RAG integration
- Check tool orchestration
- Validate state transitions

## Success Criteria

- [ ] All three workflows implemented
- [ ] RAG context used in all decisions
- [ ] Learnings stored after each workflow
- [ ] Workflows can be interrupted and resumed
- [ ] Natural language summaries generated
- [ ] Tool orchestration working smoothly
- [ ] Performance within targets
- [ ] Comprehensive test coverage
- [ ] Documentation complete

## Next Sprint Preview

Sprint 03.05 will add:
- Change preview UI
- Workflow analytics dashboard
- Advanced RAG tuning
- Production optimizations 

## Workflow Tools for Chat

```typescript
// apps/web/modules/ai/tools/workflow/index.ts

export const startMyDay = tool({
  description: "Run Start of Day workflow for intelligent daily planning",
  parameters: z.object({
    date: z.string().optional(),
    includeBacklog: z.boolean().default(true),
  }),
  execute: async ({ date, includeBacklog }) => {
    try {
      const baseWorkflow = createSODWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'sod');
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        date: date || format(new Date(), 'yyyy-MM-dd'),
        includeBacklog,
      });
      
      const confirmationId = crypto.randomUUID();
      await proposalStore.store(confirmationId, {
        type: 'schedule',
        changes: result.finalSchedule,
        userId: await getCurrentUserId(),
      });
      
      return toolConfirmation(
        result.finalSchedule,
        confirmationId,
        result.summary
      );
    } catch (error) {
      return toolError('SOD_FAILED', error.message);
    }
  },
});

export const adjustMyDay = tool({
  description: "Run Midday Adjustment workflow to adapt schedule",
  parameters: z.object({
    currentEnergy: z.enum(['high', 'medium', 'low']).optional(),
  }),
  execute: async ({ currentEnergy }) => {
    try {
      const baseWorkflow = createMiddayWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'midday');
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        currentEnergy: currentEnergy || 'medium',
      });
      
      return toolSuccess(
        result.adjustments,
        {
          type: 'schedule',
          content: result.adjustments,
        },
        {
          suggestions: [
            'Apply these changes',
            'Show current schedule',
            'Skip adjustments',
          ],
        }
      );
    } catch (error) {
      return toolError('MIDDAY_FAILED', error.message);
    }
  },
});

export const reviewMyDay = tool({
  description: "Run End of Day workflow to review and learn",
  parameters: z.object({
    date: z.string().optional(),
  }),
  execute: async ({ date }) => {
    try {
      const baseWorkflow = createEODWorkflow();
      const workflow = createPersistentWorkflow(baseWorkflow, 'eod');
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        date: date || format(new Date(), 'yyyy-MM-dd'),
      });
      
      return toolSuccess(
        {
          summary: result.reviewSummary,
          patterns: result.patterns,
          suggestions: result.tomorrowSuggestions,
        },
        {
          type: 'text',
          content: result.reviewSummary,
        }
      );
    } catch (error) {
      return toolError('EOD_FAILED', error.message);
    }
  },
});
```

## Workflow Persistence & Storage

### Proposal Storage

```typescript
// apps/web/modules/workflows/utils/proposalStore.ts

interface StoredProposal {
  id: string;
  userId: string;
  type: 'schedule' | 'adjustments' | 'suggestions';
  data: any;
  timestamp: Date;
  expiresAt: Date;
}

class ProposalStore {
  private proposals = new Map<string, StoredProposal>();
  private cleanupInterval: NodeJS.Timer;
  
  constructor() {
    // Clean up expired proposals every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }
  
  async store(id: string, data: any): Promise<void> {
    const proposal: StoredProposal = {
      id,
      userId: data.userId,
      type: data.type,
      data: data.changes || data,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };
    
    this.proposals.set(id, proposal);
    
    // Limit store size
    if (this.proposals.size > 100) {
      const oldest = Array.from(this.proposals.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      this.proposals.delete(oldest[0]);
    }
  }
  
  async retrieve(id: string): Promise<StoredProposal | null> {
    const proposal = this.proposals.get(id);
    if (!proposal) return null;
    
    if (proposal.expiresAt < new Date()) {
      this.proposals.delete(id);
      return null;
    }
    
    return proposal;
  }
  
  private cleanup(): void {
    const now = new Date();
    for (const [id, proposal] of this.proposals.entries()) {
      if (proposal.expiresAt < now) {
        this.proposals.delete(id);
      }
    }
  }
}

export const proposalStore = new ProposalStore();
```

### Apply Proposed Changes

```typescript
// apps/web/modules/ai/tools/workflow/applyChanges.ts

export const applyProposedChanges = tool({
  description: "Apply previously proposed schedule changes",
  parameters: z.object({
    confirmationId: z.string(),
  }),
  execute: async ({ confirmationId }) => {
    try {
      const proposal = await proposalStore.retrieve(confirmationId);
      if (!proposal) {
        return toolError('PROPOSAL_EXPIRED', 'This proposal has expired. Please run the workflow again.');
      }
      
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const applied = [];
      const failed = [];
      
      for (const change of proposal.data) {
        try {
          if (change.action === 'create') {
            await scheduleService.createTimeBlock(change.block);
            applied.push(change);
          } else if (change.action === 'update') {
            await scheduleService.updateTimeBlock(change.blockId, change.updates);
            applied.push(change);
          } else if (change.action === 'delete') {
            await scheduleService.deleteTimeBlock(change.blockId);
            applied.push(change);
          }
        } catch (error) {
          failed.push({ change, error: error.message });
        }
      }
      
      return toolSuccess({
        applied: applied.length,
        failed: failed.length,
        details: failed,
      }, {
        type: 'text',
        content: `Applied ${applied.length} changes${failed.length > 0 ? `, ${failed.length} failed` : ''}.`,
      });
    } catch (error) {
      return toolError('APPLY_FAILED', error.message);
    }
  },
});
```

## Workflow Utilities

### Time Helpers

```typescript
// apps/web/modules/workflows/utils/timeHelpers.ts

export function getTimeOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function calculateCompletionRate(state: EODState): number {
  const total = state.completedTasks.length + state.incompleteTasks.length;
  return total > 0 ? (state.completedTasks.length / total) * 100 : 0;
}

export function calculateAdherenceRate(state: EODState): number {
  const deviations = state.deviations.length;
  const totalBlocks = state.plannedSchedule.length;
  return totalBlocks > 0 ? ((totalBlocks - deviations) / totalBlocks) * 100 : 100;
}

export function getPatternEmoji(type: string): string {
  const emojis = {
    productivity: '🚀',
    behavior: '🔄',
    health: '❤️',
    workload: '📈',
    timing: '⏰',
  };
  return emojis[type] || '📌';
}
```

### Backlog Management

```typescript
// apps/web/modules/workflows/utils/backlogManager.ts

export async function getTaskBacklogHealth(userId: string): Promise<TaskBacklogSummary> {
  const { data: tasks } = await db
    .from('task_backlog')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('days_in_backlog', { ascending: false });
  
  return {
    total: tasks.length,
    tasks: tasks || [],
    stale: tasks?.filter(t => t.days_in_backlog > 7).length || 0,
    growthRate: await calculateGrowthRate(userId, 'task'),
  };
}

export async function getEmailBacklogSummary(userId: string): Promise<EmailBacklogSummary> {
  const { data: emails } = await db
    .from('email_backlog')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('urgency')
    .order('days_in_backlog', { ascending: false });
  
  return {
    total: emails.length,
    emails: emails || [],
    urgent: emails?.filter(e => e.urgency === 'urgent').length || 0,
    averageAge: calculateAverageAge(emails || []),
  };
}

export async function updateTaskBacklog(userId: string, incompleteTasks: Task[]): Promise<void> {
  for (const task of incompleteTasks) {
    await db.from('task_backlog').upsert({
      user_id: userId,
      task_id: task.id,
      title: task.title,
      priority: task.priority,
      estimated_minutes: task.estimated_minutes,
      days_in_backlog: 0, // Will be incremented by daily job
      created_at: new Date(),
    });
  }
}
```

## Time-Based Triggers

```typescript
// apps/web/app/api/chat/route.ts additions

// Check for time-based workflow triggers
const hour = new Date().getHours();
const userId = await getCurrentUserId();

// Morning trigger
if (hour >= 6 && hour <= 10) {
  const hasRunSOD = await checkWorkflowRun(userId, 'sod', 'today');
  if (!hasRunSOD) {
    // Suggest SOD workflow
    return new Response(
      "Good morning! Ready to plan your day? I can help you create an optimized schedule.",
      { headers: { 'X-Suggestion': 'start-my-day' } }
    );
  }
}

// End of day trigger
if (hour >= 17 && hour <= 20) {
  const hasRunEOD = await checkWorkflowRun(userId, 'eod', 'today');
  if (!hasRunEOD) {
    return new Response(
      "End of your workday! Would you like me to review today and prepare for tomorrow?",
      { headers: { 'X-Suggestion': 'review-my-day' } }
    );
  }
}
```

## Testing Scenarios

### SOD Workflow Tests
1. **Empty calendar**: Should create full schedule
2. **Existing meetings**: Should work around them
3. **Large backlog**: Should prioritize intelligently
4. **Monday morning**: Should handle weekend emails

### Midday Workflow Tests
1. **Behind schedule**: Should adjust realistically
2. **Ahead of schedule**: Should add more tasks
3. **Low energy**: Should suggest easier tasks
4. **New urgent items**: Should fit them in

### EOD Workflow Tests
1. **Productive day**: Should recognize patterns
2. **Skipped lunch**: Should flag and plan protection
3. **Growing backlog**: Should suggest capacity adjustment
4. **Friday evening**: Should prep for Monday

## Success Criteria

- [ ] All three workflows implemented with LangGraph
- [ ] Email backlog managed in workflows
- [ ] Task backlog managed in workflows
- [ ] RAG integration in all workflows
- [ ] Workflow persistence working
- [ ] Proposal storage and retrieval
- [ ] Time-based triggers functional
- [ ] Natural language summaries
- [ ] Backlog health tracking
- [ ] Pattern extraction working
- [ ] Tomorrow suggestions intelligent
- [ ] All workflows complete in <5 seconds
- [ ] Error recovery implemented
- [ ] Comprehensive test coverage 