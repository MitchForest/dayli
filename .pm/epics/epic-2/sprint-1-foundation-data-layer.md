# Sprint 1: Foundation & Data Layer

**Duration**: Days 1-3 (3 days)  
**Goal**: Set up database schema with pgvector, mock data generation, and Gmail/Calendar-compatible APIs

## Sprint Overview

This sprint establishes the data foundation for dayli, including:
- Complete database schema with vector storage for RAG
- Mock data generation that matches Gmail/Calendar API formats
- Data access layer with TypeScript types
- Development tools for testing and iteration

## Day 1: Database Schema & pgvector Setup

### 1.1 Database Migration

Create migration file: `migrations/003_tasks_schedules_vectors.sql`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Core tables (as defined in epic plan)
CREATE TABLE IF NOT EXISTS public.tasks (...);
CREATE TABLE IF NOT EXISTS public.emails (...);
CREATE TABLE IF NOT EXISTS public.daily_schedules (...);
CREATE TABLE IF NOT EXISTS public.time_blocks (...);

-- RAG/Embedding tables
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('command', 'decision', 'pattern', 'preference')) NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  pattern_type TEXT CHECK (pattern_type IN ('email_sender', 'task_timing', 'meeting_preference', 'focus_time')) NOT NULL,
  pattern_data JSONB NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  last_observed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vector similarity search
CREATE INDEX embeddings_embedding_idx ON public.embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_embeddings_user_content_type ON public.embeddings(user_id, content_type);
CREATE INDEX idx_user_patterns_user_type ON public.user_patterns(user_id, pattern_type);
```

### 1.2 TypeScript Types

Update `packages/database/src/types.ts`:

```typescript
// Core types
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  source: 'email' | 'calendar' | 'ai' | 'manual';
  email_id?: string;
  status: 'backlog' | 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  user_id: string;
  gmail_id?: string;
  from_email: string;
  from_name?: string;
  subject: string;
  body_preview?: string;
  full_body?: string;
  is_read: boolean;
  decision?: 'now' | 'tomorrow' | 'never';
  action_type?: 'quick_reply' | 'thoughtful_response' | 'archive' | 'no_action';
  received_at: string;
  processed_at?: string;
  metadata: Record<string, any>;
}

export interface TimeBlock {
  id: string;
  user_id: string;
  daily_schedule_id?: string;
  start_time: string;
  end_time: string;
  type: 'focus' | 'meeting' | 'email' | 'quick-decisions' | 'break' | 'blocked' | 'open-meeting';
  title: string;
  description?: string;
  source: 'calendar' | 'ai' | 'manual';
  calendar_event_id?: string;
  metadata: Record<string, any>;
}

// RAG types
export interface Embedding {
  id: string;
  user_id: string;
  content: string;
  content_type: 'command' | 'decision' | 'pattern' | 'preference';
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface UserPattern {
  id: string;
  user_id: string;
  pattern_type: 'email_sender' | 'task_timing' | 'meeting_preference' | 'focus_time';
  pattern_data: Record<string, any>;
  confidence: number;
  last_observed: string;
}
```

### 1.3 Database Queries

Create `packages/database/src/queries/schedule.ts`:

```typescript
export async function getDailySchedule(userId: string, date: string) {
  // Get or create daily schedule
  // Fetch all time blocks for the day
  // Include tasks and emails in blocks
}

export async function createTimeBlock(block: Omit<TimeBlock, 'id' | 'created_at' | 'updated_at'>) {
  // Create time block
  // Handle calendar event association
}

export async function updateTimeBlock(id: string, updates: Partial<TimeBlock>) {
  // Update time block
  // Sync with calendar if needed
}
```

## Day 2: Mock Data Generation System

### 2.1 Gmail API Compatible Mock Service

Create `apps/web/services/mock/gmail.service.ts`:

```typescript
// Matches Gmail API v1 format exactly
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      data: string; // Base64 encoded
    };
    parts?: Array<{
      partId: string;
      mimeType: string;
      body: {
        data: string;
      };
    }>;
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string; // Epoch ms as string
}

export class MockGmailService {
  private generateRealisticEmails(): GmailMessage[] {
    // Generate 100+ emails with:
    // - Newsletter patterns (morning delivery)
    // - Work emails (business hours)
    // - Meeting invites
    // - Follow-ups
    // - Urgent requests
    // - Social notifications
  }

  async listMessages(params: {
    userId: string;
    q?: string;
    pageToken?: string;
    maxResults?: number;
  }) {
    // Return paginated results matching Gmail API
  }

