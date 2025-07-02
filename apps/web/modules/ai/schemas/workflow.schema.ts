import { z } from 'zod';

// Define the base schema without children first
const baseWorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['tool', 'decision', 'parallel', 'loop', 'condition']),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  input: z.any(),
  output: z.any().optional(),
  error: z.string().optional(),
});

// Workflow step schema with recursive children
export type WorkflowStep = z.infer<typeof baseWorkflowStepSchema> & {
  children?: WorkflowStep[];
};

export const workflowStepSchema: z.ZodType<WorkflowStep> = baseWorkflowStepSchema.extend({
  children: z.lazy(() => z.array(workflowStepSchema)).optional(),
});

// Workflow execution schema
export const workflowExecutionSchema = z.object({
  id: z.string(),
  workflowType: z.enum(['daily_planning', 'email_triage', 'task_review', 'schedule_optimization']),
  status: z.enum(['initializing', 'running', 'completed', 'failed', 'cancelled']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  currentStep: z.string().optional(),
  steps: z.array(workflowStepSchema),
  context: z.record(z.any()), // Workflow-specific context
  result: z.any().optional(),
  error: z.object({
    message: z.string(),
    step: z.string().optional(),
    recoverable: z.boolean(),
  }).optional(),
});

// Workflow progress schema
export const workflowProgressSchema = z.object({
  workflowId: z.string(),
  currentStep: z.string(),
  totalSteps: z.number(),
  completedSteps: z.number(),
  percentage: z.number().min(0).max(100),
  estimatedTimeRemaining: z.number().optional(), // seconds
  message: z.string(),
  canCancel: z.boolean().default(true),
  canPause: z.boolean().default(false),
});

// Workflow result schema
export const workflowResultSchema = z.object({
  workflowId: z.string(),
  type: z.string(),
  summary: z.string(),
  changes: z.array(z.object({
    type: z.string(),
    description: z.string(),
    entityId: z.string().optional(),
    entityType: z.enum(['task', 'schedule', 'email', 'preference']).optional(),
  })),
  metrics: z.object({
    tasksProcessed: z.number().optional(),
    emailsTriaged: z.number().optional(),
    blocksOptimized: z.number().optional(),
    timesSaved: z.number().optional(), // minutes
  }).optional(),
  requiresConfirmation: z.boolean().default(false),
  confirmationId: z.string().optional(),
});

// Workflow template schema
export const workflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  triggers: z.array(z.enum(['manual', 'scheduled', 'event'])),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    default: z.any().optional(),
    description: z.string().optional(),
  })),
  estimatedDuration: z.number(), // seconds
  category: z.enum(['productivity', 'organization', 'communication', 'analysis']),
});

// Type exports
export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;
export type WorkflowProgress = z.infer<typeof workflowProgressSchema>;
export type WorkflowResult = z.infer<typeof workflowResultSchema>;
export type WorkflowTemplate = z.infer<typeof workflowTemplateSchema>; 