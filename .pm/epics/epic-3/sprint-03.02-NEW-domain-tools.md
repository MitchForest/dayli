# Sprint 03.02 NEW: Domain Tools & Operations

## Sprint Overview

**Sprint Number**: 03.02  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: PLANNING

### Sprint Goal
Build stateless, single-purpose domain tools that form the foundation for all intelligent workflows. These tools are the building blocks that workflows will orchestrate to create complex behaviors.

### Key Principles
- **Stateless**: Each tool performs one operation without maintaining state
- **Composable**: Tools can be combined by workflows in any order
- **Domain-Focused**: Organized by domain (email, task, schedule, calendar)
- **Workflow-Agnostic**: Tools don't know about workflows that use them

## Tool Categories

### 1. Email Operations

#### Email Triage Tools
```typescript
// Analyze email importance/urgency
analyzeSingleEmail(email) → { importance, urgency, suggestedAction }

// Batch emails by strategy
batchEmailsByStrategy(emails, strategy) → EmailBatch[]

// Calculate optimal email processing time
calculateEmailProcessingTime(emails) → { totalMinutes, breakdown }

// Extract action items from email
extractActionItems(emailContent) → ActionItem[]

// Manage email backlog
updateEmailBacklog(userId, emails) → { added, removed, aged }
getEmailBacklogSummary(userId) → { total, byUrgency, avgAge }
```

#### Email Insights Tools
```typescript
// Analyze sender patterns
analyzeSenderPatterns(userId, sender) → { frequency, importance, responseTime }

// Get email statistics
getEmailStats(userId, dateRange) → { volume, responseTime, patterns }

// Identify email clusters
findSimilarEmails(email, allEmails) → Email[]
```

### 2. Task Operations

#### Task Scoring & Prioritization
```typescript
// Score task based on multiple factors
scoreTask(task, context) → { score, factors, reasoning }

// Match tasks to available time
findTasksForTimeSlot(tasks, minutes, energy) → Task[]

// Analyze task completion patterns
analyzeTaskPatterns(userId, tasks) → { velocity, preferredTimes, blockTypes }

// Manage task backlog
updateTaskBacklog(userId, tasks) → { added, completed, aged }
getTaskBacklogHealth(userId) → { total, stale, priority }
```

#### Task Batching
```typescript
// Group similar tasks
batchSimilarTasks(tasks) → TaskBatch[]

// Estimate task duration
estimateTaskDuration(task, historicalData) → minutes

// Find task dependencies
findTaskDependencies(task, allTasks) → Task[]
```

### 3. Calendar Operations

#### Conflict Detection
```typescript
// Find calendar conflicts
detectConflicts(events, timeRange) → Conflict[]

// Suggest conflict resolutions
suggestConflictResolution(conflict) → Resolution[]

// Check if time is available
isTimeSlotAvailable(start, end, calendar) → boolean
```

#### Meeting Optimization
```typescript
// Find optimal meeting time
findOptimalMeetingTime(attendees, duration, preferences) → TimeSlot[]

// Analyze meeting patterns
analyzeMeetingPatterns(userId) → { backToBack, avgDuration, heavyDays }

// Suggest meeting consolidation
suggestMeetingConsolidation(meetings) → Consolidation[]

// Calendar protection tool (ready for Google Calendar API)
protectCalendarTime(block, userId) → { 
  // TODO: Uncomment when Google Calendar API is integrated
  // const event = await googleCalendar.createEvent({
  //   summary: `Protected: ${block.title}`,
  //   start: block.startTime,
  //   end: block.endTime,
  //   busy: true,
  //   reminders: { useDefault: false }
  // });
  // return { protected: true, eventId: event.id };
  
  // For now, just log and return mock
  console.log('[CALENDAR PROTECTION] Would protect:', block);
  return { protected: true, eventId: `mock_${Date.now()}` };
}
```

### 4. Schedule Operations

