/**
 * Test scenarios for AI understanding validation
 * These represent real user inputs that our system must handle correctly
 */

import { CompleteContext } from '../types/complete-context';

export interface TestScenario {
  id: string;
  category: 'date' | 'time' | 'entity' | 'workflow' | 'ambiguous';
  input: string;
  context: {
    viewingDate: string;
    currentTime: string;
    hasRecentOperations?: boolean;
    recentBlockTitle?: string;
    recentTaskTitle?: string;
  };
  expected: {
    intent: string;
    tool?: string;
    workflow?: string;
    resolvedDates?: string[];
    resolvedTimes?: string[];
    resolvedEntities?: string[];
    confidence: number;
  };
}

export const testScenarios: TestScenario[] = [
  // Date Resolution Scenarios
  {
    id: 'date-1',
    category: 'date',
    input: 'Schedule a meeting tomorrow at 2pm',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'schedule_meeting',
      tool: 'calendar_scheduleMeeting',
      resolvedDates: ['2024-07-05'],
      resolvedTimes: ['14:00'],
      confidence: 0.95,
    },
  },
  {
    id: 'date-2',
    category: 'date',
    input: 'Show me next Monday',
    context: {
      viewingDate: '2024-07-04', // Thursday
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'view_schedule',
      tool: 'schedule_viewSchedule',
      resolvedDates: ['2024-07-08'],
      confidence: 0.95,
    },
  },
  {
    id: 'date-3',
    category: 'date',
    input: 'Create a work block this afternoon',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'create_time_block',
      tool: 'schedule_createTimeBlock',
      resolvedDates: ['2024-07-04'],
      resolvedTimes: ['13:00', '17:00'], // afternoon range
      confidence: 0.85,
    },
  },

  // Time Resolution Scenarios
  {
    id: 'time-1',
    category: 'time',
    input: 'Block 30 minutes for email',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'create_time_block',
      tool: 'schedule_createTimeBlock',
      confidence: 0.9,
    },
  },
  {
    id: 'time-2',
    category: 'time',
    input: 'Extend the 2pm meeting by an hour',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'update_time_block',
      tool: 'schedule_updateTimeBlock',
      resolvedTimes: ['14:00'],
      confidence: 0.9,
    },
  },

  // Entity Reference Scenarios
  {
    id: 'entity-1',
    category: 'entity',
    input: 'Move it to 3pm',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
      hasRecentOperations: true,
      recentBlockTitle: 'Team Standup',
    },
    expected: {
      intent: 'reschedule_block',
      tool: 'schedule_rescheduleTimeBlock',
      resolvedTimes: ['15:00'],
      resolvedEntities: ['recent_block'],
      confidence: 0.8,
    },
  },
  {
    id: 'entity-2',
    category: 'entity',
    input: 'Mark that as complete',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
      hasRecentOperations: true,
      recentTaskTitle: 'Review PR #123',
    },
    expected: {
      intent: 'complete_task',
      tool: 'task_completeTask',
      resolvedEntities: ['recent_task'],
      confidence: 0.85,
    },
  },
  {
    id: 'entity-3',
    category: 'entity',
    input: 'Add "prepare slides" to the meeting block',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'add_task_to_block',
      tool: 'task_createTask',
      confidence: 0.9,
    },
  },

  // Workflow Scenarios
  {
    id: 'workflow-1',
    category: 'workflow',
    input: 'Plan my day',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T06:00:00Z',
    },
    expected: {
      intent: 'daily_planning',
      workflow: 'workflow_dailyPlanning',
      resolvedDates: ['2024-07-04'],
      confidence: 0.95,
    },
  },
  {
    id: 'workflow-2',
    category: 'workflow',
    input: 'Triage my emails',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
    },
    expected: {
      intent: 'email_triage',
      workflow: 'workflow_emailTriage',
      confidence: 0.95,
    },
  },
  {
    id: 'workflow-3',
    category: 'workflow',
    input: 'Fill this work block with tasks',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
      hasRecentOperations: true,
      recentBlockTitle: 'Deep Work',
    },
    expected: {
      intent: 'fill_work_block',
      workflow: 'workflow_fillWorkBlock',
      resolvedEntities: ['recent_block'],
      confidence: 0.9,
    },
  },

  // Ambiguous Scenarios
  {
    id: 'ambiguous-1',
    category: 'ambiguous',
    input: 'Schedule it',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
      hasRecentOperations: false,
    },
    expected: {
      intent: 'unclear',
      confidence: 0.3,
    },
  },
  {
    id: 'ambiguous-2',
    category: 'ambiguous',
    input: 'Move the thing to next week',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
      hasRecentOperations: false,
    },
    expected: {
      intent: 'reschedule',
      resolvedDates: ['2024-07-08', '2024-07-12'], // week range
      confidence: 0.5,
    },
  },
  {
    id: 'ambiguous-3',
    category: 'ambiguous',
    input: 'Make it longer',
    context: {
      viewingDate: '2024-07-04',
      currentTime: '2024-07-04T10:00:00Z',
      hasRecentOperations: true,
      recentBlockTitle: 'Lunch Break',
    },
    expected: {
      intent: 'extend_duration',
      resolvedEntities: ['recent_block'],
      confidence: 0.7,
    },
  },
];

/**
 * Complex multi-step scenarios
 */
export const complexScenarios = [
  {
    id: 'complex-1',
    description: 'User views July 4th but asks about relative dates',
    steps: [
      {
        input: 'Show me tomorrow',
        expectedDate: '2024-07-05',
      },
      {
        input: 'Schedule a meeting at 2pm',
        expectedDate: '2024-07-05', // Should remember we're looking at tomorrow
        expectedTime: '14:00',
      },
      {
        input: 'Actually make it 3pm on Monday',
        expectedDate: '2024-07-08', // Next Monday from July 4th
        expectedTime: '15:00',
      },
    ],
  },
  {
    id: 'complex-2',
    description: 'Workflow followed by modifications',
    steps: [
      {
        input: 'Plan my day',
        expectedWorkflow: 'workflow_dailyPlanning',
      },
      {
        input: 'Move the first work block to 10am',
        expectedTool: 'schedule_rescheduleTimeBlock',
        expectedTime: '10:00',
      },
      {
        input: 'Extend it by 30 minutes',
        expectedTool: 'schedule_updateTimeBlock',
      },
    ],
  },
];

/**
 * Edge cases that should be handled gracefully
 */
export const edgeCases = [
  {
    id: 'edge-1',
    input: 'Schedule a meeting yesterday',
    note: 'Past date - should warn or adjust',
  },
  {
    id: 'edge-2',
    input: 'Create a 25 hour work block',
    note: 'Invalid duration - should handle gracefully',
  },
  {
    id: 'edge-3',
    input: 'Move all my meetings to never',
    note: 'Nonsensical request - should ask for clarification',
  },
  {
    id: 'edge-4',
    input: 'Schedule something at midnight',
    note: 'Edge of day boundary',
  },
  {
    id: 'edge-5',
    input: 'Book the entire weekend',
    note: 'Multi-day block request',
  },
]; 