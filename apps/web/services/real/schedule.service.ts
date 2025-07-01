import { ServiceConfig } from '../interfaces/base.interface';
import { 
  ScheduleService, 
  TimeBlock, 
  CreateTimeBlockInput, 
  UpdateTimeBlockInput 
} from '../interfaces/schedule.interface';
import { parseISO, format, startOfDay, endOfDay } from 'date-fns';

export class RealScheduleService implements ScheduleService {
  readonly serviceName = 'RealScheduleService';
  readonly isRealImplementation = true;
  private userId: string;
  private supabase: any;

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.supabase = config.supabaseClient;
  }

  private parseTimeToDate(time: string, date: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const dateObj = parseISO(date);
    dateObj.setHours(hours || 0, minutes || 0, 0, 0);
    return dateObj;
  }

  async createTimeBlock(input: CreateTimeBlockInput): Promise<TimeBlock> {
    const startTime = this.parseTimeToDate(input.startTime, input.date);
    const endTime = this.parseTimeToDate(input.endTime, input.date);

    const { data, error } = await this.supabase
      .from('time_blocks')
      .insert({
        user_id: this.userId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        type: input.type,
        title: input.title,
        description: input.description,
        metadata: input.metadata,
        source: 'ai'
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create time block: ${error.message}`);

    return this.mapToTimeBlock(data);
  }

  async updateTimeBlock(input: UpdateTimeBlockInput): Promise<TimeBlock> {
    const updates: any = {};
    
    if (input.startTime) {
      // Need to fetch existing block to get the date
      const existing = await this.getTimeBlock(input.id);
      if (!existing) throw new Error('Time block not found');
      
      const date = format(existing.startTime, 'yyyy-MM-dd');
      updates.start_time = this.parseTimeToDate(input.startTime, date).toISOString();
    }
    
    if (input.endTime) {
      const existing = await this.getTimeBlock(input.id);
      if (!existing) throw new Error('Time block not found');
      
      const date = format(existing.startTime, 'yyyy-MM-dd');
      updates.end_time = this.parseTimeToDate(input.endTime, date).toISOString();
    }
    
    if (input.title) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.type) updates.type = input.type;

    const { data, error } = await this.supabase
      .from('time_blocks')
      .update(updates)
      .eq('id', input.id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update time block: ${error.message}`);

    return this.mapToTimeBlock(data);
  }

  async deleteTimeBlock(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('time_blocks')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to delete time block: ${error.message}`);
  }

  async getTimeBlock(id: string): Promise<TimeBlock | null> {
    const { data, error } = await this.supabase
      .from('time_blocks')
      .select()
      .eq('id', id)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get time block: ${error.message}`);
    }

    return this.mapToTimeBlock(data);
  }

  async getScheduleForDate(date: string): Promise<TimeBlock[]> {
    const startOfDayDate = startOfDay(parseISO(date));
    const endOfDayDate = endOfDay(parseISO(date));

    const { data, error } = await this.supabase
      .from('time_blocks')
      .select()
      .eq('user_id', this.userId)
      .gte('start_time', startOfDayDate.toISOString())
      .lte('start_time', endOfDayDate.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw new Error(`Failed to get schedule: ${error.message}`);

    return data.map((block: any) => this.mapToTimeBlock(block));
  }

  async getScheduleForDateRange(startDate: string, endDate: string): Promise<TimeBlock[]> {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    const { data, error } = await this.supabase
      .from('time_blocks')
      .select()
      .eq('user_id', this.userId)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw new Error(`Failed to get schedule range: ${error.message}`);

    return data.map((block: any) => this.mapToTimeBlock(block));
  }

  async checkForConflicts(
    startTime: string, 
    endTime: string, 
    date: string, 
    excludeId?: string
  ): Promise<boolean> {
    const start = this.parseTimeToDate(startTime, date);
    const end = this.parseTimeToDate(endTime, date);

    let query = this.supabase
      .from('time_blocks')
      .select('id')
      .eq('user_id', this.userId)
      .or(`and(start_time.lt.${end.toISOString()},end_time.gt.${start.toISOString()})`);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to check conflicts: ${error.message}`);

    return data.length > 0;
  }

  private mapToTimeBlock(data: any): TimeBlock {
    return {
      id: data.id,
      userId: data.user_id,
      dailyScheduleId: data.daily_schedule_id,
      startTime: new Date(data.start_time),
      endTime: new Date(data.end_time),
      type: data.type,
      title: data.title,
      description: data.description,
      source: data.source,
      calendarEventId: data.calendar_event_id,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
} 