import { BaseService } from './base.interface';

export interface UserPreferences {
  id: string;
  userId: string;
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchDurationMinutes: number;
  breakSchedule: {
    lunchTime: string;
    lunchDuration: number;
    autoProtect: boolean;
    morningBreak?: { time: string; duration: number };
    afternoonBreak?: { time: string; duration: number };
  };
  openTimePreferences: {
    dailyHours: number;
    preferredSlots: string[];
    allowMeetingTypes: string[];
  };
  emailPreferences: {
    quickReplyMinutes: number;
    batchProcessing: boolean;
    autoArchivePatterns?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferenceUpdate {
  workStartTime?: string;
  workEndTime?: string;
  lunchStartTime?: string;
  lunchDurationMinutes?: number;
  breakSchedule?: Partial<UserPreferences['breakSchedule']>;
  openTimePreferences?: Partial<UserPreferences['openTimePreferences']>;
  emailPreferences?: Partial<UserPreferences['emailPreferences']>;
}

export interface PreferenceService extends BaseService {
  getUserPreferences(): Promise<UserPreferences>;
  updatePreferences(updates: PreferenceUpdate): Promise<UserPreferences>;
  updateBreakSchedule(breakSchedule: Partial<UserPreferences['breakSchedule']>): Promise<void>;
  updateEmailPreferences(emailPrefs: Partial<UserPreferences['emailPreferences']>): Promise<void>;
  updateOpenTimePreferences(openTimePrefs: Partial<UserPreferences['openTimePreferences']>): Promise<void>;
} 