# AI System Reference - Epic 4 Architecture

## Executive Summary

dayli employs a sophisticated multi-layered AI architecture that intelligently routes requests through an orchestration layer to either atomic tools, complex workflows, or direct conversational responses. The system continuously learns from user interactions through RAG (Retrieval-Augmented Generation) to provide increasingly personalized and context-aware assistance.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestration Layer                         │
│  • Intent Classification (GPT-4)                             │
│  • RAG Context Injection                                     │
│  • Confidence Scoring                                        │
│  • Route Determination                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬─────────────────┐
        ▼                         ▼                 ▼
┌───────────────┐       ┌───────────────┐   ┌───────────────┐
│  AI SDK Tools │       │   LangGraph   │   │    Direct     │
│   (Atomic)    │       │  (Workflows)  │   │  Response     │
│               │       │               │   │               │
│  25 Tools     │       │  4 Workflows  │   │ Conversation  │
└───────────────┘       └───────────────┘   └───────────────┘
        │                         │                 │
        └─────────────┬───────────┴─────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              UniversalToolResponse                           │
│  • Structured Data                                           │
│  • Rich UI Components                                        │
│  • Suggestions & Actions                                     │
└─────────────────────────────────────────────────────────────┘
```

## 1. Orchestration Layer

The orchestration layer is the brain of our system, using GPT-4 to understand user intent and route requests appropriately.

### Intent Classification

```typescript
interface UserIntent {
  category: 'workflow' | 'tool' | 'conversation';
  confidence: number; // 0-1 score
  subcategory?: string;
  entities: {
    dates?: string[];
    times?: string[];
    people?: string[];
    tasks?: string[];
    emails?: string[];
  };
  suggestedHandler: {
    type: 'workflow' | 'tool' | 'direct';
    name?: string;
    params?: Record<string, any>;
  };
  reasoning: string;
}
```

### Routing Logic

1. **High Complexity → Workflows** (confidence > 0.8)
   - Multi-step operations
   - Cross-domain requests
   - Strategic planning
   - Example: "Organize my entire day including emails and tasks"

2. **Specific Actions → Tools** (confidence > 0.7)
   - Single operations
   - Clear parameters
   - Direct modifications
   - Example: "Move my 2pm meeting to 4pm"

3. **Ambiguous/Conversational → Direct Response** (confidence < 0.7)
   - Questions
   - Clarifications
   - General assistance
   - Example: "How should I prioritize my day?"

### RAG Context Injection

Before classification, the orchestrator enriches the request with:
- **Past Decisions**: Similar actions the user has taken
- **User Patterns**: Learned preferences and behaviors
- **Constraints**: Rules learned from rejections
- **Time Context**: Current time, day of week, user's schedule state

## 2. Tools Inventory (25 Total)

All tools follow the AI SDK pattern and return `UniversalToolResponse` for consistent UI rendering.

### Schedule Tools (5)

#### `viewSchedule`
- **Purpose**: Display schedule for any date
- **Parameters**: `date?` (defaults to today)
- **Returns**: Time blocks with statistics
- **UI**: Schedule timeline with interactive blocks

#### `createTimeBlock`
- **Purpose**: Add new time blocks to schedule
- **Parameters**: `type`, `title`, `startTime`, `endTime`, `date?`
- **Returns**: Created block with conflict warnings
- **Features**: Supports up to 4 overlapping blocks

#### `moveTimeBlock`
- **Purpose**: Reschedule existing blocks
- **Parameters**: `blockId`, `newStartTime`, `newEndTime?`
- **Returns**: Updated block with new time
- **Validation**: Conflict checking

#### `deleteTimeBlock`
- **Purpose**: Remove blocks from schedule
- **Parameters**: `blockId`, `confirm?`
- **Returns**: Confirmation or deletion result
- **Safety**: Requires confirmation for blocks with tasks

#### `fillWorkBlock`
- **Purpose**: Intelligently fill work blocks with tasks
- **Parameters**: `blockId`, `strategy` (best_fit|priority|quick_wins)
- **Returns**: Block with assigned tasks
- **Intelligence**: Considers task duration, priority, and energy levels

### Task Tools (4)

#### `createTask`
- **Purpose**: Create new tasks with smart defaults
- **Parameters**: `title`, `estimatedMinutes?`, `priority?`, `description?`
- **Returns**: Created task with auto-scheduling for high priority
- **Features**: Auto-assigns to work blocks if high priority

#### `updateTask`
- **Purpose**: Modify existing tasks
- **Parameters**: `taskId`, `updates` (any task field)
- **Returns**: Updated task
- **Triggers**: Re-scheduling if priority changes

#### `completeTask`
- **Purpose**: Mark tasks as done
- **Parameters**: `taskId`
- **Returns**: Completed task with stats
- **Side Effects**: Updates block utilization

#### `viewTasks`
- **Purpose**: List and search tasks with scoring
- **Parameters**: `filter?`, `sort?`, `includeCompleted?`
- **Returns**: Scored task list with insights
- **Intelligence**: Multi-factor scoring (priority, urgency, age)

### Email Tools (3)

#### `viewEmails`
- **Purpose**: List emails with smart filtering
- **Parameters**: `status?`, `urgency?`, `limit?`
- **Returns**: Email list with importance indicators
- **Features**: Backlog aging, urgency detection

#### `readEmail`
- **Purpose**: Full email content with analysis
- **Parameters**: `emailId`
- **Returns**: Email body, attachments, extracted action items
- **AI**: Automatic action item extraction

#### `processEmail`
- **Purpose**: Multi-action email handler
- **Parameters**: `emailId`, `action` (draft|send|convert_to_task|archive)
- **Returns**: Action result (draft, task, confirmation)
- **Intelligence**: AI-powered response generation

### Calendar Tools (2)

#### `scheduleMeeting`
- **Purpose**: Smart meeting scheduling
- **Parameters**: `title`, `attendees`, `duration`, `preferredTimes?`
- **Returns**: Scheduled meeting with optional prep block
- **Features**: Conflict detection, prep time automation

#### `rescheduleMeeting`
- **Purpose**: Move meetings with conflict resolution
- **Parameters**: `eventId`, `newTime`, `notifyAttendees?`
- **Returns**: Updated meeting or conflict options
- **Intelligence**: Suggests alternative times on conflicts

### Preference Tool (1)

#### `updatePreferences`
- **Purpose**: Modify user preferences
- **Parameters**: `key`, `value`
- **Returns**: Updated preference with confirmation
- **Affects**: All scheduling and workflow decisions

### Workflow Tools (4)

#### `optimizeSchedule`
- **Purpose**: Run adaptive scheduling workflow
- **Type**: LangGraph workflow wrapper
- **Returns**: Proposed schedule changes for confirmation

#### `triageEmails`
- **Purpose**: Run email management workflow
- **Type**: LangGraph workflow wrapper
- **Returns**: Prioritized email actions

#### `prioritizeTasks`
- **Purpose**: Run task intelligence workflow
- **Type**: LangGraph workflow wrapper
- **Returns**: Optimized task order and assignments

#### `optimizeCalendar`
- **Purpose**: Run calendar optimization workflow
- **Type**: LangGraph workflow wrapper
- **Returns**: Meeting consolidation suggestions

### System Tools (6)

#### `confirmProposal`
- **Purpose**: Execute stored workflow proposals
- **Parameters**: `proposalId`
- **Returns**: Execution result
- **Safety**: Proposals expire after 5 minutes

#### `showWorkflowHistory`
- **Purpose**: Display past workflow executions
- **Parameters**: `type?`, `limit?`
- **Returns**: Workflow history with outcomes
- **Use Case**: Debugging, pattern analysis

#### `resumeWorkflow`
- **Purpose**: Continue interrupted workflows
- **Parameters**: `workflowId`
- **Returns**: Resumed workflow result
- **Feature**: State persistence up to 24 hours

#### `provideFeedback`
- **Purpose**: Capture user feedback for learning
- **Parameters**: `type`, `feedback`, `context?`
- **Returns**: Confirmation
- **Impact**: Improves future decisions

#### `showPatterns`
- **Purpose**: Display learned user patterns
- **Parameters**: `category?`
- **Returns**: Insights and patterns
- **Intelligence**: Shows personalization in action

#### `clearContext`
- **Purpose**: Reset conversation state
- **Parameters**: `scope?` (conversation|all)
- **Returns**: Confirmation
- **Use Case**: Fresh start, privacy

## 3. Workflow Architecture

Workflows use LangGraph for complex multi-step operations with state management.

### Adaptive Scheduling Workflow

**Purpose**: Intelligently plan or reorganize daily schedules

**Nodes**:
1. **fetchScheduleData** 
   - Parallel fetch: schedule, tasks, emails, preferences
   - Generates initial insights
   
2. **analyzeScheduleState**
   - Gap detection
   - Inefficiency identification
   - Workload analysis
   
3. **determineStrategy**
   - `full`: Empty schedule → complete day planning
   - `optimize`: Busy schedule → reorganization
   - `partial`: Some gaps → targeted filling
   - `minimal`: Nearly full → minor adjustments
   
4. **executeStrategy**
   - Creates proposed changes
   - Assigns tasks to blocks
   - Schedules email time
   - Protects breaks
   
5. **validateChanges**
   - Conflict checking
   - Preference validation
   - Change summary generation

**State Shape**:
```typescript
interface SchedulingState {
  userId: string;
  date: string;
  currentSchedule: TimeBlock[];
  tasks: TaskWithScore[];
  emails: EmailWithUrgency[];
  preferences: UserPreferences;
  analysis: ScheduleAnalysis;
  strategy: SchedulingStrategy;
  proposedChanges: ScheduleChange[];
  validationResult: ValidationResult;
}
```

### Email Management Workflow

**Purpose**: Triage and process email backlog efficiently

**Nodes**:
1. **fetchEmailData**
   - Get unread/starred emails
   - Fetch user email patterns
   - Load response templates
   
2. **analyzeEmails**
   - Urgency scoring
   - Sender importance
   - Action item extraction
   - Category classification
   
3. **createBatches**
   - Group by sender
   - Group by topic
   - Group by action type
   - Optimize processing order
   
4. **generateActions**
   - Draft responses
   - Create tasks
   - Schedule follow-ups
   - Archive suggestions
   
5. **validateActions**
   - Check task capacity
   - Verify time availability
   - Generate summary

### Task Intelligence Workflow

**Purpose**: Optimize task list and execution order

**Nodes**:
1. **fetchTaskData**
   - Load all active tasks
   - Get completion history
   - Fetch current schedule
   
2. **analyzeTaskPatterns**
   - Completion velocity
   - Time-of-day performance
   - Task type preferences
   - Procrastination patterns
   
3. **scoreAndRank**
   - Multi-factor scoring
   - Deadline consideration
   - Energy alignment
   - Dependency mapping
   
4. **createExecutionPlan**
   - Optimal task order
   - Time block assignments
   - Batch similar tasks
   - Break recommendations
   
5. **validatePlan**
   - Feasibility check
   - Workload balance
   - Buffer time verification

### Calendar Optimization Workflow

**Purpose**: Optimize meeting schedule and reduce overhead

**Nodes**:
1. **fetchCalendarData**
   - Get all meetings
   - Load attendee patterns
   - Check room availability
   
2. **analyzeMeetingPatterns**
   - Back-to-back detection
   - Meeting heavy days
   - Recurring efficiency
   - Travel time needs
   
3. **identifyOptimizations**
   - Consolidation opportunities
   - Better time slots
   - Virtual alternatives
   - Elimination candidates
   
4. **generateProposals**
   - Rescheduling options
   - Combination suggestions
   - Cancellation recommendations
   - Agenda optimizations
   
5. **validateProposals**
   - Attendee availability
   - Priority preservation
   - Change impact assessment

## 4. RAG Integration

Our RAG system provides continuous learning and personalization through three layers:

### Three-Layer Context System

#### Layer 1: Immediate Context (Real-time)
- Current schedule state
- Recent tool calls
- Active conversation
- Time of day/week

#### Layer 2: Historical Patterns (Embedded)
- Past scheduling decisions
- Task completion patterns
- Email response styles
- Meeting preferences

#### Layer 3: Extracted Insights (Learned)
- "User prefers meetings after 10am"
- "Batches similar tasks on Fridays"
- "Responds to urgent emails within 2 hours"
- "Takes breaks every 90 minutes"

### Embedding Pipeline

```typescript
interface EmbeddedDecision {
  id: string;
  userId: string;
  timestamp: Date;
  decision: string;
  context: string;
  outcome: 'accepted' | 'rejected' | 'modified';
  embedding: number[]; // 1536-dimensional vector
  metadata: {
    toolsUsed: string[];
    entities: string[];
    timeOfDay: string;
    dayOfWeek: string;
  };
}
```

### Learning from Rejections

When users reject proposals, the system:
1. Embeds the rejection with reason
2. Extracts constraint pattern
3. Updates user preference model
4. Influences future decisions

Example:
- **Rejected**: "Schedule meeting at 8am"
- **Reason**: "Too early"
- **Learned**: "No meetings before 9am"
- **Applied**: Future meeting suggestions start at 9am+

### Pattern Extraction

The system identifies patterns through:
- **Frequency Analysis**: Repeated behaviors
- **Temporal Patterns**: Time-based preferences
- **Contextual Patterns**: Situation-specific behaviors
- **Outcome Analysis**: Success/failure rates

## 5. UniversalToolResponse Structure

All tools and workflows return this standardized format for consistent UI rendering:

```typescript
interface UniversalToolResponse {
  // Metadata
  metadata: {
    toolName: string;
    operation: 'create' | 'read' | 'update' | 'delete' | 'execute';
    resourceType: 'schedule' | 'task' | 'email' | 'meeting' | 'preference' | 'workflow';
    timestamp: string;
    executionTime: number;
  };
  
