# Sprint 03.05: Gmail & Calendar API Integration

## Sprint Overview

**Sprint Number**: 03.05  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: NOT STARTED

### Sprint Goal
Replace all mock data services with real Gmail and Google Calendar API integrations. This sprint transforms dayli from a demo app to a real productivity assistant that works with actual user data. All existing workflows should continue working seamlessly with real data.

### Context for Executor
In previous sprints, we built:
- Sprint 03.01-03.04: Complete AI workflows using mock data
- Data-agnostic service interfaces throughout

Now we're making it real. The architecture was designed to be data-source agnostic, so this sprint focuses on:
1. Implementing real API services that match our existing interfaces
2. Setting up OAuth2 authentication flows
3. Handling rate limits and error cases
4. Removing all mock data generators

## Prerequisites from Previous Sprints

Before starting, verify:
- [ ] All workflows function correctly with mock data
- [ ] Service interfaces are properly defined
- [ ] Supabase OAuth integration is configured
- [ ] Google Cloud Console project is set up

## Key Concepts

### Data Source Abstraction
Our architecture uses service interfaces that don't care about data source:
```typescript
interface GmailService {
  getMessages(params: GetMessagesParams): Promise<EmailMessage[]>
  getMessage(id: string): Promise<EmailMessage>
  updateMessage(id: string, updates: MessageUpdates): Promise<void>
}
```

The workflows only interact with these interfaces, not the implementation.

### OAuth2 Flow
1. User clicks "Connect Gmail/Calendar"
2. Redirect to Google OAuth consent
3. Receive authorization code
4. Exchange for access/refresh tokens
5. Store tokens securely in Supabase

### API Rate Limiting
- Gmail: 250 quota units per user per second
- Calendar: 500 queries per 100 seconds
- Implement exponential backoff for rate limit errors

## Key Deliverables

### 1. Update Service Interfaces for Real APIs

**File**: `apps/web/services/interfaces/gmail.interface.ts` (Update existing)

```typescript
export interface EmailMessage {
  id: string;
  threadId: string;
  sender: string;
  senderName?: string;
  recipients: string[];
  subject: string;
  snippet: string;
  body?: string;
  date: Date;
  labels: string[];
  attachments: Attachment[];
  isRead: boolean;
  isStarred: boolean;
  importance?: 'high' | 'normal' | 'low';
  urgency?: 'urgent' | 'normal' | 'low';
}

export interface GetMessagesParams {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export interface MessageUpdates {
  addLabelIds?: string[];
  removeLabelIds?: string[];
  markAsRead?: boolean;
  markAsStarred?: boolean;
}

export interface GmailService {
  // Core methods
  getMessages(params: GetMessagesParams): Promise<{
    messages: EmailMessage[];
    nextPageToken?: string;
  }>;
  getMessage(id: string): Promise<EmailMessage>;
  updateMessage(id: string, updates: MessageUpdates): Promise<void>;
  
  // Batch operations
  batchUpdateMessages(updates: Array<{
    id: string;
    updates: MessageUpdates;
  }>): Promise<void>;
  
  // Label management
  getLabels(): Promise<Label[]>;
  createLabel(name: string): Promise<Label>;
}
```

**File**: `apps/web/services/interfaces/calendar.interface.ts` (Update existing)

```typescript
export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
  attendees: Attendee[];
  organizer: {
    email: string;
    displayName?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'public' | 'private' | 'confidential';
  reminders: Reminder[];
  recurrence?: string[];
  colorId?: string;
}

export interface GetEventsParams {
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
  maxResults?: number;
  pageToken?: string;
  q?: string;
  showDeleted?: boolean;
  singleEvents?: boolean;
}

export interface CalendarService {
  // Calendar management
  getCalendars(): Promise<Calendar[]>;
  
  // Event operations
  getEvents(params: GetEventsParams): Promise<{
    events: CalendarEvent[];
    nextPageToken?: string;
  }>;
  getEvent(calendarId: string, eventId: string): Promise<CalendarEvent>;
  createEvent(calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;
  updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  
  // Availability
  getFreeBusy(params: FreeBusyParams): Promise<FreeBusyResponse>;
}
```

