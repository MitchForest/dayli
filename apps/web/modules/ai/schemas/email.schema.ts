import { z } from 'zod';

// Email attachment schema
export const emailAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(), // bytes
  url: z.string().optional(),
});

// Full email schema
export const emailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.object({
    name: z.string(),
    email: z.string(),
  }),
  to: z.array(z.object({
    name: z.string().optional(),
    email: z.string(),
  })),
  cc: z.array(z.object({
    name: z.string().optional(),
    email: z.string(),
  })).optional(),
  subject: z.string(),
  bodyPreview: z.string(),
  bodyHtml: z.string().optional(),
  bodyPlain: z.string(),
  receivedAt: z.string().datetime(),
  isRead: z.boolean(),
  isStarred: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
  urgency: z.enum(['urgent', 'important', 'normal']).default('normal'),
  actionItems: z.array(z.string()).optional(),
});

// Email list schema
export const emailListSchema = z.object({
  emails: z.array(emailSchema),
  totalCount: z.number(),
  unreadCount: z.number(),
  filters: z.object({
    isRead: z.boolean().optional(),
    isStarred: z.boolean().optional(),
    labels: z.array(z.string()).optional(),
    from: z.string().optional(),
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
  }).optional(),
  nextPageToken: z.string().optional(),
});

// Email draft schema
export const emailDraftSchema = z.object({
  id: z.string().optional(),
  to: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string(),
  body: z.string(),
  bodyHtml: z.string().optional(),
  replyToId: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64
    mimeType: z.string(),
  })).optional(),
  sendAt: z.string().datetime().optional(),
});

// Email action schema
export const emailActionSchema = z.object({
  emailId: z.string(),
  action: z.enum(['archive', 'delete', 'markRead', 'markUnread', 'star', 'unstar', 'label']),
  labels: z.array(z.string()).optional(), // for label action
  result: z.enum(['success', 'failed']),
  error: z.string().optional(),
});

// Email to task conversion schema
export const emailToTaskSchema = z.object({
  emailId: z.string(),
  email: emailSchema,
  suggestedTask: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    estimatedMinutes: z.number(),
    dueDate: z.string().optional(),
  }),
  createdTaskId: z.string().optional(),
});

// Type exports
export type Email = z.infer<typeof emailSchema>;
export type EmailList = z.infer<typeof emailListSchema>;
export type EmailDraft = z.infer<typeof emailDraftSchema>;
export type EmailAction = z.infer<typeof emailActionSchema>;
export type EmailToTask = z.infer<typeof emailToTaskSchema>; 