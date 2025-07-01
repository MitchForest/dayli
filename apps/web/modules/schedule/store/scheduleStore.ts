import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DailySchedule } from '../types/schedule.types';

interface ScheduleStore {
  schedules: Record<string, DailySchedule>;
  refreshTrigger: number;
  getSchedule: (date: string) => DailySchedule | undefined;
  setSchedule: (date: string, schedule: DailySchedule) => void;
  toggleTaskComplete: (date: string, taskId: string) => void;
  invalidateSchedule: (date?: string) => void;
}

export const useScheduleStore = create<ScheduleStore>()(
  subscribeWithSelector((set, get) => ({
    schedules: {},
    refreshTrigger: 0,
    
    getSchedule: (date: string) => {
      return get().schedules[date];
    },
    
    setSchedule: (date: string, schedule: DailySchedule) => {
      set(state => ({
        schedules: {
          ...state.schedules,
          [date]: schedule,
        },
      }));
    },
    
    toggleTaskComplete: (date: string, taskId: string) => {
      const schedule = get().schedules[date];
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
      
      set(state => ({
        schedules: {
          ...state.schedules,
          [date]: updatedSchedule,
        },
      }));
    },
    
    invalidateSchedule: (date?: string) => {
      set(state => {
        if (date) {
          // Remove specific date from cache
          const { [date]: _, ...rest } = state.schedules;
          return { 
            schedules: rest,
            refreshTrigger: state.refreshTrigger + 1
          };
        } else {
          // Clear all schedules
          return { 
            schedules: {},
            refreshTrigger: state.refreshTrigger + 1
          };
        }
      });
    },
  }))
); 