### 2. Implement Gmail Service

**File**: `apps/web/services/impl/gmail.service.ts`

```typescript
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailService, EmailMessage, GetMessagesParams, MessageUpdates } from '../interfaces/gmail.interface';
import { createClient } from '@supabase/supabase-js';

export class GmailServiceImpl implements GmailService {
  private gmail: gmail_v1.Gmail;
  private oauth2Client: OAuth2Client;
  private userId: string;
  
  constructor(userId: string, accessToken: string, refreshToken: string) {
    this.userId = userId;
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    // Handle token refresh
    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        this.updateStoredTokens(tokens);
      }
    });
  }
  
  async getMessages(params: GetMessagesParams): Promise<{
    messages: EmailMessage[];
    nextPageToken?: string;
  }> {
    try {
      // Build query
      const query = this.buildQuery(params);
      
      // Fetch message list
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: params.maxResults || 20,
        pageToken: params.pageToken,
        labelIds: params.labelIds,
        includeSpamTrash: params.includeSpamTrash || false,
      });
      
      if (!response.data.messages) {
        return { messages: [] };
      }
      
      // Fetch full message details in parallel
      const messages = await Promise.all(
        response.data.messages.map(msg => this.getMessage(msg.id!))
      );
      
      return {
        messages,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async getMessage(id: string): Promise<EmailMessage> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      
      return this.parseMessage(response.data);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async updateMessage(id: string, updates: MessageUpdates): Promise<void> {
    try {
      const modifyRequest: gmail_v1.Schema$ModifyMessageRequest = {};
      
      if (updates.addLabelIds) {
        modifyRequest.addLabelIds = updates.addLabelIds;
      }
      
      if (updates.removeLabelIds) {
        modifyRequest.removeLabelIds = updates.removeLabelIds;
      }
      
      if (updates.markAsRead !== undefined) {
        if (updates.markAsRead) {
          modifyRequest.removeLabelIds = [...(modifyRequest.removeLabelIds || []), 'UNREAD'];
        } else {
          modifyRequest.addLabelIds = [...(modifyRequest.addLabelIds || []), 'UNREAD'];
        }
      }
      
      if (updates.markAsStarred !== undefined) {
        if (updates.markAsStarred) {
          modifyRequest.addLabelIds = [...(modifyRequest.addLabelIds || []), 'STARRED'];
        } else {
          modifyRequest.removeLabelIds = [...(modifyRequest.removeLabelIds || []), 'STARRED'];
        }
      }
      
      await this.gmail.users.messages.modify({
        userId: 'me',
        id,
        requestBody: modifyRequest,
      });
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async batchUpdateMessages(updates: Array<{
    id: string;
    updates: MessageUpdates;
  }>): Promise<void> {
    // Gmail doesn't have a true batch modify endpoint, so we'll use parallel requests
    // with rate limiting
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await Promise.all(
        batch.map(({ id, updates }) => this.updateMessage(id, updates))
      );
      
      // Rate limit protection
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  async getLabels(): Promise<Label[]> {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me',
      });
      
      return response.data.labels?.map(label => ({
        id: label.id!,
        name: label.name!,
        type: label.type as 'system' | 'user',
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
      })) || [];
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async createLabel(name: string): Promise<Label> {
    try {
      const response = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          messageListVisibility: 'show',
          labelListVisibility: 'labelShow',
        },
      });
      
      return {
        id: response.data.id!,
        name: response.data.name!,
        type: 'user',
        messageListVisibility: response.data.messageListVisibility,
        labelListVisibility: response.data.labelListVisibility,
      };
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  private buildQuery(params: GetMessagesParams): string {
    const parts: string[] = [];
    
    if (params.query) {
      parts.push(params.query);
    }
    
    // Add default filters for productivity
    parts.push('-category:promotions');
    parts.push('-category:social');
    
    return parts.join(' ');
  }
  
  private parseMessage(message: gmail_v1.Schema$Message): EmailMessage {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
    
    const sender = getHeader('from');
    const senderMatch = sender.match(/^(?:"?([^"]*)"?\s)?<(.+)>$/);
    
    return {
      id: message.id!,
      threadId: message.threadId!,
      sender: senderMatch ? senderMatch[2] : sender,
      senderName: senderMatch ? senderMatch[1] : undefined,
      recipients: getHeader('to').split(',').map(r => r.trim()),
      subject: getHeader('subject'),
      snippet: message.snippet || '',
      body: this.extractBody(message.payload),
      date: new Date(parseInt(message.internalDate!)),
      labels: message.labelIds || [],
      attachments: this.extractAttachments(message.payload),
      isRead: !message.labelIds?.includes('UNREAD'),
      isStarred: message.labelIds?.includes('STARRED') || false,
      importance: this.inferImportance(message),
      urgency: this.inferUrgency(message),
    };
  }
  
  private extractBody(payload?: gmail_v1.Schema$MessagePart): string {
    if (!payload) return '';
    
    // Handle single part message
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    
    // Handle multipart message
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      
      // Fallback to HTML if no plain text
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
          // Simple HTML to text conversion
          return html.replace(/<[^>]*>/g, '');
        }
      }
    }
    
    return '';
  }
  
  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): Attachment[] {
    const attachments: Attachment[] = [];
    
    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }
      
      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };
    
    if (payload) {
      extractFromPart(payload);
    }
    
    return attachments;
  }
  
  private inferImportance(message: gmail_v1.Schema$Message): 'high' | 'normal' | 'low' {
    // Check for importance markers
    if (message.labelIds?.includes('IMPORTANT')) return 'high';
    
    const headers = message.payload?.headers || [];
    const importance = headers.find(h => h.name === 'Importance')?.value;
    
    if (importance === 'high') return 'high';
    if (importance === 'low') return 'low';
    
    return 'normal';
  }
  
  private inferUrgency(message: gmail_v1.Schema$Message): 'urgent' | 'normal' | 'low' {
    const subject = message.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
    const body = message.snippet || '';
    
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
    const text = `${subject} ${body}`.toLowerCase();
    
    if (urgentKeywords.some(keyword => text.includes(keyword))) {
      return 'urgent';
    }
    
    return 'normal';
  }
  
  private async updateStoredTokens(tokens: any) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    await supabase
      .from('oauth_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      })
      .eq('user_id', this.userId)
      .eq('provider', 'google');
  }
  
  private handleApiError(error: any) {
    if (error.code === 429) {
      console.error('Gmail API rate limit exceeded');
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    if (error.code === 401) {
      console.error('Gmail API authentication failed');
      throw new Error('Authentication failed. Please reconnect your Google account.');
    }
    
    console.error('Gmail API error:', error);
  }
}
```

