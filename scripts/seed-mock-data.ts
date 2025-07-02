#!/usr/bin/env bun

import { createClient } from '@supabase/supabase-js';
import { MockGmailService } from '../apps/web/services/mock/gmail.service';
import { MockCalendarService } from '../apps/web/services/mock/calendar.service';
import { MockTaskService } from '../apps/web/services/mock/tasks.service';
import type { TablesInsert } from '../packages/database/src/types';
import { parseArgs } from 'util';
import { readFileSync } from 'fs';
import { join } from 'path';

// Type aliases for clarity
type EmailInsert = TablesInsert<'emails'>;
type TaskInsert = TablesInsert<'tasks'>;
type TimeBlockInsert = TablesInsert<'time_blocks'>;
type DailyScheduleInsert = TablesInsert<'daily_schedules'>;

// Load environment variables from apps/web/.env.local
try {
  const envPath = join(process.cwd(), 'apps/web/.env.local');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
} catch (error) {
  console.warn('⚠️  Could not load apps/web/.env.local, using existing environment variables');
}

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

// Helper to create ISO timestamp that represents local time
function createLocalTimestamp(date: Date, timeStr: string, timezone: string = 'America/New_York'): string {
  const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
  
  // Create a date string in YYYY-MM-DD format
  const dateStr = date.toISOString().split('T')[0];
  
  // For Eastern Time, we need to add 4 or 5 hours to get UTC (depending on DST)
  // This is a simplified approach - in production, use a proper timezone library
  const isDST = () => {
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== date.getTimezoneOffset();
  };
  
  // Eastern Time is UTC-5 (standard) or UTC-4 (daylight)
  const utcOffset = timezone === 'America/New_York' ? (isDST() ? 4 : 5) : 5;
  
  // Adjust hours for UTC
  let utcHours = hours + utcOffset;
  let adjustedDate = new Date(date);
  
  // Handle day rollover
  if (utcHours >= 24) {
    utcHours -= 24;
    adjustedDate.setDate(adjustedDate.getDate() + 1);
  }
  
  const adjustedDateStr = adjustedDate.toISOString().split('T')[0];
  const timestamp = `${adjustedDateStr}T${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`;
  
  return timestamp;
}

// Schedule patterns for more realistic variation
const schedulePatterns = {
  // Different work start times for different people/days
  workStartTimes: ['07:00', '07:30', '08:00', '08:30', '09:00'],
  
  // Morning routines
  morningRoutineTimes: ['06:00', '06:30', '07:00'],
  
  // Email check times (multiple throughout the day)
  morningEmailTimes: ['08:00', '08:15', '08:30'],
  midMorningEmailTimes: ['10:30', '11:00', '11:30'],
  afternoonEmailTimes: ['13:30', '14:00', '14:30'],
  eveningEmailTimes: ['16:30', '17:00', '17:30'],
  
  // Lunch variations (more realistic)
  lunchTimes: ['12:00', '12:30', '13:00'],
  
  // Break times
  morningBreakTimes: ['10:00', '10:15', '10:30'],
  afternoonBreakTimes: ['15:00', '15:30', '16:00'],
  
  // Focus block durations
  focusBlockDurations: [60, 90, 120, 150], // minutes
  
  // Meeting durations
  meetingDurations: [30, 45, 60, 90],
  
  // End of day times
  endOfDayTimes: ['17:00', '17:30', '18:00', '18:30'],
};

// Helper to get a random element from array
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// Helper to add minutes to a time string and return properly formatted time
function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  let totalMinutes = (hours || 0) * 60 + (minutes || 0) + minutesToAdd;
  
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

// Helper to check if a time slot conflicts with existing blocks
function hasConflict(
  newStart: Date, 
  newEnd: Date, 
  existingBlocks: Array<{start_time: string, end_time: string}>
): boolean {
  return existingBlocks.some(block => {
    const blockStart = new Date(block.start_time);
    const blockEnd = new Date(block.end_time);
    return (newStart < blockEnd && newEnd > blockStart);
  });
}