  async getMessage(params: {
    userId: string;
    id: string;
  }) {
    // Return full message with proper format
  }
}
```

### 2.2 Calendar API Compatible Mock Service

Create `apps/web/services/mock/calendar.service.ts`:

```typescript
// Matches Google Calendar API v3 format
interface CalendarEvent {
  kind: 'calendar#event';
  etag: string;
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink: string;
  created: string; // RFC3339
  updated: string; // RFC3339
  summary: string;
  description?: string;
  location?: string;
  creator: {
    email: string;
    displayName?: string;
  };
  organizer: {
    email: string;
    displayName?: string;
  };
  start: {
    dateTime?: string; // RFC3339
    date?: string; // All-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  recurrence?: string[];
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export class MockCalendarService {
  private generateRealisticEvents(): CalendarEvent[] {
    // Generate events with:
    // - Recurring team meetings
    // - One-on-ones
    // - All-hands meetings
    // - Focus time blocks (if already scheduled)
    // - External meetings
    // - Lunch blocks
  }

  async listEvents(params: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
    pageToken?: string;
    maxResults?: number;
  }) {
    // Return events in time range
  }

  async insertEvent(params: {
    calendarId: string;
    resource: Partial<CalendarEvent>;
  }) {
    // Create new event (for blocking calendar)
  }
}
```

### 2.3 Task Backlog Generator

Create `apps/web/services/mock/tasks.service.ts`:

```typescript
export class MockTaskService {
  generateBacklogTasks(): Task[] {
    return [
      // Strategic tasks
      { title: "Review Q1 OKRs", source: "manual", status: "backlog", priority: "high" },
      { title: "Prepare board presentation", source: "email", status: "backlog", priority: "high" },
      
      // Development tasks
      { title: "Code review for PR #234", source: "manual", status: "backlog", priority: "medium" },
      { title: "Fix production bug in auth flow", source: "manual", status: "backlog", priority: "high" },
      
      // Communication tasks
      { title: "Reply to Sarah about project timeline", source: "email", status: "backlog", priority: "medium" },
      { title: "Schedule 1:1 with new team member", source: "manual", status: "backlog", priority: "medium" },
      
      // Administrative tasks
      { title: "Submit expense report", source: "manual", status: "backlog", priority: "low" },
      { title: "Update team documentation", source: "manual", status: "backlog", priority: "low" },
      
      // Generate 30+ tasks total with realistic distribution
    ];
  }
}
```

## Day 3: Data Access Layer & API Endpoints ✅

### 3.1 Mock API Routes

Create `apps/web/app/api/mock/gmail/messages/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { MockGmailService } from '@/services/mock/gmail.service';

const gmailService = new MockGmailService();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'me';
  const q = searchParams.get('q') || undefined;
  
  const messages = await gmailService.listMessages({
    userId,
    q,
    pageToken: searchParams.get('pageToken') || undefined,
    maxResults: parseInt(searchParams.get('maxResults') || '50'),
  });
  
  return NextResponse.json(messages);
}
```

### 3.2 Seed Script

Create `scripts/seed-mock-data.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { MockGmailService } from '../apps/web/services/mock/gmail.service';
import { MockCalendarService } from '../apps/web/services/mock/calendar.service';
import { MockTaskService } from '../apps/web/services/mock/tasks.service';

