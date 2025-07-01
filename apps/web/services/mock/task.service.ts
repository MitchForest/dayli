import { ServiceConfig } from '../interfaces/base.interface';
import { 
  TaskService, 
  Task, 
  TaskBacklog,
  CreateTaskInput 
} from '../interfaces/task.interface';

export class MockTaskService implements TaskService {
  readonly serviceName = 'MockTaskService';
  readonly isRealImplementation = false;
  private userId: string;
  private mockTasks: Map<string, Task> = new Map();
  private mockBacklog: Map<string, TaskBacklog> = new Map();

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Add some default tasks
    const task1: Task = {
      id: 'task-1',
      userId: this.userId,
      title: 'Review Q1 strategy deck',
      description: 'Go through the slides and provide feedback',
      completed: false,
      source: 'manual',
      status: 'backlog',
      priority: 'high',
      estimatedMinutes: 45,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const task2: Task = {
      id: 'task-2',
      userId: this.userId,
      title: 'Respond to Sarah\'s email about budget',
      description: 'Provide the Q4 numbers she requested',
      completed: false,
      source: 'email',
      status: 'backlog',
      priority: 'medium',
      estimatedMinutes: 15,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const task3: Task = {
      id: 'task-3',
      userId: this.userId,
      title: 'Prepare for team standup',
      description: 'Review sprint progress and blockers',
      completed: false,
      source: 'calendar',
      status: 'scheduled',
      priority: 'medium',
      estimatedMinutes: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockTasks.set(task1.id, task1);
    this.mockTasks.set(task2.id, task2);
    this.mockTasks.set(task3.id, task3);

    // Add a backlog item
    const backlogItem: TaskBacklog = {
      id: 'backlog-1',
      userId: this.userId,
      title: 'Research new productivity tools',
      description: 'Look into alternatives to current stack',
      priority: 30,
      urgency: 20,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedMinutes: 60,
      tags: ['research', 'tools']
    };

    this.mockBacklog.set(backlogItem.id, backlogItem);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const id = `task-${Date.now()}`;
    
    const task: Task = {
      id,
      userId: this.userId,
      title: input.title,
      description: input.description,
      completed: false,
      source: input.source || 'manual',
      emailId: input.emailId,
      status: 'backlog',
      priority: input.priority,
      estimatedMinutes: input.estimatedMinutes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockTasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = this.mockTasks.get(id);
    if (!existing) throw new Error('Task not found');

    const { userId, createdAt, updatedAt, ...validUpdates } = updates;
    
    const updated: Task = {
      ...existing,
      ...validUpdates,
      updatedAt: new Date()
    };

    this.mockTasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.mockTasks.has(id)) {
      throw new Error('Task not found');
    }
    this.mockTasks.delete(id);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.mockTasks.get(id) || null;
  }

  async getUnassignedTasks(): Promise<Task[]> {
    return Array.from(this.mockTasks.values())
      .filter(task => 
        task.userId === this.userId &&
        task.status === 'backlog' &&
        !task.completed
      )
      .sort((a, b) => {
        // Sort by priority, then by creation date
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority || 'low'];
        const bPriority = priorityOrder[b.priority || 'low'];
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async getTasksByStatus(status: 'backlog' | 'scheduled' | 'completed'): Promise<Task[]> {
    return Array.from(this.mockTasks.values())
      .filter(task => 
        task.userId === this.userId &&
        task.status === status
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async completeTask(id: string): Promise<Task> {
    const task = this.mockTasks.get(id);
    if (!task) throw new Error('Task not found');

    const completed: Task = {
      ...task,
      completed: true,
      status: 'completed',
      updatedAt: new Date()
    };

    this.mockTasks.set(id, completed);
    return completed;
  }

  async assignTaskToBlock(taskId: string, blockId: string): Promise<void> {
    const task = this.mockTasks.get(taskId);
    if (!task) throw new Error('Task not found');

    const updated: Task = {
      ...task,
      status: 'scheduled',
      updatedAt: new Date()
    };

    this.mockTasks.set(taskId, updated);
  }

  async addToBacklog(task: Omit<TaskBacklog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<TaskBacklog> {
    const id = `backlog-${Date.now()}`;
    
    const backlogItem: TaskBacklog = {
      id,
      userId: this.userId,
      ...task,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockBacklog.set(id, backlogItem);
    return backlogItem;
  }

  async getBacklogTasks(includeDeferred = false): Promise<TaskBacklog[]> {
    const now = new Date();
    
    return Array.from(this.mockBacklog.values())
      .filter(task => {
        if (task.userId !== this.userId) return false;
        if (!includeDeferred && task.deferredUntil && task.deferredUntil > now) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by priority and urgency
        const aScore = a.priority + a.urgency;
        const bScore = b.priority + b.urgency;
        return bScore - aScore;
      });
  }

  async updateBacklogPriority(id: string, priority: number, urgency: number): Promise<void> {
    const item = this.mockBacklog.get(id);
    if (!item) throw new Error('Backlog item not found');

    const updated: TaskBacklog = {
      ...item,
      priority,
      urgency,
      updatedAt: new Date()
    };

    this.mockBacklog.set(id, updated);
  }
} 