async function handleMockData() {
  if (clearData) {
    console.log(`🗑️  Clearing mock data for user: ${userEmail}`);
  } else {
    console.log(`🌱 Seeding mock data for user: ${userEmail}`);
  }
  
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
      console.log('🗑️  Clearing mock data...');
      
      // Delete in order of dependencies
      const { data: userTimeBlocks } = await supabase
        .from('time_blocks')
        .select('id')
        .eq('user_id', userId);
      
      if (userTimeBlocks && userTimeBlocks.length > 0) {
        const timeBlockIds = userTimeBlocks.map(tb => tb.id);
        
        await supabase.from('time_block_tasks').delete().in('time_block_id', timeBlockIds);
        await supabase.from('time_block_emails').delete().in('time_block_id', timeBlockIds);
      }
      
      await supabase.from('time_blocks').delete().eq('user_id', userId);
      await supabase.from('daily_schedules').delete().eq('user_id', userId);
      await supabase.from('tasks').delete().eq('user_id', userId);
      await supabase.from('emails').delete().eq('user_id', userId);
      await supabase.from('task_backlog').delete().eq('user_id', userId);
      await supabase.from('email_backlog').delete().eq('user_id', userId);
      
      console.log('✅ All mock data cleared successfully');
      return;
    }
    
    // 4. Generate mock emails (10-20 per day)
    console.log('📧 Generating emails...');
    const gmailService = new MockGmailService();
    const gmailMessages = gmailService.getAllMessages();
    
    // Take a subset of emails (15 emails)
    const selectedEmails = gmailMessages.slice(0, 15);
    
    const emails: EmailInsert[] = selectedEmails.map(msg => {
      const fromHeader = msg.payload.headers.find(h => h.name === 'From');
      const subjectHeader = msg.payload.headers.find(h => h.name === 'Subject');
      
      const fromMatch = fromHeader?.value.match(/^(.+?)\s*<(.+?)>$/);
      const fromEmail = fromMatch ? fromMatch[2] : fromHeader?.value || 'unknown@example.com';
      const fromName = fromMatch ? fromMatch[1] : undefined;
      
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
    
    const { data: insertedEmails, error: emailError } = await supabase
      .from('emails')
      .insert(emails)
      .select();
    
    if (emailError) {
      console.error('❌ Error inserting emails:', emailError);
    } else {
      console.log(`✅ Inserted ${emails.length} emails`);
      
      // Create email backlog entries
      if (insertedEmails) {
        const emailBacklog: TablesInsert<'email_backlog'>[] = insertedEmails.map((email, index) => {
          // Vary importance and urgency
          const importance = index < 5 ? 'important' : index < 10 ? 'not_important' : 'archive';
          const urgency = index < 3 ? 'urgent' : index < 8 ? 'can_wait' : 'no_response';
          
          return {
            user_id: userId,
            email_id: email.id,
            subject: email.subject,
            from_email: email.from_email,
            importance,
            urgency,
            days_in_backlog: Math.floor(Math.random() * 5),
            last_reviewed_at: new Date().toISOString(),
            snippet: email.body_preview,
          };
        });
        
        const { error: backlogError } = await supabase
          .from('email_backlog')
          .insert(emailBacklog);
          
        if (backlogError) {
          console.error('❌ Error inserting email backlog:', backlogError);
        } else {
          console.log(`✅ Created email backlog entries`);
        }
      }
    }
    
    // 5. Generate tasks (20-40 in backlog)
    console.log('📋 Generating tasks...');
    const taskService = new MockTaskService();
    const mockTasks = taskService.generateBacklogTasks(userId);
    
    // Take 30 tasks
    const selectedTasks = mockTasks.slice(0, 30);
    const tasks: TaskInsert[] = selectedTasks.map(task => ({
      ...task,
      user_id: userId,
    }));
    
    const { data: insertedTasks, error: taskError } = await supabase
      .from('tasks')
      .insert(tasks)
      .select();
    
    if (taskError) {
      console.error('❌ Error inserting tasks:', taskError);
    } else {
      console.log(`✅ Inserted ${tasks.length} tasks`);
      
      // Create task backlog entries
      if (insertedTasks) {
        const taskBacklog: TablesInsert<'task_backlog'>[] = insertedTasks.map((task, index) => ({
          user_id: userId,
          title: task.title,
          description: task.description,
          priority: Math.max(0, 100 - (index * 3)), // Decreasing priority
          urgency: Math.max(0, 80 - (index * 2)), // Decreasing urgency
          source: task.source === 'manual' || task.source === 'email' || task.source === 'calendar' 
            ? task.source 
            : 'manual', // Ensure source is valid
          source_id: task.id,
          estimated_minutes: task.estimated_minutes,
          tags: index < 10 ? ['important'] : index < 20 ? ['routine'] : ['low-priority'],
        }));
        
        const { error: backlogError } = await supabase
          .from('task_backlog')
          .insert(taskBacklog);
          
        if (backlogError) {
          console.error('❌ Error inserting task backlog:', backlogError);
        } else {
          console.log(`✅ Created task backlog entries`);
        }
      }
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
      
      // Skip weekends
      const dayOfWeek = scheduleDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log(`⏭️  Skipping weekend: ${dateStr}`);
        continue;
      }
      
      // Create daily schedule
      const dailySchedule: DailyScheduleInsert = {
        user_id: userId,
        schedule_date: dateStr,
        stats: {
          emailsProcessed: dayOffset < 0 ? Math.floor(Math.random() * 10) + 5 : 0,
          tasksCompleted: dayOffset < 0 ? Math.floor(Math.random() * 5) + 2 : 0,
          focusMinutes: dayOffset < 0 ? Math.floor(Math.random() * 120) + 120 : 0,
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
      
      const dayBlocks: TimeBlockInsert[] = [];
      const existingBlocks: Array<{start_time: string, end_time: string}> = [];
      
      // Add calendar events as time blocks for this day
      const dayEvents = calendarEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date || '');
        return eventDate.toISOString().split('T')[0] === dateStr;
      });
      
      // Add meetings first (they have priority)
      for (const event of dayEvents) {
        // Generate video link for most meetings (80% chance)
        const hasVideoLink = Math.random() < 0.8;
        const videoLink = hasVideoLink 
          ? event.summary.toLowerCase().includes('standup') || event.summary.toLowerCase().includes('sync')
            ? `https://meet.google.com/${event.id.substring(0, 10)}`
            : `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}`
          : undefined;
        
        const block: TimeBlockInsert = {
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
            attendeeCount: event.attendees?.length || 1,
            videoLink: videoLink,
            location: !hasVideoLink && Math.random() < 0.3 ? 'Conference Room B' : undefined,
          },
        };
        
        dayBlocks.push(block);
        existingBlocks.push({
          start_time: block.start_time,
          end_time: block.end_time
        });
      }
      
      // Generate different schedule patterns based on day of week
      const isMonday = dayOfWeek === 1;
      const isFriday = dayOfWeek === 5;
      const isMidWeek = dayOfWeek === 3;
      
      // Determine work start time for this day
      const workStartTime = isMonday 
        ? randomFrom(['08:00', '08:30']) // Start a bit later on Monday
        : randomFrom(schedulePatterns.workStartTimes);
      
      // Add morning routine block (optional, 30% chance)
      if (Math.random() < 0.3 && dayOffset <= 0) {
        const routineTime = randomFrom(schedulePatterns.morningRoutineTimes);
        const routineStart = createLocalTimestamp(scheduleDate, routineTime, userTimezone);
        const routineEnd = createLocalTimestamp(scheduleDate, workStartTime, userTimezone);
        
        const routineBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: routineStart,
          end_time: routineEnd,
          type: 'blocked',
          title: 'Morning Routine',
          description: 'Exercise, breakfast, commute',
          source: 'manual',
          metadata: { personal: true },
        };
        
        dayBlocks.push(routineBlock);
        existingBlocks.push({
          start_time: routineBlock.start_time,
          end_time: routineBlock.end_time
        });
      }
      
      // Add daily planning block (most days)
      if (Math.random() < 0.8) {
        const planningStart = createLocalTimestamp(scheduleDate, workStartTime, userTimezone);
        const planningEnd = createLocalTimestamp(
          scheduleDate,
          addMinutesToTime(workStartTime, 15),
          userTimezone
        );
        
        const planningBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: planningStart,
          end_time: planningEnd,
          type: 'work',
          title: 'Daily Planning',
          description: 'Review calendar, prioritize tasks',
          source: 'ai',
          metadata: {},
        };
        
        dayBlocks.push(planningBlock);
        existingBlocks.push({
          start_time: planningBlock.start_time,
          end_time: planningBlock.end_time
        });
      }
      
      // Add morning email triage
      const morningEmailTime = randomFrom(schedulePatterns.morningEmailTimes);
      const morningEmailStart = createLocalTimestamp(scheduleDate, morningEmailTime, userTimezone);
      const morningEmailEnd = createLocalTimestamp(
        scheduleDate,
        addMinutesToTime(morningEmailTime, 30),
        userTimezone
      );
      
      if (!hasConflict(new Date(morningEmailStart), new Date(morningEmailEnd), existingBlocks)) {
        const emailBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: morningEmailStart,
          end_time: morningEmailEnd,
          type: 'email',
          title: 'Morning Email Triage',
          description: 'Process urgent emails, quick responses',
          source: 'ai',
          metadata: {},
        };
        
        dayBlocks.push(emailBlock);
        existingBlocks.push({
          start_time: emailBlock.start_time,
          end_time: emailBlock.end_time
        });
      }
      
      // Add morning focus block (prime productivity time)
      const focusDuration = randomFrom(schedulePatterns.focusBlockDurations);
      const morningFocusStart = createLocalTimestamp(scheduleDate, '09:00', userTimezone);
      const morningFocusEnd = createLocalTimestamp(
        scheduleDate, 
        addMinutesToTime('09:00', focusDuration),
        userTimezone
      );
      
      if (!hasConflict(new Date(morningFocusStart), new Date(morningFocusEnd), existingBlocks)) {
        const focusBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: morningFocusStart,
          end_time: morningFocusEnd,
          type: 'work',
          title: dayOffset < 0 ? 'Deep Work Session' : 'Focus Time',
          description: dayOffset < 0 ? 'Worked on project deliverables' : 'Reserved for important work',
          source: 'ai',
          metadata: {},
        };
        
        dayBlocks.push(focusBlock);
        existingBlocks.push({
          start_time: focusBlock.start_time,
          end_time: focusBlock.end_time
        });
      }
      
      // Add mid-morning break (50% chance)
      if (Math.random() < 0.5) {
        const breakTime = randomFrom(schedulePatterns.morningBreakTimes);
        const breakStart = createLocalTimestamp(scheduleDate, breakTime, userTimezone);
        const breakEnd = createLocalTimestamp(
          scheduleDate,
          addMinutesToTime(breakTime, 15),
          userTimezone
        );
        
        if (!hasConflict(new Date(breakStart), new Date(breakEnd), existingBlocks)) {
          const breakBlock: TimeBlockInsert = {
            user_id: userId,
            daily_schedule_id: schedule.id,
            start_time: breakStart,
            end_time: breakEnd,
            type: 'break',
            title: 'Coffee Break',
            source: 'ai',
            metadata: {},
          };
          
          dayBlocks.push(breakBlock);
          existingBlocks.push({
            start_time: breakBlock.start_time,
            end_time: breakBlock.end_time
          });
        }
      }
      
      // Add mid-morning email check
      const midMorningEmailTime = randomFrom(schedulePatterns.midMorningEmailTimes);
      const midMorningEmailStart = createLocalTimestamp(scheduleDate, midMorningEmailTime, userTimezone);
      const midMorningEmailEnd = createLocalTimestamp(
        scheduleDate,
        addMinutesToTime(midMorningEmailTime, 15),
        userTimezone
      );
      
      if (!hasConflict(new Date(midMorningEmailStart), new Date(midMorningEmailEnd), existingBlocks)) {
        const midEmailBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: midMorningEmailStart,
          end_time: midMorningEmailEnd,
          type: 'email',
          title: 'Quick Email Check',
          source: 'ai',
          metadata: {},
        };
        
        dayBlocks.push(midEmailBlock);
        existingBlocks.push({
          start_time: midEmailBlock.start_time,
          end_time: midEmailBlock.end_time
        });
      }
      
      // Lunch time (more realistic)
      const lunchTime = randomFrom(schedulePatterns.lunchTimes);
      const lunchStart = createLocalTimestamp(scheduleDate, lunchTime, userTimezone);
      const lunchDuration = isFriday ? 90 : 60; // Longer lunch on Friday
      const lunchEnd = createLocalTimestamp(
        scheduleDate, 
        addMinutesToTime(lunchTime, lunchDuration),
        userTimezone
      );
      
      // Check if lunch conflicts with a meeting
      const lunchConflict = hasConflict(
        new Date(lunchStart),
        new Date(lunchEnd),
        existingBlocks
      );
      
      // If lunch conflicts, try to shift it
      let actualLunchStart = lunchStart;
      let actualLunchEnd = lunchEnd;
      
      if (lunchConflict) {
        // Try 30 minutes earlier or later
        const earlierStart = createLocalTimestamp(scheduleDate, '11:30', userTimezone);
        const earlierEnd = createLocalTimestamp(scheduleDate, '12:30', userTimezone);
        
        if (!hasConflict(new Date(earlierStart), new Date(earlierEnd), existingBlocks)) {
          actualLunchStart = earlierStart;
          actualLunchEnd = earlierEnd;
        } else {
          // Try later
          actualLunchStart = createLocalTimestamp(scheduleDate, '13:00', userTimezone);
          actualLunchEnd = createLocalTimestamp(scheduleDate, '14:00', userTimezone);
        }
      }
      
      // Add lunch break
      const lunchBlock: TimeBlockInsert = {
        user_id: userId,
        daily_schedule_id: schedule.id,
        start_time: actualLunchStart,
        end_time: actualLunchEnd,
        type: 'break',
        title: 'Lunch Break',
        source: 'ai',
        metadata: { protected: true },
      };
      
      dayBlocks.push(lunchBlock);
      existingBlocks.push({
        start_time: lunchBlock.start_time,
        end_time: lunchBlock.end_time
      });
      
      // Afternoon patterns vary by day
      if (isMonday || isMidWeek) {
        // Meeting-heavy days
        // Add 2-3 afternoon meetings (already added by calendar events)
        
        // Add admin time between meetings
        const adminStart = createLocalTimestamp(scheduleDate, '14:00', userTimezone);
        const adminEnd = createLocalTimestamp(scheduleDate, '14:30', userTimezone);
        
        if (!hasConflict(new Date(adminStart), new Date(adminEnd), existingBlocks)) {
          const adminBlock: TimeBlockInsert = {
            user_id: userId,
            daily_schedule_id: schedule.id,
            start_time: adminStart,
            end_time: adminEnd,
            type: 'work',
            title: 'Admin Tasks',
            description: 'Expense reports, timesheets, documentation',
            source: 'ai',
            metadata: {},
          };
          
          dayBlocks.push(adminBlock);
          existingBlocks.push({
            start_time: adminBlock.start_time,
            end_time: adminBlock.end_time
          });
        }
      } else {
        // Focus days (Tuesday, Thursday)
        // Add afternoon focus block
        if (dayOffset < 0) {
          const afternoonStart = createLocalTimestamp(scheduleDate, '14:00', userTimezone);
          const afternoonEnd = createLocalTimestamp(scheduleDate, '16:00', userTimezone);
          
          if (!hasConflict(new Date(afternoonStart), new Date(afternoonEnd), existingBlocks)) {
            const afternoonBlock: TimeBlockInsert = {
              user_id: userId,
              daily_schedule_id: schedule.id,
              start_time: afternoonStart,
              end_time: afternoonEnd,
              type: 'work',
              title: 'Afternoon Deep Work',
              description: 'Continued project work',
              source: 'ai',
              metadata: {},
            };
            
            dayBlocks.push(afternoonBlock);
            existingBlocks.push({
              start_time: afternoonBlock.start_time,
              end_time: afternoonBlock.end_time
            });
          }
        }
      }
      
      // Add afternoon break (30% chance)
      if (Math.random() < 0.3) {
        const breakTime = randomFrom(schedulePatterns.afternoonBreakTimes);
        const breakStart = createLocalTimestamp(scheduleDate, breakTime, userTimezone);
        const breakEnd = createLocalTimestamp(
          scheduleDate,
          addMinutesToTime(breakTime, 15),
          userTimezone
        );
        
        if (!hasConflict(new Date(breakStart), new Date(breakEnd), existingBlocks)) {
          const breakBlock: TimeBlockInsert = {
            user_id: userId,
            daily_schedule_id: schedule.id,
            start_time: breakStart,
            end_time: breakEnd,
            type: 'break',
            title: 'Afternoon Break',
            description: 'Walk, stretch, recharge',
            source: 'ai',
            metadata: {},
          };
          
          dayBlocks.push(breakBlock);
          existingBlocks.push({
            start_time: breakBlock.start_time,
            end_time: breakBlock.end_time
          });
        }
      }
      
      // Add afternoon email block
      const afternoonEmailTime = randomFrom(schedulePatterns.afternoonEmailTimes);
      const afternoonEmailStart = createLocalTimestamp(scheduleDate, afternoonEmailTime, userTimezone);
      const afternoonEmailEnd = createLocalTimestamp(
        scheduleDate,
        addMinutesToTime(afternoonEmailTime, 30),
        userTimezone
      );
      
      if (!hasConflict(new Date(afternoonEmailStart), new Date(afternoonEmailEnd), existingBlocks)) {
        const afternoonEmailBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: afternoonEmailStart,
          end_time: afternoonEmailEnd,
          type: 'email',
          title: 'Afternoon Email Processing',
          description: 'Respond to emails, clear inbox',
          source: 'ai',
          metadata: {},
        };
        
        dayBlocks.push(afternoonEmailBlock);
        existingBlocks.push({
          start_time: afternoonEmailBlock.start_time,
          end_time: afternoonEmailBlock.end_time
        });
      }
      
      // Add end-of-day wrap-up
      const wrapUpTime = randomFrom(schedulePatterns.eveningEmailTimes);
      const wrapUpStart = createLocalTimestamp(scheduleDate, wrapUpTime, userTimezone);
      const wrapUpEnd = createLocalTimestamp(
        scheduleDate,
        addMinutesToTime(wrapUpTime, 30),
        userTimezone
      );
      
      if (!hasConflict(new Date(wrapUpStart), new Date(wrapUpEnd), existingBlocks)) {
        const wrapUpBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: wrapUpStart,
          end_time: wrapUpEnd,
          type: isFriday ? 'work' : 'email',
          title: isFriday ? 'Weekly Review' : 'End of Day Wrap-up',
          description: isFriday 
            ? 'Review week accomplishments, plan next week' 
            : 'Final email check, update task list, plan tomorrow',
          source: 'ai',
          metadata: {},
        };
        
        dayBlocks.push(wrapUpBlock);
        existingBlocks.push({
          start_time: wrapUpBlock.start_time,
          end_time: wrapUpBlock.end_time
        });
      }
      
      // Add evening personal time block (20% chance)
      if (Math.random() < 0.2) {
        const personalTime = randomFrom(schedulePatterns.endOfDayTimes);
        const personalStart = createLocalTimestamp(scheduleDate, personalTime, userTimezone);
        const personalEnd = createLocalTimestamp(
          scheduleDate,
          addMinutesToTime(personalTime, 120), // 2 hours
          userTimezone
        );
        
        const personalBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: personalStart,
          end_time: personalEnd,
          type: 'blocked',
          title: 'Personal Commitment',
          description: 'Family time, gym, personal appointment',
          source: 'manual',
          metadata: { personal: true },
        };
        
        dayBlocks.push(personalBlock);
        existingBlocks.push({
          start_time: personalBlock.start_time,
          end_time: personalBlock.end_time
        });
      }
      
      // Add realistic overlaps to demonstrate UI
      if (dayOffset === 0) {
        // Today: Add 2-3 overlapping scenarios
        
        // Scenario 1: Quick check-in during focus time
        const checkInStart = createLocalTimestamp(scheduleDate, '10:00', userTimezone);
        const checkInEnd = createLocalTimestamp(scheduleDate, '10:15', userTimezone);
        
        const checkInBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: checkInStart,
          end_time: checkInEnd,
          type: 'meeting',
          title: 'Quick Sync with Manager',
          description: 'Urgent question about project',
          source: 'calendar',
          metadata: { urgent: true },
        };
        
        dayBlocks.push(checkInBlock);
        
        // Scenario 2: Double-booked meetings
        if (dayEvents.length > 0) {
          const doubleBookStart = createLocalTimestamp(scheduleDate, '14:30', userTimezone);
          const doubleBookEnd = createLocalTimestamp(scheduleDate, '15:00', userTimezone);
          
          const doubleBookBlock: TimeBlockInsert = {
            user_id: userId,
            daily_schedule_id: schedule.id,
            start_time: doubleBookStart,
            end_time: doubleBookEnd,
            type: 'meeting',
            title: 'Conflicting: Customer Call',
            description: 'Need to reschedule - conflicts with team meeting',
            source: 'calendar',
            metadata: { conflict: true },
          };
          
          dayBlocks.push(doubleBookBlock);
        }
        
        // Scenario 3: Urgent email during meeting
        const urgentEmailStart = createLocalTimestamp(scheduleDate, '15:45', userTimezone);
        const urgentEmailEnd = createLocalTimestamp(scheduleDate, '16:00', userTimezone);
        
        const urgentEmailBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: urgentEmailStart,
          end_time: urgentEmailEnd,
          type: 'email',
          title: 'Urgent: CEO Request',
          description: 'Need to respond immediately',
          source: 'manual',
          metadata: { urgent: true, priority: 'high' },
        };
        
        dayBlocks.push(urgentEmailBlock);
      }
      
      // For past days with overlaps, add some variety
      if (dayOffset === -1) {
        // Yesterday: Meeting ran over
        const overrunStart = createLocalTimestamp(scheduleDate, '11:30', userTimezone);
        const overrunEnd = createLocalTimestamp(scheduleDate, '12:15', userTimezone);
        
        const overrunBlock: TimeBlockInsert = {
          user_id: userId,
          daily_schedule_id: schedule.id,
          start_time: overrunStart,
          end_time: overrunEnd,
          type: 'meeting',
          title: 'Extended: Budget Review',
          description: 'Ran 45 minutes over, pushed lunch back',
          source: 'calendar',
          metadata: { extended: true },
        };
        
        dayBlocks.push(overrunBlock);
      }
      
      // Insert all blocks for this day
      const { error: blocksError } = await supabase
        .from('time_blocks')
        .insert(dayBlocks);
      
      if (blocksError) {
        console.error(`❌ Error inserting blocks for ${dateStr}:`, blocksError);
      } else {
        // For past days, assign some tasks to work/focus blocks
        if (dayOffset < 0 && insertedTasks) {
          const workBlocks = dayBlocks.filter(b => b.type === 'work');
          const { data: insertedBlocks } = await supabase
            .from('time_blocks')
            .select('id, type, title')
            .eq('daily_schedule_id', schedule.id)
            .in('type', ['work']);
          
          if (insertedBlocks && insertedBlocks.length > 0) {
            // Assign tasks intelligently based on block type
            const taskAssignments: TablesInsert<'time_block_tasks'>[] = [];
            let taskIndex = 0;
            
            insertedBlocks.forEach((block) => {
              // Focus blocks get 2-3 tasks, work blocks get 1-2
              const tasksPerBlock = block.type === 'work' 
                ? Math.floor(Math.random() * 2) + 2 
                : Math.floor(Math.random() * 2) + 1;
              
              for (let i = 0; i < tasksPerBlock && taskIndex < insertedTasks.length; i++) {
                // Skip if this would exceed reasonable task count
                if (taskIndex >= insertedTasks.length) break;
                
                taskAssignments.push({
                  time_block_id: block.id,
                  task_id: insertedTasks[taskIndex]!.id,
                });
                taskIndex++;
              }
            });
            
            if (taskAssignments.length > 0) {
              const { error: assignError } = await supabase
                .from('time_block_tasks')
                .insert(taskAssignments);
                
              if (!assignError) {
                console.log(`  ✓ Assigned ${taskAssignments.length} tasks to work blocks`);
              }
            }
          }
        }
        
        console.log(`✅ Created schedule for ${dateStr} with ${dayBlocks.length} blocks (${dayBlocks.filter(b => hasConflict(new Date(b.start_time), new Date(b.end_time), existingBlocks.filter(e => e !== b))).length} overlaps)`);
      }
    }
    
    console.log('\n✨ Mock data seeding complete!');
    console.log(`
Summary:
- User: ${userEmail} (${userId})
- Emails: ${emails.length} (with backlog entries)
- Tasks: ${tasks.length} (with backlog entries)
- Schedules: 5 weekdays (-3 to +3 from today)
- Past days have tasks assigned to work blocks
- Today and future days have empty work blocks for AI planning
    `);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
handleMockData().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 