# Epic 4a: LangGraph.js Workflows Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**Target End Date**: [TBD + 1 week]  
**Actual End Date**: [TBD]

**Epic Goal**: Implement LangGraph.js workflows to orchestrate intelligent email analysis, daily planning, and schedule optimization, creating the AI brain that makes dayli's decisions.

**User Stories Addressed**:
- Story 1: Morning Planning - AI creates optimal daily schedule
- Story 2: Email to Tasks - Intelligent email analysis and task extraction
- Story 3: Protected Focus Time - Smart time blocking based on patterns

**PRD Reference**: [Link to dayli PRD - Epic 4a section]

## Sprint Breakdown

| Sprint # | Sprint Name | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|--------|------------|----------|-----------------|
| 04a.00 | LangGraph.js Setup | NOT STARTED | - | - | Basic workflow infrastructure |
| 04a.01 | Email Analysis Workflow | NOT STARTED | - | - | Intelligent email triage |
| 04a.02 | Daily Planning Workflow | NOT STARTED | - | - | Schedule optimization |
| 04a.03 | Integration & Refinement | NOT STARTED | - | - | Connect workflows to UI |

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
- LangGraph.js runs in Vercel Functions (not edge)
- Stateful workflows manage multi-step decisions
- OpenAI for analysis and decision-making
- Workflows triggered by API calls from frontend

### Key Design Decisions
1. **Workflow Architecture**: Separate graphs for each major flow
   - Alternatives considered: Single monolithic workflow
   - Rationale: Easier to debug, test, and modify independently
   - Trade-offs: Some duplication but better maintainability

2. **State Management**: LangGraph's built-in state for workflow context
   - Alternatives considered: External state store, Redis
   - Rationale: Simpler, works well for request-scoped workflows
   - Trade-offs: State doesn't persist between requests

3. **OpenAI Integration**: Direct API calls within nodes
   - Alternatives considered: Separate AI service layer
   - Rationale: Keeps workflows self-contained
   - Trade-offs: OpenAI dependency in multiple places

4. **Error Handling**: Graceful degradation with fallbacks
   - Alternatives considered: Fail fast approach
   - Rationale: Users need a working schedule even if AI fails
   - Trade-offs: More complex error paths

### Dependencies
**External Dependencies**:
- @langchain/langgraph: ^0.0.20
- @langchain/openai: ^0.0.25
- openai: ^4.0.0 (already added in Epic 2)

**Internal Dependencies**:
- Requires: Gmail/Calendar data from Epic 3
- Provides: Intelligent scheduling for Epic 4b

## Implementation Notes

### File Structure for Epic
```
apps/web/
├── app/
│   └── api/
│       └── workflows/
│           ├── analyze-emails/
│           │   └── route.ts      # Trigger email analysis
│           ├── plan-day/
│           │   └── route.ts      # Trigger daily planning
│           └── optimize-schedule/
│               └── route.ts      # Trigger optimization
├── lib/
│   └── workflows/
│       ├── graphs/
│       │   ├── emailTriage.ts   # Email analysis workflow
│       │   ├── dailyPlanning.ts # Schedule creation workflow
│       │   └── optimization.ts  # Time optimization workflow
│       ├── nodes/
│       │   ├── analyzeEmail.ts  # Email importance/urgency
│       │   ├── extractTasks.ts  # Pull tasks from emails
│       │   ├── scheduleTask.ts  # Place task in time block
│       │   ├── optimizeTime.ts  # Rearrange for focus
│       │   └── protectFocus.ts  # Block calendar time
│       ├── state/
│       │   └── types.ts         # Workflow state definitions
│       └── prompts/
│           ├── emailAnalysis.ts # Prompts for email decisions
│           └── scheduling.ts    # Prompts for time decisions
└── hooks/
    └── useWorkflow.ts           # Trigger workflows from UI
```

### API Endpoints Added
| Method | Path | Purpose | Sprint |
|--------|------|---------|--------|
| POST | /api/workflows/analyze-emails | Run email triage workflow | 04a.01 |
| POST | /api/workflows/plan-day | Generate daily schedule | 04a.02 |
| POST | /api/workflows/optimize-schedule | Optimize time blocks | 04a.02 |

