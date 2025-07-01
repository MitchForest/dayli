import { create } from 'zustand';
import type { DailySchedule } from '../types/schedule.types';

interface ScheduleStore {
  schedules: Map<string, DailySchedule>;
  getSchedule: (date: string) => DailySchedule | undefined;
  setSchedule: (date: string, schedule: DailySchedule) => void;
  toggleTaskComplete: (date: string, taskId: string) => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => {
  const state = {
    schedules: new Map<string, DailySchedule>(),
  };

  const actions = {
    getSchedule: (date: string) => {
      return get().schedules.get(date);
    },
    setSchedule: (date: string, schedule: DailySchedule) => {
      set(state => ({
        schedules: new Map(state.schedules).set(date, schedule),
      }));
    },
    toggleTaskComplete: (date: string, taskId: string) => {
      const schedule = get().schedules.get(date);
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
      
      get().setSchedule(date, updatedSchedule);
    },
  };

  return { ...state, ...actions };
}); 