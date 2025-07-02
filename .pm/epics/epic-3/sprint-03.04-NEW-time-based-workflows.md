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

**File**: `apps/web/modules/workflows/graphs/endOfDay.ts`

```typescript
interface EODState {
  userId: string;
  date: string;
  // Today's data
  plannedSchedule: TimeBlock[];
  actualSchedule: TimeBlock[];
  completedTasks: Task[];
  incompleteTasks: Task[];
  emailStats: EmailStats;
  // Analysis
  adherenceAnalysis: ScheduleAdherence;
  productivityMetrics: ProductivityMetrics;
  patterns: ExtractedPattern[];
  // Tomorrow prep
  tomorrowPriorities: Priority[];
  tomorrowSuggestions: Suggestion[];
  // Output
  reviewSummary: string;
  learnings: Learning[];
  messages: BaseMessage[];
}

export function createEndOfDayWorkflow() {
  const workflow = new StateGraph<EODState>({
    channels: {
      userId: null,
      date: null,
      plannedSchedule: [],
      actualSchedule: [],
      completedTasks: [],
      incompleteTasks: [],
      emailStats: null,
      adherenceAnalysis: null,
      productivityMetrics: null,
      patterns: [],
      tomorrowPriorities: [],
      tomorrowSuggestions: [],
      reviewSummary: '',
      learnings: [],
      messages: [],
    },
  });

  workflow.addNode("collectTodayData", collectTodayDataNode);
  workflow.addNode("analyzeAdherence", analyzeAdherenceNode);
  workflow.addNode("calculateProductivity", calculateProductivityNode);
  workflow.addNode("extractPatterns", extractPatternsNode);
  workflow.addNode("storeLearnings", storeLearningsNode);
  workflow.addNode("prepareTomorrow", prepareTomorrowNode);
  workflow.addNode("generateReview", generateReviewNode);

  // Flow
  workflow.addEdge("collectTodayData", "analyzeAdherence");
  workflow.addEdge("analyzeAdherence", "calculateProductivity");
  workflow.addEdge("calculateProductivity", "extractPatterns");
  workflow.addEdge("extractPatterns", "storeLearnings");
  workflow.addEdge("storeLearnings", "prepareTomorrow");
  workflow.addEdge("prepareTomorrow", "generateReview");
  workflow.addEdge("generateReview", END);

  workflow.setEntryPoint("collectTodayData");

  return workflow.compile();
}

async function extractPatternsNode(state: EODState): Promise<Partial<EODState>> {
  const patterns: ExtractedPattern[] = [];
  
  // Schedule adherence patterns
  if (state.adherenceAnalysis.deviationPercent < 20) {
    patterns.push({
      type: 'positive',
      category: 'schedule',
      description: 'Excellent schedule adherence today',
      confidence: 0.9,
    });
  }
  
  // Productivity patterns
  const focusBlocks = state.actualSchedule.filter(b => b.type === 'focus');
  const tasksPerHour = state.completedTasks.length / 
    (focusBlocks.reduce((sum, b) => sum + b.duration, 0) / 60);
  
  if (tasksPerHour > 2) {
    patterns.push({
      type: 'positive',
      category: 'productivity',
      description: `High productivity: ${tasksPerHour.toFixed(1)} tasks/hour`,
      confidence: 0.85,
    });
  }
  
  // Time preference patterns
  const morningTasks = state.completedTasks.filter(t => 
    new Date(t.completedAt).getHours() < 12
  );
  const afternoonTasks = state.completedTasks.filter(t => 
    new Date(t.completedAt).getHours() >= 12
  );
  
  if (morningTasks.length > afternoonTasks.length * 1.5) {
    patterns.push({
      type: 'behavioral',
      category: 'timing',
      description: 'More productive in mornings',
      confidence: 0.8,
    });
  }
  
  return { patterns };
}

async function storeLearningsNode(state: EODState): Promise<Partial<EODState>> {
  const ragService = new RAGContextService();
  const learningService = new LearningPatternsService();
  const learnings: Learning[] = [];
  
  // Store significant patterns
  for (const pattern of state.patterns) {
    if (pattern.confidence > 0.7) {
      await ragService.storeContext({
        userId: state.userId,
        type: 'pattern',
        content: pattern.description,
        metadata: {
          date: state.date,
          category: pattern.category,
          confidence: pattern.confidence,
          workflow: 'eod',
        },
      });
      
      learnings.push({
        type: 'pattern_stored',
        description: pattern.description,
      });
    }
  }
  
  // Store schedule deviations
  for (const deviation of state.adherenceAnalysis.deviations) {
    await learningService.learnFromScheduleChange({
      userId: state.userId,
      changeType: deviation.type,
      blockType: deviation.blockType,
      originalTime: deviation.planned,
      newTime: deviation.actual,
      reason: deviation.reason,
    });
    
    learnings.push({
      type: 'deviation_learned',
      description: `Learned from ${deviation.type} of ${deviation.blockType}`,
    });
  }
  
  return { learnings };
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