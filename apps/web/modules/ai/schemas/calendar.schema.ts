import { z } from 'zod';

// Calendar event/meeting schema
export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isAllDay: z.boolean().default(false),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional(),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    responseStatus: z.enum(['accepted', 'declined', 'tentative', 'needsAction']).optional(),
    isOrganizer: z.boolean().default(false),
    isOptional: z.boolean().default(false),
  })).optional(),
  recurrence: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().min(1),
    until: z.string().datetime().optional(),
    count: z.number().optional(),
    daysOfWeek: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
  }).optional(),
  reminders: z.array(z.object({
    method: z.enum(['email', 'popup']),
    minutes: z.number(),
  })).optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).default('confirmed'),
  visibility: z.enum(['public', 'private']).default('public'),
  colorId: z.string().optional(),
});

// Available time slot schema
export const timeSlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  duration: z.number(), // minutes
  score: z.number().min(0).max(100).optional(), // preference score
  conflicts: z.array(z.string()).optional(), // conflicting event IDs
});

// Meeting scheduling request schema
export const meetingRequestSchema = z.object({
  title: z.string(),
  duration: z.number(), // minutes
  attendees: z.array(z.string().email()),
  preferredTimes: z.array(z.object({
    date: z.string(),
    timeRanges: z.array(z.object({
      start: z.string(),
      end: z.string(),
    })),
  })).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  needsPrepTime: z.boolean().default(false),
  prepDuration: z.number().default(15), // minutes
});

// Meeting conflict schema
export const meetingConflictSchema = z.object({
  conflictingEvents: z.array(calendarEventSchema),
  type: z.enum(['time_overlap', 'back_to_back', 'insufficient_break', 'attendee_conflict']),
  severity: z.enum(['high', 'medium', 'low']),
  suggestedResolutions: z.array(z.object({
    type: z.enum(['reschedule', 'shorten', 'cancel', 'make_optional']),
    description: z.string(),
    newTime: timeSlotSchema.optional(),
  })),
});

// Calendar availability schema
export const calendarAvailabilitySchema = z.object({
  date: z.string(),
  availableSlots: z.array(timeSlotSchema),
  busySlots: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    eventTitle: z.string().optional(),
    isPrivate: z.boolean().default(false),
  })),
  workingHours: z.object({
    start: z.string(),
    end: z.string(),
  }),
  totalAvailableMinutes: z.number(),
  utilizationPercentage: z.number(),
});

// Type exports
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type MeetingRequest = z.infer<typeof meetingRequestSchema>;
export type MeetingConflict = z.infer<typeof meetingConflictSchema>;
export type CalendarAvailability = z.infer<typeof calendarAvailabilitySchema>; 