#### Time Analysis
```typescript
// Find gaps in schedule
findScheduleGaps(blocks, workingHours) → Gap[]

// Detect inefficiencies
detectScheduleInefficiencies(blocks) → Inefficiency[]

// Calculate focus time
calculateFocusTime(blocks) → { total, continuous, fragmented }

// Find best slot for activity
findBestTimeSlot(activity, schedule, preferences) → TimeSlot
```

#### Schedule Optimization
```typescript
// Balance workload across day
balanceScheduleLoad(blocks) → BalancedSchedule

// Consolidate fragmented time
consolidateFragmentedTime(blocks) → ConsolidatedBlocks[]

// Protect break times
ensureBreaksProtected(blocks, preferences) → Block[]
```

## Helper Utilities

### Time Parsing & Formatting
```typescript
// apps/web/modules/ai/utils/timeHelpers.ts

// Parse natural language time
export function parseNaturalTime(input: string): Date {
  const now = new Date();
  const lower = input.toLowerCase().trim();
  
  // Handle relative times
  if (lower === 'now') return now;
  if (lower === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  // Handle specific times
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let [_, hours, minutes = '0', ampm] = timeMatch;
    let hour = parseInt(hours);
    
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    const result = new Date(now);
    result.setHours(hour, parseInt(minutes), 0, 0);
    return result;
  }
  
  // Handle "in X minutes/hours"
  const durationMatch = lower.match(/in\s+(\d+)\s+(minute|hour|day)s?/);
  if (durationMatch) {
    const [_, amount, unit] = durationMatch;
    const result = new Date(now);
    const num = parseInt(amount);
    
    switch (unit) {
      case 'minute': result.setMinutes(result.getMinutes() + num); break;
      case 'hour': result.setHours(result.getHours() + num); break;
      case 'day': result.setDate(result.getDate() + num); break;
    }
    return result;
  }
  
  throw new Error(`Cannot parse time: ${input}`);
}

// Format time range
export function formatTimeRange(start: Date, end: Date): string {
  const startStr = format(start, 'h:mm a');
  const endStr = format(end, 'h:mm a');
  return `${startStr} - ${endStr}`;
}

// Calculate duration in minutes
export function calculateDuration(start: Date | string, end: Date | string): number {
  const startTime = typeof start === 'string' ? parseTime(start) : start;
  const endTime = typeof end === 'string' ? parseTime(end) : end;
  return differenceInMinutes(endTime, startTime);
}
```

### Workflow Persistence

```typescript
// apps/web/modules/workflows/services/workflowPersistence.ts

interface WorkflowState {
  id: string;
  userId: string;
  type: string;
  state: Record<string, any>;
  currentNode: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class WorkflowPersistenceService {
  async saveWorkflowState(workflowId: string, state: Partial<WorkflowState>): Promise<void> {
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
    
    const workflow = this.getWorkflowByType(saved.type);
    return workflow.resume(saved.state, saved.currentNode);
  }
  
  // Cleanup expired workflows
  async cleanupExpiredWorkflows(): Promise<number> {
    const { data } = await db.from('workflow_states')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');
    
    return data?.length || 0;
  }
}

// Run cleanup every minute
setInterval(async () => {
  const service = new WorkflowPersistenceService();
  const cleaned = await service.cleanupExpiredWorkflows();
  if (cleaned > 0) {
    console.log(`[WORKFLOW CLEANUP] Removed ${cleaned} expired workflows`);
  }
}, 60 * 1000);
```

### Confirmation Flow & Proposal Storage

