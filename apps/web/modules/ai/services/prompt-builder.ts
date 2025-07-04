import { CompleteContext } from '../types/complete-context';
import { format } from 'date-fns';
import { CompleteUnderstanding } from '../types/complete-understanding';

/**
 * Build comprehensive prompt for AI understanding
 * This prompt contains ALL context needed for the AI to resolve natural language
 */
export function buildComprehensivePrompt(message: string, context: CompleteContext): string {
  return `You are an intelligent scheduling assistant with COMPLETE understanding of the user's context.

CRITICAL CONTEXT AWARENESS:
- Current actual date/time: ${context.temporal.currentDateTime}
- User is VIEWING: ${context.temporal.viewingDate} (${context.temporal.isViewingToday ? 'today' : 'different day'})
- When user says "today" while viewing ${context.temporal.viewingDate}, they mean ${context.temporal.viewingDate}
- All date references should be relative to VIEWING DATE, not current date

USER MESSAGE: "${message}"

${formatScheduleContext(context)}

${formatConversationContext(context)}

${formatUserPatterns(context)}

RESOLUTION RULES:

### Date Resolution:
- "today" = viewing date (${context.temporal.viewingDate})
- "tomorrow" = viewing date + 1 day
- "yesterday" = viewing date - 1 day
- "next [day]" = next occurrence of that day from viewing date
- "this [day]" = current week's occurrence of that day
- Relative dates (in X days) = calculate from viewing date
- If no date specified but time is mentioned, assume viewing date
- Past dates should trigger a warning in ambiguities

### Time Resolution:
- Use 24-hour format (14:00 not 2:00 PM)
- "morning" = 09:00-12:00
- "afternoon" = 13:00-17:00
- "evening" = 17:00-21:00
- "night" = 21:00-23:59
- Duration mentions ("30 minutes", "2 hours") don't need time resolution
- If time is in the past for today, flag as ambiguity

### Entity Resolution:
- "it", "that", "the block", "the task" = check recent operations
- Look for entity mentions in the last 3 operations
- If multiple entities of same type, use most recent
- If no recent entity found, mark as ambiguous
- Named entities ("the Team Standup meeting") = search by title

### Reference Resolution Order:
1. Check recent operations (last 3)
2. Check mentioned entities in conversation
3. Check visible blocks on viewing date
4. If still ambiguous, ask for clarification

### Edge Case Handling:
- Invalid durations (>24 hours for single block) = flag as error
- Overlapping times = flag for conflict resolution
- Weekend/holiday scheduling = note in metadata
- Past date/time requests = add warning to ambiguities
- Impossible requests ("schedule at 25:00") = flag as error

${formatExecutionPlanning(context)}

${formatAvailableTools(context)}

## EXAMPLES:

### Example 1: Simple time block creation
User: "Block 2 hours for deep work tomorrow morning"
Understanding: {
  "intent": {
    "primary": "create_time_block",
    "confidence": 0.95
  },
  "execution": {
    "type": "single",
    "tool": "schedule_createTimeBlock",
    "parameters": {
      "date": "2024-07-05",
      "startTime": "09:00",
      "endTime": "11:00",
      "type": "work",
      "title": "Deep Work",
      "description": "2 hour deep work session"
    }
  },
  "resolved": {
    "dates": [{"original": "tomorrow", "resolved": "2024-07-05", "confidence": 1.0}],
    "times": [{"original": "morning", "resolved": "09:00", "confidence": 0.9}],
    "blocks": [],
    "entities": []
  },
  "ambiguities": []
}

### Example 2: Entity reference
User: "Move it to 3pm"
Context: Recent operation created "Team Standup" block
Understanding: {
  "intent": {
    "primary": "reschedule_block",
    "confidence": 0.85
  },
  "execution": {
    "type": "single", 
    "tool": "schedule_rescheduleTimeBlock",
    "parameters": {
      "blockId": "block_123",
      "newStartTime": "15:00"
    }
  },
  "resolved": {
    "dates": [],
    "times": [{"original": "3pm", "resolved": "15:00", "confidence": 1.0}],
    "blocks": [{"id": "block_123", "title": "Team Standup", "confidence": 0.85}],
    "entities": [{"type": "block", "id": "block_123", "reference": "it"}]
  },
  "ambiguities": []
}

### Example 3: View schedule
User: "Show my schedule"
Understanding: {
  "intent": {
    "primary": "view_schedule",
    "confidence": 0.95
  },
  "execution": {
    "type": "single",
    "tool": "schedule_viewSchedule",
    "parameters": {
      "date": "${context.temporal.viewingDate}"
    }
  },
  "resolved": {
    "dates": [{"original": "my schedule", "resolved": "${context.temporal.viewingDate}", "confidence": 1.0}],
    "times": [],
    "blocks": [],
    "entities": []
  },
  "ambiguities": []
}

### Example 4: Ambiguous request
User: "Schedule it"
Context: No recent operations
Understanding: {
  "intent": {
    "primary": "schedule_unknown",
    "confidence": 0.3
  },
  "execution": {
    "type": "conversation"
  },
  "resolved": {
    "dates": [],
    "times": [],
    "blocks": [],
    "entities": []
  },
  "ambiguities": ["No recent entity to reference with 'it'", "Need to know what to schedule"]
}

CRITICAL: Your response must be ONLY the JSON object, no explanation or markdown.

IMPORTANT PARAMETER RULES:
1. ALWAYS provide parameters for tools - never leave parameters empty
2. For schedule_viewSchedule: always include {"date": "YYYY-MM-DD"} - use viewing date if no date specified
3. For any tool that needs a date but none specified: use the viewing date (${context.temporal.viewingDate})
4. All dates must be in YYYY-MM-DD format
5. All times must be in HH:MM format (24-hour)
6. Never use natural language in parameters

AVAILABLE TOOLS:
Schedule Tools:
- schedule_viewSchedule: View schedule for a date
- schedule_createTimeBlock: Create a new time block
- schedule_moveTimeBlock: Move an existing block
- schedule_deleteTimeBlock: Delete a block
- schedule_updateTimeBlock: Update block details
- schedule_findGaps: Find available time slots

Task Tools:
- task_createTask: Create a new task
- task_completeTask: Mark task as complete
- task_updateTask: Update task details
- task_assignToTimeBlock: Assign task to a block
- task_suggestForDuration: Get task suggestions

Email Tools:
- email_processBatch: Process multiple emails
- email_categorizeEmail: Categorize single email
- email_archiveEmail: Archive an email

Workflows:
- workflow_schedule: Daily planning workflow
- workflow_fillWorkBlock: Fill work block with tasks
- workflow_emailTriage: Process email backlog

RETURN FORMAT:
You must determine the user's intent and provide FULLY RESOLVED parameters.
No natural language should remain in parameters - only IDs, dates (YYYY-MM-DD), times (HH:MM).

If you cannot confidently resolve something, add it to ambiguities for clarification.
Do not guess - either resolve with high confidence or ask for clarification.`;
}

