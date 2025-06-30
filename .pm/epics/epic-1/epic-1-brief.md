# Epic 1: App Shell & Beautiful UI Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**Target End Date**: [TBD + 1 week]  
**Actual End Date**: [TBD]

**Epic Goal**: Build the complete dayli UI with mock data, establishing the visual design and user experience before adding backend complexity.

**User Stories Addressed**:
- Story 1: Morning Planning - UI shows 3-7 tasks in time blocks (visual only)
- Story 3: Protected Focus Time - Visual representation of blocked calendar time
- Story 4: Quick Decisions - Email decision card UI (non-functional)
- Story 5: AI Assistant Control - Chat interface UI (non-functional)

**PRD Reference**: [Link to dayli PRD - Epic 1 section]

## Sprint Breakdown

| Sprint # | Sprint Name | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|--------|------------|----------|-----------------|
| 01.00 | Infrastructure/Setup | NOT STARTED | - | - | Turborepo + Tauri + Next.js setup |
| 01.01 | Core Layout & Time Blocks | NOT STARTED | - | - | Two-column layout with schedule view |
| 01.02 | Task & Email UI | NOT STARTED | - | - | Task display and email decision cards |
| 01.03 | Chat UI & Polish | NOT STARTED | - | - | Chat interface and visual polish |

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
- **Web app contains ALL functionality** - desktop is just a Tauri wrapper
- Next.js web app with two-column layout: Schedule (left) + Chat (right)
- Mock data service to simulate all backend responses
- Tailwind CSS for consistent styling
- Desktop app simply loads the web app (localhost in dev, embedded in production)

### Key Design Decisions
1. **Module Location**: All modules live in the web app
   - Alternatives considered: Splitting between desktop/web
   - Rationale: Single source of truth, no duplication
   - Trade-offs: Desktop app has minimal code but that's good

2. **UI Framework**: Next.js App Router with Tailwind CSS
   - Alternatives considered: Remix, vanilla React
   - Rationale: Best for both web and desktop deployment
   - Trade-offs: Slightly larger bundle vs better DX

3. **State Management**: Zustand for local state (today's schedule only)
   - Alternatives considered: Redux, Context API
   - Rationale: Simple, lightweight, perfect for limited state
   - Trade-offs: Less powerful than Redux but we don't need it

4. **Mock Data Structure**: TypeScript interfaces matching future API
   - Alternatives considered: JSON files, faker.js
   - Rationale: Type safety from day 1
   - Trade-offs: More setup work but prevents future bugs

### Dependencies
**External Dependencies**:
- next: ^14.0.0 (in web app)
- tailwindcss: ^3.4.0 (in web app)
- zustand: ^4.4.0 (in web app)
- date-fns: ^3.0.0 (in web app)
- @tauri-apps/api: ^1.5.0 (in desktop app only)

**Internal Dependencies**:
- Requires: None (first epic)
- Provides: Complete UI in web app that desktop wraps

## Implementation Notes

### File Structure for Epic
```
apps/
├── web/                          # ALL APPLICATION LOGIC LIVES HERE
│   ├── app/
│   │   ├── layout.tsx           # Two-column layout
│   │   ├── page.tsx             # Main schedule view
│   │   ├── globals.css          # Tailwind setup
│   │   └── api/                 # Future API routes (Epic 4)
│   ├── components/
│   │   ├── schedule/            # Schedule module
│   │   │   ├── TimeBlock.tsx
│   │   │   ├── DayView.tsx
│   │   │   └── TaskItem.tsx
│   │   ├── email/               # Email module
│   │   │   └── EmailDecision.tsx
│   │   ├── chat/                # Chat module
│   │   │   └── ChatInterface.tsx
│   │   └── shared/              # Shared components
│   ├── lib/
│   │   ├── mock-data.ts         # All mock data
│   │   └── types.ts             # TypeScript interfaces
│   └── store/
│       └── schedule.ts          # Zustand store
│
├── desktop/                      # MINIMAL - JUST A WRAPPER
│   ├── src-tauri/               # Tauri configuration
│   │   ├── tauri.conf.json      # Points to web app
│   │   └── src/
│   │       └── main.rs          # Basic window setup
│   └── index.html               # Loads localhost:3000 in dev
│
└── packages/
    ├── ui/                      # Shared between web/desktop if needed
    └── types/                   # Shared TypeScript types
```

**Important Architecture Note**: 
The desktop app is just a native window that displays the web app. In development, it loads `localhost:3000`. In production, the web app is bundled and embedded. This means:
- All features are built in the web app
- Desktop app has no business logic
- Same codebase works for both desktop and web deployment

### API Endpoints Added
| Method | Path | Purpose | Sprint |
|--------|------|---------|--------|
| N/A | Mock only | No real APIs in Epic 1 | - |

### Data Model Changes
```typescript
// lib/types.ts
interface DailyTask {
  id: string
  title: string
  completed: boolean
  source?: 'email' | 'calendar' | 'ai'
}

interface TimeBlock {
  id: string
  startTime: string  // "9:00 AM"
  endTime: string    // "11:00 AM"
  type: 'focus' | 'meeting' | 'email' | 'quick-decisions' | 'break'
  title: string
  tasks: DailyTask[]
}

interface DailySchedule {
  date: string
  timeBlocks: TimeBlock[]
  dailyTasks: DailyTask[]  // The 3-7 for the day
  stats: {
    emailsProcessed: number
    tasksDeferred: number
    focusMinutes: number
  }
}
```

### Key Functions/Components Created
- `DayView` - Main schedule container - Sprint 01.01
- `TimeBlock` - Individual time block display - Sprint 01.01
- `TaskItem` - Task with checkbox - Sprint 01.02
- `EmailDecision` - Email triage card - Sprint 01.02
- `ChatInterface` - Chat UI shell - Sprint 01.03
- `useMockSchedule` - Hook for mock data - Sprint 01.01

## Sprint Execution Log

### Sprint 01.00: Infrastructure/Setup
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 01.01: Core Layout & Time Blocks
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 01.02: Task & Email UI
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 01.03: Chat UI & Polish
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

## Testing & Quality

### Testing Approach
- Visual testing with Storybook for components
- Manual testing of Tauri app on Mac/Windows
- Mock data covers all edge cases (empty day, full day, etc.)

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
   cd apps/desktop
   rm -rf .next node_modules/.cache
   bun install
   bun run build
   ```

2. **Tauri wrapper test:**
   ```bash
   # Start web app first
   cd apps/web
   bun dev
   
   # In another terminal, start desktop app
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

3. **Run quality checks:**
   ```bash
   bun run lint      # MUST return 0 errors, 0 warnings
   bun run typecheck # MUST return 0 errors
   ```

4. **Test on platforms:**
   ```bash
   # Development mode
   bun tauri dev
   
   # Production build
   bun tauri build
   ```

5. **Verification checklist:**
   - [ ] Web app runs correctly at localhost:3000
   - [ ] Desktop app loads web app properly
   - [ ] App launches without crashes on macOS
   - [ ] App launches without crashes on Windows
   - [ ] All time blocks render correctly
   - [ ] Tasks display within blocks
   - [ ] Email cards show properly
   - [ ] Chat UI is visible
   - [ ] No console errors in web or desktop
   - [ ] Same UI works in both browser and desktop app
   - [ ] Screenshots taken of both web and desktop versions

## Epic Completion Checklist

- [ ] All planned sprints completed and approved
- [ ] Complete UI shell with mock data working
- [ ] All components render correctly
- [ ] Responsive design works at different window sizes
- [ ] Code follows project conventions
- [ ] TypeScript types defined for all data structures
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