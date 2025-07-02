import { BaseService } from './base.interface';

export interface Task {
  id: string;
  title: string;
  status: 'backlog' | 'scheduled' | 'completed';
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  description?: string;
  source?: 'email' | 'chat' | 'calendar' | 'manual';
  completed?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
  emailId?: string;
}

export interface TaskBacklog {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: number; // 0-100
  urgency: number; // 0-100
  source?: 'email' | 'chat' | 'calendar' | 'manual';
  sourceId?: string;
  createdAt: Date;
  updatedAt: Date;
  deferredUntil?: Date;
  estimatedMinutes?: number;
  tags?: string[];
}

export interface CreateTaskInput {
  title: string;
  estimatedMinutes?: number;
  priority?: 'high' | 'medium' | 'low';
  description?: string;
}

export interface CreateTaskParams {
  title: string;
  estimatedMinutes?: number;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  source?: 'email' | 'chat' | 'calendar' | 'manual';
}

export interface UpdateTaskParams {
  title?: string;
  estimatedMinutes?: number;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'backlog' | 'scheduled' | 'completed';
}

export interface TaskService extends BaseService {
  // Core CRUD operations
  createTask(params: CreateTaskParams): Promise<Task>;
  updateTask(id: string, updates: UpdateTaskParams): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  
  // Query operations
  getUnassignedTasks(): Promise<Task[]>;
  getTasksByStatus(status: 'backlog' | 'scheduled' | 'completed'): Promise<Task[]>;
  searchTasks(query: string): Promise<Task[]>;
  
  // Schedule operations
  assignTaskToBlock(taskId: string, blockId: string): Promise<void>;
  unassignTaskFromBlock(taskId: string): Promise<void>;
  completeTask(taskId: string): Promise<Task>;
  
  // Batch operations
  batchCreateTasks(tasks: CreateTaskParams[]): Promise<Task[]>;
  batchUpdateTasks(updates: { id: string; updates: UpdateTaskParams }[]): Promise<Task[]>;
  
  // Backlog operations
  getTaskBacklog(): Promise<Task[]>;
  moveToBacklog(taskId: string): Promise<Task>;
} 