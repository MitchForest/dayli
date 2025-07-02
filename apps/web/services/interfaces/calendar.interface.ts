import type { CalendarEvent } from '../real/calendar.service';

export interface ICalendarService {
  listEvents(params: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
    pageToken?: string;
    maxResults?: number;
  }): Promise<{
    kind: 'calendar#events';
    etag: string;
    summary: string;
    updated: string;
    timeZone: string;
    accessRole: string;
    defaultReminders: Array<{
      method: string;
      minutes: number;
    }>;
    nextPageToken?: string;
    items: CalendarEvent[];
  }>;
  
  insertEvent(params: {
    calendarId: string;
    resource: Partial<CalendarEvent>;
  }): Promise<CalendarEvent>;
  
  // Additional methods needed by calendar tools
  createEvent(params: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: Array<{ email: string }>;
  }): Promise<CalendarEvent>;
  
  getEvent(eventId: string): Promise<CalendarEvent | null>;
  
  updateEvent(eventId: string, updates: {
    summary?: string;
    description?: string;
    start?: Date;
    end?: Date;
  }): Promise<CalendarEvent>;
  
  deleteEvent(eventId: string): Promise<void>;
  
  checkConflicts(params: {
    start: Date;
    end: Date;
    excludeEventId?: string;
  }): Promise<CalendarEvent[]>;
  
  sendUpdateNotification(eventId: string, params: {
    message: string;
  }): Promise<void>;
  
  findAvailableSlots(params: {
    duration: number;
    attendees: string[];
    preferredTimes?: string[];
    workingHours: { start: string; end: string };
  }): Promise<Array<{ start: Date; end: Date }>>;
} 