import { z } from 'zod';

// Component schemas need to be defined before they're used
export const scheduleBlockComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['work', 'meeting', 'email', 'break', 'blocked']),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  description: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    estimatedMinutes: z.number(),
    completed: z.boolean(),
  })).optional(),
});

export const taskCardComponentSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedMinutes: z.number(),
  status: z.enum(['backlog', 'scheduled', 'in_progress', 'completed']),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const emailPreviewComponentSchema = z.object({
  id: z.string(),
  from: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  preview: z.string(),
  receivedAt: z.string(),
  isRead: z.boolean(),
  hasAttachments: z.boolean(),
  urgency: z.enum(['urgent', 'important', 'normal']).optional(),
});

export const meetingCardComponentSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  date: z.string(),
  attendees: z.array(z.object({
    email: z.string(),
    name: z.string(),
  })),
  location: z.string().optional(),
  description: z.string().optional(),
  meetingUrl: z.string().optional(),
  hasConflicts: z.boolean().optional(),
});

export const preferenceFormComponentSchema = z.object({
  key: z.string(),
  value: z.any(),
  type: z.enum(['text', 'number', 'boolean', 'select', 'time']),
  label: z.string(),
  description: z.string().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
});

export const progressIndicatorSchema = z.object({
  current: z.number(),
  total: z.number(),
  label: z.string(),
  percentage: z.number().min(0).max(100),
});

export const confirmationDialogSchema = z.object({
  title: z.string(),
  message: z.string(),
  confirmText: z.string().default('Confirm'),
  cancelText: z.string().default('Cancel'),
  variant: z.enum(['info', 'warning', 'danger']).default('info'),
});

// Component schema for modular UI
export const componentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scheduleBlock'),
    data: scheduleBlockComponentSchema,
  }),
  z.object({
    type: z.literal('taskCard'),
    data: taskCardComponentSchema,
  }),
  z.object({
    type: z.literal('emailPreview'),
    data: emailPreviewComponentSchema,
  }),
  z.object({
    type: z.literal('meetingCard'),
    data: meetingCardComponentSchema,
  }),
  z.object({
    type: z.literal('preferenceForm'),
    data: preferenceFormComponentSchema,
  }),
  z.object({
    type: z.literal('progressIndicator'),
    data: progressIndicatorSchema,
  }),
  z.object({
    type: z.literal('confirmationDialog'),
    data: confirmationDialogSchema,
  }),
]);

// Action schema for contextual actions
export const actionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  variant: z.enum(['primary', 'secondary', 'danger']).default('secondary'),
  action: z.object({
    type: z.enum(['tool', 'message', 'url']),
    tool: z.string().optional(),
    params: z.record(z.any()).optional(),
    message: z.string().optional(),
    url: z.string().optional(),
  }),
});

// Base response that ALL tools must return
export const universalToolResponseSchema = z.object({
  // Response metadata
  metadata: z.object({
    toolName: z.string(),
    operation: z.enum(['create', 'read', 'update', 'delete', 'execute']),
    resourceType: z.enum(['schedule', 'task', 'email', 'meeting', 'preference', 'workflow']),
    timestamp: z.string().datetime(),
    executionTime: z.number(), // milliseconds
  }),
  
  // The actual data - validated per resource type
  data: z.any(), // Will be refined by specific schemas
  
  // Display instructions for UI
  display: z.object({
    type: z.enum(['card', 'list', 'timeline', 'grid', 'form', 'confirmation', 'progress']),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    components: z.array(componentSchema),
  }),
  
  // UI behavior hints
  ui: z.object({
    notification: z.object({
      show: z.boolean(),
      type: z.enum(['success', 'info', 'warning', 'error']),
      message: z.string(),
      duration: z.number().default(3000),
    }).optional(),
    suggestions: z.array(z.string()),
    actions: z.array(actionSchema),
    confirmationRequired: z.boolean().default(false),
    confirmationId: z.string().optional(),
  }),
  
  // Streaming support
  streaming: z.object({
    supported: z.boolean(),
    progress: z.number().min(0).max(100).optional(),
    stage: z.enum(['initializing', 'processing', 'finalizing', 'complete']).optional(),
    partialData: z.any().optional(),
  }).optional(),
  
  // Error handling
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    recoverable: z.boolean(),
    suggestedActions: z.array(z.string()),
  }).optional(),
});

// Type exports for easier use
export type UniversalToolResponse = z.infer<typeof universalToolResponseSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Action = z.infer<typeof actionSchema>; 