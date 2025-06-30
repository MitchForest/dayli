# Sprint 01.02: Tasks & Email Decisions Tracker

## Sprint Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**End Date**: [TBD]  
**Epic**: Epic 1 - App Shell & Beautiful UI

**Sprint Goal**: Implement task display within time blocks and create the email decision interface, bringing interactivity to the schedule with mock data.

**User Story Contribution**: 
- Completes Story 1: Morning Planning - Interactive tasks within time blocks
- Delivers Story 4: Quick Decisions - Email decision card UI with Now/Tomorrow/Never actions

## 🚨 Required Development Practices

### Database Management
- **Use Supabase MCP** to inspect current database state: `mcp_supabase_get_schemas`, `mcp_supabase_get_tables`, etc.
- **Keep types synchronized**: Run type generation after ANY schema changes
- **Migration files required**: Every database change needs a migration file
- **Test migrations**: Ensure migrations run cleanly on fresh database

### UI/UX Consistency
- **Use existing UI components**: From `@/components/ui` and `@repo/ui`
- **Follow Tailwind patterns**: Use consistent spacing and color tokens
- **Standard spacing**: Use Tailwind's spacing scale (space-4, gap-2, etc.)
- **Colors**: Use CSS variables from globals.css

### Code Quality
- **Zero tolerance**: No lint errors, no TypeScript errors
- **Type safety**: No `any` types without explicit justification
- **Run before handoff**: `bun run lint && bun run typecheck`

## Sprint Plan

### Objectives
1. Create TaskItem component with checkbox and completion animations
2. Integrate tasks into Focus blocks (3-7 tasks total per day)
3. Build email decision card interface with swipe-like interactions
4. Implement email queue display within Email blocks
5. Add daily stats display showing progress
6. Connect all interactions to Zustand stores

### Files to Create
| File Path | Purpose | Status |
|-----------|---------|--------|
| `apps/web/modules/schedule/components/TaskItem.tsx` | Individual task with checkbox | NOT STARTED |
| `apps/web/modules/schedule/components/TaskList.tsx` | Task container within blocks | NOT STARTED |
| `apps/web/modules/schedule/components/DailyStats.tsx` | Stats bar at top of schedule | NOT STARTED |
| `apps/web/modules/email/components/EmailDecisionCard.tsx` | Single email decision UI | NOT STARTED |
| `apps/web/modules/email/components/EmailQueue.tsx` | Stack of emails in block | NOT STARTED |
| `apps/web/modules/email/components/DecisionButtons.tsx` | Now/Tomorrow/Never buttons | NOT STARTED |
| `apps/web/modules/email/components/EmailCounter.tsx` | Shows remaining emails | NOT STARTED |
| `apps/web/modules/schedule/hooks/useTaskActions.ts` | Task completion logic | NOT STARTED |
| `apps/web/modules/email/hooks/useEmailActions.ts` | Email decision logic | NOT STARTED |

### Files to Modify  
| File Path | Changes Needed | Status |
|-----------|----------------|--------|
| `apps/web/modules/schedule/components/FocusBlock.tsx` | Add TaskList component | NOT STARTED |
| `apps/web/modules/schedule/components/EmailBlock.tsx` | Add EmailQueue component | NOT STARTED |
| `apps/web/modules/schedule/components/DaySchedule.tsx` | Add DailyStats at top | NOT STARTED |
| `apps/web/modules/schedule/store/scheduleStore.ts` | Add task actions | NOT STARTED |
| `apps/web/modules/email/store/emailStore.ts` | Add email actions | NOT STARTED |

### Implementation Approach
1. **Task Components**: Build TaskItem with smooth checkbox animations
2. **Task Integration**: Add tasks to Focus blocks with proper layout
3. **Email Cards**: Create swipeable-feel decision cards
4. **Decision Flow**: Implement Now/Tomorrow/Never with visual feedback
5. **Stats Display**: Minimal progress indicators
6. **Store Actions**: Connect all interactions to update state

**Key Technical Decisions**:
- **Checkbox animations**: CSS transitions for smooth completion
- **Card stack design**: Emails stack with slight offset for depth
- **Optimistic updates**: Immediate UI feedback before store updates
- **Limited tasks**: Enforce 3-7 task limit in mock data

### Dependencies & Risks
**Dependencies**:
- Sprint 01.00 & 01.01 completion
- lucide-react for icons
- Existing UI components