### 3. Implement Calendar Service

**File**: `apps/web/services/impl/calendar.service.ts`

```typescript
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CalendarService, CalendarEvent, GetEventsParams } from '../interfaces/calendar.interface';

export class CalendarServiceImpl implements CalendarService {
  private calendar: calendar_v3.Calendar;
  private oauth2Client: OAuth2Client;
  private userId: string;
  
  constructor(userId: string, accessToken: string, refreshToken: string) {
    this.userId = userId;
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }
  
  async getCalendars(): Promise<Calendar[]> {
    try {
      const response = await this.calendar.calendarList.list();
      
      return response.data.items?.map(cal => ({
        id: cal.id!,
        title: cal.summary!,
        description: cal.description,
        timeZone: cal.timeZone!,
        colorId: cal.colorId,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        selected: cal.selected || false,
        accessRole: cal.accessRole as 'owner' | 'writer' | 'reader',
        primary: cal.primary || false,
      })) || [];
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async getEvents(params: GetEventsParams): Promise<{
    events: CalendarEvent[];
    nextPageToken?: string;
  }> {
    try {
      const response = await this.calendar.events.list({
        calendarId: params.calendarId || 'primary',
        timeMin: params.timeMin.toISOString(),
        timeMax: params.timeMax.toISOString(),
        maxResults: params.maxResults || 250,
        singleEvents: params.singleEvents !== false,
        orderBy: 'startTime',
        pageToken: params.pageToken,
        q: params.q,
        showDeleted: params.showDeleted || false,
      });
      
      const events = response.data.items?.map(event => 
        this.parseEvent(params.calendarId || 'primary', event)
      ) || [];
      
      return {
        events,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });
      
      return this.parseEvent(calendarId, response.data);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async createEvent(
    calendarId: string, 
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: this.formatEvent(event),
      });
      
      return this.parseEvent(calendarId, response.data);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async updateEvent(
    calendarId: string,
    eventId: string,
    updates: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: this.formatEvent(updates),
      });
      
      return this.parseEvent(calendarId, response.data);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  async getFreeBusy(params: FreeBusyParams): Promise<FreeBusyResponse> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: params.timeMin.toISOString(),
          timeMax: params.timeMax.toISOString(),
          items: params.calendars.map(id => ({ id })),
        },
      });
      
      return {
        calendars: Object.entries(response.data.calendars || {}).map(
          ([id, data]) => ({
            id,
            busy: data.busy?.map(period => ({
              start: new Date(period.start!),
              end: new Date(period.end!),
            })) || [],
          })
        ),
      };
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }
  
  private parseEvent(
    calendarId: string,
    event: calendar_v3.Schema$Event
  ): CalendarEvent {
    const startTime = event.start?.dateTime 
      ? new Date(event.start.dateTime)
      : new Date(event.start?.date || '');
      
    const endTime = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.end?.date || '');
    
    return {
      id: event.id!,
      calendarId,
      title: event.summary || 'Untitled Event',
      description: event.description,
      startTime,
      endTime,
      isAllDay: !event.start?.dateTime,
      location: event.location,
      attendees: event.attendees?.map(attendee => ({
        email: attendee.email!,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus as 'accepted' | 'declined' | 'tentative' | 'needsAction',
        organizer: attendee.organizer || false,
        optional: attendee.optional || false,
      })) || [],
      organizer: {
        email: event.organizer?.email || '',
        displayName: event.organizer?.displayName,
      },
      status: event.status as 'confirmed' | 'tentative' | 'cancelled' || 'confirmed',
      visibility: event.visibility as 'public' | 'private' | 'confidential' || 'public',
      reminders: event.reminders?.overrides?.map(reminder => ({
        method: reminder.method as 'email' | 'popup',
        minutes: reminder.minutes!,
      })) || [],
      recurrence: event.recurrence,
      colorId: event.colorId,
    };
  }
  
  private formatEvent(event: Partial<CalendarEvent>): calendar_v3.Schema$Event {
    const formatted: calendar_v3.Schema$Event = {};
    
    if (event.title !== undefined) formatted.summary = event.title;
    if (event.description !== undefined) formatted.description = event.description;
    if (event.location !== undefined) formatted.location = event.location;
    if (event.colorId !== undefined) formatted.colorId = event.colorId;
    
    if (event.startTime) {
      formatted.start = event.isAllDay
        ? { date: event.startTime.toISOString().split('T')[0] }
        : { dateTime: event.startTime.toISOString() };
    }
    
    if (event.endTime) {
      formatted.end = event.isAllDay
        ? { date: event.endTime.toISOString().split('T')[0] }
        : { dateTime: event.endTime.toISOString() };
    }
    
    if (event.attendees) {
      formatted.attendees = event.attendees.map(attendee => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus,
        optional: attendee.optional,
      }));
    }
    
    if (event.reminders) {
      formatted.reminders = {
        useDefault: false,
        overrides: event.reminders.map(reminder => ({
          method: reminder.method,
          minutes: reminder.minutes,
        })),
      };
    }
    
    return formatted;
  }
  
  private handleApiError(error: any) {
    if (error.code === 429) {
      console.error('Calendar API rate limit exceeded');
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    if (error.code === 401) {
      console.error('Calendar API authentication failed');
      throw new Error('Authentication failed. Please reconnect your Google account.');
    }
    
    console.error('Calendar API error:', error);
  }
}
```

