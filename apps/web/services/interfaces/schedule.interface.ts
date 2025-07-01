import { BaseService } from './base.interface';

export interface TimeBlock {
  id: string;
  userId: string;
  dailyScheduleId?: string;
  startTime: Date;
  endTime: Date;
  type: 'focus' | 'email' | 'break' | 'meeting' | 'blocked';
  title: string;
  description?: string;
  source?: string;
  calendarEventId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTimeBlockInput {
  type: 'focus' | 'email' | 'break' | 'meeting' | 'blocked';
  title: string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  date: string; // YYYY-MM-DD format
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTimeBlockInput {
  id: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  description?: string;
  type?: 'focus' | 'email' | 'break' | 'meeting' | 'blocked';
}

export interface ScheduleService extends BaseService {
  createTimeBlock(input: CreateTimeBlockInput): Promise<TimeBlock>;
  updateTimeBlock(input: UpdateTimeBlockInput): Promise<TimeBlock>;
  deleteTimeBlock(id: string): Promise<void>;
  getTimeBlock(id: string): Promise<TimeBlock | null>;
  getScheduleForDate(date: string): Promise<TimeBlock[]>;
  getScheduleForDateRange(startDate: string, endDate: string): Promise<TimeBlock[]>;
  checkForConflicts(startTime: string, endTime: string, date: string, excludeId?: string): Promise<boolean>;
} 