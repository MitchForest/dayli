# Sprint 5: Polish, Real APIs & Testing

**Duration**: Day 10 (1 day) + Extended for API migration  
**Goal**: Polish the experience, migrate to real Gmail/Calendar APIs, remove technical debt, and ensure production readiness

## Sprint Overview

This sprint transforms dayli from prototype to production:
- UX polish and refinements
- Real Gmail & Calendar API integration
- Technical debt cleanup
- Comprehensive testing
- Performance optimization

## Prerequisites from Sprint 4
- ✅ AI chat fully functional
- ✅ RAG system operational
- ✅ All commands working
- ✅ Mock APIs in place

## Phase 1: Polish & UX Refinements

### 1.1 Animation & Transitions

Update `apps/web/globals.css`:

```css
/* Smooth transitions for all interactions */
@layer utilities {
  .transition-smooth {
    @apply transition-all duration-200 ease-in-out;
  }
  
  .animate-slide-in {
    animation: slideIn 0.3s ease-out;
  }
  
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

### 1.2 Loading States

Create `apps/web/components/ui/loading-states.tsx`:

```typescript
export function ScheduleLoading() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-20 bg-muted rounded-lg" />
      ))}
    </div>
  );
}

export function ChatLoading() {
  return (
    <div className="flex gap-3 p-4">
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

export function TaskLoading() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse flex-1" />
        </div>
      ))}
    </div>
  );
}
```

### 1.3 Empty States

Create `apps/web/components/ui/empty-states.tsx`:

```typescript
import { Calendar, Mail, Target, Sparkles } from 'lucide-react';
import { Button } from './button';

export function EmptySchedule({ onPlanDay }: { onPlanDay: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No schedule yet</h3>
      <p className="text-muted-foreground mb-4">
        Let's create your perfect day
      </p>
      <Button onClick={onPlanDay}>
        <Sparkles className="mr-2 h-4 w-4" />
        Plan My Day
      </Button>
    </div>
  );
}

export function EmptyTasks() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <Target className="w-8 h-8 text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">
        No tasks in this block yet
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Click + to add tasks or ask AI for suggestions
      </p>
    </div>
  );
}

