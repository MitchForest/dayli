import { format } from 'date-fns';
import type { DailySchedule, DailyTask, TimeBlock } from '../types/schedule.types';
import type { EmailDecision } from '../../email/types/email.types';
import type { MockScenario } from '@/lib/constants';

// Mock task titles
const TASK_TITLES = [
  'Review Q4 strategy presentation',
  'Finalize budget proposal',
  'Update project roadmap',
  'Prepare team performance reviews',
  'Analyze competitor pricing',
  'Draft partnership agreement',
  'Review marketing campaign metrics',
  'Update investor deck',
  'Plan product launch timeline',
  'Conduct user research analysis',
];

// Mock email data
const EMAIL_SENDERS = [
  'Sarah Chen',
  'Michael Rodriguez',
  'Emily Thompson',
  'David Kim',
  'Jessica Martinez',
  'Robert Johnson',
  'Lisa Anderson',
  'James Wilson',
];

const EMAIL_SUBJECTS = [
  'Re: Q4 Budget Review',
  'Partnership Proposal - Action Required',
  'Team Meeting Follow-up',
  'Contract Review Needed',
  'Urgent: Client Feedback',
  'Project Timeline Update',
  'Weekly Report Summary',
  'New Feature Request',
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateTasks(count: number, source: DailyTask['source'] = 'ai'): DailyTask[] {
  const shuffled = [...TASK_TITLES].sort(() => 0.5 - Math.random());
  const sources: DailyTask['source'][] = ['email', 'calendar', 'ai'];
  
  return shuffled.slice(0, count).map((title, index) => ({
    id: generateId(),
    title,
    completed: false,
    // Mix up the sources for variety, but prefer the passed source
    source: index === 0 ? source : sources[Math.floor(Math.random() * sources.length)],
  }));
}

function generateEmails(count: number): EmailDecision[] {
  const emails: EmailDecision[] = [];
  for (let i = 0; i < count; i++) {
    const sender = EMAIL_SENDERS[Math.floor(Math.random() * EMAIL_SENDERS.length)] || 'Unknown Sender';
    const subject = EMAIL_SUBJECTS[Math.floor(Math.random() * EMAIL_SUBJECTS.length)] || 'No Subject';
    emails.push({
      id: generateId(),
      from: sender,
      subject,
      preview: `Hi, I wanted to follow up on our discussion about ${subject.toLowerCase()}...`,
    });
  }
  return emails;
}

function generateTimeBlocks(scenario: MockScenario): TimeBlock[] {
  switch (scenario) {
    case 'typical_day':
      return [
        {
          id: generateId(),
          startTime: '9:00 AM',
          endTime: '11:00 AM',
          type: 'focus',
          title: 'Deep Work Block',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '11:00 AM',
          endTime: '11:30 AM',
          type: 'email',
          title: 'Email Response Time',
          tasks: [],
          emailQueue: generateEmails(3),
        },
        {
          id: generateId(),
          startTime: '11:30 AM',
          endTime: '12:00 PM',
          type: 'meeting',
          title: 'Team Standup',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '12:00 PM',
          endTime: '1:00 PM',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '1:00 PM',
          endTime: '3:00 PM',
          type: 'focus',
          title: 'Afternoon Focus',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '3:00 PM',
          endTime: '3:30 PM',
          type: 'quick-decisions',
          title: 'Quick Email Decisions',
          tasks: [],
          emailQueue: generateEmails(5),
        },
        {
          id: generateId(),
          startTime: '3:30 PM',
          endTime: '5:00 PM',
          type: 'focus',
          title: 'Final Focus Block',
          tasks: generateTasks(1),
        },
      ];
      
    case 'meeting_heavy':
      return [
        {
          id: generateId(),
          startTime: '9:00 AM',
          endTime: '10:00 AM',
          type: 'meeting',
          title: 'Strategy Review',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '10:00 AM',
          endTime: '11:00 AM',
          type: 'meeting',
          title: 'Client Presentation',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '11:00 AM',
          endTime: '12:00 PM',
          type: 'focus',
          title: 'Urgent Tasks',
          tasks: generateTasks(3),
        },
        {
          id: generateId(),
          startTime: '12:00 PM',
          endTime: '1:00 PM',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '1:00 PM',
          endTime: '2:00 PM',
          type: 'meeting',
          title: 'Department Sync',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '2:00 PM',
          endTime: '3:00 PM',
          type: 'email',
          title: 'Email Catch-up',
          tasks: [],
          emailQueue: generateEmails(4),
        },
        {
          id: generateId(),
          startTime: '3:00 PM',
          endTime: '5:00 PM',
          type: 'focus',
          title: 'Project Work',
          tasks: generateTasks(2),
        },
      ];
      
    case 'focus_day':
      return [
        {
          id: generateId(),
          startTime: '9:00 AM',
          endTime: '12:00 PM',
          type: 'focus',
          title: 'Morning Deep Work',
          tasks: generateTasks(3),
        },
        {
          id: generateId(),
          startTime: '12:00 PM',
          endTime: '1:00 PM',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '1:00 PM',
          endTime: '4:00 PM',
          type: 'focus',
          title: 'Afternoon Deep Work',
          tasks: generateTasks(3),
        },
        {
          id: generateId(),
          startTime: '4:00 PM',
          endTime: '4:30 PM',
          type: 'quick-decisions',
          title: 'Email Triage',
          tasks: [],
          emailQueue: generateEmails(6),
        },
        {
          id: generateId(),
          startTime: '4:30 PM',
          endTime: '5:00 PM',
          type: 'focus',
          title: 'Wrap-up',
          tasks: generateTasks(1),
        },
      ];
      
    case 'email_heavy':
      return [
        {
          id: generateId(),
          startTime: '9:00 AM',
          endTime: '10:00 AM',
          type: 'email',
          title: 'Morning Email Processing',
          tasks: [],
          emailQueue: generateEmails(8),
        },
        {
          id: generateId(),
          startTime: '10:00 AM',
          endTime: '11:30 AM',
          type: 'focus',
          title: 'Priority Tasks',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '11:30 AM',
          endTime: '12:00 PM',
          type: 'quick-decisions',
          title: 'Quick Responses',
          tasks: [],
          emailQueue: generateEmails(5),
        },
        {
          id: generateId(),
          startTime: '12:00 PM',
          endTime: '1:00 PM',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '1:00 PM',
          endTime: '2:00 PM',
          type: 'email',
          title: 'Detailed Responses',
          tasks: [],
          emailQueue: generateEmails(4),
        },
        {
          id: generateId(),
          startTime: '2:00 PM',
          endTime: '4:00 PM',
          type: 'focus',
          title: 'Project Work',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '4:00 PM',
          endTime: '5:00 PM',
          type: 'email',
          title: 'End of Day Emails',
          tasks: [],
          emailQueue: generateEmails(5),
        },
      ];
      
    case 'light_day':
      return [
        {
          id: generateId(),
          startTime: '9:00 AM',
          endTime: '11:00 AM',
          type: 'focus',
          title: 'Morning Focus',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '11:00 AM',
          endTime: '12:00 PM',
          type: 'meeting',
          title: 'Team Check-in',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '12:00 PM',
          endTime: '1:00 PM',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '1:00 PM',
          endTime: '2:30 PM',
          type: 'focus',
          title: 'Afternoon Work',
          tasks: generateTasks(1),
        },
        {
          id: generateId(),
          startTime: '2:30 PM',
          endTime: '3:00 PM',
          type: 'break',
          title: 'Coffee Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '3:00 PM',
          endTime: '4:00 PM',
          type: 'email',
          title: 'Email Review',
          tasks: [],
          emailQueue: generateEmails(3),
        },
      ];
      
    default:
      return generateTimeBlocks('typical_day');
  }
}

export function generateMockSchedule(scenario: MockScenario = 'typical_day'): DailySchedule {
  const timeBlocks = generateTimeBlocks(scenario);
  
  // Extract all tasks from time blocks
  const allTasks = timeBlocks
    .filter(block => block.type === 'focus')
    .flatMap(block => block.tasks);
  
  // Ensure we have 3-7 tasks
  const dailyTasks = allTasks.slice(0, Math.min(7, Math.max(3, allTasks.length)));
  
  // Calculate initial stats
  const emailsProcessed = 0;
  const tasksCompleted = 0;
  const focusMinutes = timeBlocks
    .filter(block => block.type === 'focus')
    .reduce((total, block) => {
      const start = new Date(`2024-01-01 ${block.startTime}`);
      const end = new Date(`2024-01-01 ${block.endTime}`);
      return total + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);
  
  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    timeBlocks,
    dailyTasks,
    stats: {
      emailsProcessed,
      tasksCompleted,
      focusMinutes,
    },
  };
} 