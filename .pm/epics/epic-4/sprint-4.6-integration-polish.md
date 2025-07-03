# Sprint 4.6: Integration & Polish

**Sprint Goal**: Comprehensive testing, codebase audit, and production readiness  
**Duration**: 3 days  
**Status**: PLANNING

## Objectives

1. Write comprehensive E2E/integration tests for ALL 25 tools
2. Write comprehensive tests for ALL 4 workflows
3. Test all AI and RAG components thoroughly
4. Test all display components from Sprint 4.5
5. Audit entire codebase for cleanup opportunities
6. Create refactoring plan (with approval before execution)
7. Fix all discovered issues
8. Ensure zero technical debt for MVP launch

## Day 1: Comprehensive Tool Testing

### Morning: Test Infrastructure Setup

```typescript
// apps/web/tests/tools/setup.ts
import { ServiceFactory } from '@/services/factory/service.factory';
import { createClient } from '@supabase/supabase-js';
import { ToolRegistry } from '@/modules/ai/tools/base/tool-registry';

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
  
  // Get tool registry instance
  const toolRegistry = ToolRegistry.getInstance();
  
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
5. **Pure data test** - Verify response matches type definition

### Schedule Tools (5 tests each = 25 total)

```typescript
// apps/web/tests/tools/schedule/viewSchedule.test.ts
describe('viewSchedule Tool', () => {
  it('should return schedule for today when no date provided', async () => {
    const result = await viewSchedule.execute({});
    expect(result.success).toBe(true);
    expect(result.date).toBeDefined();
    expect(result.blocks).toBeArray();
    expect(result.stats).toHaveProperty('totalHours');
    expect(result.stats).toHaveProperty('utilization');
  });
  
  it('should handle invalid date format', async () => {
    const result = await viewSchedule.execute({ date: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid date format');
  });
  
  it('should return empty schedule for future date', async () => {
    const result = await viewSchedule.execute({ date: '2025-12-31' });
    expect(result.success).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.stats.totalHours).toBe(0);
  });
  
  it('should include task details in work blocks', async () => {
    // Seed work block with tasks
    await seedWorkBlockWithTasks();
    const result = await viewSchedule.execute({});
    const workBlock = result.blocks.find(b => b.type === 'work');
    expect(workBlock?.tasks).toBeDefined();
    expect(workBlock?.tasks?.length).toBeGreaterThan(0);
  });
  
  it('should match ScheduleViewResponse type', async () => {
    const result = await viewSchedule.execute({});
    // Verify structure matches type definition
    expect(result).toMatchObject({
      success: expect.any(Boolean),
      date: expect.any(String),
      blocks: expect.any(Array),
      stats: {
        totalHours: expect.any(Number),
        focusHours: expect.any(Number),
        meetingHours: expect.any(Number),
        utilization: expect.any(Number)
      }
    });
  });
});
```

### Task Tools (5 tests each = 20 total)

```typescript
// apps/web/tests/tools/task/createTask.test.ts
describe('createTask Tool', () => {
  it('should create task with default values', async () => {
    const result = await createTask.execute({ title: 'Test Task' });
    expect(result.success).toBe(true);
    expect(result.task.title).toBe('Test Task');
    expect(result.task.estimatedMinutes).toBe(30);
    expect(result.task.priority).toBe('medium');
  });
  
  it('should auto-schedule high priority tasks', async () => {
    // Create work block first
    await createWorkBlock();
    const result = await createTask.execute({ 
      title: 'Urgent Task',
      priority: 'high' 
    });
    expect(result.success).toBe(true);
    expect(result.task.priority).toBe('high');
    // Note: Auto-scheduling is a side effect, not part of response
  });
  
  it('should handle database errors gracefully', async () => {
    // Mock database failure
    jest.spyOn(taskService, 'createTask').mockRejectedValueOnce(
      new Error('Database connection failed')
    );
    const result = await createTask.execute({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Database connection failed');
  });
  
  it('should validate required fields', async () => {
    const result = await createTask.execute({ title: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Title is required');
  });
  
  it('should match CreateTaskResponse type', async () => {
    const result = await createTask.execute({ title: 'Test Task' });
    expect(result).toMatchObject({
      success: true,
      task: {
        id: expect.any(String),
        title: expect.any(String),
        priority: expect.any(String),
        estimatedMinutes: expect.any(Number),
        status: expect.any(String)
      }
    });
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
    expect(result.success).toBe(true);
    expect(result.emailId).toBe(emailId);
    expect(result.action).toBe('convert_to_task');
    expect(result.result.taskId).toBeDefined();
    expect(result.result.taskTitle).toBeDefined();
  });
  
  it('should draft email response', async () => {
    const emailId = await seedTestEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'draft',
      responsePoints: ['Will review', 'Send update Friday']
    });
    expect(result.success).toBe(true);
    expect(result.result.draftId).toBeDefined();
    expect(result.result.draftContent).toContain('review');
  });
  
  it('should handle missing email gracefully', async () => {
    const result = await processEmail.execute({
      emailId: 'non-existent',
      action: 'convert_to_task'
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Email not found');
  });
  
  it('should send email immediately when requested', async () => {
    const emailId = await seedTestEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'send',
      responsePoints: ['Acknowledged']
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('send');
  });
  
  it('should match ProcessEmailResponse type', async () => {
    const emailId = await seedTestEmail();
    const result = await processEmail.execute({
      emailId,
      action: 'archive'
    });
    expect(result).toMatchObject({
      success: true,
      emailId: expect.any(String),
      action: expect.any(String),
      result: expect.any(Object)
    });
  });
});
```

### Tool Factory Testing

```typescript
// apps/web/tests/tools/base/tool-factory.test.ts
describe('Tool Factory', () => {
  it('should create tools with consistent structure', () => {
    const tool = createTool({
      name: 'test_tool',
      description: 'Test',
      parameters: z.object({ test: z.string() }),
      metadata: { category: 'test', displayName: 'Test Tool' },
      execute: async () => ({ success: true })
    });
    
    expect(tool.__name).toBe('test_tool');
    expect(tool.__metadata.category).toBe('test');
    expect(tool.__metadata.displayName).toBe('Test Tool');
  });
  
  it('should handle errors consistently', async () => {
    const tool = createTool({
      name: 'error_tool',
      description: 'Error test',
      parameters: z.object({}),
      metadata: { category: 'test' },
      execute: async () => { throw new Error('Test error'); }
    });
    
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error');
    expect(result.timestamp).toBeDefined();
  });
  
  it('should support streaming tools', async () => {
    const streamingTool = createStreamingTool({
      name: 'stream_test',
      description: 'Streaming test',
      parameters: z.object({}),
      metadata: { category: 'test', supportsStreaming: true },
      stages: [
        {
          name: 'Stage 1',
          weight: 50,
          execute: async () => ({ data: 'stage1' })
        },
        {
          name: 'Stage 2',
          weight: 50,
          execute: async () => ({ data: 'stage2' })
        }
      ],
      finalizeResult: (context) => ({
        success: true,
        result: context
      })
    });
    
    expect(streamingTool.__metadata.supportsStreaming).toBe(true);
  });
});
```

### Calendar Tools (5 tests each = 10 total)
### Preference Tool (5 tests)
### Workflow Tools (5 tests each = 20 total)
### System Tools (5 tests each = 30 total)

**Total: 125 comprehensive tool tests**

## Day 2: Workflow, AI/RAG & Display Component Testing

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
    
    // Verify pure data response
    expect(result.success).toBe(true);
    expect(result.date).toBe('2024-01-15');
    expect(result.changes).toBeArray();
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.metrics).toBeDefined();
  });
  
  it('should handle empty schedule', async () => {
    await clearSchedule();
    const result = await optimizeSchedule.execute({});
    expect(result.success).toBe(true);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ 
        type: 'create', 
        description: expect.stringContaining('work block')
      })
    );
  });
  
  it('should respect user preferences', async () => {
    await updatePreferences({ 
      workStartTime: '10:00',
      lunchTime: '13:00'
    });
    const result = await optimizeSchedule.execute({});
    expect(result.success).toBe(true);
    // Verify changes respect preferences
    const createChanges = result.changes.filter(c => c.type === 'create');
    expect(createChanges[0].description).toContain('10:00');
  });
  
  it('should handle workflow interruption and resume', async () => {
    // Simulate interruption
    const workflow = createAdaptiveSchedulingWorkflow();
    const interruptedState = await simulateInterruption(workflow);
    
    // Resume
    const resumed = await resumeWorkflow.execute({
      workflowId: interruptedState.id
    });
    expect(resumed.success).toBe(true);
    expect(resumed.resumed).toBe(true);
  });
  
  it('should stream progress updates', async () => {
    const updates: any[] = [];
    
    // Execute with streaming
    for await (const update of optimizeSchedule.executeStream({})) {
      updates.push(update);
    }
    
    expect(updates.length).toBeGreaterThan(3);
    expect(updates[updates.length - 1].progress).toBe(100);
  });
});
```

### Display Component Testing

Test all display components from Sprint 4.5:

```typescript
// apps/web/tests/components/displays/ScheduleDisplay.test.tsx
import { render } from '@testing-library/react';
import { ScheduleDisplay } from '@/modules/chat/components/displays/ScheduleDisplay';

describe('ScheduleDisplay Component', () => {
  it('should render schedule blocks correctly', () => {
    const mockData = {
      date: '2024-01-15',
      blocks: [
        { 
          id: '1', 
          type: 'work' as const, 
          title: 'Deep Work', 
          startTime: new Date('2024-01-15T09:00:00'),
          endTime: new Date('2024-01-15T11:00:00')
        }
      ],
      stats: { 
        totalHours: 8, 
        focusHours: 4,
        meetingHours: 2,
        utilization: 80 
      }
    };
    
    const { getByText } = render(<ScheduleDisplay data={mockData} />);
    expect(getByText('Deep Work')).toBeInTheDocument();
    expect(getByText('8 hours')).toBeInTheDocument();
    expect(getByText('80% utilized')).toBeInTheDocument();
  });
  
  it('should handle empty schedule', () => {
    const mockData = {
      date: '2024-01-15',
      blocks: [],
      stats: { totalHours: 0, focusHours: 0, meetingHours: 0, utilization: 0 }
    };
    
    const { getByText } = render(<ScheduleDisplay data={mockData} />);
    expect(getByText(/No blocks scheduled/)).toBeInTheDocument();
  });
});

// Test ToolResultRenderer routing
describe('ToolResultRenderer', () => {
  it('should route schedule tools to ScheduleDisplay', () => {
    const result = { 
      success: true,
      date: '2024-01-15', 
      blocks: [],
      stats: { totalHours: 0, focusHours: 0, meetingHours: 0, utilization: 0 }
    };
    
    const { container } = render(
      <ToolResultRenderer 
        toolName="schedule_viewSchedule"
        result={result}
        metadata={{ category: 'schedule' }}
      />
    );
    expect(container.querySelector('[data-testid="schedule-display"]')).toBeInTheDocument();
  });
  
  it('should handle streaming state', () => {
    const { getByText } = render(
      <ToolResultRenderer 
        toolName="workflow_optimizeSchedule"
        result={{ stage: 'Analyzing schedule' }}
        isStreaming={true}
        streamProgress={45}
      />
    );
    expect(getByText('Analyzing schedule')).toBeInTheDocument();
    expect(getByText('45%')).toBeInTheDocument();
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
    expect(intent.suggestedHandler.name).toBe('schedule_moveTimeBlock');
  });
  
  it('should route to workflow for complex requests', async () => {
    const intent = await orchestrator.classifyIntent(
      'Organize my entire day including emails and tasks'
    );
    expect(intent.category).toBe('workflow');
    expect(intent.suggestedHandler.name).toBe('workflow_optimizeSchedule');
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
  it('should embed tool execution results', async () => {
    const toolResult = {
      toolName: 'schedule_createTimeBlock',
      category: 'schedule',
      params: { type: 'work', title: 'Morning Focus' },
      result: {
        success: true,
        block: { 
          id: '123', 
          type: 'work', 
          title: 'Morning Focus',
          startTime: new Date(),
          endTime: new Date()
        }
      },
      userId: 'test-user-id'
    };
    
    await embeddingService.embedToolResult(toolResult);
    
    const similar = await embeddingService.searchSimilar(
      'create work block',
      'schedule',
      10
    );
    expect(similar[0].toolName).toBe('schedule_createTimeBlock');
  });
  
  it('should learn from rejections', async () => {
    // Simulate rejection
    await embeddingService.embedRejection({
      toolName: 'schedule_createTimeBlock',
      proposedParams: { startTime: '09:00', type: 'meeting' },
      rejectedResult: { 
        success: true, 
        block: { startTime: new Date('2024-01-15T09:00:00') } 
      },
      reason: 'Too early for meetings'
    });
    
    // Verify learning
    const context = await ragProvider.getRelevantContext(
      'Schedule morning meeting',
      'test-user-id',
      'schedule_createTimeBlock'
    );
    expect(context.rejections.length).toBeGreaterThan(0);
  });
  
  it('should extract patterns correctly', async () => {
    await seedUserHistory();
    const patterns = await ragProvider.extractPatterns('test-user-id');
    
    expect(patterns).toContainEqual(
      expect.objectContaining({
        category: 'schedule',
        pattern: expect.stringContaining('work blocks in morning')
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
    expect(response.toolInvocations).toHaveLength(2);
    expect(response.toolInvocations[0].toolName).toBe('task_createTask');
    expect(response.toolInvocations[1].toolName).toBe('schedule_fillWorkBlock');
    
    // Verify pure data results
    expect(response.toolInvocations[0].result.success).toBe(true);
    expect(response.toolInvocations[0].result.task).toBeDefined();
  });
  
  it('should display tool results with appropriate components', async () => {
    const response = await sendChatMessage('Show my schedule');
    
    // Check that tool was called
    expect(response.toolInvocations[0].toolName).toBe('schedule_viewSchedule');
    
    // Verify pure data result
    const result = response.toolInvocations[0].result;
    expect(result.success).toBe(true);
    expect(result.blocks).toBeArray();
    
    // UI rendering is handled by ToolResultRenderer
    // Component testing verifies the display
  });
  
  it('should handle errors gracefully', async () => {
    // Simulate service failure
    mockServiceFailure('scheduleService');
    
    const response = await sendChatMessage('Show my schedule');
    const result = response.toolInvocations[0].result;
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
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
- [ ] Remove UniversalToolResponse schema
- [ ] Remove buildToolResponse helper functions
- [ ] Remove StructuredMessage component (if replaced by display components)
- [ ] Remove old UI formatting utilities
- [ ] Find unused AI components
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

## 6. New Architecture Compliance
- [ ] All 25 tools return pure data
- [ ] No UI instructions in tool responses
- [ ] Tool factory pattern used consistently
- [ ] Display components handle all rendering
- [ ] ToolResultRenderer properly configured
- [ ] Tool metadata includes category and display hints
- [ ] All tools registered with ToolRegistry
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
   - `/modules/ai/schemas/universal.schema.ts` (replaced by pure data)
   - `/modules/ai/utils/tool-helpers.ts` (buildToolResponse deprecated)
   - `/modules/ai/components/StructuredMessage.tsx` (if replaced)
   - Impact: Reduces bundle by ~50KB

## Priority 2: Architecture Improvements
1. **Complete tool migration to pure data**
   - Remaining tools: Calendar (2), Preference (1), Workflow (4), System (6)
   - Effort: 4 hours
   - Impact: Consistent architecture

2. **Implement all display components**
   - Components needed: WorkflowResultDisplay, SystemDisplay, etc.
   - Effort: 6 hours
   - Impact: Complete UI rendering system

## Priority 3: Performance
1. **Implement React.memo for display components**
   - Components: ScheduleDisplay, TaskListDisplay, EmailListDisplay
   - Expected improvement: 30% fewer re-renders

2. **Optimize lazy loading**
   - Current: Basic lazy loading
   - Proposed: Preload on hover, priority loading
   - Impact: 200ms faster interaction

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
  
  it('should have all tools returning pure data', async () => {
    const tools = ToolRegistry.getInstance().getAll();
    
    for (const [name, tool] of Object.entries(tools)) {
      const result = await tool.execute({});
      expect(result).toHaveProperty('success');
      expect(result).not.toHaveProperty('display');
      expect(result).not.toHaveProperty('ui');
    }
  });
});
```

## Success Criteria

### Testing Coverage
- [ ] 100% of tools have 5+ tests each (125 total)
- [ ] 100% of workflows have comprehensive tests
- [ ] AI orchestration fully tested
- [ ] RAG components fully tested with new architecture
- [ ] All display components tested
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
- [ ] Bundle size < 500KB (with lazy-loaded displays)
- [ ] First paint < 1 second
- [ ] No memory leaks
- [ ] Display components render < 100ms
- [ ] Tool result routing < 50ms

### Architecture
- [ ] No circular dependencies
- [ ] Clear separation of concerns
- [ ] All business logic in services
- [ ] UI components are pure
- [ ] Proper error boundaries
- [ ] All tools return pure data (no UI formatting)
- [ ] ToolResultRenderer handles all routing
- [ ] Display components lazy-loaded
- [ ] Tool metadata properly configured

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
   - 30+ display component tests
   - 50+ integration tests
   - Performance benchmarks

2. **Audit Report**
   - Complete findings document
   - Prioritized issues list
   - Impact assessment
   - Architecture compliance report

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