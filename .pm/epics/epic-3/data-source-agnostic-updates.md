# Data Source Agnostic Updates for Epic 3

## Overview
To ensure smooth transition from mock data to real Gmail/Calendar APIs in Sprint 03.05, we need to update Sprints 03.01-03.04 to use data-source agnostic service interfaces.

## Architecture Pattern

### Service Interface Pattern
```typescript
// Define interface
interface EmailService {
  getMessages(params: GetMessagesParams): Promise<EmailMessage[]>
  // ... other methods
}

// Factory returns appropriate implementation
const emailService = await ServiceFactory.getEmailService(userId);
// Returns MockEmailService or GmailServiceImpl based on OAuth status
```

## Updates Required by Sprint

### Sprint 03.01 - Core AI Chat & Tools

**Current Issue**: Direct references to mock services in tools

**Updates Needed**:

1. **Update Schedule Service References**
```typescript
// BEFORE (in schedule-tools.ts)
import { scheduleService } from '@/services/mock/schedule.service';

// AFTER
import { ServiceFactory } from '@/services/factory/serviceFactory';

export const createTimeBlock = tool({
  // ... parameters ...
  execute: async (params) => {
    const scheduleService = await ServiceFactory.getInstance()
      .getScheduleService(getCurrentUserId());
    
    const block = await scheduleService.createTimeBlock({
      // ... params
    });
  },
});
```

2. **Update Task Service References**
```typescript
// BEFORE
import { taskService } from '@/services/mock/tasks.service';

// AFTER
const taskService = await ServiceFactory.getInstance()
  .getTaskService(getCurrentUserId());
```

### Sprint 03.02 - Adaptive Scheduling Workflow

**Current Issue**: Workflow nodes might have direct service imports

**Updates Needed**:

1. **Update Workflow State to Include Services**
```typescript
interface ScheduleState {
  // ... existing fields ...
  services?: {
    schedule: ScheduleService;
    task: TaskService;
    calendar: CalendarService;
  };
}
```

2. **Initialize Services in Entry Node**
```typescript
async function initializeNode(state: ScheduleState) {
  const factory = ServiceFactory.getInstance();
  const services = {
    schedule: await factory.getScheduleService(state.userId),
    task: await factory.getTaskService(state.userId),
    calendar: await factory.getCalendarService(state.userId),
  };
  
  return { ...state, services };
}
```

### Sprint 03.03 - Email Triage Workflows

**Current Issue**: GmailService is implemented but not using factory pattern

**Updates Needed**:

1. **Move Gmail Service Behind Factory**
```typescript
// Update gmail.service.ts to implement interface
export class MockGmailService implements GmailService {
  async getUnreadEmails(options) {
    // Return mock emails
    return generateMockEmails(options.maxResults);
  }
}

// In workflow
const gmailService = await ServiceFactory.getInstance()
  .getGmailService(state.userId);
```

### Sprint 03.04 - RAG System & Learning

**No updates needed** - RAG system is already data-source agnostic as it stores learned patterns regardless of data source.

## Service Factory Implementation (for Sprint 03.01)

**File**: `apps/web/services/factory/serviceFactory.ts`

```typescript
export class ServiceFactory {
  private static instance: ServiceFactory;
  
  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }
  
  async getEmailService(userId: string): Promise<EmailService> {
    // This will be updated in Sprint 03.05 to check OAuth
    // For now, always return mock
    return new MockEmailService();
  }
  
  async getCalendarService(userId: string): Promise<CalendarService> {
    return new MockCalendarService();
  }
  
  async getScheduleService(userId: string): Promise<ScheduleService> {
    // Schedule is always in our database
    return new ScheduleServiceImpl(userId);
  }
  
  async getTaskService(userId: string): Promise<TaskService> {
    // Tasks are always in our database
    return new TaskServiceImpl(userId);
  }
}
```

## Benefits of This Approach

1. **Zero Code Changes in Workflows**: When we switch to real APIs in Sprint 03.05, workflows don't change
2. **Gradual Migration**: Users without OAuth still get mock data
3. **Testing**: Can force mock services for testing even with OAuth
4. **Future Providers**: Easy to add Outlook, Apple Calendar, etc.

## Implementation Order

1. **Sprint 03.01**: Add ServiceFactory and update all tools
2. **Sprint 03.02**: Update workflow nodes to use factory
3. **Sprint 03.03**: Ensure email service uses factory pattern
4. **Sprint 03.04**: No changes needed
5. **Sprint 03.05**: Update factory to return real services when OAuth exists

## Testing Strategy

```typescript
// Test that services work with both implementations
describe('Service Factory', () => {
  it('returns mock service without OAuth', async () => {
    const service = await factory.getEmailService('user-without-oauth');
    expect(service).toBeInstanceOf(MockEmailService);
  });
  
  it('returns same interface regardless of implementation', async () => {
    const mockService = new MockEmailService();
    const realService = new GmailServiceImpl();
    
    // Both should have same methods
    expect(mockService.getMessages).toBeDefined();
    expect(realService.getMessages).toBeDefined();
  });
});
```

## Migration Checklist

- [ ] Create service interfaces in Sprint 03.01
- [ ] Implement ServiceFactory in Sprint 03.01
- [ ] Update all tool implementations to use factory
- [ ] Update workflow nodes to use factory
- [ ] Ensure mock services implement interfaces
- [ ] Test that switching implementations doesn't break anything 