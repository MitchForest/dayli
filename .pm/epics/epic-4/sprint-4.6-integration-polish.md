# Sprint 4.6: Integration & Polish

**Sprint Goal**: Comprehensive testing, codebase audit, and production readiness  
**Duration**: 3 days  
**Status**: PLANNING

## Objectives

1. Write comprehensive E2E/integration tests for ALL 25 tools
2. Write comprehensive tests for ALL 4 workflows
3. Test all AI and RAG components thoroughly
4. Audit entire codebase for cleanup opportunities
5. Create refactoring plan (with approval before execution)
6. Fix all discovered issues
7. Ensure zero technical debt for MVP launch

## Day 1: Comprehensive Tool Testing

### Morning: Test Infrastructure Setup

```typescript
// apps/web/tests/tools/setup.ts
import { ServiceFactory } from '@/services/factory/service.factory';
import { createClient } from '@supabase/supabase-js';
import { toolRegistry } from '@/modules/ai/tools/registry';

export async function setupTestEnvironment() {
  // Create test database client
  const supabase = createClient(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_ANON_KEY!
  );
  
  // Configure ServiceFactory
  ServiceFactory.getInstance().configure({
    userId: 'test-user-id',
    supabaseClient: supabase
  });
  
  // Register all tools
  await toolRegistry.autoRegister();
  
  // Seed test data
  await seedTestData(supabase);
  
  return { supabase, toolRegistry };
}
```

### Tool Testing Requirements

Each tool must have:
1. **Happy path test** - Normal successful execution
2. **Error handling test** - Verify proper error responses
3. **Edge case test** - Boundary conditions
4. **Integration test** - With real services
5. **AI response test** - Verify UniversalToolResponse format

### Schedule Tools (5 tests each = 25 total)

```typescript
// apps/web/tests/tools/schedule/viewSchedule.test.ts
describe('viewSchedule Tool', () => {
  it('should return schedule for today when no date provided', async () => {
    const result = await viewSchedule.execute({});
    expect(result.metadata.toolName).toBe('viewSchedule');
    expect(result.data).toHaveProperty('blocks');
    expect(result.display.type).toBe('schedule');
  });
  
  it('should handle invalid date format', async () => {
    const result = await viewSchedule.execute({ date: 'invalid' });
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('INVALID_DATE');
  });
  
  it('should return empty schedule for future date', async () => {
    const result = await viewSchedule.execute({ date: '2025-12-31' });
    expect(result.data.blocks).toHaveLength(0);
    expect(result.ui.suggestions).toContain('Create a time block');
  });
  
  it('should include task details in work blocks', async () => {
    // Seed work block with tasks
    await seedWorkBlockWithTasks();
    const result = await viewSchedule.execute({});
    const workBlock = result.data.blocks.find(b => b.type === 'work');
    expect(workBlock.tasks).toBeDefined();
    expect(workBlock.tasks.length).toBeGreaterThan(0);
  });
  
  it('should calculate correct statistics', async () => {
    await seedMixedSchedule();
    const result = await viewSchedule.execute({});
    expect(result.data.stats.totalHours).toBeCloseTo(8, 1);
    expect(result.data.stats.focusHours).toBeGreaterThan(0);
  });
});
```

### Task Tools (5 tests each = 20 total)

```typescript
// apps/web/tests/tools/task/createTask.test.ts
describe('createTask Tool', () => {
  it('should create task with default values', async () => {
    const result = await createTask.execute({ title: 'Test Task' });
    expect(result.data.title).toBe('Test Task');
    expect(result.data.estimatedMinutes).toBe(30);
    expect(result.data.priority).toBe('medium');
  });
  
  it('should auto-schedule high priority tasks', async () => {
    // Create work block first
    await createWorkBlock();
    const result = await createTask.execute({ 
      title: 'Urgent Task',
      priority: 'high' 
    });
    expect(result.data.assignedToBlockId).toBeDefined();
    expect(result.ui.notification.message).toContain('scheduled');
  });
  
  it('should handle database errors gracefully', async () => {
    // Mock database failure
    jest.spyOn(taskService, 'createTask').mockRejectedValueOnce(
      new Error('Database connection failed')
    );
    const result = await createTask.execute({ title: 'Test' });
    expect(result.error.recoverable).toBe(true);
    expect(result.error.suggestedActions).toContain('Retry the operation');
  });
  
  it('should validate required fields', async () => {
    const result = await createTask.execute({ title: '' });
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
  
  it('should include proper UI suggestions', async () => {
    const result = await createTask.execute({ title: 'Test Task' });
    expect(result.ui.suggestions).toContain('Create another task');
    expect(result.ui.actions).toHaveLength(2);
  });
});
```

