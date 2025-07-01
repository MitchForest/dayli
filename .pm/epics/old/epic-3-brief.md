# Epic 3: Gmail & Calendar Integration Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**Target End Date**: [TBD + 1 week]  
**Actual End Date**: [TBD]

**Epic Goal**: Connect Gmail and Google Calendar APIs to fetch real emails and calendar events, implement email triage functionality, and create focus time blocks on the user's calendar.

**User Stories Addressed**:
- Story 2: Email to Tasks - Real email fetching and triage decisions
- Story 3: Protected Focus Time - Create actual calendar blocks
- Story 4: Quick Decisions - Functional email decision interface

**PRD Reference**: [Link to dayli PRD - Epic 3 section]

## Sprint Breakdown

| Sprint # | Sprint Name | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|--------|------------|----------|-----------------|
| 03.00 | Google APIs Setup | NOT STARTED | - | - | OAuth scopes & API clients |
| 03.01 | Gmail Integration | NOT STARTED | - | - | Fetch and display emails |
| 03.02 | Calendar Integration | NOT STARTED | - | - | Read events & create blocks |
| 03.03 | Email Triage Flow | NOT STARTED | - | - | Decision UI connected to actions |

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
- Google OAuth tokens from Supabase auth used for API access
- Server-side API calls to protect tokens
- Email and calendar data fetched on-demand (not stored)
- Real-time updates when user makes decisions

### Key Design Decisions
1. **API Access Pattern**: Server-side only via API routes
   - Alternatives considered: Client-side with token refresh
   - Rationale: Better security, token management handled server-side
   - Trade-offs: Additional API routes but more secure

2. **Data Storage**: Minimal - only store decisions, not email content
   - Alternatives considered: Cache all emails in database
   - Rationale: Privacy-first, avoid storing sensitive data
   - Trade-offs: More API calls but better privacy

3. **Calendar Strategy**: Create events directly, no intermediate storage
   - Alternatives considered: Queue system for calendar updates
   - Rationale: Immediate feedback, simpler architecture
   - Trade-offs: Requires good error handling

4. **Email Processing**: Fetch last 24-48 hours only
   - Alternatives considered: Full inbox scan, pagination
   - Rationale: Aligns with "today focus" POV
   - Trade-offs: Might miss older important emails

### Dependencies
**External Dependencies**:
- @googleapis/gmail: ^1.0.0
- @googleapis/calendar: ^1.0.0
- googleapis: ^130.0.0

**Internal Dependencies**:
- Requires: Auth system from Epic 2
- Provides: Real data for Epic 4 workflows

## Implementation Notes

### File Structure for Epic
```
apps/web/
├── app/
│   └── api/
│       ├── gmail/
│       │   ├── messages/
│       │   │   └── route.ts      # Fetch emails
│       │   ├── archive/
│       │   │   └── route.ts      # Archive email
│       │   └── modify/
│       │       └── route.ts      # Mark as read/unread
│       └── calendar/
│           ├── events/
│           │   └── route.ts      # Fetch calendar events
│           ├── create-block/
│           │   └── route.ts      # Create focus block
│           └── decline/
│               └── route.ts      # Decline meeting
├── components/
│   ├── email/
│   │   ├── EmailDecision.tsx    # Updated with real data
│   │   ├── EmailList.tsx        # List of decisions
│   │   └── QuickActions.tsx     # Approve/decline buttons
│   └── schedule/
│       ├── CalendarEvent.tsx    # Real calendar events
│       └── FocusBlockCreator.tsx # UI to create blocks
├── lib/
│   ├── google/
│   │   ├── auth.ts              # Google OAuth client
│   │   ├── gmail.ts             # Gmail API helpers
│   │   └── calendar.ts          # Calendar API helpers
│   └── email/
│       ├── triage.ts            # Email processing logic
│       └── patterns.ts          # Email importance rules
└── hooks/
    ├── useGmail.ts              # Gmail data fetching
    └── useCalendar.ts           # Calendar data fetching
```

### API Endpoints Added
| Method | Path | Purpose | Sprint |
|--------|------|---------|--------|
| GET | /api/gmail/messages | Fetch recent emails | 03.01 |
| POST | /api/gmail/archive | Archive an email | 03.03 |
| POST | /api/gmail/modify | Mark read/add label | 03.03 |
| GET | /api/calendar/events | Get today's events | 03.02 |
| POST | /api/calendar/create-block | Create focus time | 03.02 |
| POST | /api/calendar/decline | Decline a meeting | 03.02 |

