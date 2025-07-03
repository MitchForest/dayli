'use client';

import { useCallback } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import { format } from 'date-fns';
import type { DailyTask } from '../types/schedule.types';
import { useAuth } from '@repo/auth/hooks';
import type { Database } from '@repo/database/types';

type Task = Database['public']['Tables']['tasks']['Row'];

export const useTaskActions = () => {
  const { supabase, user } = useAuth();
  const { toggleTaskComplete, getSchedule } = useScheduleStore();
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  
  const completeTask = useCallback((taskId: string) => {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    toggleTaskComplete(dateString, taskId);
  }, [toggleTaskComplete, currentDate]);
  
  const getTaskById = useCallback((taskId: string): DailyTask | null => {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    const schedule = getSchedule(dateString);
    
    if (!schedule) return null;
    
    // Search through all time blocks for the task
    for (const block of schedule.timeBlocks) {
      const task = block.tasks.find((t: DailyTask) => t.id === taskId);
      if (task) return task;
    }
    
    // Also check daily tasks
    return schedule.dailyTasks.find((t: DailyTask) => t.id === taskId) || null;
  }, [getSchedule, currentDate]);
  
  const getTaskStats = useCallback(() => {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    const schedule = getSchedule(dateString);
    
    if (!schedule) return { total: 0, completed: 0, percentage: 0 };
    
    const total = schedule.dailyTasks.length;
    const completed = schedule.dailyTasks.filter((t: DailyTask) => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, percentage };
  }, [getSchedule, currentDate]);

  const toggleTaskCompletion = useCallback(async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed })
      .eq('id', taskId);

    if (error) {
      console.error('Error toggling task:', error);
      throw error;
    }
  }, []);

  const addTaskToBlock = useCallback(async (blockId: string, task: Partial<Task>) => {
    if (!user) throw new Error('Not authenticated');

    // Create the task
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: task.title || 'New Task',
        description: task.description,
        priority: task.priority,
        estimated_minutes: task.estimated_minutes,
        source: task.source,
        email_id: task.email_id,
        user_id: user.id,
        status: 'scheduled',
      })
      .select()
      .single();

    if (taskError || !newTask) {
      console.error('Error creating task:', taskError);
      throw taskError;
    }

    // Update task with time block assignment
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        assigned_to_block_id: blockId,
        status: 'scheduled'
      })
      .eq('id', newTask.id);

    if (updateError) {
      console.error('Error assigning task to block:', updateError);
      throw updateError;
    }

    return newTask;
  }, [supabase, user]);

  const removeTaskFromBlock = useCallback(async (blockId: string, taskId: string) => {
    // Update task to remove block assignment
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        assigned_to_block_id: null,
        status: 'backlog' 
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('Error removing task from block:', updateError);
      throw updateError;
    }
  }, [supabase]);

  const loadTasksForBlock = useCallback(async (blockId: string): Promise<Task[]> => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to_block_id', blockId)
      .order('created_at');

    if (error) {
      console.error('Error loading tasks:', error);
      return [];
    }

    return data || [];
  }, [supabase]);

  return {
    completeTask,
    getTaskById,
    getTaskStats,
    toggleTaskCompletion,
    addTaskToBlock,
    removeTaskFromBlock,
    loadTasksForBlock,
  };
} 