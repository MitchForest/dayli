export interface DailyTask {
  id: string;
  title: string;
  completed: boolean;
  source?: 'email' | 'calendar' | 'ai';
  emailId?: string;
}

export interface TimeBlock {
  id: string;
  startTime: string; // "9:00 AM"
  endTime: string; // "11:00 AM"
  type: 'focus' | 'meeting' | 'email' | 'quick-decisions' | 'break';
  title: string;
  tasks: DailyTask[];
  emailQueue?: EmailDecision[]; // For email blocks
}

export interface DailySchedule {
  date: string;
  timeBlocks: TimeBlock[];
  dailyTasks: DailyTask[]; // The 3-7 for the day
  stats: {
    emailsProcessed: number;
    tasksCompleted: number;
    focusMinutes: number;
  };
}

// Import from email types
import type { EmailDecision } from '../../email/types/email.types'; 