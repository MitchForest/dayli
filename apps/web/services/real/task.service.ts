import { ServiceConfig } from '../interfaces/base.interface';
import { 
  TaskService, 
  Task, 
  TaskBacklog,
  CreateTaskInput,
  CreateTaskParams,
  UpdateTaskParams
} from '../interfaces/task.interface';
import { Database } from '@repo/database/types';

export class RealTaskService implements TaskService {
  readonly serviceName = 'RealTaskService';
  readonly isRealImplementation = true;
  private userId: string;
  private supabase: any;

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.supabase = config.supabaseClient;
  }

  async createTask(params: CreateTaskParams): Promise<Task> {
    if (!this.userId) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        user_id: this.userId,
        title: params.title,
        description: params.description,
        priority: params.priority || 'medium',
        estimated_minutes: params.estimatedMinutes || 30,
        source: params.source || 'manual',
        status: 'backlog',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return this.mapToTask(data);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const { userId, createdAt, updatedAt, ...validUpdates } = updates;
    
    const { data, error } = await this.supabase
      .from('tasks')
      .update(validUpdates)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);

    return this.mapToTask(data);
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select()
      .eq('id', id)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get task: ${error.message}`);
    }

    return this.mapToTask(data);
  }

  async getUnassignedTasks(): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select()
      .eq('user_id', this.userId)
      .eq('status', 'backlog')
      .eq('completed', false);

    if (error) throw new Error(`Failed to get unassigned tasks: ${error.message}`);

    // Sort by priority first (high -> medium -> low), then by created_at
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sortedTasks = data.sort((a: any, b: any) => {
      const aPriority = priorityOrder[a.priority || 'low'] ?? 2;
      const bPriority = priorityOrder[b.priority || 'low'] ?? 2;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // If same priority, sort by created_at (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sortedTasks.map((task: any) => this.mapToTask(task));
  }

  async getTasksByStatus(status: 'backlog' | 'scheduled' | 'completed'): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select()
      .eq('user_id', this.userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get tasks by status: ${error.message}`);

    return data.map((task: any) => this.mapToTask(task));
  }

  async completeTask(id: string): Promise<Task> {
    const { data, error } = await this.supabase
      .from('tasks')
      .update({ 
        completed: true, 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to complete task: ${error.message}`);

    return this.mapToTask(data);
  }

  async assignTaskToBlock(taskId: string, blockId: string): Promise<void> {
    // This would typically update a junction table or metadata
    // For now, we'll update the task status to 'scheduled'
    const { error } = await this.supabase
      .from('tasks')
      .update({ 
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to assign task to block: ${error.message}`);
  }

  async addToBacklog(task: Omit<TaskBacklog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<TaskBacklog> {
    const { data, error } = await this.supabase
      .from('task_backlog')
      .insert({
        user_id: this.userId,
        ...task
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add to backlog: ${error.message}`);

    return this.mapToTaskBacklog(data);
  }

  async getBacklogTasks(includeDeferred = false): Promise<TaskBacklog[]> {
    let query = this.supabase
      .from('task_backlog')
      .select()
      .eq('user_id', this.userId)
      .order('priority', { ascending: false })
      .order('urgency', { ascending: false });

    if (!includeDeferred) {
      query = query.or('deferred_until.is.null,deferred_until.lte.now()');
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get backlog tasks: ${error.message}`);

    return data.map((task: any) => this.mapToTaskBacklog(task));
  }

  async updateBacklogPriority(id: string, priority: number, urgency: number): Promise<void> {
    const { error } = await this.supabase
      .from('task_backlog')
      .update({ 
        priority,
        urgency,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to update backlog priority: ${error.message}`);
  }

  async batchCreateTasks(tasks: CreateTaskParams[]): Promise<Task[]> {
    const results = await Promise.all(
      tasks.map(task => this.createTask(task))
    );
    return results;
  }
  
  async batchUpdateTasks(updates: { id: string; updates: UpdateTaskParams }[]): Promise<Task[]> {
    const results = await Promise.all(
      updates.map(({ id, updates }) => this.updateTask(id, updates))
    );
    return results;
  }
  
  async searchTasks(query: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  }
  
  async unassignTaskFromBlock(taskId: string): Promise<void> {
    const { error } = await this.supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId);
      
    if (error) throw error;
  }
  
  async getTaskBacklog(): Promise<Task[]> {
    return this.getTasksByStatus('backlog');
  }
  
  async moveToBacklog(taskId: string): Promise<Task> {
    return this.updateTask(taskId, { status: 'backlog' });
  }

  private mapToTask(data: any): Task {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description,
      completed: data.completed,
      source: data.source,
      emailId: data.email_id,
      status: data.status,
      priority: data.priority,
      estimatedMinutes: data.estimated_minutes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapToTaskBacklog(data: any): TaskBacklog {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      urgency: data.urgency,
      source: data.source,
      sourceId: data.source_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      deferredUntil: data.deferred_until ? new Date(data.deferred_until) : undefined,
      estimatedMinutes: data.estimated_minutes,
      tags: data.tags
    };
  }
} 