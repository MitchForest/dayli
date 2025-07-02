import { z } from 'zod';

// Individual preference schema
export const preferenceSchema = z.object({
  key: z.string(),
  value: z.any(),
  type: z.enum(['string', 'number', 'boolean', 'time', 'select', 'array']),
  category: z.enum(['schedule', 'email', 'task', 'notification', 'ai', 'general']),
  label: z.string(),
  description: z.string().optional(),
  validation: z.object({
    required: z.boolean().default(true),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    options: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).optional(),
  }).optional(),
  defaultValue: z.any().optional(),
  updatedAt: z.string().datetime().optional(),
});

// Preference group schema
export const preferenceGroupSchema = z.object({
  category: z.string(),
  label: z.string(),
  description: z.string().optional(),
  preferences: z.array(preferenceSchema),
});

// Full preferences schema
export const userPreferencesSchema = z.object({
  userId: z.string(),
  preferences: z.record(z.any()), // key-value pairs
  groups: z.array(preferenceGroupSchema),
  lastUpdated: z.string().datetime(),
  version: z.number().default(1),
});

// Preference update schema
export const preferenceUpdateSchema = z.object({
  key: z.string(),
  previousValue: z.any(),
  newValue: z.any(),
  validation: z.object({
    isValid: z.boolean(),
    errors: z.array(z.string()).optional(),
  }),
  impact: z.object({
    affectedFeatures: z.array(z.string()),
    requiresRestart: z.boolean().default(false),
    immediateEffect: z.boolean().default(true),
  }).optional(),
});

// Batch preference update schema
export const batchPreferenceUpdateSchema = z.object({
  updates: z.array(preferenceUpdateSchema),
  summary: z.string(),
  totalUpdated: z.number(),
  failed: z.array(z.object({
    key: z.string(),
    reason: z.string(),
  })).optional(),
});

// Type exports
export type Preference = z.infer<typeof preferenceSchema>;
export type PreferenceGroup = z.infer<typeof preferenceGroupSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type PreferenceUpdate = z.infer<typeof preferenceUpdateSchema>;
export type BatchPreferenceUpdate = z.infer<typeof batchPreferenceUpdateSchema>; 