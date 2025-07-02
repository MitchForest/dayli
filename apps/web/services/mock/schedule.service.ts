import { ServiceConfig } from '../interfaces/base.interface';
import { 
  ScheduleService, 
  TimeBlock, 
  CreateTimeBlockInput, 
  UpdateTimeBlockInput 
} from '../interfaces/schedule.interface';
import { parseISO, format, startOfDay, endOfDay } from 'date-fns';
import { generateMockSchedule } from '@/modules/schedule/utils/mockGenerator';
import type { MockScenario } from '@/lib/constants';

export class MockScheduleService implements ScheduleService {
  readonly serviceName = 'MockScheduleService';
  readonly isRealImplementation = false;
  private userId: string;
  private mockTimeBlocks: Map<string, TimeBlock> = new Map();
  private initializedDates: Set<string> = new Set();

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.initializeMockData();
  }

  private getScenarioForToday(): MockScenario {
    // Vary scenario by day of week for variety
    const day = new Date().getDay();
    const scenarios: MockScenario[] = [
      'light_day',      // Sunday
      'meeting_heavy',  // Monday
      'typical_day',    // Tuesday
      'focus_day',      // Wednesday
      'email_heavy',    // Thursday
      'typical_day',    // Friday
      'light_day',      // Saturday
    ];
    return scenarios[day] || 'typical_day';
  }

  private initializeMockData(): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    this.ensureMockDataForDate(today);
  }

  private ensureMockDataForDate(date: string): void {
    // Only initialize if we haven't already for this date
    if (this.initializedDates.has(date)) {
      return;
    }

    const scenario = this.getScenarioForToday();
    const schedule = generateMockSchedule(scenario);
    
    // Convert generated blocks to TimeBlock format
    schedule.timeBlocks.forEach(block => {
      const timeBlock: TimeBlock = {
        id: `mock-${block.id}`,
        userId: this.userId,
        startTime: this.parseTimeToDate(block.startTime, date),
        endTime: this.parseTimeToDate(block.endTime, date),
        type: block.type,
        title: block.title,
        description: undefined,
        source: block.source || 'ai',
        metadata: block.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.mockTimeBlocks.set(timeBlock.id, timeBlock);
    });

    this.initializedDates.add(date);
  }

  private parseTimeToDate(time: string, date: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const dateObj = parseISO(date);
    dateObj.setHours(hours || 0, minutes || 0, 0, 0);
    return dateObj;
  }

  async createTimeBlock(input: CreateTimeBlockInput): Promise<TimeBlock> {
    const id = `mock-${Date.now()}`;
    const startTime = this.parseTimeToDate(input.startTime, input.date);
    const endTime = this.parseTimeToDate(input.endTime, input.date);

    const timeBlock: TimeBlock = {
      id,
      userId: this.userId,
      startTime,
      endTime,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
      source: 'ai',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockTimeBlocks.set(id, timeBlock);
    return timeBlock;
  }

  async updateTimeBlock(input: UpdateTimeBlockInput): Promise<TimeBlock> {
    const existing = this.mockTimeBlocks.get(input.id);
    if (!existing) throw new Error('Time block not found');

    const date = format(existing.startTime, 'yyyy-MM-dd');
    
    const updated: TimeBlock = {
      ...existing,
      startTime: input.startTime ? this.parseTimeToDate(input.startTime, date) : existing.startTime,
      endTime: input.endTime ? this.parseTimeToDate(input.endTime, date) : existing.endTime,
      title: input.title || existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      type: input.type || existing.type,
      updatedAt: new Date()
    };

    this.mockTimeBlocks.set(input.id, updated);
    return updated;
  }

  async deleteTimeBlock(id: string): Promise<void> {
    if (!this.mockTimeBlocks.has(id)) {
      throw new Error('Time block not found');
    }
    this.mockTimeBlocks.delete(id);
  }

  async getTimeBlock(id: string): Promise<TimeBlock | null> {
    return this.mockTimeBlocks.get(id) || null;
  }

  async getScheduleForDate(date: string): Promise<TimeBlock[]> {
    // Ensure we have mock data for this date
    this.ensureMockDataForDate(date);
    
    const targetDate = parseISO(date);
    const startOfTargetDay = startOfDay(targetDate);
    const endOfTargetDay = endOfDay(targetDate);

    const blocks = Array.from(this.mockTimeBlocks.values())
      .filter(block => 
        block.userId === this.userId &&
        block.startTime >= startOfTargetDay &&
        block.startTime <= endOfTargetDay
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    console.log(`[MockScheduleService] getScheduleForDate(${date}): found ${blocks.length} blocks`);
    return blocks;
  }

  async getScheduleForDateRange(startDate: string, endDate: string): Promise<TimeBlock[]> {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    return Array.from(this.mockTimeBlocks.values())
      .filter(block => 
        block.userId === this.userId &&
        block.startTime >= start &&
        block.startTime <= end
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async checkForConflicts(
    startTime: string, 
    endTime: string, 
    date: string, 
    excludeId?: string
  ): Promise<boolean> {
    const start = this.parseTimeToDate(startTime, date);
    const end = this.parseTimeToDate(endTime, date);

    console.log(`[MockScheduleService] Checking conflicts for ${startTime}-${endTime} on ${date}`);

    const dayBlocks = await this.getScheduleForDate(date);
    
    const conflictingBlock = dayBlocks.find(block => {
      if (excludeId && block.id === excludeId) return false;
      
      // Check for overlap - a conflict exists if:
      // 1. New block starts before existing ends AND new block ends after existing starts
      const hasOverlap = start < block.endTime && end > block.startTime;
      
      if (hasOverlap) {
        console.log(`[MockScheduleService] Conflict detected with block: ${block.title} (${format(block.startTime, 'HH:mm')}-${format(block.endTime, 'HH:mm')})`);
      }
      
      return hasOverlap;
    });
    
    return !!conflictingBlock;
  }
} 