import { BaseService } from './base.interface';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  source?: 'email' | 'chat' | 'calendar' | 'manual';
  emailId?: string;
  status: 'backlog' | 'scheduled' | 'completed';
  priority?: 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
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
  description?: string;
  source?: 'email' | 'chat' | 'calendar' | 'manual';
  priority?: 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  emailId?: string;
}

export interface TaskService extends BaseService {
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  getUnassignedTasks(): Promise<Task[]>;
  getTasksByStatus(status: 'backlog' | 'scheduled' | 'completed'): Promise<Task[]>;
  completeTask(id: string): Promise<Task>;
  assignTaskToBlock(taskId: string, blockId: string): Promise<void>;
  
  // Backlog operations
  addToBacklog(task: Omit<TaskBacklog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<TaskBacklog>;
  getBacklogTasks(includeDeferred?: boolean): Promise<TaskBacklog[]>;
  updateBacklogPriority(id: string, priority: number, urgency: number): Promise<void>;
} 