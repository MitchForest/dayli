import { z } from 'zod';

// Individual task schema
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['backlog', 'scheduled', 'in_progress', 'completed']),
  estimatedMinutes: z.number().min(5).max(480), // 5 min to 8 hours
  actualMinutes: z.number().optional(),
  dueDate: z.string().optional(),
  completedAt: z.string().optional(),
  source: z.enum(['manual', 'email', 'calendar', 'ai']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  assignedToBlockId: z.string().optional(),
});

// Task group schema
export const taskGroupSchema = z.object({
  groupBy: z.enum(['priority', 'status', 'dueDate', 'source', 'none']),
  groups: z.array(z.object({
    key: z.string(),
    label: z.string(),
    tasks: z.array(taskSchema),
    count: z.number(),
    totalMinutes: z.number(),
  })),
});

// Task search result schema
export const taskSearchResultSchema = z.object({
  query: z.string(),
  filters: z.object({
    priority: z.array(z.enum(['high', 'medium', 'low'])).optional(),
    status: z.array(z.enum(['backlog', 'scheduled', 'in_progress', 'completed'])).optional(),
    tags: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
  }).optional(),
  results: z.array(taskSchema),
  totalCount: z.number(),
  groupedResults: taskGroupSchema.optional(),
});

// Task update schema
export const taskUpdateSchema = z.object({
  taskId: z.string(),
  updates: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['backlog', 'scheduled', 'in_progress', 'completed']).optional(),
    estimatedMinutes: z.number().optional(),
    dueDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  previousState: taskSchema,
  newState: taskSchema,
  changedFields: z.array(z.string()),
});

// Batch task operation schema
export const batchTaskOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'move']),
  taskIds: z.array(z.string()),
  updates: z.any().optional(), // Specific to operation type
  summary: z.string(),
  affectedCount: z.number(),
});

// Type exports
export type Task = z.infer<typeof taskSchema>;
export type TaskGroup = z.infer<typeof taskGroupSchema>;
export type TaskSearchResult = z.infer<typeof taskSearchResultSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type BatchTaskOperation = z.infer<typeof batchTaskOperationSchema>; 