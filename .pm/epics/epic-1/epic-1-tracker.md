# Epic 1: App Shell & Beautiful UI Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**Target End Date**: [TBD + 1 week]  
**Actual End Date**: [TBD]

**Epic Goal**: Build the complete dayli UI with mock data, establishing the visual design and user experience of a radical focus app that shows only what matters today.

**User Stories Addressed**:
- Story 1: Morning Planning - UI shows 3-7 tasks already scheduled in time blocks
- Story 3: Protected Focus Time - Visual representation of blocked calendar time with tasks
- Story 4: Quick Decisions - Email decision card UI for Now/Tomorrow/Never triage
- Story 5: AI Assistant Control - Chat interface UI shell (non-functional)

**PRD Reference**: [.pm/planning_docs/prd.md - Epic 1 section]

## Sprint Breakdown

| Sprint # | Sprint Name | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|--------|------------|----------|-----------------|
| 01.00 | Infrastructure & Core Setup | NOT STARTED | - | - | Routes, Zustand, two-column layout |
| 01.01 | Time Blocks & Schedule View | NOT STARTED | - | - | Complete day view with all block types |
| 01.02 | Tasks & Email Decisions | NOT STARTED | - | - | Task display and email triage UI |
| 01.03 | Chat Interface & Polish | NOT STARTED | - | - | Collapsible chat panel and final polish |

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
The app consists of a single `/focus` route displaying a two-column layout:
- **Left Column**: Time-based daily schedule (8 AM - 6 PM) with time blocks
- **Right Column**: Collapsible chat panel for future AI assistant
- **State Management**: Zustand stores for schedule, email, and chat state
- **Mock Data**: TypeScript generators for realistic daily schedules

### Key Design Decisions
1. **Single Screen Architecture**: `/focus` as the only app screen
   - Alternatives considered: Multiple pages with navigation
   - Rationale: Enforces radical focus philosophy - no browsing or procrastination
   - Trade-offs: Less flexibility, but that's the point

2. **Time Grid System**: CSS Grid with 1-hour blocks and 15-minute increments
   - Alternatives considered: Absolute positioning, flexbox
   - Rationale: Clean layout, handles overlaps, easy to maintain
   - Trade-offs: Slightly more complex initial setup

3. **Zustand for State**: Separate stores for schedule, email, and chat
   - Alternatives considered: Context API, single mega-store
   - Rationale: Clean separation of concerns, easy to extend
   - Trade-offs: Multiple stores to manage

4. **Mock Data Architecture**: TypeScript generators with scenarios
   - Alternatives considered: Static JSON files, faker.js
   - Rationale: Type-safe, realistic variations, easy edge case testing
   - Trade-offs: More code than static files

5. **Collapsible Chat**: Right panel can be hidden for pure focus
   - Alternatives considered: Always visible, modal
   - Rationale: User choice for distraction-free mode
   - Trade-offs: Additional UI state to manage

### Dependencies
**External Dependencies**:
- zustand: ^5.0.2 (state management)
- date-fns: ^3.0.0 (time calculations)
- clsx: ^2.1.1 (conditional classes)
- lucide-react: ^0.525.0 (icons)

**Internal Dependencies**:
- Requires: Existing auth system (keeping as-is)
- Provides: Complete UI shell for future epics to add functionality

## Implementation Notes

### File Structure for Epic
```
apps/web/
├── app/
│   ├── focus/
│   │   ├── page.tsx          # Main app screen (protected route)
│   │   └── layout.tsx        # Two-column layout wrapper
│   ├── page.tsx              # Redirects to /focus or /login
│   └── login/                # Existing auth (unchanged)
├── modules/
│   ├── schedule/
│   │   ├── components/
│   │   │   ├── DaySchedule.tsx
│   │   │   ├── TimeBlock.tsx
│   │   │   ├── FocusBlock.tsx
│   │   │   ├── MeetingBlock.tsx
│   │   │   ├── EmailBlock.tsx
│   │   │   ├── BreakBlock.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   └── CurrentTimeIndicator.tsx
│   │   ├── hooks/
│   │   │   ├── useSchedule.ts
│   │   │   └── useMockSchedule.ts
│   │   ├── store/
│   │   │   └── scheduleStore.ts
│   │   ├── types/
│   │   │   └── schedule.types.ts
│   │   └── utils/
│   │       ├── timeGrid.ts
│   │       └── mockGenerator.ts
│   ├── email/
│   │   ├── components/
│   │   │   ├── EmailDecisionCard.tsx
│   │   │   ├── EmailQueue.tsx
│   │   │   └── DecisionButtons.tsx
│   │   ├── store/
│   │   │   └── emailStore.ts
│   │   └── types/
│   │       └── email.types.ts
│   └── chat/
│       ├── components/
│       │   ├── ChatPanel.tsx
│       │   ├── MessageList.tsx
│       │   ├── MessageInput.tsx
│       │   └── WelcomePrompt.tsx
│       ├── store/
│       │   └── chatStore.ts
│       └── types/
│           └── chat.types.ts
├── stores/
│   └── index.ts              # Export all stores
└── lib/
    └── constants.ts          # Time constants, block colors, etc.
```

