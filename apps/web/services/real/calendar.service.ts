import { ServiceConfig } from '../interfaces/base.interface';
import type { ICalendarService } from '../interfaces/calendar.interface';

// Define CalendarEvent type here for now (will move to a shared types file later)
export interface CalendarEvent {
  kind: 'calendar#event';
  etag: string;
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink: string;
  created: string; // RFC3339
  updated: string; // RFC3339
  summary: string;
  description?: string;
  location?: string;
  creator: {
    email: string;
    displayName?: string;
  };
  organizer: {
    email: string;
    displayName?: string;
  };
  start: {
    dateTime?: string; // RFC3339
    date?: string; // All-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  recurrence?: string[];
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export class RealCalendarService implements ICalendarService {
  readonly serviceName = 'RealCalendarService';
  readonly isRealImplementation = true;
  private userId: string;
  private supabase: any;
  private userTimezone: string = 'America/New_York';

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.supabase = config.supabaseClient;
  }

  async listEvents(params: {
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
  }> {
    try {
      // For now, fetch calendar events from our database
      // Later, this will integrate with Google Calendar API
      const { data, error } = await this.supabase
        .from('calendar_events')
        .select()
        .eq('user_id', this.userId)
        .gte('start_time', params.timeMin)
        .lte('start_time', params.timeMax)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching calendar events:', error);
        // Return empty result instead of throwing
        return this.createEmptyResponse();
      }

      // Transform database events to Google Calendar format
      const items: CalendarEvent[] = (data || []).map((event: any) => ({
        kind: 'calendar#event',
        etag: `"${event.updated_at}"`,
        id: event.id,
        status: event.status || 'confirmed',
        htmlLink: `https://calendar.google.com/event?eid=${event.id}`,
        created: event.created_at,
        updated: event.updated_at,
        summary: event.title,
        description: event.description,
        location: event.location,
        creator: {
          email: event.creator_email || 'user@example.com',
          displayName: event.creator_name
        },
        organizer: {
          email: event.organizer_email || 'user@example.com',
          displayName: event.organizer_name
        },
        start: {
          dateTime: event.start_time,
          timeZone: this.userTimezone
        },
        end: {
          dateTime: event.end_time,
          timeZone: this.userTimezone
        },
        attendees: event.attendees || [],
        reminders: event.reminders || { useDefault: true }
      }));

      return {
        kind: 'calendar#events',
        etag: `"${Date.now()}"`,
        summary: params.calendarId,
        updated: new Date().toISOString(),
        timeZone: this.userTimezone,
        accessRole: 'owner',
        defaultReminders: [
          {
            method: 'popup',
            minutes: 10
          }
        ],
        items
      };
    } catch (error) {
      console.error('Unexpected error in listEvents:', error);
      return this.createEmptyResponse();
    }
  }

  async insertEvent(params: {
    calendarId: string;
    resource: Partial<CalendarEvent>;
  }): Promise<CalendarEvent> {
    const { resource } = params;
    
    // Transform Google Calendar format to database format
    const { data, error } = await this.supabase
      .from('calendar_events')
      .insert({
        user_id: this.userId,
        title: resource.summary,
        description: resource.description,
        location: resource.location,
        start_time: resource.start?.dateTime,
        end_time: resource.end?.dateTime,
        status: resource.status || 'confirmed',
        creator_email: resource.creator?.email,
        creator_name: resource.creator?.displayName,
        organizer_email: resource.organizer?.email,
        organizer_name: resource.organizer?.displayName,
        attendees: resource.attendees,
        reminders: resource.reminders
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create calendar event: ${error.message}`);

    // Transform back to Google Calendar format
    return {
      kind: 'calendar#event',
      etag: `"${data.updated_at}"`,
      id: data.id,
      status: data.status,
      htmlLink: `https://calendar.google.com/event?eid=${data.id}`,
      created: data.created_at,
      updated: data.updated_at,
      summary: data.title,
      description: data.description,
      location: data.location,
      creator: {
        email: data.creator_email || 'user@example.com',
        displayName: data.creator_name
      },
      organizer: {
        email: data.organizer_email || 'user@example.com',
        displayName: data.organizer_name
      },
      start: {
        dateTime: data.start_time,
        timeZone: this.userTimezone
      },
      end: {
        dateTime: data.end_time,
        timeZone: this.userTimezone
      },
      attendees: data.attendees || [],
      reminders: data.reminders || { useDefault: true }
    };
  }

  private createEmptyResponse() {
    return {
      kind: 'calendar#events' as const,
      etag: `"${Date.now()}"`,
      summary: 'primary',
      updated: new Date().toISOString(),
      timeZone: this.userTimezone,
      accessRole: 'owner' as const,
      defaultReminders: [
        {
          method: 'popup',
          minutes: 10
        }
      ],
      items: []
    };
  }
} 