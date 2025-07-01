import type { ICalendarService } from '../interfaces/calendar.interface';

// Matches Google Calendar API v3 format
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

interface CalendarListResponse {
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
}

export class MockCalendarService implements ICalendarService {
  private events: Map<string, CalendarEvent> = new Map();
  private userTimezone: string = 'America/New_York'; // Default timezone
  
  constructor(timezone?: string) {
    if (timezone) {
      this.userTimezone = timezone;
    }
    this.generateRealisticEvents();
  }

  private generateRealisticEvents(): void {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Event templates
    const recurringMeetings = [
      {
        summary: 'Daily Standup',
        description: 'Team sync to discuss daily priorities',
        hour: 9,
        duration: 15,
        recurrence: 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
        attendees: ['team@company.com']
      },
      {
        summary: 'Weekly Team Meeting',
        description: 'Weekly team sync and planning',
        hour: 14,
        duration: 60,
        dayOfWeek: 1, // Monday
        recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
        attendees: ['team@company.com', 'manager@company.com']
      },
      {
        summary: 'Sprint Planning',
        description: 'Plan upcoming sprint work',
        hour: 10,
        duration: 120,
        dayOfWeek: 1, // Monday
        recurrence: 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        attendees: ['team@company.com', 'product@company.com']
      }
    ];
    
    const oneOffMeetings = [
      {
        summary: '1:1 with Manager',
        description: 'Weekly check-in',
        hour: 11,
        duration: 30,
        attendees: ['manager@company.com']
      },
      {
        summary: 'Product Review',
        description: 'Review new feature designs',
        hour: 15,
        duration: 60,
        attendees: ['design@company.com', 'product@company.com']
      },
      {
        summary: 'Client Call',
        description: 'Quarterly business review',
        hour: 10,
        duration: 60,
        attendees: ['client@external.com', 'sales@company.com']
      },
      {
        summary: 'All Hands Meeting',
        description: 'Company-wide update',
        hour: 16,
        duration: 60,
        attendees: ['all@company.com']
      }
    ];
    
    // Generate events for -3 to +3 days
    for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      targetDate.setHours(0, 0, 0, 0);
      
      // Add recurring meetings
      recurringMeetings.forEach((meeting, index) => {
        // Check if this meeting occurs on this day
        const dayOfWeek = targetDate.getDay();
        if (meeting.dayOfWeek !== undefined && meeting.dayOfWeek !== dayOfWeek) {
          return; // Skip if not the right day
        }
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return; // Skip weekends for daily meetings
        }
        
        const eventTime = new Date(targetDate);
        eventTime.setHours(meeting.hour, 0, 0, 0);
        
        const endTime = new Date(eventTime);
        endTime.setMinutes(endTime.getMinutes() + meeting.duration);
        
        const eventId = `recurring_${index}_${dayOffset}_${Math.random().toString(36).substr(2, 9)}`;
        
        const event: CalendarEvent = {
          kind: 'calendar#event',
          etag: `"${Math.random().toString(36).substr(2, 9)}"`,
          id: eventId,
          status: 'confirmed',
          htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
          created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          summary: meeting.summary,
          description: meeting.description,
          creator: {
            email: 'user@example.com',
            displayName: 'You'
          },
          organizer: {
            email: 'user@example.com',
            displayName: 'You'
          },
          start: {
            dateTime: eventTime.toISOString(),
            timeZone: this.userTimezone
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: this.userTimezone
          },
          recurrence: meeting.recurrence ? [meeting.recurrence] : undefined,
          attendees: meeting.attendees.map(email => ({
            email,
            displayName: email.split('@')[0],
            responseStatus: 'accepted' as const
          })),
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 10 }
            ]
          }
        };
        
        this.events.set(eventId, event);
      });
      
      // Add 1-3 one-off meetings per day
      const meetingCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < meetingCount; i++) {
        const meetingTemplate = oneOffMeetings[Math.floor(Math.random() * oneOffMeetings.length)]!;
        
        const eventTime = new Date(targetDate);
        eventTime.setHours(
          meetingTemplate.hour + Math.floor(Math.random() * 2),
          Math.random() > 0.5 ? 0 : 30,
          0,
          0
        );
        
        const endTime = new Date(eventTime);
        endTime.setMinutes(endTime.getMinutes() + meetingTemplate.duration);
        
        const eventId = `oneoff_${dayOffset}_${i}_${Math.random().toString(36).substr(2, 9)}`;
        
        const event: CalendarEvent = {
          kind: 'calendar#event',
          etag: `"${Math.random().toString(36).substr(2, 9)}"`,
          id: eventId,
          status: 'confirmed',
          htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
          created: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          summary: meetingTemplate.summary,
          description: meetingTemplate.description,
          creator: {
            email: meetingTemplate.attendees[0] || 'user@example.com',
            displayName: meetingTemplate.attendees[0]?.split('@')[0] || 'You'
          },
          organizer: {
            email: meetingTemplate.attendees[0] || 'user@example.com',
            displayName: meetingTemplate.attendees[0]?.split('@')[0] || 'You'
          },
          start: {
            dateTime: eventTime.toISOString(),
            timeZone: this.userTimezone
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: this.userTimezone
          },
          attendees: [
            {
              email: 'user@example.com',
              displayName: 'You',
              responseStatus: 'accepted'
            },
            ...meetingTemplate.attendees.map(email => ({
              email,
              displayName: email.split('@')[0],
              responseStatus: 'accepted' as const
            }))
          ],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 10 }
            ]
          }
        };
        
        this.events.set(eventId, event);
      }
    }
  }

  async listEvents(params: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
    pageToken?: string;
    maxResults?: number;
  }): Promise<CalendarListResponse> {
    const timeMin = new Date(params.timeMin);
    const timeMax = new Date(params.timeMax);
    const maxResults = params.maxResults || 250;
    
    // Filter events within time range
    const filteredEvents = Array.from(this.events.values()).filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date || '');
      return eventStart >= timeMin && eventStart <= timeMax;
    });
    
    // Sort by start time
    filteredEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date || '');
      const bStart = new Date(b.start.dateTime || b.start.date || '');
      return aStart.getTime() - bStart.getTime();
    });
    
    // Implement pagination
    const startIndex = params.pageToken ? parseInt(params.pageToken) : 0;
    const endIndex = Math.min(startIndex + maxResults, filteredEvents.length);
    const pageEvents = filteredEvents.slice(startIndex, endIndex);
    
    return {
      kind: 'calendar#events',
      etag: `"${Math.random().toString(36).substr(2, 9)}"`,
      summary: 'user@example.com',
      updated: new Date().toISOString(),
      timeZone: this.userTimezone,
      accessRole: 'owner',
      defaultReminders: [
        { method: 'popup', minutes: 10 }
      ],
      nextPageToken: endIndex < filteredEvents.length ? endIndex.toString() : undefined,
      items: pageEvents
    };
  }

  async insertEvent(params: {
    calendarId: string;
    resource: Partial<CalendarEvent>;
  }): Promise<CalendarEvent> {
    const eventId = `created_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newEvent: CalendarEvent = {
      kind: 'calendar#event',
      etag: `"${Math.random().toString(36).substr(2, 9)}"`,
      id: eventId,
      status: params.resource.status || 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      created: now,
      updated: now,
      summary: params.resource.summary || 'New Event',
      description: params.resource.description,
      location: params.resource.location,
      creator: {
        email: 'user@example.com',
        displayName: 'You'
      },
      organizer: {
        email: 'user@example.com',
        displayName: 'You'
      },
      start: params.resource.start || {
        dateTime: new Date().toISOString(),
        timeZone: this.userTimezone
      },
      end: params.resource.end || {
        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        timeZone: this.userTimezone
      },
      attendees: params.resource.attendees,
      reminders: params.resource.reminders || {
        useDefault: true
      }
    };
    
    this.events.set(eventId, newEvent);
    return newEvent;
  }

  // Helper method to get all events (for seeding database)
  getAllEvents(): CalendarEvent[] {
    return Array.from(this.events.values());
  }
} 