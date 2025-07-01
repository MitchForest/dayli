import { z } from 'zod';
import type { Database } from '@repo/database/types';

// Type aliases for convenience
type Task = Database['public']['Tables']['tasks']['Row'];
type Email = Database['public']['Tables']['emails']['Row'];
type TimeBlock = Database['public']['Tables']['time_blocks']['Row'];
type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];

// Block types as specified
export const BlockType = z.enum(['work', 'email', 'break', 'meetings', 'blocked']);
export type BlockTypeEnum = z.infer<typeof BlockType>;

// Email decision types
export const EmailDecision = z.enum(['now', 'later', 'never']);
export type EmailDecisionEnum = z.infer<typeof EmailDecision>;

// Daily Planning State
export const DailyPlanningState = z.object({
  userId: z.string(),
  date: z.string(),
  userPreferences: z.object({
    work_start_time: z.string().nullable(),
    work_end_time: z.string().nullable(),
    lunch_start_time: z.string().nullable(),
    lunch_duration_minutes: z.number().nullable(),
    target_deep_work_blocks: z.number().nullable(),
    deep_work_duration_hours: z.number().nullable(),
  }).nullable(),
  existingMeetings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    start_time: z.string(),
    end_time: z.string(),
  })),
  unreadEmails: z.object({
    count: z.number(),
    urgent: z.number(),
    newsletters: z.number(),
  }),
  backlogTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    priority: z.enum(['high', 'medium', 'low']).nullable(),
    estimated_minutes: z.number().optional(),
    source: z.string().nullable(),
  })),
  generatedSchedule: z.array(z.object({
    type: BlockType,
    title: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    tasks: z.array(z.string()).optional(),
  })),
});

export type DailyPlanningStateType = z.infer<typeof DailyPlanningState>;

// Email Triage State
export const EmailTriageState = z.object({
  userId: z.string(),
  blockId: z.string(),
  emails: z.array(z.object({
    id: z.string(),
    from_email: z.string(),
    from_name: z.string().nullable(),
    subject: z.string(),
    body_preview: z.string().nullable(),
    received_at: z.string(),
  })),
  decisions: z.array(z.object({
    emailId: z.string(),
    decision: EmailDecision,
    actionType: z.enum(['quick_reply', 'thoughtful_response', 'archive', 'no_action']),
    reasoning: z.string(),
    taskTitle: z.string().optional(),
  })),
  stats: z.object({
    processed: z.number(),
    now: z.number(),
    later: z.number(),
    never: z.number(),
  }),
});

export type EmailTriageStateType = z.infer<typeof EmailTriageState>;

// Generated Schedule Block
export interface GeneratedBlock {
  type: BlockTypeEnum;
  title: string;
  start_time: string;
  end_time: string;
  tasks?: string[];
  metadata?: Record<string, unknown>;
}

// Email Stats
export interface EmailStats {
  count: number;
  urgent: number;
  newsletters: number;
} 