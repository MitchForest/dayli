# Architecture Recommendations for Sprint 03.015

## Current Architecture Strengths

1. **Clear Separation of Concerns**
   - Tools handle single operations
   - Workflows orchestrate complex processes
   - Services manage data and external APIs
   - UI components are decoupled

2. **Consistent Patterns**
   - All tools use AI SDK's `tool` function
   - All workflows use LangGraph's StateGraph
   - Services implement interfaces
   - Error handling is centralized

3. **Good Abstractions**
   - ServiceFactory provides dependency injection
   - Interfaces allow for testing and swapping implementations
   - Workflow persistence is a clean wrapper

## Recommended Improvements

### 1. Tool Registry Pattern

**Current**: Tools are imported individually in chat route
```typescript
import { createTask } from './tools/task-operations';
import { scheduleDay } from './tools/workflow-tools';
// ... many imports
```

**Recommended**: Create a tool registry
```typescript
// tools/registry.ts
export class ToolRegistry {
  private static tools = new Map<string, Tool>();
  
  static register(category: string, tools: Record<string, Tool>) {
    Object.entries(tools).forEach(([name, tool]) => {
      this.tools.set(`${category}.${name}`, tool);
    });
  }
  
  static getTools(): Record<string, Tool> {
    return Object.fromEntries(this.tools);
  }
  
  static getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.entries())
      .filter(([key]) => key.startsWith(category))
      .map(([_, tool]) => tool);
  }
}

// In each tool file
ToolRegistry.register('schedule', {
  viewSchedule,
  createTimeBlock,
  moveTimeBlock,
});

// In chat route
const tools = ToolRegistry.getTools();
```

### 2. Workflow Factory Pattern

**Current**: Workflows are created directly
```typescript
const workflow = createAdaptiveSchedulingWorkflow();
```

**Recommended**: Add workflow factory for consistency
```typescript
export class WorkflowFactory {
  private static workflows = new Map<string, () => StateGraph>();
  
  static register(name: string, factory: () => StateGraph()) {
    this.workflows.set(name, factory);
  }
  
  static create(name: string): StateGraph {
    const factory = this.workflows.get(name);
    if (!factory) throw new Error(`Unknown workflow: ${name}`);
    
    // Always wrap with persistence
    return createPersistentWorkflow(factory(), name);
  }
}

// Usage
WorkflowFactory.register('adaptive_scheduling', createAdaptiveSchedulingWorkflow);
const workflow = WorkflowFactory.create('adaptive_scheduling');
```

### 3. Tool Composition Framework

**Current**: Some composite tools manually call other tools
```typescript
const email = await readEmailContent.execute({ emailId });
const task = await createTask.execute({ title: email.subject });
```

**Recommended**: Create composition utilities
```typescript
export class ToolComposer {
  static chain<T>(...tools: Tool[]): Tool<T> {
    return tool({
      description: `Composed: ${tools.map(t => t.description).join(' → ')}`,
      parameters: mergeSchemas(tools.map(t => t.parameters)),
      execute: async (params) => {
        let result = params;
        for (const tool of tools) {
          result = await tool.execute(result);
        }
        return result;
      }
    });
  }
  
  static parallel<T>(...tools: Tool[]): Tool<T[]> {
    return tool({
      description: `Parallel: ${tools.map(t => t.description).join(' + ')}`,
      parameters: mergeSchemas(tools.map(t => t.parameters)),
      execute: async (params) => {
        return Promise.all(tools.map(t => t.execute(params)));
      }
    });
  }
}

// Usage
export const emailToScheduledTask = ToolComposer.chain(
  readEmailContent,
  extractActionItems,
  createTask,
  scheduleTask
);
```

### 4. Service Middleware Pattern

**Current**: Error handling proxy wraps services
```typescript
return new ErrorHandlingProxy(this.emailService);
```

**Recommended**: Extensible middleware system
```typescript
export class ServiceMiddleware {
  static compose(...middlewares: Middleware[]): Middleware {
    return (service) => 
      middlewares.reduceRight((acc, mw) => mw(acc), service);
  }
}

// Middlewares
const withRetry = (service) => new RetryMiddleware(service);
const withCache = (service) => new CacheMiddleware(service);
const withMetrics = (service) => new MetricsMiddleware(service);
const withOfflineQueue = (service) => new OfflineQueueMiddleware(service);

// In ServiceFactory
getEmailService(): IEmailService {
  const middleware = ServiceMiddleware.compose(
    withRetry,
    withCache,
    withMetrics,
    withOfflineQueue
  );
  
  return middleware(this.emailService);
}
```