### 4. OAuth2 Authentication Setup

**File**: `apps/web/app/api/auth/google/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.redirect('/login');
  }
  
  // Generate OAuth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: user.id, // Pass user ID in state
  });
  
  return NextResponse.redirect(authUrl);
}
```

**File**: `apps/web/app/api/auth/google/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // User ID
  const error = searchParams.get('error');
  
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect('/settings?error=oauth_failed');
  }
  
  if (!code || !state) {
    return NextResponse.redirect('/settings?error=invalid_callback');
  }
  
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in Supabase
    const supabase = createRouteHandlerClient({ cookies });
    
    const { error: dbError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: state,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
      });
    
    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect('/settings?error=storage_failed');
    }
    
    // Get user info
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    // Store user info
    await supabase
      .from('google_accounts')
      .upsert({
        user_id: state,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      });
    
    return NextResponse.redirect('/settings?success=google_connected');
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.redirect('/settings?error=token_exchange_failed');
  }
}
```

### 5. Service Factory with OAuth Token Management

**File**: `apps/web/services/factory/serviceFactory.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { GmailService } from '../interfaces/gmail.interface';
import { CalendarService } from '../interfaces/calendar.interface';
import { GmailServiceImpl } from '../impl/gmail.service';
import { CalendarServiceImpl } from '../impl/calendar.service';
import { MockGmailService } from '../mock/gmail.service';
import { MockCalendarService } from '../mock/calendar.service';

export class ServiceFactory {
  private static instance: ServiceFactory;
  private supabase;
  
  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }
  
  async getGmailService(userId: string): Promise<GmailService> {
    // Check if user has connected Google account
    const { data: tokens } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();
    
    if (!tokens || !tokens.access_token) {
      // Return mock service if no OAuth tokens
      console.log('No Google OAuth tokens found, using mock service');
      return new MockGmailService();
    }
    
    // Check if token is expired
    if (tokens.expiry_date && new Date(tokens.expiry_date) < new Date()) {
      // Token expired, attempt refresh
      await this.refreshGoogleTokens(userId, tokens.refresh_token);
      
      // Fetch updated tokens
      const { data: updatedTokens } = await this.supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .single();
      
      return new GmailServiceImpl(
        userId,
        updatedTokens!.access_token,
        updatedTokens!.refresh_token
      );
    }
    
    return new GmailServiceImpl(
      userId,
      tokens.access_token,
      tokens.refresh_token
    );
  }
  
  async getCalendarService(userId: string): Promise<CalendarService> {
    // Same pattern as Gmail
    const { data: tokens } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();
    
    if (!tokens || !tokens.access_token) {
      console.log('No Google OAuth tokens found, using mock service');
      return new MockCalendarService();
    }
    
    return new CalendarServiceImpl(
      userId,
      tokens.access_token,
      tokens.refresh_token
    );
  }
  
  private async refreshGoogleTokens(userId: string, refreshToken: string) {
    // Implementation for token refresh
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      await this.supabase
        .from('oauth_tokens')
        .update({
          access_token: credentials.access_token,
          expiry_date: credentials.expiry_date,
        })
        .eq('user_id', userId)
        .eq('provider', 'google');
    } catch (error) {
      console.error('Failed to refresh Google tokens:', error);
      throw new Error('Token refresh failed');
    }
  }
}
```