### Data Model Changes
```typescript
// lib/types.ts additions
interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: Date
  isImportant: boolean
  hasAttachments: boolean
}

interface CalendarEvent {
  id: string
  summary: string
  start: Date
  end: Date
  attendees?: string[]
  isDeclinable: boolean
}

interface EmailDecision {
  emailId: string
  decision: 'now' | 'tomorrow' | 'never'
  processedAt?: Date
  resultingTaskId?: string
}

// Supabase tables
create table email_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  email_id text not null,
  decision text not null,
  processed_at timestamptz default now(),
  resulting_task_id uuid
);
```

### Key Functions/Components Created
- `getGoogleAuthClient` - Creates OAuth client with user tokens - Sprint 03.00
- `fetchRecentEmails` - Gets last 24-48hrs of email - Sprint 03.01
- `createFocusBlock` - Adds event to Google Calendar - Sprint 03.02
- `processEmailDecision` - Handles now/tomorrow/never - Sprint 03.03
- `useGmail` - Hook for email data with SWR - Sprint 03.01
- `useCalendar` - Hook for calendar data - Sprint 03.02

## Sprint Execution Log

### Sprint 03.00: Google APIs Setup
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 03.01: Gmail Integration
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 03.02: Calendar Integration
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 03.03: Email Triage Flow
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

## Testing & Quality

### Testing Approach
- Test with various Gmail account types (personal, workspace)
- Verify calendar permissions and event creation
- Test email archiving and label management
- Ensure rate limits are handled gracefully
- Test with empty inbox/calendar scenarios

### Known Issues
| Issue | Severity | Sprint | Status | Resolution |
|-------|----------|--------|--------|------------|
| [TBD] | - | - | - | - |

## Refactoring Completed

### Code Improvements
- [To be tracked during development]

### Performance Optimizations
- [To be tracked during development]

## Learnings & Gotchas

### What Worked Well
- [To be documented]

### Challenges Faced
- [To be documented]

### Gotchas for Future Development
- **OAuth Scopes**: Need specific scopes for modify operations
- **Rate Limits**: Gmail API has strict quotas
- **Token Refresh**: Handle expired tokens gracefully
- [Additional gotchas to be documented]

## Build Testing & Verification

### Epic-End Build Process (MANDATORY)

Before marking Epic 3 as complete:

1. **Clean build test:**
   ```bash
   cd apps/web
   rm -rf .next node_modules/.cache
   bun install
   bun run build
   ```

2. **API Configuration check:**
   ```bash
   # Verify Google Cloud Console setup:
   # - OAuth consent screen configured
   # - Gmail API enabled
   # - Calendar API enabled
   # - Correct redirect URIs
   ```

3. **Run quality checks:**
   ```bash
   bun run lint      # MUST return 0 errors, 0 warnings
   bun run typecheck # MUST return 0 errors
   ```

4. **Test Gmail integration:**
   - Fetch emails successfully
   - Archive email works
   - Labels applied correctly
   - No sensitive data logged

5. **Test Calendar integration:**
   - Today's events display
   - Create focus block
   - Block appears in Google Calendar
   - Decline meeting functionality

6. **Verification checklist:**
   - [ ] Gmail API fetches recent emails
   - [ ] Email decisions (now/tomorrow/never) work
   - [ ] Emails can be archived
   - [ ] Calendar events display correctly
   - [ ] Focus blocks can be created
   - [ ] Calendar blocks show as "busy"
   - [ ] Meetings can be declined
   - [ ] OAuth tokens refresh properly
   - [ ] Rate limiting handled gracefully
   - [ ] No sensitive data in logs
   - [ ] Works in both web and desktop

## Epic Completion Checklist

- [ ] All planned sprints completed and approved
- [ ] Gmail integration fully functional
- [ ] Calendar integration working properly
- [ ] Email triage flow complete
- [ ] Focus time blocks created successfully
- [ ] API rate limits handled
- [ ] Security review completed
- [ ] No PII stored unnecessarily
- [ ] Documentation updated
- [ ] Epic summary added to project tracker

## Epic Summary for Project Tracker

**[To be completed at epic end]**

**Delivered Features**:
- [To be documented]

**Key Architectural Decisions**:
- [To be documented]

**Critical Learnings**:
- [To be documented]

**Technical Debt Created**:
- [To be documented]

---

*Epic Started: [Date]*  
*Epic Completed: [Date]*  
*Total Duration: [X days]*