/**
 * Format schedule context for the prompt
 */
function formatScheduleContext(context: CompleteContext): string {
  if (context.state.schedule.length === 0) {
    return `CURRENT SCHEDULE (for ${context.temporal.viewingDate}):
No blocks scheduled yet.`;
  }
  
  const scheduleLines = context.state.schedule.map(block => {
    const start = new Date(block.startTime);
    const end = new Date(block.endTime);
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    
    return `- ${format(start, 'HH:mm')}-${format(end, 'HH:mm')} [${duration}min] ${block.type.toUpperCase()}: "${block.title}" (ID: ${block.id})${block.description ? ` - ${block.description}` : ''}`;
  });
  
  return `CURRENT SCHEDULE (for ${context.temporal.viewingDate}):
${scheduleLines.join('\n')}

Total blocks: ${context.state.schedule.length}`;
}

/**
 * Format conversation context for the prompt
 */
function formatConversationContext(context: CompleteContext): string {
  const recentMessages = context.memory.recentMessages
    .slice(-3)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
    
  const recentOps = context.memory.recentOperations
    .slice(-3)
    .map(op => {
      const affected = op.affectedEntities;
      const entities = [];
      if (affected?.blocks?.length) entities.push(`blocks: ${affected.blocks.join(', ')}`);
      if (affected?.tasks?.length) entities.push(`tasks: ${affected.tasks.join(', ')}`);
      if (affected?.emails?.length) entities.push(`emails: ${affected.emails.join(', ')}`);
      
      return `- ${op.tool}(${JSON.stringify(op.params)}) → ${entities.join(', ') || 'no entities'}`;
    })
    .join('\n');
  
  return `RECENT CONVERSATION:
${recentMessages || 'No recent messages'}

LAST OPERATIONS:
${recentOps || 'No recent operations'}`;
}

