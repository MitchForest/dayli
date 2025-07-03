// Re-export all tools for easy access
// Schedule tools (5)
export { viewSchedule } from './schedule/viewSchedule';
export { createTimeBlock } from './schedule/createTimeBlock';
export { moveTimeBlock } from './schedule/moveTimeBlock';
export { deleteTimeBlock } from './schedule/deleteTimeBlock';
export { fillWorkBlock as fillWorkBlockTool } from './schedule/fillWorkBlock';

// Task tools (4)
export { viewTasks } from './task/viewTasks';
export { createTask } from './task/createTask';
export { updateTask } from './task/updateTask';
export { completeTask } from './task/completeTask';

// Email tools (3)
export { viewEmails } from './email/viewEmails';
export { readEmail } from './email/readEmail';
export { processEmail } from './email/processEmail';

// Calendar tools (2)
export { scheduleMeeting } from './calendar/scheduleMeeting';
export { rescheduleMeeting } from './calendar/rescheduleMeeting';

// Preference tool (1)
export { updatePreferences } from './preference/updatePreferences';

// Workflow tools (3)
export { schedule } from './workflow/schedule';
export { fillWorkBlock } from './workflow/fillWorkBlock';
export { fillEmailBlock } from './workflow/fillEmailBlock';

// System tools (6)
export { confirmProposal } from './system/confirmProposal';
export { showWorkflowHistory } from './system/showWorkflowHistory';
export { resumeWorkflow } from './system/resumeWorkflow';
export { provideFeedback } from './system/provideFeedback';
export { showPatterns } from './system/showPatterns';
export { clearContext } from './system/clearContext';

// Export the tool registry
export { toolRegistry } from './registry'; 