### 5. Tool Result Standards

**Current**: Tools return different shapes
```typescript
// Some return { success, message }
// Some return { task, scheduled }
// Some return raw data
```

**Recommended**: Standardized result type
```typescript
interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  metadata?: {
    confirmationRequired?: boolean;
    confirmationId?: string;
    suggestedActions?: Action[];
    affectedEntities?: Entity[];
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// Utility for consistent returns
export function toolSuccess<T>(
  data: T, 
  message?: string, 
  metadata?: ToolResult['metadata']
): ToolResult<T> {
  return { success: true, data, message, metadata };
}

export function toolError(
  code: string, 
  message: string, 
  retryable = false
): ToolResult {
  return { success: false, error: { code, message, retryable } };
}
```

### 6. Workflow State Type Safety

**Current**: Workflow state uses `Record<string, any>`
```typescript
state: Record<string, any>;
```

**Recommended**: Generic workflow state system
```typescript
export abstract class WorkflowState {
  userId: string;
  startedAt: Date;
  
  abstract validate(): boolean;
  abstract summarize(): string;
}

export class SchedulingWorkflowState extends WorkflowState {
  currentSchedule: TimeBlock[];
  proposedChanges: ScheduleChange[];
  // ... specific fields
  
  validate(): boolean {
    return this.userId && this.currentSchedule !== undefined;
  }
}

// In workflow creation
export function createTypedWorkflow<T extends WorkflowState>(
  stateClass: new() => T
): StateGraph<T> {
  // Type-safe workflow creation
}
```

### 7. Tool Permission System

**Recommended**: Add permission checks for sensitive operations
```typescript
export interface ToolPermissions {
  requiresConfirmation?: boolean;
  maxExecutionsPerHour?: number;
  allowedRoles?: string[];
  costTier?: 'free' | 'premium' | 'enterprise';
}

export function protectedTool<T>(
  definition: ToolDefinition<T>,
  permissions: ToolPermissions
): Tool<T> {
  return tool({
    ...definition,
    execute: async (params, context) => {
      // Check permissions
      if (permissions.requiresConfirmation && !params.confirmed) {
        return toolError('CONFIRMATION_REQUIRED', 'Please confirm this action');
      }
      
      // Check rate limits
      if (permissions.maxExecutionsPerHour) {
        const count = await getRateLimitCount(context.userId, definition.name);
        if (count >= permissions.maxExecutionsPerHour) {
          return toolError('RATE_LIMITED', 'Too many requests');
        }
      }
      
      // Execute original
      return definition.execute(params, context);
    }
  });
}
```

## Implementation Priority

1. **High Priority** (Do in Sprint 03.015):
   - Tool Registry (reduces boilerplate)
   - Standardized Tool Results (improves consistency)

2. **Medium Priority** (Consider for later):
   - Workflow Factory
   - Service Middleware Pattern
   - Tool Composition Framework

3. **Low Priority** (Nice to have):
   - Workflow State Type Safety
   - Tool Permission System

## Architecture Decision Records (ADRs)

### ADR-004: Tool Registry Pattern
**Decision**: Implement tool registry for automatic discovery
**Rationale**: Reduces import boilerplate, enables dynamic tool loading
**Consequences**: Slight startup overhead, better maintainability

### ADR-005: Standardized Tool Results
**Decision**: All tools return ToolResult<T> type
**Rationale**: Consistent error handling, metadata, and UI rendering
**Consequences**: Migration effort for existing tools, better UX

### ADR-006: Service Middleware
**Decision**: Implement composable middleware for services
**Rationale**: Extensible cross-cutting concerns (retry, cache, metrics)
**Consequences**: More complex but more flexible

## Summary

The current architecture is solid and well-suited for senior-level development. The recommended improvements are optimizations that would:

1. Reduce boilerplate code
2. Improve consistency
3. Enable better testing
4. Support future scaling
5. Maintain type safety

None of these are blocking issues - the current design will work well. These are refinements that could be implemented incrementally as the codebase grows. 