async function seedDatabase() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 1. Clear existing data
  await supabase.from('time_blocks').delete().neq('id', '');
  await supabase.from('tasks').delete().neq('id', '');
  await supabase.from('emails').delete().neq('id', '');
  
  // 2. Generate mock data
  const gmailService = new MockGmailService();
  const calendarService = new MockCalendarService();
  const taskService = new MockTaskService();
  
  // 3. Insert emails
  const emails = gmailService.generateRealisticEmails();
  // Transform to our schema and insert
  
  // 4. Insert tasks
  const tasks = taskService.generateBacklogTasks();
  await supabase.from('tasks').insert(tasks);
  
  // 5. Generate 7 days of schedules
  for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    // Create daily schedule
    // Add calendar events as time blocks
    // Add some pre-scheduled focus blocks
  }
  
  console.log('✅ Mock data seeded successfully');
}
```

### 3.3 Development Tools

Create `apps/web/app/api/dev/reset-data/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  
  // Reset user's data to fresh mock state
  // Useful for testing different scenarios
}
```

## Deliverables Checklist

### Database Schema ✓
- [x] pgvector extension enabled
- [x] All core tables created (tasks, emails, time_blocks, daily_schedules)
- [x] RAG tables created (embeddings, user_patterns)
- [x] Proper indexes for performance
- [x] RLS policies configured

### Mock Data System ✓
- [x] Gmail API compatible service
- [x] Calendar API compatible service
- [x] 100+ realistic emails generated
- [x] 30+ backlog tasks
- [x] 7 days of calendar events
- [x] Realistic patterns (meeting clusters, email bursts)

### Data Access Layer ✓
- [x] TypeScript types for all entities
- [x] CRUD operations for all tables
- [x] Query functions with proper typing
- [x] Error handling

### API Endpoints ✓
- [x] `/api/gmail/messages` - List messages
- [x] `/api/gmail/messages/[id]` - Get message
- [x] `/api/calendar/events` - List events
- [x] `/api/calendar/events` - Create event
- [x] Seed script with user email flag
- [x] Service interface pattern for mock/real switching

### Development Tools ✓
- [x] Seed script for consistent test data
- [x] User-specific data seeding
- [x] Clear data option
- [x] Timezone-aware mock data

## Final Architecture Notes

The implemented architecture differs from the original plan in a key way that improves the system:

1. **Service Interface Pattern**: Instead of separate mock API endpoints, we created real API endpoints that use service interfaces. This allows seamless switching between mock and real data sources via environment variables.

2. **Benefits**:
   - No duplicate API implementation work
   - Cleaner migration path to real Gmail/Calendar APIs
   - Better testing capabilities
   - Single codebase for both development and production

3. **Usage**:
   ```bash
   # Seed mock data for a specific user
   bun run scripts/seed-mock-data.ts --user-email=white.mitchell.f@gmail.com
   
   # Clear and reseed
   bun run scripts/seed-mock-data.ts --user-email=white.mitchell.f@gmail.com --clear
   ```

## Handoff to Sprint 2

Sprint 2 now has:
- Fully functional database with pgvector support
- Complete mock data system that mimics real APIs
- Real API endpoints ready for UI integration
- Type-safe data access layer
- Ability to seed user-specific test data
- Foundation for RAG system with embeddings table

The service interface pattern means Sprint 2 can build against the real API endpoints immediately, and we can swap in real Gmail/Calendar services later without changing any UI code.

## Testing Plan

### Day 3 Testing
1. **Database Tests**
   - Verify all tables created
   - Test vector similarity searches
   - Ensure RLS policies work

2. **Mock Data Tests**
   - Verify Gmail API format matches
   - Verify Calendar API format matches
   - Check data variety and realism

3. **Integration Tests**
   - Test data access functions
   - Verify API endpoints return correct format
   - Test pagination

## Success Criteria

- [ ] Database schema fully implemented with pgvector
- [ ] Mock APIs return Gmail/Calendar compatible responses
- [ ] 100+ emails, 30+ tasks, 7 days of events generated
- [ ] Seed script creates consistent test environment
- [ ] All TypeScript types properly defined
- [ ] Basic CRUD operations working
- [ ] Development tools documented and working

## Risk Mitigation

### Potential Issues
1. **pgvector setup complexity**
   - Solution: Clear setup instructions, fallback to jsonb if needed

2. **Mock data realism**
   - Solution: Study actual Gmail/Calendar responses, iterate on patterns

3. **API format matching**
   - Solution: Use actual API docs, test with real API client libraries

## Notes for Implementation

- Focus on API compatibility - this makes future migration seamless
- Generate enough variety in mock data to test edge cases
- Ensure mock emails have realistic patterns (newsletters in morning, work emails during day)
- Calendar events should include recurring meetings and various meeting types
- Tasks should span different priorities and sources

## Implementation Progress Tracking

### Day 1: Database Schema & pgvector Setup ✅

#### Completed:
1. **Applied existing migration** (003_tasks_and_schedules.sql)
   - All core tables created successfully
   - RLS policies in place
   - Indexes configured

2. **Created and applied pgvector migration** (004_pgvector_and_embeddings.sql)
   - pgvector extension enabled
   - embeddings table with vector(1536) column
   - user_patterns table for learning
   - Proper indexes for vector similarity search

3. **Updated TypeScript types**
   - Regenerated types using Supabase CLI with project ID
   - Consolidated all types into `packages/database/src/types.ts`
   - Removed separate `database.types.ts` file
   - Added helper types (QueryResult, type aliases)
   - Fixed all import paths

#### Deviations from Plan:
- Used Supabase CLI with project ID instead of local generation (no Docker)
- Consolidated types into single file instead of having separate database.types.ts
- Used standard `OPENAI_API_KEY` environment variable name
- Changed API architecture: Creating real API routes that use mock services as data sources, rather than separate mock API endpoints. This provides a cleaner migration path to real Gmail/Calendar APIs.

#### Next Steps:
- Create real API routes (gmail, calendar) that use mock services
- Implement service interface pattern for easy mock/real switching
- Create database query functions
- Build seed script with user email flag

### Day 2: Mock Data Generation System ✅ (Partial)

#### Completed:
1. **Mock Services Created**
   - `MockGmailService`: Generates 100+ realistic emails with Gmail API v1 format
   - `MockCalendarService`: Generates recurring and one-off meetings with Calendar API v3 format
   - `MockTaskService`: Generates 30-40 diverse backlog tasks
   - All services respect user timezone settings

#### Architecture Decision:
Instead of creating separate mock API endpoints (`/api/mock/gmail/*`), we're creating real API endpoints (`/api/gmail/*`) that use mock services as data sources. This allows for:
- Cleaner migration path when switching to real APIs
- No duplicate API route work
- Better testing of actual API patterns
- Environment variable switching between mock and real data

#### Next Steps:
- Create real API routes that consume mock services
- Implement service interfaces for mock/real compatibility
- Complete seed script implementation 