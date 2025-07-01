import type { CalendarEvent } from '../mock/calendar.service';

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
} 