```typescript
// apps/web/modules/ai/utils/proposalStore.ts

interface StoredProposal {
  changes: any[];
  timestamp: Date;
  userId: string;
  type: string;
}

class ProposalStore {
  private store = new Map<string, StoredProposal>();
  private readonly MAX_SIZE = 100;
  private readonly TTL_MINUTES = 5;
  
  constructor() {
    // Cleanup expired proposals every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }
  
  store(confirmationId: string, proposal: Omit<StoredProposal, 'timestamp'>): void {
    // Enforce max size
    if (this.store.size >= this.MAX_SIZE) {
      const oldest = Array.from(this.store.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      this.store.delete(oldest[0]);
      console.log(`[PROPOSAL STORE] Evicted oldest proposal: ${oldest[0]}`);
    }
    
    this.store.set(confirmationId, {
      ...proposal,
      timestamp: new Date(),
    });
  }
  
  retrieve(confirmationId: string): StoredProposal | null {
    const proposal = this.store.get(confirmationId);
    if (!proposal) return null;
    
    // Check if expired
    const age = Date.now() - proposal.timestamp.getTime();
    if (age > this.TTL_MINUTES * 60 * 1000) {
      this.store.delete(confirmationId);
      console.log(`[PROPOSAL STORE] Proposal expired: ${confirmationId}`);
      return null;
    }
    
    return proposal;
  }
  
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [id, proposal] of this.store.entries()) {
      const age = now - proposal.timestamp.getTime();
      if (age > this.TTL_MINUTES * 60 * 1000) {
        expired.push(id);
      }
    }
    
    expired.forEach(id => {
      this.store.delete(id);
      console.log(`[PROPOSAL STORE] Cleaned up expired proposal: ${id}`);
    });
  }
}

export const proposalStore = new ProposalStore();

// Confirmation tool
export const confirmProposal = tool({
  description: "Confirm and execute a proposed change",
  parameters: z.object({
    confirmationId: z.string(),
    confirmed: z.boolean().default(true),
  }),
  execute: async ({ confirmationId, confirmed }) => {
    if (!confirmed) {
      return toolSuccess({ message: "Proposal cancelled" });
    }
    
    const proposal = proposalStore.retrieve(confirmationId);
    if (!proposal) {
      return toolError('PROPOSAL_EXPIRED', 'This proposal has expired. Please try again.');
    }
    
    try {
      // Execute the changes
      const results = await executeProposedChanges(proposal.changes);
      return toolSuccess({
        executed: results.length,
        message: `Successfully applied ${results.length} changes`,
      });
    } catch (error) {
      return toolError('EXECUTION_FAILED', `Failed to apply changes: ${error.message}`);
    }
  },
});
```

### Error Recovery Patterns

```typescript
// apps/web/modules/ai/utils/errorRecovery.ts

export enum ErrorCategory {
  RECOVERABLE = 'recoverable',
  NON_RECOVERABLE = 'non_recoverable',
  PARTIAL = 'partial'
}

export interface RecoverableError extends Error {
  category: ErrorCategory;
  retryable: boolean;
  partialResult?: any;
}

export async function executeWithRecovery<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    onError?: (error: Error, attempt: number) => void;
    allowPartial?: boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 1, onError, allowPartial = false } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      onError?.(lastError, attempt);
      
      // Categorize error
      const category = categorizeError(lastError);
      
      if (category === ErrorCategory.NON_RECOVERABLE) {
        throw lastError;
      }
      
      if (category === ErrorCategory.PARTIAL && allowPartial) {
        return (lastError as RecoverableError).partialResult;
      }
      
      // Only retry if recoverable and attempts remain
      if (category === ErrorCategory.RECOVERABLE && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError;
}

function categorizeError(error: Error): ErrorCategory {
  // Network errors are recoverable
  if (error.message.includes('network') || error.message.includes('timeout')) {
    return ErrorCategory.RECOVERABLE;
  }
  
  // Permission errors are non-recoverable
  if (error.message.includes('permission') || error.message.includes('unauthorized')) {
    return ErrorCategory.NON_RECOVERABLE;
  }
  
  // Partial success errors
  if ('partialResult' in error) {
    return ErrorCategory.PARTIAL;
  }
  
  return ErrorCategory.NON_RECOVERABLE;
}

// Use in tools
export async function executeChangesWithRecovery(changes: any[]): Promise<{
  successful: any[];
  failed: any[];
}> {
  const successful: any[] = [];
  const failed: any[] = [];
  
  for (const change of changes) {
    try {
      const result = await executeWithRecovery(
        () => applyChange(change),
        { maxRetries: 1, allowPartial: true }
      );
      successful.push({ change, result });
    } catch (error) {
      failed.push({ change, error: error.message });
      console.error(`[CHANGE EXECUTION] Failed to apply change:`, change, error);
    }
  }
  
  return { successful, failed };
}
```