  // Core Data
  data: any; // Tool-specific data
  
  // UI Instructions
  display: {
    type: 'card' | 'list' | 'timeline' | 'grid' | 'form' | 'confirmation' | 'progress';
    title: string;
    description?: string;
    priority: 'high' | 'medium' | 'low';
    components: Component[]; // Rich UI components
  };
  
  // Behavior Hints
  ui: {
    notification?: {
      show: boolean;
      type: 'success' | 'info' | 'warning' | 'error';
      message: string;
      duration: number;
    };
    suggestions: string[]; // Next action suggestions
    actions: Action[]; // Buttons/quick actions
    confirmationRequired?: boolean;
    confirmationId?: string;
  };
  
  // Streaming Support
  streaming?: {
    supported: boolean;
    progress?: number;
    stage?: string;
    partialData?: any;
  };
  
  // Error Handling
  error?: {
    code: string;
    message: string;
    details?: any;
    recoverable: boolean;
    suggestedActions: string[];
  };
}
```

## 6. Component Types

Rich UI components returned in responses:

### scheduleBlock
```typescript
{
  type: 'scheduleBlock',
  data: {
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: string; // "9:00 AM"
    endTime: string;   // "10:30 AM"
    description?: string;
    tasks?: Array<{
      id: string;
      title: string;
      estimatedMinutes: number;
      completed: boolean;
    }>;
  }
}
```

### taskCard
```typescript
{
  type: 'taskCard',
  data: {
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    estimatedMinutes: number;
    status: 'backlog' | 'scheduled' | 'in_progress' | 'completed';
    description?: string;
    dueDate?: string;
    tags?: string[];
    score?: number; // 0-100
  }
}
```

### emailPreview
```typescript
{
  type: 'emailPreview',
  data: {
    id: string;
    from: string;
    fromEmail: string;
    subject: string;
    preview: string;
    receivedAt: string;
    isRead: boolean;
    hasAttachments: boolean;
    urgency?: 'urgent' | 'important' | 'normal';
  }
}
```

## 7. System Intelligence Features

### Adaptive Behaviors

1. **Time-of-Day Intelligence**
   - Morning: Complex, creative tasks
   - Afternoon: Collaborative work, meetings
   - Evening: Quick wins, administrative tasks

2. **Energy Management**
   - Tracks peak performance times
   - Suggests breaks before fatigue
   - Balances high/low energy tasks

3. **Context Switching Minimization**
   - Groups similar tasks
   - Batches email processing
   - Consolidates meeting blocks

### Personalization Engine

The system learns and adapts through:
- **Explicit Feedback**: User confirmations/rejections
- **Implicit Signals**: Task completion times, email response patterns
- **Pattern Recognition**: Recurring behaviors and preferences
- **Outcome Tracking**: Success rates of suggestions

### Continuous Improvement

1. **A/B Testing Internal Strategies**
   - Tests different scheduling algorithms
   - Measures user satisfaction
   - Automatically adopts better approaches

2. **Feedback Loop Processing**
   - Weekly pattern analysis
   - Monthly preference updates
   - Quarterly strategy evolution

3. **Cross-User Learning** (Privacy-Preserved)
   - Anonymized pattern sharing
   - Industry-specific optimizations
   - Role-based suggestions

## 8. Production Architecture

### Performance Characteristics

- **Tool Execution**: < 2 seconds (p95)
- **Workflow Completion**: < 5 seconds (p95)
- **Intent Classification**: < 300ms
- **RAG Context Retrieval**: < 500ms
- **UI Update Latency**: < 100ms

### Scalability Design

- **Stateless Tools**: Horizontal scaling
- **Workflow State**: Redis-backed persistence
- **Embeddings**: Vector DB with caching
- **Service Layer**: Connection pooling, retry logic

### Reliability Features

- **Automatic Retries**: Exponential backoff
- **Circuit Breakers**: Prevent cascade failures
- **Graceful Degradation**: Fallback to simpler operations
- **State Recovery**: Resume interrupted workflows

## Conclusion

dayli's AI system represents a sophisticated orchestration of multiple AI technologies working in harmony. By combining intelligent routing, atomic tools, complex workflows, and continuous learning through RAG, we deliver an AI executive assistant that truly understands and adapts to each user's unique working style.

The system's strength lies not in any single component, but in how these pieces work together - the orchestrator's intelligence in routing, the tools' focused efficiency, the workflows' handling of complexity, and RAG's continuous personalization create an assistant that becomes more valuable with every interaction. 