### Email Tools (5 tests each = 15 total)

```typescript
// apps/web/tests/tools/email/processEmail.test.ts
describe('processEmail Tool', () => {
  it('should convert email to task', async () => {
    const emailId = await seedTestEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'convert_to_task'
    });
    expect(result.data.task).toBeDefined();
    expect(result.data.emailArchived).toBe(true);
  });
  
  it('should draft email response', async () => {
    const emailId = await seedTestEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'draft_response',
      responsePoints: ['Will review', 'Send update Friday']
    });
    expect(result.data.draft).toBeDefined();
    expect(result.data.draft.body).toContain('review');
  });
  
  it('should handle missing email gracefully', async () => {
    const result = await processEmail.execute({
      emailId: 'non-existent',
      action: 'convert_to_task'
    });
    expect(result.error.code).toBe('EMAIL_NOT_FOUND');
  });
  
  it('should send email immediately when requested', async () => {
    const emailId = await seedTestEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'send_response',
      responsePoints: ['Acknowledged'],
      sendImmediately: true
    });
    expect(result.data.sent).toBe(true);
  });
  
  it('should extract action items correctly', async () => {
    const emailId = await seedActionEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'convert_to_task'
    });
    expect(result.data.task.title).toContain('Review Q4 report');
  });
});
```

### Calendar Tools (5 tests each = 10 total)
### Preference Tool (5 tests)
### Workflow Tools (5 tests each = 20 total)
### System Tools (5 tests each = 30 total)

**Total: 125 comprehensive tool tests**

## Day 2: Workflow & AI/RAG Testing

### Morning: Workflow Testing

Each workflow needs comprehensive testing:

```typescript
// apps/web/tests/workflows/adaptiveScheduling.test.ts
describe('Adaptive Scheduling Workflow', () => {
  beforeEach(async () => {
    await clearTestData();
    await seedRealisticSchedule();
  });
  
  it('should complete full workflow successfully', async () => {
    const result = await optimizeSchedule.execute({
      date: '2024-01-15',
      strategy: 'full'
    });
    
    // Verify all workflow stages
    expect(result.data.stages).toEqual([
      'fetchScheduleData',
      'analyzeScheduleState', 
      'determineStrategy',
      'executeStrategy',
      'validateChanges'
    ]);
    
    // Verify proposed changes
    expect(result.data.proposedChanges).toHaveLength(5);
    expect(result.metadata.confirmationRequired).toBe(true);
  });
  
  it('should handle empty schedule', async () => {
    await clearSchedule();
    const result = await optimizeSchedule.execute({});
    expect(result.data.strategy).toBe('full');
    expect(result.data.proposedChanges).toContainEqual(
      expect.objectContaining({ type: 'add', title: 'Morning Deep Work' })
    );
  });
  
  it('should respect user preferences', async () => {
    await updatePreferences({ 
      workStartTime: '10:00',
      lunchTime: '13:00'
    });
    const result = await optimizeSchedule.execute({});
    const firstBlock = result.data.proposedChanges[0];
    expect(firstBlock.startTime).toBe('10:00 AM');
  });
  
  it('should handle workflow interruption and resume', async () => {
    // Simulate interruption
    const workflow = createAdaptiveSchedulingWorkflow();
    const interruptedState = await simulateInterruption(workflow);
    
    // Resume
    const resumed = await resumeWorkflow.execute({
      workflowId: interruptedState.id
    });
    expect(resumed.data.completed).toBe(true);
  });
  
  it('should stream progress updates', async () => {
    const updates: any[] = [];
    const result = await optimizeSchedule.execute(
      { streamProgress: true },
      { onProgress: (update) => updates.push(update) }
    );
    
    expect(updates).toContainEqual(
      expect.objectContaining({ stage: 'fetchScheduleData' })
    );
    expect(updates.length).toBeGreaterThan(3);
  });
});
```

### Afternoon: AI & RAG Component Testing