## Integration with Chat UI

### Tool Registration
All domain tools are automatically discovered and registered:

```typescript
// apps/web/modules/ai/tools/registry.ts
export class ToolRegistry {
  async autoRegister() {
    // Discovers all tools from subdirectories
    const modules = import.meta.glob('./*/index.ts');
    
    for (const [path, loader] of Object.entries(modules)) {
      const module = await loader() as any;
      const category = path.split('/')[1];
      
      Object.entries(module).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`${category}.${name}`, tool as CoreTool<any, any>);
        }
      });
    }
  }
}
```

### Progress Streaming
Multi-step operations stream progress to the UI:

```typescript
// In chat route
const result = await streamText({
  model: openai('gpt-4-turbo'),
  messages,
  tools: toolRegistry.getAll(),
  maxSteps: 5,
  onStepFinish: async ({ toolCalls, toolResults }) => {
    // Stream progress update
    console.log('[AI] Tool step completed:', {
      tools: toolCalls.map(tc => tc.toolName),
      results: toolResults.map(tr => ({ 
        success: tr.result?.success,
        error: tr.result?.error 
      }))
    });
  },
});
```

## Database Migrations

```sql
-- Workflow persistence table
CREATE TABLE IF NOT EXISTS public.workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
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

-- Email backlog table
CREATE TABLE IF NOT EXISTS public.email_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT NOT NULL,
  subject TEXT,
  from_email TEXT,
  snippet TEXT,
  urgency TEXT CHECK (urgency IN ('urgent', 'can_wait', 'no_response')),
  importance TEXT CHECK (importance IN ('important', 'not_important', 'archive')),
  days_in_backlog INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, email_id),
  INDEX idx_email_backlog_user_urgency (user_id, urgency)
);

-- Task backlog view
CREATE OR REPLACE VIEW task_backlog AS
SELECT 
  t.*,
  EXTRACT(DAY FROM NOW() - t.created_at) as days_in_backlog,
  CASE 
    WHEN t.priority = 'high' THEN 100
    WHEN t.priority = 'medium' THEN 50
    ELSE 25
  END + LEAST(EXTRACT(DAY FROM NOW() - t.created_at) * 5, 20) as urgency_score
FROM tasks t
WHERE t.status = 'backlog'
ORDER BY urgency_score DESC;
```

## Testing Patterns

### Test Domain Tools
```typescript
describe('Email Operations', () => {
  it('should analyze email importance correctly', async () => {
    const result = await analyzeSingleEmail({
      from: 'ceo@company.com',
      subject: 'Urgent: Board Meeting Tomorrow',
      content: 'Please prepare the Q4 report...'
    });
    
    expect(result.importance).toBe('important');
    expect(result.urgency).toBe('urgent');
  });
  
  it('should batch emails by strategy', async () => {
    const emails = [/* test emails */];
    const batches = await batchEmailsByStrategy(emails, 'importance_urgency');
    
    expect(batches).toHaveLength(4); // 4 quadrants
    expect(batches[0].type).toBe('important_urgent');
  });
});
```

### Test Error Recovery
```typescript
it('should retry recoverable errors', async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    if (attempts < 2) throw new Error('network timeout');
    return 'success';
  };
  
  const result = await executeWithRecovery(operation, { maxRetries: 2 });
  expect(result).toBe('success');
  expect(attempts).toBe(2);
});
```

## Success Criteria

- [ ] All domain tools are stateless and single-purpose
- [ ] Email backlog management fully implemented
- [ ] Task backlog with scoring and aging
- [ ] Calendar protection tool ready (commented for now)
- [ ] Workflow persistence with automatic cleanup
- [ ] Confirmation flow with proposal storage
- [ ] Error recovery patterns implemented
- [ ] Helper utilities for time parsing
- [ ] Integration with chat UI documented
- [ ] Progress streaming for multi-step operations
- [ ] All tools return standardized ToolResult format
- [ ] Database migrations for backlogs and persistence 