### 6. Database Migrations for OAuth

**File**: `migrations/007_google_oauth.sql`

```sql
-- OAuth tokens table
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, provider)
);

-- Google account info
CREATE TABLE IF NOT EXISTS public.google_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own OAuth tokens" ON public.oauth_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own Google account" ON public.google_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_oauth_tokens_user_provider ON public.oauth_tokens(user_id, provider);
CREATE INDEX idx_google_accounts_user ON public.google_accounts(user_id);
```

## Testing Guide

### 1. Test OAuth Flow

```typescript
// Test the complete OAuth flow
describe('Google OAuth', () => {
  it('should redirect to Google consent screen', async () => {
    const response = await fetch('/api/auth/google');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('accounts.google.com');
  });
  
  it('should handle callback and store tokens', async () => {
    // Mock the OAuth callback
    const mockCode = 'test-auth-code';
    const response = await fetch(`/api/auth/google/callback?code=${mockCode}&state=user-123`);
    
    // Check tokens were stored
    const { data } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', 'user-123')
      .single();
    
    expect(data).toBeTruthy();
    expect(data.access_token).toBeTruthy();
  });
});
```

### 2. Test Service Factory

```typescript
// Test service factory fallback behavior
describe('Service Factory', () => {
  it('should return mock service when no OAuth tokens', async () => {
    const factory = ServiceFactory.getInstance();
    const gmailService = await factory.getGmailService('user-without-oauth');
    
    // Should get mock service
    expect(gmailService.constructor.name).toBe('MockGmailService');
  });
  
  it('should return real service with valid tokens', async () => {
    const factory = ServiceFactory.getInstance();
    const gmailService = await factory.getGmailService('user-with-oauth');
    
    // Should get real service
    expect(gmailService.constructor.name).toBe('GmailServiceImpl');
  });
});
```

