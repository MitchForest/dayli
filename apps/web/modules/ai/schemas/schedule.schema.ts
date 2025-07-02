import { z } from 'zod';

// Time format validation
const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Individual time block schema
export const timeBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['work', 'meeting', 'email', 'break', 'blocked']),
  title: z.string(),
  startTime: z.string().regex(timeRegex, 'Time must be in format "h:mm AM/PM"'),
  endTime: z.string().regex(timeRegex, 'Time must be in format "h:mm AM/PM"'),
  description: z.string().optional(),
  color: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    estimatedMinutes: z.number(),
    completed: z.boolean(),
  })).optional(),
  metadata: z.record(z.any()).optional(),
});

// Schedule conflict schema
export const scheduleConflictSchema = z.object({
  blocks: z.array(z.string()), // block IDs
  type: z.enum(['overlap', 'back-to-back', 'insufficient-break']),
  severity: z.enum(['high', 'medium', 'low']),
  resolution: z.string().optional(),
});

// Full schedule data schema
export const scheduleDataSchema = z.object({
  date: z.string().regex(dateRegex, 'Date must be in format "YYYY-MM-DD"'),
  blocks: z.array(timeBlockSchema),
  timePeriods: z.object({
    morning: z.array(timeBlockSchema),
    afternoon: z.array(timeBlockSchema),
    evening: z.array(timeBlockSchema),
  }),
  stats: z.object({
    totalBlocks: z.number(),
    totalHours: z.number(),
    focusHours: z.number(),
    meetingHours: z.number(),
    breakHours: z.number(),
    utilization: z.number().min(0).max(100),
  }),
  conflicts: z.array(scheduleConflictSchema).optional(),
});

// Schedule change schema for updates
export const scheduleChangeSchema = z.object({
  type: z.enum(['add', 'remove', 'move', 'update']),
  blockId: z.string(),
  previousState: timeBlockSchema.optional(),
  newState: timeBlockSchema.optional(),
  reason: z.string().optional(),
});

// Batch schedule update schema
export const scheduleUpdateSchema = z.object({
  date: z.string().regex(dateRegex),
  changes: z.array(scheduleChangeSchema),
  summary: z.string(),
  requiresConfirmation: z.boolean().default(false),
});

// Type exports
export type TimeBlock = z.infer<typeof timeBlockSchema>;
export type ScheduleData = z.infer<typeof scheduleDataSchema>;
export type ScheduleConflict = z.infer<typeof scheduleConflictSchema>;
export type ScheduleChange = z.infer<typeof scheduleChangeSchema>;
export type ScheduleUpdate = z.infer<typeof scheduleUpdateSchema>; 