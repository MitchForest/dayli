import { ServiceConfig } from '../interfaces/base.interface';
import { 
  ScheduleService, 
  TimeBlock, 
  CreateTimeBlockInput, 
  UpdateTimeBlockInput 
} from '../interfaces/schedule.interface';
import { parseISO, format, startOfDay, endOfDay } from 'date-fns';

export class MockScheduleService implements ScheduleService {
  readonly serviceName = 'MockScheduleService';
  readonly isRealImplementation = false;
  private userId: string;
  private mockTimeBlocks: Map<string, TimeBlock> = new Map();

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Add some default time blocks for today
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const morningBlock: TimeBlock = {
      id: 'mock-1',
      userId: this.userId,
      startTime: this.parseTimeToDate('09:00', today),
      endTime: this.parseTimeToDate('11:00', today),
      type: 'work',
      title: 'Deep Work Session',
      description: 'Focus on strategy deck',
      source: 'ai',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const lunchBlock: TimeBlock = {
      id: 'mock-2',
      userId: this.userId,
      startTime: this.parseTimeToDate('12:00', today),
      endTime: this.parseTimeToDate('13:00', today),
      type: 'break',
      title: 'Lunch Break',
      source: 'ai',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockTimeBlocks.set(morningBlock.id, morningBlock);
    this.mockTimeBlocks.set(lunchBlock.id, lunchBlock);
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
    const targetDate = parseISO(date);
    const startOfTargetDay = startOfDay(targetDate);
    const endOfTargetDay = endOfDay(targetDate);

    return Array.from(this.mockTimeBlocks.values())
      .filter(block => 
        block.userId === this.userId &&
        block.startTime >= startOfTargetDay &&
        block.startTime <= endOfTargetDay
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
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

    const dayBlocks = await this.getScheduleForDate(date);
    
    return dayBlocks.some(block => {
      if (excludeId && block.id === excludeId) return false;
      
      // Check for overlap
      return (
        (start < block.endTime && end > block.startTime) ||
        (block.startTime < end && block.endTime > start)
      );
    });
  }
} 