### 3. Test API Rate Limiting

```typescript
// Test rate limit handling
describe('API Rate Limiting', () => {
  it('should handle rate limit errors gracefully', async () => {
    const gmailService = new GmailServiceImpl('user-123', 'token', 'refresh');
    
    // Mock rate limit error
    jest.spyOn(gmailService['gmail'].users.messages, 'list')
      .mockRejectedValue({ code: 429 });
    
    await expect(gmailService.getMessages({}))
      .rejects.toThrow('Rate limit exceeded');
  });
});
```

## Common Issues & Solutions

### Issue 1: OAuth Scope Changes
**Problem**: Need additional permissions after initial auth
**Solution**: Force re-consent with `prompt: 'consent'` parameter

### Issue 2: Token Expiration
**Problem**: Access tokens expire after 1 hour
**Solution**: Automatic refresh token handling in service factory

### Issue 3: Rate Limiting
**Problem**: Hitting Google API quotas
**Solution**: 
- Implement exponential backoff
- Cache frequently accessed data
- Batch operations where possible

### Issue 4: Large Email Attachments
**Problem**: Attachments not included in message body
**Solution**: Separate API call to fetch attachment data when needed

## Success Criteria

- [ ] OAuth flow completes successfully
- [ ] Tokens are stored securely in Supabase
- [ ] Services automatically fall back to mock when no OAuth
- [ ] Gmail messages are fetched and parsed correctly
- [ ] Calendar events are retrieved with proper timezone handling
- [ ] Rate limiting is handled gracefully
- [ ] Token refresh works automatically
- [ ] All existing workflows continue to function
- [ ] No mock data remains in production code

## Migration Checklist

- [ ] Remove all mock data generators
- [ ] Update service imports throughout codebase
- [ ] Add OAuth connection UI in settings
- [ ] Test all workflows with real data
- [ ] Add proper error handling for API failures
- [ ] Document OAuth setup in README

## Next Steps

After completing this sprint:
1. Monitor API usage and quotas
2. Implement caching for frequently accessed data
3. Add webhook support for real-time updates
4. Consider adding Microsoft Graph API support
5. Proceed to Sprint 03.06 for UI polish

## Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Calendar API](https://developers.google.com/calendar)
- [Google OAuth2 Guide](https://developers.google.com/identity/protocols/oauth2)
- [API Quotas and Limits](https://developers.google.com/gmail/api/reference/quota)