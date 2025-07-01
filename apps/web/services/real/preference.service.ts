import { ServiceConfig } from '../interfaces/base.interface';
import { 
  PreferenceService, 
  UserPreferences, 
  PreferenceUpdate 
} from '../interfaces/preference.interface';

export class RealPreferenceService implements PreferenceService {
  readonly serviceName = 'RealPreferenceService';
  readonly isRealImplementation = true;
  private userId: string;
  private supabase: any;

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.supabase = config.supabaseClient;
  }

  async getUserPreferences(): Promise<UserPreferences> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select()
      .eq('user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, create default
        return this.createDefaultPreferences();
      }
      throw new Error(`Failed to get user preferences: ${error.message}`);
    }

    return this.mapToUserPreferences(data);
  }

  async updatePreferences(updates: PreferenceUpdate): Promise<UserPreferences> {
    const dbUpdates: any = {};
    
    if (updates.workStartTime) dbUpdates.work_start_time = updates.workStartTime;
    if (updates.workEndTime) dbUpdates.work_end_time = updates.workEndTime;
    if (updates.lunchStartTime) dbUpdates.lunch_start_time = updates.lunchStartTime;
    if (updates.lunchDurationMinutes) dbUpdates.lunch_duration_minutes = updates.lunchDurationMinutes;
    if (updates.breakSchedule) dbUpdates.break_schedule = updates.breakSchedule;
    if (updates.openTimePreferences) dbUpdates.open_time_preferences = updates.openTimePreferences;
    if (updates.emailPreferences) dbUpdates.email_preferences = updates.emailPreferences;

    const { data, error } = await this.supabase
      .from('user_preferences')
      .update(dbUpdates)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update preferences: ${error.message}`);

    return this.mapToUserPreferences(data);
  }

  async updateBreakSchedule(breakSchedule: Partial<UserPreferences['breakSchedule']>): Promise<void> {
    const { data: current } = await this.supabase
      .from('user_preferences')
      .select('break_schedule')
      .eq('user_id', this.userId)
      .single();

    const updatedBreakSchedule = {
      ...(current?.break_schedule || {}),
      ...breakSchedule
    };

    const { error } = await this.supabase
      .from('user_preferences')
      .update({ break_schedule: updatedBreakSchedule })
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to update break schedule: ${error.message}`);
  }

  async updateEmailPreferences(emailPrefs: Partial<UserPreferences['emailPreferences']>): Promise<void> {
    const { data: current } = await this.supabase
      .from('user_preferences')
      .select('email_preferences')
      .eq('user_id', this.userId)
      .single();

    const updatedEmailPrefs = {
      ...(current?.email_preferences || {}),
      ...emailPrefs
    };

    const { error } = await this.supabase
      .from('user_preferences')
      .update({ email_preferences: updatedEmailPrefs })
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to update email preferences: ${error.message}`);
  }

  async updateOpenTimePreferences(openTimePrefs: Partial<UserPreferences['openTimePreferences']>): Promise<void> {
    const { data: current } = await this.supabase
      .from('user_preferences')
      .select('open_time_preferences')
      .eq('user_id', this.userId)
      .single();

    const updatedOpenTimePrefs = {
      ...(current?.open_time_preferences || {}),
      ...openTimePrefs
    };

    const { error } = await this.supabase
      .from('user_preferences')
      .update({ open_time_preferences: updatedOpenTimePrefs })
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to update open time preferences: ${error.message}`);
  }

  private async createDefaultPreferences(): Promise<UserPreferences> {
    const defaults = {
      user_id: this.userId,
      work_start_time: '09:00',
      work_end_time: '17:00',
      lunch_start_time: '12:00',
      lunch_duration_minutes: 60,
      break_schedule: {
        lunchTime: '12:00',
        lunchDuration: 60,
        autoProtect: true
      },
      open_time_preferences: {
        dailyHours: 2,
        preferredSlots: ['14:00-15:00', '16:00-17:00'],
        allowMeetingTypes: ['external', '1-on-1', 'team']
      },
      email_preferences: {
        quickReplyMinutes: 5,
        batchProcessing: true
      }
    };

    const { data, error } = await this.supabase
      .from('user_preferences')
      .insert(defaults)
      .select()
      .single();

    if (error) throw new Error(`Failed to create default preferences: ${error.message}`);

    return this.mapToUserPreferences(data);
  }

  private mapToUserPreferences(data: any): UserPreferences {
    return {
      id: data.id,
      userId: data.user_id,
      workStartTime: data.work_start_time,
      workEndTime: data.work_end_time,
      lunchStartTime: data.lunch_start_time,
      lunchDurationMinutes: data.lunch_duration_minutes,
      breakSchedule: data.break_schedule || {
        lunchTime: data.lunch_start_time || '12:00',
        lunchDuration: data.lunch_duration_minutes || 60,
        autoProtect: true
      },
      openTimePreferences: data.open_time_preferences || {
        dailyHours: 2,
        preferredSlots: ['14:00-15:00', '16:00-17:00'],
        allowMeetingTypes: ['external', '1-on-1', 'team']
      },
      emailPreferences: data.email_preferences || {
        quickReplyMinutes: 5,
        batchProcessing: true
      },
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
} 