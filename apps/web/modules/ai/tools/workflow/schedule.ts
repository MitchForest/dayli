import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { getCurrentUserId } from '../utils/helpers';
import { format, parse, addMinutes, isWithinInterval, differenceInMinutes } from 'date-fns';
import { ServiceFactory } from '@/services/factory/service.factory';
import { type ScheduleResponse } from '../types/responses';

const parameters = z.object({
  date: z.string().optional().describe("Date to schedule in YYYY-MM-DD format"),
  preferences: z.object({
    workStart: z.string().default("09:00"),
    workEnd: z.string().default("17:00"),
    lunchDuration: z.number().default(60),
    breakDuration: z.number().default(15)
  }).optional(),
  feedback: z.string().optional().describe("User feedback about schedule adjustments")
});

export const schedule = registerTool(
  createTool<typeof parameters, ScheduleResponse>({
    name: 'workflow_schedule',
    description: "Create and manage time blocks for your day - creates work blocks, email blocks, breaks, and lunch",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Schedule Day',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ date, preferences = {}, feedback }) => {
      try {
        // Try to get userId but don't fail if we can't (for testing)
        let userId: string | null = null;
        try {
          userId = await getCurrentUserId();
        } catch (error) {
          console.log('[Schedule Workflow] Running without user context (testing mode)');
        }
        
        const targetDate = date || format(new Date(), 'yyyy-MM-dd');
        
        // Merge with default preferences
        const userPrefs = {
          workStart: "09:00",
          workEnd: "17:00",
          lunchDuration: 60,
          breakDuration: 15,
          ...preferences
        };
        
        const factory = ServiceFactory.getInstance();
        const scheduleService = factory.getScheduleService();
        
        // Get existing schedule
        const existingBlocks = await scheduleService.getScheduleForDate(targetDate);
        
        // Sort blocks by start time
        const sortedBlocks = existingBlocks.sort((a: any, b: any) => 
          a.startTime.getTime() - b.startTime.getTime()
        );
        
        // Extract protected blocks (existing meetings)
        const protectedBlocks = sortedBlocks.filter((block: any) => 
          block.type === 'meeting' || block.isProtected
        );
        
        // Process user feedback if provided
        const adjustments = parseFeedback(feedback, userPrefs);
        
        // Create new blocks
        const newBlocks: any[] = [];
        const changes: any[] = [];
        
        // Helper to check if time slot is available
        const isTimeSlotAvailable = (startTime: Date, endTime: Date): boolean => {
          return !protectedBlocks.some((block: any) => {
            const blockStart = block.startTime;
            const blockEnd = block.endTime;
            return (
              (startTime >= blockStart && startTime < blockEnd) ||
              (endTime > blockStart && endTime <= blockEnd) ||
              (startTime <= blockStart && endTime >= blockEnd)
            );
          });
        };
        
        // 1. Create lunch block
        const lunchStart = parse(adjustments.lunchTime || "12:00", 'HH:mm', new Date(targetDate));
        const lunchEnd = addMinutes(lunchStart, adjustments.lunchDuration || userPrefs.lunchDuration);
        
        if (isTimeSlotAvailable(lunchStart, lunchEnd)) {
          newBlocks.push({
            id: crypto.randomUUID(),
            type: 'break',
            title: 'Lunch Break',
            startTime: format(lunchStart, 'HH:mm'),
            endTime: format(lunchEnd, 'HH:mm'),
            duration: adjustments.lunchDuration || userPrefs.lunchDuration,
            isProtected: true
          });
          changes.push({
            action: 'created',
            block: 'Lunch Break',
            reason: feedback?.includes('lunch') ? 'Extended lunch as requested' : 'Standard lunch break'
          });
        }
        
        // 2. Find gaps for work blocks
        const workStart = parse(userPrefs.workStart, 'HH:mm', new Date(targetDate));
        const workEnd = parse(userPrefs.workEnd, 'HH:mm', new Date(targetDate));
        
        // Get all occupied time slots (protected + new blocks)
        const allBlocks = [...protectedBlocks, ...newBlocks].sort((a, b) => {
          const aStart = typeof a.startTime === 'string' 
            ? parse(a.startTime, 'HH:mm', new Date(targetDate))
            : a.startTime;
          const bStart = typeof b.startTime === 'string'
            ? parse(b.startTime, 'HH:mm', new Date(targetDate))
            : b.startTime;
          return aStart.getTime() - bStart.getTime();
        });
        
        // Find gaps and create work blocks
        let currentTime = workStart;
        let workBlockCount = 0;
        let emailBlockCreated = false;
        
        for (const block of allBlocks) {
          const blockStart = typeof block.startTime === 'string'
            ? parse(block.startTime, 'HH:mm', new Date(targetDate))
            : block.startTime;
          
          const gapMinutes = differenceInMinutes(blockStart, currentTime);
          
          // If we have a gap of at least 30 minutes
          if (gapMinutes >= 30) {
            // Create email block in afternoon if not created
            if (!emailBlockCreated && currentTime.getHours() >= 14 && gapMinutes >= 30) {
              const emailDuration = Math.min(30, gapMinutes);
              newBlocks.push({
                id: crypto.randomUUID(),
                type: 'email',
                title: 'Email Processing',
                startTime: format(currentTime, 'HH:mm'),
                endTime: format(addMinutes(currentTime, emailDuration), 'HH:mm'),
                duration: emailDuration,
                isProtected: false
              });
              changes.push({
                action: 'created',
                block: 'Email Processing',
                reason: 'Dedicated time for email management'
              });
              emailBlockCreated = true;
              currentTime = addMinutes(currentTime, emailDuration);
              continue;
            }
            
            // Create work blocks
            if (gapMinutes >= 60) {
              const workDuration = Math.min(120, gapMinutes); // Max 2-hour blocks
              const blockTitle = workBlockCount === 0 ? 'Deep Work Block' : 
                               workBlockCount === 1 ? 'Focus Block' : 
                               'Work Block';
              
              newBlocks.push({
                id: crypto.randomUUID(),
                type: 'work',
                title: blockTitle,
                startTime: format(currentTime, 'HH:mm'),
                endTime: format(addMinutes(currentTime, workDuration), 'HH:mm'),
                duration: workDuration,
                isProtected: false
              });
              changes.push({
                action: 'created',
                block: blockTitle,
                reason: gapMinutes >= 120 ? 'Extended focus time available' : 'Productive work slot'
              });
              workBlockCount++;
              currentTime = addMinutes(currentTime, workDuration);
              
              // Add break after work block if there's time
              if (differenceInMinutes(blockStart, currentTime) >= userPrefs.breakDuration) {
                newBlocks.push({
                  id: crypto.randomUUID(),
                  type: 'break',
                  title: 'Short Break',
                  startTime: format(currentTime, 'HH:mm'),
                  endTime: format(addMinutes(currentTime, userPrefs.breakDuration), 'HH:mm'),
                  duration: userPrefs.breakDuration,
                  isProtected: false
                });
                changes.push({
                  action: 'created',
                  block: 'Short Break',
                  reason: 'Recovery time between work blocks'
                });
              }
            }
          }
          
          // Move current time to end of this block
          currentTime = typeof block.endTime === 'string'
            ? parse(block.endTime, 'HH:mm', new Date(targetDate))
            : block.endTime;
        }
        
        // Handle remaining time at end of day
        const remainingMinutes = differenceInMinutes(workEnd, currentTime);
        if (remainingMinutes >= 30) {
          if (!emailBlockCreated && remainingMinutes >= 30) {
            newBlocks.push({
              id: crypto.randomUUID(),
              type: 'email',
              title: 'Email Wrap-up',
              startTime: format(currentTime, 'HH:mm'),
              endTime: format(addMinutes(currentTime, 30), 'HH:mm'),
              duration: 30,
              isProtected: false
            });
            changes.push({
              action: 'created',
              block: 'Email Wrap-up',
              reason: 'End-of-day email check'
            });
          } else if (remainingMinutes >= 60) {
            newBlocks.push({
              id: crypto.randomUUID(),
              type: 'work',
              title: 'Wrap-up Tasks',
              startTime: format(currentTime, 'HH:mm'),
              endTime: format(workEnd, 'HH:mm'),
              duration: remainingMinutes,
              isProtected: false
            });
            changes.push({
              action: 'created',
              block: 'Wrap-up Tasks',
              reason: 'End-of-day task completion'
            });
          }
        }
        
        // Add afternoon break if day is packed
        const totalWorkMinutes = newBlocks
          .filter(b => b.type === 'work')
          .reduce((sum, b) => sum + b.duration, 0);
        
        if (totalWorkMinutes > 240 && !newBlocks.some(b => b.type === 'break' && b.startTime.includes('15:'))) {
          // Try to insert afternoon break around 3pm
          const afternoonBreakTime = parse("15:00", 'HH:mm', new Date(targetDate));
          const afternoonBreakEnd = addMinutes(afternoonBreakTime, userPrefs.breakDuration);
          
          if (isTimeSlotAvailable(afternoonBreakTime, afternoonBreakEnd)) {
            newBlocks.push({
              id: crypto.randomUUID(),
              type: 'break',
              title: 'Afternoon Break',
              startTime: format(afternoonBreakTime, 'HH:mm'),
              endTime: format(afternoonBreakEnd, 'HH:mm'),
              duration: userPrefs.breakDuration,
              isProtected: true
            });
            changes.push({
              action: 'created',
              block: 'Afternoon Break',
              reason: 'Prevent afternoon fatigue'
            });
          }
        }
        
        // Combine all blocks for final schedule
        const finalBlocks = [...protectedBlocks.map((b: any) => ({
          id: b.id,
          type: b.type,
          title: b.title,
          startTime: format(b.startTime, 'HH:mm'),
          endTime: format(b.endTime, 'HH:mm'),
          duration: differenceInMinutes(b.endTime, b.startTime),
          isProtected: true
        })), ...newBlocks].sort((a, b) => {
          const aTime = parse(a.startTime, 'HH:mm', new Date());
          const bTime = parse(b.startTime, 'HH:mm', new Date());
          return aTime.getTime() - bTime.getTime();
        });
        
        // Generate summary
        const workBlocks = finalBlocks.filter(b => b.type === 'work').length;
        const emailBlocks = finalBlocks.filter(b => b.type === 'email').length;
        const breaks = finalBlocks.filter(b => b.type === 'break').length;
        
        return {
          success: true,
          date: targetDate,
          blocks: finalBlocks,
          changes,
          summary: `Created ${workBlocks} work blocks, ${emailBlocks} email block${emailBlocks !== 1 ? 's' : ''}, and ${breaks} breaks`
        };
        
      } catch (error) {
        console.error('[Workflow: schedule] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create schedule',
          date: date || format(new Date(), 'yyyy-MM-dd'),
          blocks: [],
          changes: [],
          summary: 'Failed to create schedule'
        };
      }
    },
  })
);

// Helper function to parse user feedback
function parseFeedback(feedback: string | undefined, defaults: any): any {
  if (!feedback) return defaults;
  
  const adjustments = { ...defaults };
  
  // Parse lunch duration requests
  const lunchDurationMatch = feedback.match(/(\d+)\s*hour\s*lunch/i);
  if (lunchDurationMatch && lunchDurationMatch[1]) {
    const hours = parseInt(lunchDurationMatch[1]);
    adjustments.lunchDuration = hours * 60;
  }
  
  // Parse lunch time requests
  const lunchTimeMatch = feedback.match(/lunch\s*at\s*(\d{1,2})/i);
  if (lunchTimeMatch && lunchTimeMatch[1]) {
    const hour = parseInt(lunchTimeMatch[1]);
    adjustments.lunchTime = `${hour.toString().padStart(2, '0')}:00`;
  }
  
  // Parse blocked time requests
  if (feedback.match(/block.*afternoon/i)) {
    adjustments.blockAfternoon = true;
  }
  
  return adjustments;
} 