### Data Model Changes
```typescript
// lib/workflows/state/types.ts
interface EmailTriageState {
  emails: GmailMessage[]
  decisions: Map<string, EmailDecision>
  extractedTasks: Task[]
  errors: string[]
}

interface DailyPlanningState {
  availableTime: TimeSlot[]
  existingEvents: CalendarEvent[]
  tasksToSchedule: Task[]
  proposedSchedule: TimeBlock[]
  conflicts: Conflict[]
}

interface OptimizationState {
  currentSchedule: TimeBlock[]
  preferences: UserPreferences
  optimizedSchedule: TimeBlock[]
  focusBlocks: FocusBlock[]
}

// Workflow nodes return types
interface EmailAnalysis {
  importance: 'critical' | 'important' | 'low'
  urgency: 'immediate' | 'today' | 'later'
  hasActionItem: boolean
  suggestedAction?: string
  estimatedTime?: number
}
```

### Key Functions/Components Created
- `createEmailTriageGraph` - Main email workflow - Sprint 04a.01
- `createDailyPlanningGraph` - Schedule generation - Sprint 04a.02
- `analyzeEmailNode` - OpenAI email analysis - Sprint 04a.01
- `extractTasksNode` - Pull tasks from emails - Sprint 04a.01
- `scheduleTaskNode` - Smart task placement - Sprint 04a.02
- `optimizeScheduleNode` - Rearrange for focus - Sprint 04a.02
- `protectFocusNode` - Create calendar blocks - Sprint 04a.02

## Sprint Execution Log

### Sprint 04a.00: LangGraph.js Setup
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 04a.01: Email Analysis Workflow
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 04a.02: Daily Planning Workflow
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 04a.03: Integration & Refinement
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

## Testing & Quality

### Testing Approach
- Unit tests for individual nodes
- Integration tests for complete workflows
- Test with various email patterns
- Verify schedule optimization logic
- Test error handling and fallbacks
- Performance testing for workflow execution time

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
- **Vercel Function Timeouts**: Complex workflows need optimization
- **OpenAI Rate Limits**: Batch operations where possible
- **State Size**: Keep workflow state minimal
- [Additional gotchas to be documented]

## Build Testing & Verification

### Epic-End Build Process (MANDATORY)

Before marking Epic 4a as complete:

1. **Clean build test:**
   ```bash
   cd apps/web
   rm -rf .next node_modules/.cache
   bun install
   bun run build
   ```

2. **Workflow testing:**
   ```bash
   # Test each workflow endpoint
   # Monitor execution time
   # Verify Vercel Function size limits
   ```

3. **Run quality checks:**
   ```bash
   bun run lint      # MUST return 0 errors, 0 warnings
   bun run typecheck # MUST return 0 errors
   ```

4. **Test email workflow:**
   - Process batch of emails
   - Verify importance classification
   - Check task extraction accuracy
   - Ensure decisions match expectations

5. **Test planning workflow:**
   - Generate daily schedule
   - Verify time block allocation
   - Check focus time protection
   - Test with various constraints

6. **Verification checklist:**
   - [ ] LangGraph.js workflows execute successfully
   - [ ] Email analysis produces accurate results
   - [ ] Tasks extracted from emails correctly
   - [ ] Daily schedule generation works
   - [ ] Focus blocks created appropriately
   - [ ] Schedule optimization improves layout
   - [ ] Error handling works gracefully
   - [ ] Workflows complete within timeout
   - [ ] OpenAI costs are reasonable
   - [ ] No infinite loops in graphs
   - [ ] State management works correctly

## Epic Completion Checklist

- [ ] All planned sprints completed and approved
- [ ] Email triage workflow fully functional
- [ ] Daily planning workflow generates good schedules
- [ ] Schedule optimization improves time usage
- [ ] All workflows integrated with UI
- [ ] Performance within acceptable limits
- [ ] Error handling comprehensive
- [ ] Costs monitored and acceptable
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