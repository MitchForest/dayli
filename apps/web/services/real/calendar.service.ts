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
      // Fetch meeting time blocks from our database
      const { data, error } = await this.supabase
        .from('time_blocks')
        .select()
        .eq('user_id', this.userId)
        .eq('type', 'meeting')  // Only get meeting blocks
        .gte('start_time', params.timeMin)
        .lte('start_time', params.timeMax)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching meeting blocks:', error);
        // Return empty result instead of throwing
        return this.createEmptyResponse();
      }

      // Transform time blocks to Google Calendar format
      const items: CalendarEvent[] = (data || []).map((block: any) => ({
        kind: 'calendar#event',
        etag: `"${block.updated_at}"`,
        id: block.id,
        status: block.metadata?.status || 'confirmed',
        htmlLink: `https://calendar.google.com/event?eid=${block.id}`,
        created: block.created_at,
        updated: block.updated_at,
        summary: block.title,
        description: block.description,
        location: block.metadata?.location,
        creator: {
          email: block.metadata?.creator_email || 'user@example.com',
          displayName: block.metadata?.creator_name
        },
        organizer: {
          email: block.metadata?.organizer_email || 'user@example.com',
          displayName: block.metadata?.organizer_name
        },
        start: {
          dateTime: block.start_time,
          timeZone: this.userTimezone
        },
        end: {
          dateTime: block.end_time,
          timeZone: this.userTimezone
        },
        attendees: block.metadata?.attendees || [],
        reminders: block.metadata?.reminders || { useDefault: true }
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
    
    // Transform Google Calendar format to time block format
    const { data, error } = await this.supabase
      .from('time_blocks')
      .insert({
        user_id: this.userId,
        type: 'meeting',  // All calendar events are meetings
        title: resource.summary || 'Untitled Meeting',
        description: resource.description,
        start_time: resource.start?.dateTime,
        end_time: resource.end?.dateTime,
        source: 'calendar',
        calendar_event_id: resource.id,  // Store external calendar ID if provided
        metadata: {
          status: resource.status || 'confirmed',
          location: resource.location,
          creator_email: resource.creator?.email,
          creator_name: resource.creator?.displayName,
          organizer_email: resource.organizer?.email,
          organizer_name: resource.organizer?.displayName,
          attendees: resource.attendees,
          reminders: resource.reminders
        }
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create meeting block: ${error.message}`);

    // Transform back to Google Calendar format
    return {
      kind: 'calendar#event',
      etag: `"${data.updated_at}"`,
      id: data.id,
      status: data.metadata?.status || 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=${data.id}`,
      created: data.created_at,
      updated: data.updated_at,
      summary: data.title,
      description: data.description,
      location: data.metadata?.location,
      creator: {
        email: data.metadata?.creator_email || 'user@example.com',
        displayName: data.metadata?.creator_name
      },
      organizer: {
        email: data.metadata?.organizer_email || 'user@example.com',
        displayName: data.metadata?.organizer_name
      },
      start: {
        dateTime: data.start_time,
        timeZone: this.userTimezone
      },
      end: {
        dateTime: data.end_time,
        timeZone: this.userTimezone
      },
      attendees: data.metadata?.attendees || [],
      reminders: data.metadata?.reminders || { useDefault: true }
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
  
  // Additional methods needed by calendar tools
  async createEvent(params: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: Array<{ email: string }>;
  }): Promise<CalendarEvent> {
    return this.insertEvent({
      calendarId: 'primary',
      resource: {
        summary: params.summary,
        description: params.description,
        start: {
          dateTime: params.start.toISOString(),
          timeZone: this.userTimezone
        },
        end: {
          dateTime: params.end.toISOString(),
          timeZone: this.userTimezone
        },
        attendees: params.attendees?.map(a => ({
          email: a.email,
          responseStatus: 'needsAction' as const
        }))
      }
    });
  }
  
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const { data, error } = await this.supabase
        .from('time_blocks')
        .select()
        .eq('id', eventId)
        .eq('user_id', this.userId)
        .eq('type', 'meeting')  // Only get meeting blocks
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to get meeting: ${error.message}`);
      }

      // Transform to Google Calendar format
      return {
        kind: 'calendar#event',
        etag: `"${data.updated_at}"`,
        id: data.id,
        status: data.metadata?.status || 'confirmed',
        htmlLink: `https://calendar.google.com/event?eid=${data.id}`,
        created: data.created_at,
        updated: data.updated_at,
        summary: data.title,
        description: data.description,
        location: data.metadata?.location,
        creator: {
          email: data.metadata?.creator_email || 'user@example.com',
          displayName: data.metadata?.creator_name
        },
        organizer: {
          email: data.metadata?.organizer_email || 'user@example.com',
          displayName: data.metadata?.organizer_name
        },
        start: {
          dateTime: data.start_time,
          timeZone: this.userTimezone
        },
        end: {
          dateTime: data.end_time,
          timeZone: this.userTimezone
        },
        attendees: data.metadata?.attendees || [],
        reminders: data.metadata?.reminders || { useDefault: true }
      };
    } catch (error) {
      console.error('Error getting event:', error);
      return null;
    }
  }
  
  async updateEvent(eventId: string, updates: {
    summary?: string;
    description?: string;
    start?: Date;
    end?: Date;
  }): Promise<CalendarEvent> {
    const updateData: any = {};
    if (updates.summary) updateData.title = updates.summary;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.start) updateData.start_time = updates.start.toISOString();
    if (updates.end) updateData.end_time = updates.end.toISOString();
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('time_blocks')
      .update(updateData)
      .eq('id', eventId)
      .eq('user_id', this.userId)
      .eq('type', 'meeting')  // Only update meeting blocks
      .select()
      .single();

    if (error) throw new Error(`Failed to update meeting: ${error.message}`);

    // Transform back to Google Calendar format
    return {
      kind: 'calendar#event',
      etag: `"${data.updated_at}"`,
      id: data.id,
      status: data.metadata?.status || 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=${data.id}`,
      created: data.created_at,
      updated: data.updated_at,
      summary: data.title,
      description: data.description,
      location: data.metadata?.location,
      creator: {
        email: data.metadata?.creator_email || 'user@example.com',
        displayName: data.metadata?.creator_name
      },
      organizer: {
        email: data.metadata?.organizer_email || 'user@example.com',
        displayName: data.metadata?.organizer_name
      },
      start: {
        dateTime: data.start_time,
        timeZone: this.userTimezone
      },
      end: {
        dateTime: data.end_time,
        timeZone: this.userTimezone
      },
      attendees: data.metadata?.attendees || [],
      reminders: data.metadata?.reminders || { useDefault: true }
    };
  }
  
  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .from('time_blocks')
      .delete()
      .eq('id', eventId)
      .eq('user_id', this.userId)
      .eq('type', 'meeting');  // Only delete meeting blocks

    if (error) throw new Error(`Failed to delete meeting: ${error.message}`);
  }
  
  async checkConflicts(params: {
    start: Date;
    end: Date;
    excludeEventId?: string;
  }): Promise<CalendarEvent[]> {
    let query = this.supabase
      .from('time_blocks')
      .select()
      .eq('user_id', this.userId)
      .in('type', ['meeting', 'work', 'blocked'])  // Check conflicts with meetings, work blocks, and blocked time
      .or(`and(start_time.lt.${params.end.toISOString()},end_time.gt.${params.start.toISOString()})`);

    if (params.excludeEventId) {
      query = query.neq('id', params.excludeEventId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to check conflicts: ${error.message}`);

    // Transform to CalendarEvent format (only return meetings)
    return (data || [])
      .filter((block: any) => block.type === 'meeting')  // Only return meeting conflicts
      .map((block: any) => ({
        kind: 'calendar#event',
        etag: `"${block.updated_at}"`,
        id: block.id,
        status: block.metadata?.status || 'confirmed',
        htmlLink: `https://calendar.google.com/event?eid=${block.id}`,
        created: block.created_at,
        updated: block.updated_at,
        summary: block.title,
        description: block.description,
        location: block.metadata?.location,
        creator: {
          email: block.metadata?.creator_email || 'user@example.com',
          displayName: block.metadata?.creator_name
        },
        organizer: {
          email: block.metadata?.organizer_email || 'user@example.com',
          displayName: block.metadata?.organizer_name
        },
        start: {
          dateTime: block.start_time,
          timeZone: this.userTimezone
        },
        end: {
          dateTime: block.end_time,
          timeZone: this.userTimezone
        },
        attendees: block.metadata?.attendees || [],
        reminders: block.metadata?.reminders || { useDefault: true }
      }));
  }
  
  async sendUpdateNotification(eventId: string, params: {
    message: string;
  }): Promise<void> {
    // For now, just log the notification
    // In production, this would send emails to attendees
    console.log(`Event update notification for ${eventId}: ${params.message}`);
    
    // Could store in a notifications table
    const { error } = await this.supabase
      .from('notifications')
      .insert({
        user_id: this.userId,
        type: 'calendar_update',
        event_id: eventId,
        message: params.message,
        sent_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store notification:', error);
      // Don't throw - notifications are non-critical
    }
  }
  
  async findAvailableSlots(params: {
    duration: number;
    attendees: string[];
    preferredTimes?: string[];
    workingHours: { start: string; end: string };
  }): Promise<Array<{ start: Date; end: Date }>> {
    // Get all blocks for today (meetings, work blocks, and blocked time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: blocks } = await this.supabase
      .from('time_blocks')
      .select()
      .eq('user_id', this.userId)
      .in('type', ['meeting', 'work', 'blocked', 'email', 'break'])  // All block types that occupy time
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true });

    // Parse working hours
    const workHoursParts = params.workingHours.start.split(':');
    const workStartHour = parseInt(workHoursParts[0] || '9', 10);
    const workStartMin = parseInt(workHoursParts[1] || '0', 10);
    
    const workEndParts = params.workingHours.end.split(':');
    const workEndHour = parseInt(workEndParts[0] || '17', 10);
    const workEndMin = parseInt(workEndParts[1] || '0', 10);
    
    const workStart = new Date(today);
    workStart.setHours(workStartHour, workStartMin, 0, 0);
    
    const workEnd = new Date(today);
    workEnd.setHours(workEndHour, workEndMin, 0, 0);

    // Find gaps in schedule
    const availableSlots: Array<{ start: Date; end: Date }> = [];
    let currentTime = new Date(workStart);

    for (const block of blocks || []) {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);

      // Check if there's a gap before this block
      const gapMinutes = (blockStart.getTime() - currentTime.getTime()) / (1000 * 60);
      if (gapMinutes >= params.duration) {
        availableSlots.push({
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + params.duration * 60 * 1000)
        });
      }

      // Move current time to end of this block
      currentTime = new Date(Math.max(currentTime.getTime(), blockEnd.getTime()));
    }

    // Check if there's time after the last block
    const remainingMinutes = (workEnd.getTime() - currentTime.getTime()) / (1000 * 60);
    if (remainingMinutes >= params.duration) {
      availableSlots.push({
        start: new Date(currentTime),
        end: new Date(currentTime.getTime() + params.duration * 60 * 1000)
      });
    }

    // Filter by preferred times if provided
    if (params.preferredTimes && params.preferredTimes.length > 0) {
      // This would need more sophisticated parsing of preferred times
      // For now, return first 3 slots
      return availableSlots.slice(0, 3);
    }

    return availableSlots;
  }
} 