export function NoEmails() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Mail className="w-10 h-10 text-muted-foreground mb-3" />
      <h3 className="font-medium mb-1">Inbox Zero! 🎉</h3>
      <p className="text-sm text-muted-foreground">
        All emails have been processed
      </p>
    </div>
  );
}
```

### 1.4 Keyboard Shortcuts

Create `apps/web/hooks/useKeyboardShortcuts.ts`:

```typescript
import { useEffect } from 'react';
import { useChatStore } from '@/modules/chat/store/chatStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Focus chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('chat-input')?.focus();
      }
      
      // Cmd/Ctrl + P: Plan day
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        document.getElementById('plan-day-button')?.click();
      }
      
      // Cmd/Ctrl + E: Email triage
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        // Trigger email triage
      }
      
      // Escape: Close modals
      if (e.key === 'Escape') {
        // Close any open modals
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}
```

## Phase 2: Real Gmail & Calendar API Integration

### 2.1 Remove Mock Services

Delete these files:
- `apps/web/services/mock/gmail.service.ts`
- `apps/web/services/mock/calendar.service.ts`
- `apps/web/services/mock/tasks.service.ts`
- `apps/web/app/api/mock/*`

### 2.2 Gmail API Service

Create `apps/web/services/google/gmail.service.ts`:

```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '@/lib/supabase';

export class GmailService {
  private gmail;
  
  constructor(private authClient: OAuth2Client) {
    this.gmail = google.gmail({ version: 'v1', auth: authClient });
  }

  async listMessages(params: {
    userId: string;
    query?: string;
    maxResults?: number;
    pageToken?: string;
  }) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: params.query || 'is:unread',
        maxResults: params.maxResults || 50,
        pageToken: params.pageToken,
      });

      return response.data;
    } catch (error) {
      console.error('Gmail API error:', error);
      throw error;
    }
  }

  async getMessage(messageId: string) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data;
    } catch (error) {
      console.error('Gmail API error:', error);
      throw error;
    }
  }

  async modifyMessage(messageId: string, addLabels: string[], removeLabels: string[]) {
    try {
      const response = await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Gmail API error:', error);
      throw error;
    }
  }

  async syncEmails(userId: string) {
    // Fetch unread emails
    const messages = await this.listMessages({ userId, query: 'is:unread' });
    
    for (const message of messages.messages || []) {
      const fullMessage = await this.getMessage(message.id!);
      
      // Parse email data
      const headers = fullMessage.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      // Extract body
      const body = this.extractBody(fullMessage.payload);
      
      // Store in database
      await supabase.from('emails').upsert({
        user_id: userId,
        gmail_id: message.id,
        from_email: this.extractEmail(from),
        from_name: this.extractName(from),
        subject,
        body_preview: body.substring(0, 200),
        full_body: body,
        received_at: new Date(date).toISOString(),
        is_read: false,
      });
    }
  }

  private extractBody(payload: any): string {
    // Extract text body from Gmail payload
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }
    
    return '';
  }

  private extractEmail(from: string): string {
    const match = from.match(/<(.+?)>/);
    return match ? match[1] : from;
  }

  private extractName(from: string): string {
    const match = from.match(/^(.+?)</);
    return match ? match[1].trim() : '';
  }
}
```

### 2.3 Calendar API Service

Create `apps/web/services/google/calendar.service.ts`:

```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class CalendarService {
  private calendar;
  
  constructor(private authClient: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth: authClient });
  }

  async listEvents(params: {
    timeMin: string;
    timeMax: string;
    calendarId?: string;
    maxResults?: number;
  }) {
    try {
      const response = await this.calendar.events.list({
        calendarId: params.calendarId || 'primary',
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        maxResults: params.maxResults || 250,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Calendar API error:', error);
      throw error;
    }
  }

  async createEvent(event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    transparency?: 'opaque' | 'transparent';
  }) {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          ...event,
          transparency: event.transparency || 'opaque', // Busy by default
        },
      });

      return response.data;
    } catch (error) {
      console.error('Calendar API error:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, updates: any) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: updates,
      });

      return response.data;
    } catch (error) {
      console.error('Calendar API error:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
    } catch (error) {
      console.error('Calendar API error:', error);
      throw error;
    }
  }

  async blockCalendarTime(blocks: Array<{
    title: string;
    startTime: string;
    endTime: string;
    type: string;
  }>) {
    const events = [];
    
    for (const block of blocks) {
      const event = await this.createEvent({
        summary: `[dayli] ${block.title}`,
        description: `Protected time block created by dayli. Type: ${block.type}`,
        start: { dateTime: block.startTime },
        end: { dateTime: block.endTime },
        transparency: block.type === 'open-meeting' ? 'transparent' : 'opaque',
      });
      
      events.push(event);
    }
    
    return events;
  }
}
```

### 2.4 OAuth Integration

Update `apps/web/lib/google-auth.ts`:

```typescript
import { OAuth2Client } from 'google-auth-library';
import { supabase } from './supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export async function getGoogleAuthClient(userId: string): Promise<OAuth2Client> {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/google/callback`
  );

  // Get stored tokens from database
  const { data: auth } = await supabase
    .from('user_auth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (!auth?.access_token) {
    throw new Error('No Google auth tokens found');
  }

  oauth2Client.setCredentials({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expiry_date: auth.expiry_date,
  });

  // Auto-refresh if needed
  oauth2Client.on('tokens', async (tokens) => {
    await supabase
      .from('user_auth_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || auth.refresh_token,
        expiry_date: tokens.expiry_date,
      })
      .eq('user_id', userId)
      .eq('provider', 'google');
  });

  return oauth2Client;
}
```

## Phase 3: Technical Debt Cleanup

### 3.1 Remove Mock Data Dependencies

1. **Update imports**: Replace all mock service imports with real services
2. **Remove seed scripts**: Delete `scripts/seed-mock-data.ts`
3. **Update API routes**: Remove `/api/mock/*` endpoints
4. **Clean migrations**: Remove mock data references

### 3.2 Type Safety Improvements

Create `apps/web/types/google-apis.ts`:

```typescript
// Properly typed Google API responses
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body: { data?: string };
    parts?: Array<{
      mimeType: string;
      body: { data?: string };
    }>;
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

export interface CalendarEvent {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    responseStatus: string;
    displayName?: string;
  }>;
  transparency?: 'opaque' | 'transparent';
}
```

### 3.3 Error Boundaries

Create `apps/web/components/error-boundary.tsx`:

```typescript
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground text-center mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Phase 4: Testing

### 4.1 Unit Tests

Create `apps/web/__tests__/services/command-processor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CommandProcessor } from '@/services/chat/command-processor';

describe('CommandProcessor', () => {
  const processor = new CommandProcessor();

  it('should parse schedule task command', async () => {
    const command = await processor.parseCommand('Schedule review PR for 2pm');
    expect(command?.type).toBe('schedule_task');
    expect(command?.task).toBe('review PR');
    expect(command?.time).toBe('2pm');
  });

  it('should parse move task command', async () => {
    const command = await processor.parseCommand('Move task-123 to 4pm');
    expect(command?.type).toBe('move_task');
    expect(command?.taskId).toBe('task-123');
    expect(command?.newTime).toBe('4pm');
  });

  it('should return null for non-commands', async () => {
    const command = await processor.parseCommand('Hello, how are you?');
    expect(command).toBeNull();
  });
});
```

### 4.2 Integration Tests

Create `apps/web/__tests__/integration/daily-planning.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createDailyPlanningWorkflow } from '@/modules/workflows/graphs/dailyPlanning';
import { mockSupabase } from '../mocks/supabase';

describe('Daily Planning Workflow', () => {
  beforeEach(() => {
    // Reset mocks
    mockSupabase.reset();
  });

  it('should generate schedule with all required blocks', async () => {
    const workflow = createDailyPlanningWorkflow();
    
    const result = await workflow.invoke({
      userId: 'test-user',
      date: '2024-01-15',
      userPreferences: {
        workStartTime: '09:00',
        workEndTime: '18:00',
        lunchStartTime: '12:00',
        lunchDuration: 60,
        targetDeepWorkBlocks: 2,
        deepWorkDuration: 2,
      },
      existingMeetings: [],
      unreadEmails: { count: 25, urgent: 3, newsletters: 10 },
      backlogTasks: [],
      generatedSchedule: [],
    });

    expect(result.generatedSchedule).toHaveLength(7); // Expected blocks
    expect(result.generatedSchedule.some(b => b.type === 'email')).toBe(true);
    expect(result.generatedSchedule.some(b => b.type === 'focus')).toBe(true);
    expect(result.generatedSchedule.some(b => b.type === 'break')).toBe(true);
  });
});
```

### 4.3 E2E Tests

Create `apps/web/e2e/chat-commands.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Chat Commands', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/focus');
    await page.waitForSelector('[data-testid="chat-input"]');
  });

  test('should plan day via chat', async ({ page }) => {
    await page.fill('[data-testid="chat-input"]', 'Plan my day');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await expect(page.locator('[data-testid="planning-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="schedule-block"]')).toHaveCount(7);
  });

  test('should schedule task via chat', async ({ page }) => {
    await page.fill('[data-testid="chat-input"]', 'Schedule code review at 2pm');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await expect(page.locator('text=Scheduled "code review"')).toBeVisible();
  });
});
```

### 4.4 Performance Tests

Create `apps/web/__tests__/performance/rag.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RAGContextService } from '@/services/rag/context.service';

describe('RAG Performance', () => {
  const ragService = new RAGContextService();

  it('should retrieve context in under 100ms', async () => {
    const start = performance.now();
    
    await ragService.getContextForQuery('test-user', 'schedule meeting');
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should handle concurrent queries', async () => {
    const queries = Array(10).fill(null).map((_, i) => 
      ragService.getContextForQuery('test-user', `query ${i}`)
    );
    
    const start = performance.now();
    await Promise.all(queries);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500); // All queries in under 500ms
  });
});
```

## Phase 5: Pre-Launch Checklist

### 5.1 Security
- [ ] All API keys in environment variables
- [ ] OAuth tokens encrypted at rest
- [ ] RLS policies tested
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented

### 5.2 Performance
- [ ] Bundle size < 500KB
- [ ] Initial load < 3s
- [ ] RAG queries < 100ms
- [ ] Database queries optimized
- [ ] Images optimized

### 5.3 Error Handling
- [ ] All async operations have error handling
- [ ] User-friendly error messages
- [ ] Error boundaries in place
- [ ] Logging configured
- [ ] Sentry integration

### 5.4 Documentation
- [ ] README updated
- [ ] API documentation
- [ ] Deployment guide
- [ ] Environment variables documented
- [ ] Architecture decisions recorded

## Deliverables Checklist

### Polish ✓
- [ ] Smooth animations
- [ ] Loading states everywhere
- [ ] Empty states designed
- [ ] Keyboard shortcuts
- [ ] Error boundaries

### Real APIs ✓
- [ ] Gmail API integrated
- [ ] Calendar API integrated
- [ ] OAuth flow complete
- [ ] Token refresh working
- [ ] API error handling

### Technical Debt ✓
- [ ] Mock services removed
- [ ] Types properly defined
- [ ] Unused code deleted
- [ ] Dependencies updated
- [ ] Code organized

### Testing ✓
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Manual testing complete

## Success Criteria

- [ ] No mock data remains
- [ ] Real emails sync properly
- [ ] Calendar blocks created successfully
- [ ] All animations smooth
- [ ] No console errors
- [ ] Tests have >80% coverage
- [ ] Performance targets met
- [ ] Security audit passed

## Launch Readiness

### Final Steps
1. Run full test suite
2. Performance audit
3. Security review
4. Deploy to staging
5. User acceptance testing
6. Production deployment

## Notes

- Keep old mock services in a separate branch for reference
- Document any API quirks discovered
- Monitor API quotas carefully
- Plan for offline support in future
- Consider adding analytics 