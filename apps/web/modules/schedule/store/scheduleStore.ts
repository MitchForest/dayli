import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DailySchedule } from '../types/schedule.types';

interface ScheduleStore {
  schedules: Record<string, DailySchedule>;
  getSchedule: (date: string) => DailySchedule | undefined;
  setSchedule: (date: string, schedule: DailySchedule) => void;
  toggleTaskComplete: (date: string, taskId: string) => void;
}

export const useScheduleStore = create<ScheduleStore>()(
  subscribeWithSelector((set, get) => ({
    schedules: {},
    
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
  }))
); 