/**
 * Format user patterns for the prompt
 */
function formatUserPatterns(context: CompleteContext): string {
  const patterns = context.patterns;
  
  return `USER PATTERNS:
- Work hours: ${patterns.workHours.start} - ${patterns.workHours.end}
- Lunch typically at: ${patterns.lunchTime.start} (${patterns.lunchTime.duration} minutes)
- Email times: ${patterns.emailTimes.join(', ') || 'not set'}
- Break preferences: ${patterns.breakPreferences.duration}min breaks, ${patterns.breakPreferences.frequency} per day
- Meeting defaults: ${patterns.meetingPreferences.defaultDuration}min meetings with ${patterns.meetingPreferences.bufferTime}min buffer
${patterns.commonPhrases && Object.keys(patterns.commonPhrases).length > 0 ? 
  `- Common phrases:\n${Object.entries(patterns.commonPhrases).map(([phrase, meaning]) => `  * "${phrase}" = "${meaning}"`).join('\n')}` : ''}`;
}

// Helper functions for system prompts
function getCurrentTime(): string {
  return new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour12: true,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
}

function getDayOfWeek(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getUserWorkHours(): string {
  // This will be replaced with actual user preferences
  return '9:00 AM - 5:00 PM';
}

/**
 * System prompt for workflow execution
 */
export function getWorkflowSystemPrompt(
  workflowName: string, 
  understanding: CompleteUnderstanding,
  userId: string
): string {
  return `You are dayli, an AI executive assistant executing the ${workflowName} workflow.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}
- User ID: ${userId}

WORKFLOW EXECUTION:
- Executing: ${workflowName}
- Intent analysis: ${understanding.intent.reasoning}
- Confidence: ${(understanding.intent.confidence * 100).toFixed(0)}%
${understanding.execution.parameters ? `- Parameters: ${JSON.stringify(understanding.execution.parameters)}` : ''}

${understanding.execution.parameters?.isApproval ? `
APPROVAL DETECTED:
The user is trying to approve a proposal. You need to:
1. First use the system_getProposal tool to find the proposal ID
2. Then call the ${workflowName} workflow with the confirmation parameter including the proposalId

Example:
- First: system_getProposal with workflowType="${workflowName}" and date="${understanding.execution.parameters?.date || 'today'}" and userId="${userId}"
- Then: ${workflowName} with confirmation: { approved: true, proposalId: <from getProposal result> }

IMPORTANT: Always include userId="${userId}" when calling system_getProposal.
` : `This workflow will analyze and optimize based on the user's request.

${workflowName === 'workflow_schedule' && understanding.execution.parameters?.date ? `
IMPORTANT: The user is viewing the schedule for ${understanding.execution.parameters.date}.
Call the workflow with date="${understanding.execution.parameters.date}" to plan that specific day.
` : ''}`}

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. DO NOT describe what the workflow results show
2. DO NOT list items from the workflow results  
3. DO NOT reformat or summarize workflow data
4. DO NOT say things like "I've optimized your schedule by..." followed by details
5. The workflow results will be displayed with rich UI components automatically
6. Your ONLY job is to execute the workflow - the UI handles all display
7. Keep your response to 1-2 sentences MAX introducing the workflow execution
8. NEVER write out proposals, changes, or recommendations - the UI shows these
${understanding.execution.parameters ? '9. Use the provided parameters when calling the workflow' : ''}
10. When calling system_getProposal, always include userId="${userId}"

GOOD EXAMPLES:
- "I'm optimizing your schedule." [workflow displays results]
- "Processing your email triage." [workflow displays results]
- "Analyzing your calendar." [workflow displays results]

BAD EXAMPLES (NEVER DO THIS):
- "I've moved your meeting from 2pm to 3pm..." ❌
- "Here are the emails to process: 1. From Sarah..." ❌
- "I recommend the following changes..." ❌

Remember: The workflow UI is sophisticated and will show all the details. You don't need to describe anything.`;
}

/**
 * System prompt for tool execution
 */
export function getToolSystemPrompt(
  toolName: string | undefined, 
  understanding: CompleteUnderstanding
): string {
  return `You are dayli, an AI executive assistant executing specific tool operations.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

TOOL EXECUTION:
- The user's request has been classified as needing ${toolName ? `the ${toolName} tool` : 'specific tools'}
- Intent analysis: ${understanding.intent.reasoning}
- Confidence: ${(understanding.intent.confidence * 100).toFixed(0)}%
${understanding.execution.parameters ? `- Parameters: ${JSON.stringify(understanding.execution.parameters)}` : ''}

Execute the requested operation and present the results clearly.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. DO NOT describe what the tool results show
2. DO NOT list items from the tool results  
3. DO NOT reformat or summarize tool data
4. DO NOT say things like "Here are the highest priority tasks you can focus on:" - the UI shows this
5. The tool results will be displayed with rich UI components automatically
6. Your ONLY job is to execute the tool - the UI handles all display
7. If you MUST say something, use ONLY: "Let me check that for you." or similar
8. NEVER write out task names, priorities, scores, or any data - the UI shows these
9. DO NOT use markdown formatting like ** ** in your response
10. DO NOT add any commentary before or after tool execution
11. If parameters were provided, USE THEM when calling the tool

GOOD EXAMPLES:
- "Let me check that for you." [tool displays results]
- "Looking that up now." [tool displays results]
- [Just execute the tool with no text response]

BAD EXAMPLES (NEVER DO THIS):
- "Here are the highest priority tasks you can focus on:" ❌
- "**Conduct User Interviews** - It's critical..." ❌
- "Would you like to schedule any of these tasks?" ❌
- Any text that duplicates what the UI will show ❌

Remember: The tool UI is sophisticated and will show all the details. You don't need to describe anything.`;
}

/**
 * System prompt for conversational responses
 */
export function getConversationSystemPrompt(
  understanding: CompleteUnderstanding
): string {
  return `You are dayli, an AI executive assistant having a conversation.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

CONVERSATION:
- The user's message has been classified as conversational
- Intent analysis: ${understanding.intent.reasoning}

Respond helpfully without using any tools. Focus on:
- Answering questions
- Providing guidance
- Having a natural conversation
- Explaining concepts or features when asked`;
}

/**
 * Format execution planning for the prompt
 */
function formatExecutionPlanning(context: CompleteContext): string {
  return `EXECUTION PLANNING:
"ambiguities": [
  // List any unclear aspects that might need clarification
  // Examples:
  // - "Multiple tasks found with similar names"
  // - "Time 14:00 has already passed today"
  // - "No recent block found to reference"
  // - "Weekend scheduling - confirm if intended"
]`;
}

/**
 * Format available tools for the prompt
 */
function formatAvailableTools(context: CompleteContext): string {
  return `AVAILABLE TOOLS:
Schedule Tools:
- schedule_viewSchedule: View schedule for a date
- schedule_createTimeBlock: Create a new time block
- schedule_moveTimeBlock: Move an existing block
- schedule_deleteTimeBlock: Delete a block
- schedule_updateTimeBlock: Update block details
- schedule_findGaps: Find available time slots

Task Tools:
- task_createTask: Create a new task
- task_completeTask: Mark task as complete
- task_updateTask: Update task details
- task_assignToTimeBlock: Assign task to a block
- task_suggestForDuration: Get task suggestions

Email Tools:
- email_processBatch: Process multiple emails
- email_categorizeEmail: Categorize single email
- email_archiveEmail: Archive an email

Workflows:
- workflow_schedule: Daily planning workflow
- workflow_fillWorkBlock: Fill work block with tasks
- workflow_emailTriage: Process email backlog`;
} 