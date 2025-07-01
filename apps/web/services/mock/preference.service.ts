import { ServiceConfig } from '../interfaces/base.interface';
import { 
  PreferenceService, 
  UserPreferences, 
  PreferenceUpdate 
} from '../interfaces/preference.interface';

export class MockPreferenceService implements PreferenceService {
  readonly serviceName = 'MockPreferenceService';
  readonly isRealImplementation = false;
  private userId: string;
  private mockPreferences: UserPreferences;

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.mockPreferences = this.createDefaultPreferences();
  }

  private createDefaultPreferences(): UserPreferences {
    return {
      id: 'pref-1',
      userId: this.userId,
      workStartTime: '09:00',
      workEndTime: '17:00',
      lunchStartTime: '12:00',
      lunchDurationMinutes: 60,
      breakSchedule: {
        lunchTime: '12:00',
        lunchDuration: 60,
        autoProtect: true
      },
      openTimePreferences: {
        dailyHours: 2,
        preferredSlots: ['14:00-15:00', '16:00-17:00'],
        allowMeetingTypes: ['external', '1-on-1', 'team']
      },
      emailPreferences: {
        quickReplyMinutes: 5,
        batchProcessing: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getUserPreferences(): Promise<UserPreferences> {
    return { ...this.mockPreferences };
  }

  async updatePreferences(updates: PreferenceUpdate): Promise<UserPreferences> {
    if (updates.workStartTime) this.mockPreferences.workStartTime = updates.workStartTime;
    if (updates.workEndTime) this.mockPreferences.workEndTime = updates.workEndTime;
    if (updates.lunchStartTime) this.mockPreferences.lunchStartTime = updates.lunchStartTime;
    if (updates.lunchDurationMinutes) this.mockPreferences.lunchDurationMinutes = updates.lunchDurationMinutes;
    
    if (updates.breakSchedule) {
      this.mockPreferences.breakSchedule = {
        ...this.mockPreferences.breakSchedule,
        ...updates.breakSchedule
      };
    }
    
    if (updates.openTimePreferences) {
      this.mockPreferences.openTimePreferences = {
        ...this.mockPreferences.openTimePreferences,
        ...updates.openTimePreferences
      };
    }
    
    if (updates.emailPreferences) {
      this.mockPreferences.emailPreferences = {
        ...this.mockPreferences.emailPreferences,
        ...updates.emailPreferences
      };
    }

    this.mockPreferences.updatedAt = new Date();
    
    return { ...this.mockPreferences };
  }

  async updateBreakSchedule(breakSchedule: Partial<UserPreferences['breakSchedule']>): Promise<void> {
    this.mockPreferences.breakSchedule = {
      ...this.mockPreferences.breakSchedule,
      ...breakSchedule
    };
    this.mockPreferences.updatedAt = new Date();
  }

  async updateEmailPreferences(emailPrefs: Partial<UserPreferences['emailPreferences']>): Promise<void> {
    this.mockPreferences.emailPreferences = {
      ...this.mockPreferences.emailPreferences,
      ...emailPrefs
    };
    this.mockPreferences.updatedAt = new Date();
  }

  async updateOpenTimePreferences(openTimePrefs: Partial<UserPreferences['openTimePreferences']>): Promise<void> {
    this.mockPreferences.openTimePreferences = {
      ...this.mockPreferences.openTimePreferences,
      ...openTimePrefs
    };
    this.mockPreferences.updatedAt = new Date();
  }
} 