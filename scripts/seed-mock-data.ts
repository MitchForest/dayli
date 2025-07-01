#!/usr/bin/env bun

import { createClient } from '@supabase/supabase-js';
import { MockGmailService } from '../apps/web/services/mock/gmail.service';
import { MockCalendarService } from '../apps/web/services/mock/calendar.service';
import { MockTaskService } from '../apps/web/services/mock/tasks.service';
import type { 
  EmailInsert, 
  TaskInsert, 
  TimeBlockInsert,
  DailyScheduleInsert 
} from '../packages/database/src/types';
import { parseArgs } from 'util';

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'user-email': {
      type: 'string',
      short: 'u',
    },
    'clear': {
      type: 'boolean',
      short: 'c',
      default: false,
    },
  },
});

const userEmail = values['user-email'];
const clearData = values['clear'];

if (!userEmail) {
  console.error('❌ Please provide a user email with --user-email flag');
  console.error('Usage: bun run scripts/seed-mock-data.ts --user-email=user@example.com');
  process.exit(1);
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedDatabase() {
  console.log(`🌱 Seeding mock data for user: ${userEmail}`);
  
  try {
    // 1. Get user by email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail)
      .single();
    
    if (userError || !userData) {
      console.error('❌ User not found:', userEmail);
      console.error('Make sure the user has logged in at least once');
      return;
    }
    
    const userId = userData.id;
    console.log(`✅ Found user: ${userId}`);
    
    // 2. Get user's timezone preference
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .single();
    
    const userTimezone = preferences?.timezone || 'America/New_York';
    console.log(`📍 Using timezone: ${userTimezone}`);
    
    // 3. Clear existing data if requested
    if (clearData) {
      console.log('🗑️  Clearing existing data...');
      
      // Delete in order of dependencies
      await supabase.from('time_block_tasks').delete().eq('time_block_id', userId);
      await supabase.from('time_block_emails').delete().eq('time_block_id', userId);
      await supabase.from('time_blocks').delete().eq('user_id', userId);
      await supabase.from('daily_schedules').delete().eq('user_id', userId);
      await supabase.from('tasks').delete().eq('user_id', userId);
      await supabase.from('emails').delete().eq('user_id', userId);
      
      console.log('✅ Existing data cleared');
    }
    
    // 4. Generate mock data
    console.log('📧 Generating emails...');
    const gmailService = new MockGmailService();
    const gmailMessages = gmailService.getAllMessages();
    
    // Transform Gmail messages to our email format
    const emails: EmailInsert[] = gmailMessages.map(msg => {
      const fromHeader = msg.payload.headers.find(h => h.name === 'From');
      const subjectHeader = msg.payload.headers.find(h => h.name === 'Subject');
      const dateHeader = msg.payload.headers.find(h => h.name === 'Date');
      
      // Extract email and name from "Name <email@example.com>" format
      const fromMatch = fromHeader?.value.match(/^(.+?)\s*<(.+?)>$/);
      const fromEmail = fromMatch ? fromMatch[2] : fromHeader?.value || 'unknown@example.com';
      const fromName = fromMatch ? fromMatch[1] : undefined;
      
      // Decode body from base64
      const bodyData = msg.payload.body.data;
      const fullBody = Buffer.from(bodyData, 'base64').toString('utf-8');
      
      return {
        user_id: userId,
        gmail_id: msg.id,
        from_email: fromEmail,
        from_name: fromName,
        subject: subjectHeader?.value || 'No Subject',
        body_preview: msg.snippet,
        full_body: fullBody,
        is_read: !msg.labelIds.includes('UNREAD'),
        received_at: new Date(parseInt(msg.internalDate)).toISOString(),
        metadata: {
          labelIds: msg.labelIds,
          threadId: msg.threadId,
        },
      };
    });
    
    const { error: emailError } = await supabase
      .from('emails')
      .insert(emails);
    
    if (emailError) {
      console.error('❌ Error inserting emails:', emailError);
    } else {
      console.log(`✅ Inserted ${emails.length} emails`);
    }
    
    // 5. Generate tasks
    console.log('📋 Generating tasks...');
    const taskService = new MockTaskService();
    const mockTasks = taskService.generateBacklogTasks(userId);
    const tasks: TaskInsert[] = mockTasks.map(task => ({
      ...task,
      user_id: userId,
    }));
    
    const { error: taskError } = await supabase
      .from('tasks')
      .insert(tasks);
    
    if (taskError) {
      console.error('❌ Error inserting tasks:', taskError);
    } else {
      console.log(`✅ Inserted ${tasks.length} tasks`);
    }
    
    // 6. Generate calendar events and schedules
    console.log('📅 Generating schedules and calendar events...');
    const calendarService = new MockCalendarService(userTimezone);
    const calendarEvents = calendarService.getAllEvents();
    
    // Generate 7 days of schedules (-3 to +3 days from today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(scheduleDate.getDate() + dayOffset);
      const dateStr = scheduleDate.toISOString().split('T')[0];
      
      // Create daily schedule
      const dailySchedule: DailyScheduleInsert = {
        user_id: userId,
        schedule_date: dateStr,
        stats: {
          emailsProcessed: 0,
          tasksCompleted: 0,
          focusMinutes: 0,
        },
      };
      
      const { data: schedule, error: scheduleError } = await supabase
        .from('daily_schedules')
        .insert(dailySchedule)
        .select()
        .single();
      
      if (scheduleError) {
        console.error(`❌ Error creating schedule for ${dateStr}:`, scheduleError);
        continue;
      }
      
      // Add calendar events as time blocks for this day
      const dayEvents = calendarEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date || '');
        return eventDate.toISOString().split('T')[0] === dateStr;
      });
      
      for (const event of dayEvents) {
        const timeBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: event.start.dateTime || `${dateStr}T09:00:00Z`,
          end_time: event.end.dateTime || `${dateStr}T10:00:00Z`,
          type: 'meeting',
          title: event.summary,
          description: event.description,
          source: 'calendar',
          calendar_event_id: event.id,
          metadata: {
            attendees: event.attendees,
            location: event.location,
          },
        };
        
        await supabase.from('time_blocks').insert(timeBlock);
      }
      
      // Add some focus blocks and email triage blocks
      if (dayOffset >= -1 && dayOffset <= 1) {
        // Morning email triage
        await supabase.from('time_blocks').insert({
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: `${dateStr}T08:00:00Z`,
          end_time: `${dateStr}T08:30:00Z`,
          type: 'email',
          title: 'Morning Email Triage',
          source: 'ai',
          metadata: {},
        });
        
        // Focus block (if no morning meetings)
        const hasMorningMeeting = dayEvents.some(event => {
          const hour = new Date(event.start.dateTime || '').getHours();
          return hour >= 9 && hour < 12;
        });
        
        if (!hasMorningMeeting) {
          await supabase.from('time_blocks').insert({
            user_id: userId,
            daily_schedule_id: schedule.id,
            start_time: `${dateStr}T09:00:00Z`,
            end_time: `${dateStr}T11:00:00Z`,
            type: 'focus',
            title: 'Deep Work Block',
            source: 'ai',
            metadata: {},
          });
        }
        
        // Lunch break
        await supabase.from('time_blocks').insert({
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: `${dateStr}T12:00:00Z`,
          end_time: `${dateStr}T13:00:00Z`,
          type: 'break',
          title: 'Lunch Break',
          source: 'ai',
          metadata: {},
        });
        
        // Afternoon focus block (if no afternoon meetings)
        const hasAfternoonMeeting = dayEvents.some(event => {
          const hour = new Date(event.start.dateTime || '').getHours();
          return hour >= 14 && hour < 17;
        });
        
        if (!hasAfternoonMeeting) {
          await supabase.from('time_blocks').insert({
            user_id: userId,
            daily_schedule_id: schedule.id,
            start_time: `${dateStr}T14:00:00Z`,
            end_time: `${dateStr}T16:00:00Z`,
            type: 'focus',
            title: 'Afternoon Focus',
            source: 'ai',
            metadata: {},
          });
        }
        
        // Evening email triage
        await supabase.from('time_blocks').insert({
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: `${dateStr}T16:30:00Z`,
          end_time: `${dateStr}T17:00:00Z`,
          type: 'email',
          title: 'Evening Email Review',
          source: 'ai',
          metadata: {},
        });
      }
      
      console.log(`✅ Created schedule for ${dateStr} with ${dayEvents.length} meetings`);
    }
    
    console.log('\n✨ Mock data seeding complete!');
    console.log(`
Summary:
- User: ${userEmail} (${userId})
- Emails: ${emails.length}
- Tasks: ${tasks.length}
- Schedules: 7 days (-3 to +3 from today)
- Calendar events: ${calendarEvents.length}
    `);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the seeder
seedDatabase().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 