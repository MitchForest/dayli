import { NextRequest, NextResponse } from 'next/server';
import { RealCalendarService } from '@/services/real/calendar.service';
import type { ICalendarService } from '@/services/interfaces/calendar.interface';
import type { CalendarEvent } from '@/services/real/calendar.service';
import { createServerActionClient } from '@/lib/supabase-server';

// Get calendar service with proper configuration
const getCalendarService = async (): Promise<ICalendarService> => {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return new RealCalendarService({
    userId: user.id,
    supabaseClient: supabase
  });
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const calendarId = searchParams.get('calendarId') || 'primary';
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const pageToken = searchParams.get('pageToken') || undefined;
    const maxResults = searchParams.get('maxResults') 
      ? parseInt(searchParams.get('maxResults')!) 
      : undefined;
    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'timeMin and timeMax are required' },
        { status: 400 }
      );
    }
    
    const calendarService = await getCalendarService();
    const events = await calendarService.listEvents({
      calendarId,
      timeMin,
      timeMax,
      pageToken,
      maxResults,
    });
    
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { calendarId = 'primary', resource } = body;
    
    if (!resource) {
      return NextResponse.json(
        { error: 'Event resource is required' },
        { status: 400 }
      );
    }
    
    const calendarService = await getCalendarService();
    const event = await calendarService.insertEvent({
      calendarId,
      resource: resource as Partial<CalendarEvent>,
    });
    
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
} 