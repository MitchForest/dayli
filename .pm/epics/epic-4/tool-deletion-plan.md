# Tool Deletion Plan - Day 2

## Summary
- **Current Tools**: 59 files
- **To Keep**: 19 files (will enhance)
- **To Delete**: 40 files
- **To Create**: 6 new tools

## Tools to KEEP and ENHANCE (19)

### Schedule Tools (5)
✅ `schedule/getSchedule.ts` → rename to `viewSchedule.ts`
✅ `schedule/createTimeBlock.ts` - already has AI SDK pattern
✅ `schedule/moveTimeBlock.ts`
✅ `schedule/deleteTimeBlock.ts`
✅ `schedule/completeTask.ts` → move to task directory

### Task Tools (3) 
✅ `task/createTask.ts`
✅ `task/editTask.ts` → rename to `updateTask.ts`
✅ `task/findTasks.ts` → enhance to become `viewTasks.ts`

### Email Tools (3)
✅ `email/listEmails.ts` → rename to `viewEmails.ts`
✅ `email/readEmailContent.ts` → rename to `readEmail.ts`
✅ `email/processEmailToTask.ts` → enhance to become `processEmail.ts`

### Calendar Tools (2)
✅ `calendar/scheduleMeeting.ts`
✅ `calendar/rescheduleMeeting.ts`

### Preference Tools (1)
✅ `preference/updatePreference.ts` → rename to `updatePreferences.ts`

### Workflow Tools (5)
✅ `workflow/confirmProposal.ts` → move to system directory
✅ `workflow/domain-workflows.ts` - contains 4 workflows:
   - optimizeSchedule (active)
   - triageEmails (commented out - need to fix)
   - prioritizeTasks (commented out - need to fix) 
   - optimizeCalendar (commented out - need to fix)

## Tools to DELETE (40)

### Schedule Tools (13)
❌ `schedule/assignTaskToBlock.ts` - functionality in fillWorkBlock
❌ `schedule/balanceScheduleLoad.ts`
❌ `schedule/calculateFocusTime.ts`
❌ `schedule/consolidateFragmentedTime.ts`
❌ `schedule/detectScheduleInefficiencies.ts`
❌ `schedule/ensureBreaksProtected.ts`
❌ `schedule/findBestTimeSlot.ts`
❌ `schedule/findScheduleGaps.ts`
❌ `schedule/findTimeBlock.ts`
❌ `schedule/getUnassignedTasks.ts`
❌ `schedule/optimizeTransitions.ts`
❌ `schedule/regenerateSchedule.ts`
❌ `schedule/suggestTasksForBlock.ts`

### Task Tools (10)
❌ `task/analyzeTaskPatterns.ts`
❌ `task/batchSimilarTasks.ts`
❌ `task/deleteTask.ts`
❌ `task/estimateTaskDuration.ts`
❌ `task/findTaskDependencies.ts`
❌ `task/findTasksForTimeSlot.ts`
❌ `task/getTaskBacklogHealth.ts`
❌ `task/scoreTask.ts`
❌ `task/suggestTaskOrder.ts`
❌ `task/updateTaskBacklog.ts`

### Email Tools (10)
❌ `email/analyzeSenderPatterns.ts`
❌ `email/analyzeSingleEmail.ts`
❌ `email/batchEmailsByStrategy.ts`
❌ `email/calculateEmailProcessingTime.ts`
❌ `email/draftEmailResponse.ts`
❌ `email/extractActionItems.ts`
❌ `email/findSimilarEmails.ts`
❌ `email/getEmailBacklogSummary.ts`
❌ `email/getEmailStats.ts`
❌ `email/updateEmailBacklog.ts`

### Calendar Tools (8)
❌ `calendar/analyzeMeetingPatterns.ts`
❌ `calendar/detectConflicts.ts`
❌ `calendar/findOptimalMeetingTime.ts`
❌ `calendar/handleMeetingConflict.ts`
❌ `calendar/isTimeSlotAvailable.ts`
❌ `calendar/protectTimeOnCalendar.ts`
❌ `calendar/suggestConflictResolution.ts`
❌ `calendar/suggestMeetingConsolidation.ts`

### Preference Tools (1)
❌ `preference/getPreferences.ts`

### Workflow Tools (1)
❌ `workflow/scheduleDay.ts`

## Tools to CREATE (6)

### Schedule Tools (1)
🆕 `schedule/fillWorkBlock.ts` - Intelligently fill work blocks with tasks

### Task Tools (1)
🆕 `task/viewTasks.ts` - Enhanced task listing with scores and filters

### Email Tools (1)
🆕 `email/viewEmails.ts` - Enhanced email listing with urgency
🆕 `email/processEmail.ts` - Combined draft/send/convert functionality

### System Tools (5)
🆕 `system/showWorkflowHistory.ts` - View past workflow runs
🆕 `system/resumeWorkflow.ts` - Resume interrupted workflows
🆕 `system/provideFeedback.ts` - Capture user feedback
🆕 `system/showPatterns.ts` - Display learned patterns
🆕 `system/clearContext.ts` - Reset conversation context

## Execution Order

1. **Delete all 40 tools** listed above
2. **Rename files** as specified
3. **Move files** (completeTask to task/, confirmProposal to system/)
4. **Create new directories** (system/)
5. **Enhance existing tools** with AI SDK pattern
6. **Create new tools** with full implementation
7. **Fix workflow tools** (uncomment and update 3 workflows)
8. **Update exports** in index files