```typescript
// apps/web/tests/ai/orchestration.test.ts
describe('AI Orchestration Layer', () => {
  it('should correctly classify schedule intent', async () => {
    const intent = await orchestrator.classifyIntent(
      'Move my 2pm meeting to 4pm'
    );
    expect(intent.category).toBe('tool');
    expect(intent.suggestedHandler.name).toBe('moveTimeBlock');
  });
  
  it('should route to workflow for complex requests', async () => {
    const intent = await orchestrator.classifyIntent(
      'Organize my entire day including emails and tasks'
    );
    expect(intent.category).toBe('workflow');
    expect(intent.suggestedHandler.name).toBe('optimizeSchedule');
  });
  
  it('should handle ambiguous requests', async () => {
    const intent = await orchestrator.classifyIntent(
      'I need help with my schedule'
    );
    expect(intent.confidence).toBeLessThan(0.8);
    expect(intent.suggestedHandler.type).toBe('direct');
  });
});

// apps/web/tests/ai/rag.test.ts
describe('RAG Context Provider', () => {
  it('should retrieve relevant past decisions', async () => {
    // Seed embeddings
    await seedDecisionHistory();
    
    const context = await ragProvider.getRelevantContext(
      'Schedule a meeting with Sarah',
      'test-user-id'
    );
    
    expect(context.pastDecisions).toContainEqual(
      expect.objectContaining({ 
        decision: 'Scheduled Sarah meetings at 2pm' 
      })
    );
  });
  
  it('should learn from rejections', async () => {
    // Simulate rejection
    await ragProvider.embedRejection({
      proposedAction: 'Schedule meeting at 9am',
      reason: 'Too early for meetings',
      userId: 'test-user-id'
    });
    
    // Verify learning
    const context = await ragProvider.getRelevantContext(
      'Schedule morning meeting',
      'test-user-id'
    );
    expect(context.constraints).toContain('User prefers no meetings before 10am');
  });
  
  it('should extract patterns correctly', async () => {
    await seedUserHistory();
    const patterns = await ragProvider.extractPatterns('test-user-id');
    
    expect(patterns).toContainEqual(
      expect.objectContaining({
        type: 'scheduling',
        pattern: 'Prefers back-to-back meetings on Tuesdays'
      })
    );
  });
});
```

### AI Chat Integration Testing

```typescript
// apps/web/tests/integration/chat.test.ts
describe('AI Chat Integration', () => {
  it('should handle multi-step tool execution', async () => {
    const response = await sendChatMessage(
      'Create a task "Review docs" and schedule it for this afternoon'
    );
    
    // Verify both tools were called
    expect(response.toolCalls).toHaveLength(2);
    expect(response.toolCalls[0].toolName).toBe('createTask');
    expect(response.toolCalls[1].toolName).toBe('fillWorkBlock');
  });
  
  it('should display rich UI components', async () => {
    const response = await sendChatMessage('Show my schedule');
    const display = response.structuredData.responses[0].display;
    
    expect(display.type).toBe('schedule');
    expect(display.components).toHaveLength(
      expect.arrayContaining([
        expect.objectContaining({ type: 'scheduleBlock' })
      ])
    );
  });
  
  it('should handle errors gracefully', async () => {
    // Simulate service failure
    mockServiceFailure('scheduleService');
    
    const response = await sendChatMessage('Show my schedule');
    expect(response.structuredData.responses[0].error).toBeDefined();
    expect(response.content).toContain('having trouble accessing your schedule');
  });
});
```

## Day 3: Codebase Audit & Cleanup Plan

### Morning: Comprehensive Codebase Audit

The executor must perform a thorough audit and document findings:

```markdown
# Codebase Audit Report

## 1. Deprecated/Orphaned Files
- [ ] Identify all unused imports
- [ ] Find components not referenced anywhere
- [ ] Locate old migration files
- [ ] Find duplicate type definitions
- [ ] Identify dead code paths

## 2. Architecture Issues
- [ ] Circular dependencies
- [ ] Inconsistent naming patterns
- [ ] Mixed concerns (UI logic in services)
- [ ] Missing abstractions
- [ ] Over-engineering

## 3. Performance Opportunities
- [ ] Unnecessary re-renders
- [ ] Missing memoization
- [ ] Inefficient queries
- [ ] Bundle size optimization
- [ ] Lazy loading opportunities

## 4. Type Safety Gaps
- [ ] Any 'any' types remaining
- [ ] Missing type definitions
- [ ] Unsafe type assertions
- [ ] Incomplete interfaces

## 5. Code Duplication
- [ ] Similar functions across files
- [ ] Repeated patterns
- [ ] Copy-pasted code blocks
```

