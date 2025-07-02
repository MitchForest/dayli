import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, addMinutes } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

// Helper to get Date from event start/end
function getEventDate(eventTime: { dateTime?: string; date?: string }): Date {
  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime);
  } else if (eventTime.date) {
    return new Date(eventTime.date);
  }
  throw new Error('Event has no valid date');
}

interface ConflictResolutionResult {
  action: 'moved_meeting' | 'moved_block' | 'shortened_both' | 'cancelled_block';
  meeting?: string;
  block?: string;
  newTime?: string;
  reductionMinutes?: number;
}

export const handleMeetingConflict = tool({
  description: "Intelligently resolve meeting conflicts",
  parameters: z.object({
    meetingId: z.string(),
    conflictingBlockId: z.string(),
    resolution: z.enum(['move_meeting', 'move_block', 'shorten_both', 'cancel_block']),
  }),
  execute: async ({ meetingId, conflictingBlockId, resolution }) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Get both items
      const meeting = await calendarService.getEvent(meetingId);
      const block = await scheduleService.getTimeBlock(conflictingBlockId);
      
      if (!meeting || !block) {
        return toolError(
          'ITEMS_NOT_FOUND',
          'Could not find the meeting or block specified'
        );
      }
      
      // Extract dates from meeting
      const meetingStart = getEventDate(meeting.start);
      const meetingEnd = getEventDate(meeting.end);
      
      let result: ConflictResolutionResult;
      
      switch (resolution) {
        case 'move_meeting': {
          // Find next available slot for meeting
          const duration = meetingEnd.getTime() - meetingStart.getTime();
          const newStart = addMinutes(block.endTime, 15); // 15 min after block
          const newEnd = new Date(newStart.getTime() + duration);
          
          // Check if new time is available
          const conflicts = await calendarService.checkConflicts({
            start: newStart,
            end: newEnd,
            excludeEventId: meetingId
          });
          
          if (conflicts.length > 0) {
            return toolError(
              'NO_AVAILABLE_SLOT',
              'No available time found to move the meeting'
            );
          }
          
          await calendarService.updateEvent(meetingId, {
            start: newStart,
            end: newEnd
          });
          
          result = {
            action: 'moved_meeting',
            meeting: meeting.summary,
            newTime: format(newStart, 'h:mm a')
          };
          break;
        }
        
        case 'move_block': {
          // Move the conflicting block later
          const blockDuration = block.endTime.getTime() - block.startTime.getTime();
          const newStart = addMinutes(meetingEnd, 15);
          const newEnd = new Date(newStart.getTime() + blockDuration);
          
          await scheduleService.updateTimeBlock({
            id: conflictingBlockId,
            startTime: format(newStart, 'HH:mm'),
            endTime: format(newEnd, 'HH:mm')
          });
          
          result = {
            action: 'moved_block',
            block: block.title,
            newTime: format(newStart, 'h:mm a')
          };
          break;
        }
        
        case 'shorten_both': {
          // Reduce duration of both to fit
          const overlap = Math.min(block.endTime.getTime(), meetingEnd.getTime()) - 
                          Math.max(block.startTime.getTime(), meetingStart.getTime());
          const reductionEach = Math.ceil(overlap / 2 / (1000 * 60)); // minutes
          
          // Shorten block
          await scheduleService.updateTimeBlock({
            id: conflictingBlockId,
            endTime: format(addMinutes(block.endTime, -reductionEach), 'HH:mm')
          });
          
          // Shorten meeting
          await calendarService.updateEvent(meetingId, {
            end: addMinutes(meetingEnd, -reductionEach)
          });
          
          result = {
            action: 'shortened_both',
            reductionMinutes: reductionEach
          };
          break;
        }
        
        case 'cancel_block': {
          // Remove the conflicting block
          await scheduleService.deleteTimeBlock(conflictingBlockId);
          
          result = {
            action: 'cancelled_block',
            block: block.title
          };
          break;
        }
      }
      
      return toolSuccess(result, {
        type: 'text',
        content: getResolutionMessage(result)
      }, {
        affectedItems: [meetingId, conflictingBlockId],
        suggestions: [
          'View updated schedule',
          'Check for other conflicts',
          'Notify attendees of changes'
        ]
      });
      
    } catch (error) {
      return toolError(
        'CONFLICT_RESOLUTION_FAILED',
        `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
});

function getResolutionMessage(result: ConflictResolutionResult): string {
  switch (result.action) {
    case 'moved_meeting':
      return `Moved "${result.meeting}" to ${result.newTime}`;
    case 'moved_block':
      return `Moved "${result.block}" to ${result.newTime}`;
    case 'shortened_both':
      return `Shortened both items by ${result.reductionMinutes} minutes to resolve conflict`;
    case 'cancelled_block':
      return `Cancelled "${result.block}" to make room for the meeting`;
    default:
      return 'Conflict resolved';
  }
} 