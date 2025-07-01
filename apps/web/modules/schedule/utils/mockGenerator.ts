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

// Realistic meeting names
const MEETING_TITLES = {
  standup: ['Daily Standup', 'Team Standup', 'Engineering Standup', 'Morning Sync'],
  oneOnOne: ['1:1 with Sarah Chen', '1:1 with Manager', 'Weekly 1:1', 'Check-in with David'],
  planning: ['Sprint Planning', 'Quarterly Planning', 'Project Planning', 'Roadmap Planning'],
  review: ['Code Review', 'Design Review', 'Product Review', 'Performance Review'],
  client: ['Client Check-in', 'Customer Call', 'Partner Meeting', 'Vendor Sync'],
  team: ['Team Meeting', 'Department Sync', 'All Hands', 'Weekly Team Sync'],
  strategy: ['Strategy Review', 'Executive Briefing', 'Board Prep', 'Leadership Sync'],
};

function getRandomMeetingTitle(type: keyof typeof MEETING_TITLES): string {
  const titles = MEETING_TITLES[type] || MEETING_TITLES.team;
  return titles[Math.floor(Math.random() * titles.length)] || 'Team Meeting';
}

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
          startTime: '09:00',
          endTime: '09:30',
          type: 'email',
          title: 'Morning Email Triage',
          tasks: [],
          emailQueue: generateEmails(5),
        },
        {
          id: generateId(),
          startTime: '09:30',
          endTime: '11:30',
          type: 'work',
          title: 'Deep Work: Project Alpha',
          tasks: generateTasks(3),
        },
        {
          id: generateId(),
          startTime: '11:30',
          endTime: '12:00',
          type: 'meeting',
          title: getRandomMeetingTitle('standup'),
          tasks: [],
          metadata: {
            attendeeCount: 8,
            videoLink: 'https://meet.google.com/abc-defg-hij',
          },
        },
        {
          id: generateId(),
          startTime: '12:00',
          endTime: '13:00',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '13:00',
          endTime: '14:00',
          type: 'work',
          title: 'Code Review Session',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '13:30',
          endTime: '14:30',
          type: 'meeting',
          title: getRandomMeetingTitle('planning'),
          tasks: [],
          metadata: {
            attendeeCount: 5,
            videoLink: 'https://zoom.us/j/123456789',
          },
        },
        {
          id: generateId(),
          startTime: '14:30',
          endTime: '15:00',
          type: 'email',
          title: 'Afternoon Email Response',
          tasks: [],
          emailQueue: generateEmails(3),
        },
        {
          id: generateId(),
          startTime: '15:00',
          endTime: '16:30',
          type: 'work',
          title: 'Deep Work: Feature Development',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '16:30',
          endTime: '17:00',
          type: 'work',
          title: 'Daily Wrap-up & Planning',
          tasks: generateTasks(1),
        },
      ];
      
    case 'meeting_heavy':
      return [
        {
          id: generateId(),
          startTime: '09:00',
          endTime: '10:00',
          type: 'meeting',
          title: getRandomMeetingTitle('strategy'),
          tasks: [],
          metadata: {
            attendeeCount: 12,
            location: 'Conference Room A',
          },
        },
        {
          id: generateId(),
          startTime: '09:30',
          endTime: '10:30',
          type: 'meeting',
          title: getRandomMeetingTitle('team'),
          tasks: [],
          metadata: {
            attendeeCount: 6,
            videoLink: 'https://meet.google.com/xyz-uvw-rst',
          },
        },
        {
          id: generateId(),
          startTime: '10:00',
          endTime: '11:00',
          type: 'meeting',
          title: getRandomMeetingTitle('client'),
          tasks: [],
          metadata: {
            attendeeCount: 4,
            videoLink: 'https://zoom.us/j/987654321',
          },
        },
        {
          id: generateId(),
          startTime: '10:30',
          endTime: '11:30',
          type: 'meeting',
          title: getRandomMeetingTitle('review'),
          tasks: [],
          metadata: {
            attendeeCount: 3,
            location: 'Conference Room B',
          },
        },
        {
          id: generateId(),
          startTime: '11:30',
          endTime: '12:00',
          type: 'work',
          title: 'Urgent Task Review',
          tasks: generateTasks(3),
        },
        {
          id: generateId(),
          startTime: '12:00',
          endTime: '13:00',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '13:00',
          endTime: '14:00',
          type: 'meeting',
          title: getRandomMeetingTitle('oneOnOne'),
          tasks: [],
          metadata: {
            attendeeCount: 2,
            location: 'Manager Office',
          },
        },
        {
          id: generateId(),
          startTime: '14:00',
          endTime: '15:00',
          type: 'email',
          title: 'Email Catch-up',
          tasks: [],
          emailQueue: generateEmails(8),
        },
        {
          id: generateId(),
          startTime: '15:00',
          endTime: '17:00',
          type: 'work',
          title: 'Project Work',
          tasks: generateTasks(2),
        },
      ];
      
    case 'focus_day':
      return [
        {
          id: generateId(),
          startTime: '09:00',
          endTime: '12:00',
          type: 'work',
          title: 'Morning Deep Work: Architecture Design',
          tasks: generateTasks(4),
        },
        {
          id: generateId(),
          startTime: '12:00',
          endTime: '13:00',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '13:00',
          endTime: '16:00',
          type: 'work',
          title: 'Afternoon Deep Work: Implementation',
          tasks: generateTasks(4),
        },
        {
          id: generateId(),
          startTime: '16:00',
          endTime: '16:30',
          type: 'email',
          title: 'End of Day Email Check',
          tasks: [],
          emailQueue: generateEmails(6),
        },
        {
          id: generateId(),
          startTime: '16:30',
          endTime: '17:00',
          type: 'work',
          title: 'Documentation & Cleanup',
          tasks: generateTasks(1),
        },
      ];
      
    case 'email_heavy':
      return [
        {
          id: generateId(),
          startTime: '09:00',
          endTime: '10:00',
          type: 'email',
          title: 'Morning Email Processing',
          tasks: [],
          emailQueue: generateEmails(12),
        },
        {
          id: generateId(),
          startTime: '10:00',
          endTime: '11:30',
          type: 'work',
          title: 'Priority Tasks',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '11:30',
          endTime: '12:00',
          type: 'email',
          title: 'Pre-Lunch Quick Responses',
          tasks: [],
          emailQueue: generateEmails(5),
        },
        {
          id: generateId(),
          startTime: '12:00',
          endTime: '13:00',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '13:00',
          endTime: '14:00',
          type: 'email',
          title: 'Detailed Email Responses',
          tasks: [],
          emailQueue: generateEmails(6),
        },
        {
          id: generateId(),
          startTime: '14:00',
          endTime: '16:00',
          type: 'work',
          title: 'Project Work',
          tasks: generateTasks(3),
        },
        {
          id: generateId(),
          startTime: '16:00',
          endTime: '17:00',
          type: 'email',
          title: 'End of Day Email Cleanup',
          tasks: [],
          emailQueue: generateEmails(8),
        },
      ];
      
    case 'light_day':
      return [
        {
          id: generateId(),
          startTime: '09:00',
          endTime: '11:00',
          type: 'work',
          title: 'Morning Focus Time',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '11:00',
          endTime: '11:30',
          type: 'meeting',
          title: getRandomMeetingTitle('standup'),
          tasks: [],
          metadata: {
            attendeeCount: 5,
            videoLink: 'https://meet.google.com/abc-defg-hij',
          },
        },
        {
          id: generateId(),
          startTime: '11:30',
          endTime: '12:00',
          type: 'work',
          title: 'Quick Task Review',
          tasks: generateTasks(1),
        },
        {
          id: generateId(),
          startTime: '12:00',
          endTime: '13:00',
          type: 'break',
          title: 'Lunch Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '13:00',
          endTime: '14:30',
          type: 'work',
          title: 'Afternoon Project Work',
          tasks: generateTasks(2),
        },
        {
          id: generateId(),
          startTime: '14:30',
          endTime: '15:00',
          type: 'break',
          title: 'Coffee Break',
          tasks: [],
        },
        {
          id: generateId(),
          startTime: '15:00',
          endTime: '16:00',
          type: 'email',
          title: 'Email Review',
          tasks: [],
          emailQueue: generateEmails(4),
        },
        {
          id: generateId(),
          startTime: '16:00',
          endTime: '16:30',
          type: 'work',
          title: 'Planning Tomorrow',
          tasks: generateTasks(1),
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
    .filter(block => block.type === 'work')
    .flatMap(block => block.tasks);
  
  // Ensure we have 3-7 tasks
  const dailyTasks = allTasks.slice(0, Math.min(7, Math.max(3, allTasks.length)));
  
  // Calculate initial stats
  const emailsProcessed = 0;
  const tasksCompleted = 0;
  const focusMinutes = timeBlocks
    .filter(block => block.type === 'work')
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