### Afternoon: Refactoring Plan (Requires Approval)

Based on audit findings, create detailed refactoring plan:

```markdown
# Refactoring Plan - REQUIRES APPROVAL

## Priority 1: Critical Issues
1. **Remove circular dependency between X and Y**
   - Impact: High
   - Effort: 2 hours
   - Solution: Extract shared types to separate file

2. **Delete orphaned files (list all)**
   - `/old-components/*` (15 files)
   - `/utils/deprecated.ts`
   - Impact: Reduces bundle by ~50KB

## Priority 2: Architecture Improvements
1. **Consolidate duplicate auth logic**
   - Current: Auth checks in 5 different places
   - Proposed: Single auth hook
   - Files affected: [list]

2. **Extract business logic from UI components**
   - Components with logic: [list]
   - Proposed service structure: [diagram]

## Priority 3: Performance
1. **Implement React.memo for heavy components**
   - Components: ScheduleView, TaskList
   - Expected improvement: 30% fewer re-renders

2. **Add lazy loading for routes**
   - Current: All routes loaded upfront
   - Proposed: Lazy load settings, analytics

## Rollback Plan
- Each refactor in separate commit
- Test suite must pass after each change
- Performance benchmarks before/after
```

### Testing the Refactored Code

After approval and implementation:

```typescript
// apps/web/tests/refactoring/validation.test.ts
describe('Post-Refactoring Validation', () => {
  it('should maintain all functionality after refactor', async () => {
    // Run entire test suite
    const results = await runAllTests();
    expect(results.failed).toBe(0);
    expect(results.passed).toBeGreaterThan(200);
  });
  
  it('should improve performance metrics', async () => {
    const before = await loadPerformanceBaseline();
    const after = await measureCurrentPerformance();
    
    expect(after.bundleSize).toBeLessThan(before.bundleSize);
    expect(after.renderTime).toBeLessThan(before.renderTime);
  });
  
  it('should have zero type errors', async () => {
    const typeCheck = await runTypeCheck();
    expect(typeCheck.errors).toHaveLength(0);
  });
});
```

## Success Criteria

### Testing Coverage
- [ ] 100% of tools have 5+ tests each (125 total)
- [ ] 100% of workflows have comprehensive tests
- [ ] AI orchestration fully tested
- [ ] RAG components fully tested
- [ ] Integration tests cover all user journeys
- [ ] Zero failing tests

### Code Quality
- [ ] Zero TypeScript errors
- [ ] Zero lint warnings
- [ ] No 'any' types
- [ ] All functions properly typed
- [ ] Consistent naming throughout

### Performance
- [ ] All tools execute < 2 seconds
- [ ] Workflows complete < 5 seconds
- [ ] Bundle size < 500KB
- [ ] First paint < 1 second
- [ ] No memory leaks

### Architecture
- [ ] No circular dependencies
- [ ] Clear separation of concerns
- [ ] All business logic in services
- [ ] UI components are pure
- [ ] Proper error boundaries

### Documentation
- [ ] Every tool documented
- [ ] Every workflow documented
- [ ] Architecture diagram updated
- [ ] Deployment guide complete
- [ ] API documentation current

## Deliverables

1. **Test Suite**
   - 125+ tool tests
   - 20+ workflow tests
   - 50+ integration tests
   - Performance benchmarks

2. **Audit Report**
   - Complete findings document
   - Prioritized issues list
   - Impact assessment

3. **Refactoring Plan**
   - Detailed proposal
   - Time estimates
   - Risk assessment
   - Requires approval before execution

4. **Clean Codebase**
   - Zero technical debt
   - No deprecated code
   - Optimized bundles
   - Production ready

## MVP Launch Readiness

After this sprint, the application is:
- ✅ Fully tested
- ✅ Performance optimized
- ✅ Zero technical debt
- ✅ Production ready
- ✅ No feature flags needed
- ✅ Ready for immediate full rollout

**Note**: No refactoring or cleanup actions should be taken without explicit approval of the plan. The executor must present findings and get sign-off before making changes. 