import { create } from 'zustand';
import type { DailySchedule, DailyTask, TimeBlock } from '../types/schedule.types';

interface ScheduleStore {
  schedule: DailySchedule | null;
  setSchedule: (schedule: DailySchedule) => void;
  toggleTaskComplete: (taskId: string) => void;
  updateTimeBlock: (blockId: string, updates: Partial<TimeBlock>) => void;
  updateStats: () => void;
  processEmailFromBlock: (emailId: string, decision: 'now' | 'tomorrow' | 'never') => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedule: null,
  
  setSchedule: (schedule) => set({ schedule }),
  
  toggleTaskComplete: (taskId) => {
    const { schedule } = get();
    if (!schedule) return;
    
    const updatedSchedule = {
      ...schedule,
      timeBlocks: schedule.timeBlocks.map(block => ({
        ...block,
        tasks: block.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
      })),
      dailyTasks: schedule.dailyTasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    };
    
    set({ schedule: updatedSchedule });
    get().updateStats();
  },
  
  updateTimeBlock: (blockId, updates) => {
    const { schedule } = get();
    if (!schedule) return;
    
    const updatedSchedule = {
      ...schedule,
      timeBlocks: schedule.timeBlocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      ),
    };
    
    set({ schedule: updatedSchedule });
  },
  
  processEmailFromBlock: (emailId, decision) => {
    const { schedule } = get();
    if (!schedule) return;
    
    // Find and remove email from time blocks
    const updatedTimeBlocks = schedule.timeBlocks.map(block => {
      if (block.emailQueue) {
        const hasEmail = block.emailQueue.some(e => e.id === emailId);
        if (hasEmail) {
          return {
            ...block,
            emailQueue: block.emailQueue.filter(e => e.id !== emailId)
          };
        }
      }
      return block;
    });
    
    // Update schedule with removed email and increment processed count
    set({
      schedule: {
        ...schedule,
        timeBlocks: updatedTimeBlocks,
        stats: {
          ...schedule.stats,
          emailsProcessed: schedule.stats.emailsProcessed + 1
        }
      }
    });
  },
  
  updateStats: () => {
    const { schedule } = get();
    if (!schedule) return;
    
    const tasksCompleted = schedule.dailyTasks.filter(task => task.completed).length;
    const emailsProcessed = schedule.stats.emailsProcessed; // Keep existing count
    const focusMinutes = schedule.timeBlocks
      .filter(block => block.type === 'focus')
      .reduce((total, block) => {
        const start = new Date(`2024-01-01 ${block.startTime}`);
        const end = new Date(`2024-01-01 ${block.endTime}`);
        return total + (end.getTime() - start.getTime()) / (1000 * 60);
      }, 0);
    
    set({
      schedule: {
        ...schedule,
        stats: {
          tasksCompleted,
          emailsProcessed,
          focusMinutes,
        },
      },
    });
  },
})); 