### API Endpoints Added
| Method | Path | Purpose | Sprint |
|--------|------|---------|--------|
| N/A | Mock only | No real APIs in Epic 1 | - |

### Data Model Changes
```typescript
// schedule.types.ts
interface DailyTask {
  id: string
  title: string
  completed: boolean
  source?: 'email' | 'calendar' | 'ai'
  emailId?: string
}

interface TimeBlock {
  id: string
  startTime: string  // "9:00 AM"
  endTime: string    // "11:00 AM"
  type: 'focus' | 'meeting' | 'email' | 'quick-decisions' | 'break'
  title: string
  tasks: DailyTask[]
  emailQueue?: EmailDecision[] // For email blocks
}

interface DailySchedule {
  date: string
  timeBlocks: TimeBlock[]
  dailyTasks: DailyTask[]  // The 3-7 for the day
  stats: {
    emailsProcessed: number
    tasksCompleted: number
    focusMinutes: number
  }
}

// email.types.ts
interface EmailDecision {
  id: string
  from: string
  subject: string
  preview: string
  decision?: 'now' | 'tomorrow' | 'never'
}

// chat.types.ts
interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}
```

### Key Functions/Components Created
- `DaySchedule` - Main schedule container with time grid - Sprint 01.01
- `TimeBlock` - Base component for all block types - Sprint 01.01
- `FocusBlock` - Deep work blocks with tasks - Sprint 01.01
- `TaskItem` - Individual task with checkbox - Sprint 01.02
- `EmailDecisionCard` - Email triage interface - Sprint 01.02
- `ChatPanel` - Collapsible chat container - Sprint 01.03
- `useMockSchedule` - Hook for generating mock data - Sprint 01.00
- `scheduleStore` - Zustand store for schedule state - Sprint 01.00

## Sprint Execution Log

### Sprint 01.00: Infrastructure & Core Setup
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 01.01: Time Blocks & Schedule View
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 01.02: Tasks & Email Decisions
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 01.03: Chat Interface & Polish
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

## Testing & Quality

### Testing Approach
- Visual testing with multiple mock data scenarios
- Manual testing of interactions (task completion, email decisions)
- Desktop app testing on both Mac and Windows
- Browser testing (Chrome, Safari, Firefox)
- Window resize behavior testing

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
- [To be documented]

## Build Testing & Verification

### Epic-End Build Process (MANDATORY)

Before marking Epic 1 as complete:

1. **Clean build test:**
   ```bash
   cd apps/web
   rm -rf .next node_modules/.cache
   bun install
   bun run build
   ```

2. **Desktop app test:**
   ```bash
   # Start web app first
   cd apps/web
   bun dev
   
   # In another terminal, test desktop wrapper
   cd apps/desktop
   bun tauri dev
   ```

3. **Production build test:**
   ```bash
   # Build web app
   cd apps/web
   bun run build
   
   # Build desktop app (embeds web build)
   cd apps/desktop
   bun tauri build
   ```

4. **Run quality checks:**
   ```bash
   bun run lint      # MUST return 0 errors, 0 warnings
   bun run typecheck # MUST return 0 errors
   ```

5. **Verification checklist:**
   - [ ] Web app runs correctly at localhost:3000
   - [ ] Desktop app loads web app properly
   - [ ] App launches without crashes on macOS
   - [ ] App launches without crashes on Windows
   - [ ] /focus route displays full schedule
   - [ ] All 5 time block types render correctly
   - [ ] Tasks display within blocks (3-7 total)
   - [ ] Email decision cards show in email blocks
   - [ ] Chat panel displays and collapses
   - [ ] Current time indicator works
   - [ ] Task completion interaction works
   - [ ] Email decision interaction works (mock)
   - [ ] No console errors in web or desktop
   - [ ] Screenshots taken of all states

## Epic Completion Checklist

- [ ] All planned sprints completed and approved
- [ ] Complete UI shell with mock data working
- [ ] Single /focus route implemented
- [ ] Two-column layout with collapsible chat
- [ ] All time block types rendering
- [ ] Task and email UI functional
- [ ] Mock data covers all scenarios
- [ ] Responsive design works (desktop only)
- [ ] Code follows project conventions
- [ ] TypeScript types defined for all data
- [ ] No ESLint or TypeScript errors
- [ ] Tauri app builds successfully
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