**Identified Risks**:
- **Animation performance**: Multiple simultaneous animations - Mitigation: Use CSS transforms, not layout changes
- **State complexity**: Task/email state updates - Mitigation: Clear action patterns in stores
- **Visual hierarchy**: Tasks within blocks - Mitigation: Careful spacing and typography

## Implementation Log

### Day-by-Day Progress
**[Date]**:
- Started: [What was begun]
- Completed: [What was finished]
- Blockers: [Any issues]
- Decisions: [Any changes to plan]

### Reality Checks & Plan Updates

**Reality Check 1** - [Date]
- Issue: [What wasn't working]
- Options Considered:
  1. [Option 1] - Pros/Cons
  2. [Option 2] - Pros/Cons
- Decision: [What was chosen]
- Plan Update: [How sprint plan changed]
- Epic Impact: [Any epic updates needed]

### Code Quality Checks

**Linting Results**:
- [ ] Initial run: [X errors, Y warnings]
- [ ] Final run: [Should be 0 errors, 0 warnings]

**Type Checking Results**:
- [ ] Initial run: [X errors]
- [ ] Final run: [Should be 0 errors]

**Build Results**:
- [ ] Development build passes
- [ ] Production build passes

## Key Code Additions

### New Functions/Components
```typescript
// TaskItem component
// Purpose: Individual task with checkbox and title
// Features: Smooth completion animation, source icon

// EmailDecisionCard component
// Purpose: Single email for triage decision
// Features: Preview text, sender info, decision buttons

// useTaskActions()
// Purpose: Provides completeTask, uncompleteTask actions
// Used by: TaskItem component

// useEmailActions()
// Purpose: Provides processEmail action
// Used by: EmailDecisionCard
```

### API Endpoints Implemented
| Method | Path | Request | Response | Status |
|--------|------|---------|----------|--------|
| N/A | Mock only | - | - | - |

### State Management
- Task completion state in scheduleStore
- Email queue and decisions in emailStore
- Stats calculated from both stores

## Testing Performed

### Manual Testing
- [ ] Tasks display within focus blocks
- [ ] Checkbox interaction works smoothly
- [ ] Task strike-through on completion
- [ ] Email cards display in email blocks
- [ ] Decision buttons trigger animations
- [ ] Stats update on interactions
- [ ] 3-7 task limit enforced
- [ ] Source icons display correctly

### Edge Cases Considered
- All tasks completed
- No tasks for the day
- Single email vs multiple emails
- Very long task titles
- Very long email subjects
- Rapid clicking on checkboxes
- Rapid email decisions

## Documentation Updates

- [ ] Task interaction flow documented
- [ ] Email decision flow documented
- [ ] Animation timing documented
- [ ] Store action patterns documented

## Handoff to Reviewer

### What Was Implemented
[To be completed during sprint execution]

### Files Modified/Created
**Created**:
[To be listed during sprint execution]

**Modified**:
[To be listed during sprint execution]

### Key Decisions Made
[To be documented during sprint execution]

### Deviations from Original Plan
[To be documented if any occur]

### Known Issues/Concerns
[To be documented during sprint execution]

### Suggested Review Focus
- Animation performance
- Interaction responsiveness
- Visual hierarchy within blocks
- State update patterns

**Sprint Status**: NOT STARTED

---

## Reviewer Section

**Reviewer**: [R persona]  
**Review Date**: [Date]

### Review Checklist
- [ ] Code matches sprint objectives
- [ ] All planned files created/modified
- [ ] Follows established patterns
- [ ] No unauthorized scope additions
- [ ] Code is clean and maintainable
- [ ] No obvious bugs or issues
- [ ] Integrates properly with existing code

### Review Outcome

**Status**: NOT REVIEWED

### Feedback
[To be completed during review]

### Post-Review Updates
[To be completed if needed]

---

## Sprint Metrics

**Duration**: Planned 3 hours | Actual [TBD]  
**Scope Changes**: [To be tracked]  
**Review Cycles**: [To be tracked]  
**Files Touched**: ~14  
**Lines Added**: ~[Estimate]  
**Lines Removed**: ~[Estimate]

## Learnings for Future Sprints

[To be documented at sprint completion]

---

*Sprint Started: [Date]*  
*Sprint Completed: [Date]*  
*Final Status: NOT STARTED* 