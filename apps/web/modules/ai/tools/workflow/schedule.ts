import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type WorkflowScheduleResponse } from '../types/responses';
import { format, parse, addMinutes, differenceInMinutes, addDays } from 'date-fns';
import { proposalStore } from '../../utils/proposal-store';
import { ServiceFactory } from '@/services/factory/service.factory';

// Import our atomic tools
import { viewSchedule } from '../schedule/viewSchedule';
import { findGaps } from '../schedule/findGaps';
import { analyzeUtilization } from '../schedule/analyzeUtilization';
import { batchCreateBlocks } from '../schedule/batchCreateBlocks';

const paramsSchema = z.object({
  date: z.string().optional().describe('Target date for scheduling (YYYY-MM-DD)'),
  preferences: z.object({
    workStart: z.string().default('09:00'),
    workEnd: z.string().default('17:00'),
    lunchDuration: z.number().default(60),
    breakDuration: z.number().default(15),
  }).optional().describe('User preferences for schedule generation'),
  feedback: z.string().optional().describe('User feedback for adjustments'),
  confirmation: z.object({
    approved: z.boolean(),
    proposalId: z.string(),
    modifiedBlocks: z.array(z.any()).optional(),
  }).optional().describe('Confirmation of proposed schedule'),
});

export const schedule = registerTool(
  createTool<typeof paramsSchema, WorkflowScheduleResponse>({
    name: 'workflow_schedule',
    description: 'Comprehensive daily planning workflow that analyzes and optimizes your schedule',
    parameters: paramsSchema,
    metadata: {
      category: 'workflow',
      displayName: 'Daily Schedule Planning',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async (params: z.infer<typeof paramsSchema>): Promise<WorkflowScheduleResponse> => {
      console.log('[Workflow: Schedule] Starting with params:', params);
      const factory = ServiceFactory.getInstance();
      
      // Ensure we have a valid date - use a default if not provided
      const defaultDate = new Date().toISOString().split('T')[0];
      const targetDate = (params.date ?? defaultDate) as string;
      
      try {
        // Check if this is a confirmation
        if (params.confirmation) {
          console.log('[Workflow: Schedule] Processing confirmation:', params.confirmation);
          
          // Retrieve the proposal
          const proposalId = params.confirmation.proposalId;
          if (!proposalId) {
            return {
              success: false,
              error: 'No proposal ID provided for confirmation',
              phase: 'completed',
              requiresConfirmation: false,
              date: targetDate,
              blocks: [],
              changes: [],
              summary: 'Failed to confirm - no proposal ID',
            };
          }
          
          const proposal = proposalStore.getProposal(proposalId);
          if (!proposal) {
            return {
              success: false,
              error: 'Proposal not found or expired',
              phase: 'completed',
              requiresConfirmation: false,
              date: targetDate,
              blocks: [],
              changes: [],
              summary: 'Failed to confirm - proposal not found',
            };
          }
          
          // Check if approved
          if (!params.confirmation.approved) {
            proposalStore.clearProposal(proposalId);
            return {
              success: true,
              phase: 'completed',
              requiresConfirmation: false,
              message: 'Schedule proposal cancelled',
              date: proposal.date,
              blocks: [],
              changes: [],
              summary: 'Schedule proposal cancelled by user',
            };
          }
          
          // Apply the proposed schedule
          console.log('[Workflow: Schedule] Applying proposed schedule');
          const scheduleService = factory.getScheduleService();
          const changes: Array<{
            action: string;
            block: string;
            reason: string;
          }> = [];
          
          // Apply each block from the proposal
          for (const block of proposal.data.blocks) {
            try {
              // Parse the times to get Date objects
              const startTime = new Date(block.startTime);
              const endTime = new Date(block.endTime);
              
              await scheduleService.createTimeBlock({
                date: proposal.date,
                type: block.type,
                title: block.title,
                description: block.description,
                startTime: startTime.toTimeString().slice(0, 5), // HH:MM format
                endTime: endTime.toTimeString().slice(0, 5), // HH:MM format
                metadata: block.metadata,
              });
              
              changes.push({
                action: 'created',
                block: block.title,
                reason: `Created ${block.type} block from ${startTime.toTimeString().slice(0, 5)} to ${endTime.toTimeString().slice(0, 5)}`,
              });
            } catch (error) {
              console.error('[Workflow: Schedule] Failed to create block:', error);
              changes.push({
                action: 'create_failed',
                block: block.title,
                reason: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
          
          // Clear the proposal after use
          proposalStore.clearProposal(proposalId);
          
          return {
            success: true,
            phase: 'completed',
            requiresConfirmation: false,
            message: 'Schedule has been created successfully',
            date: proposal.date,
            blocks: proposal.data.blocks,
            changes,
            summary: `Created ${changes.filter(c => c.action === 'created').length} of ${proposal.data.blocks.length} blocks`,
          };
        }
        
        // Get services
        const scheduleService = factory.getScheduleService();
        const preferenceService = factory.getPreferenceService();
        
        // Get user preferences
        const preferences = await preferenceService.getUserPreferences();
        const workStart = preferences?.workStartTime || '09:00';
        const workEnd = preferences?.workEndTime || '17:00';
        const lunchTime = '12:00'; // Default lunch time
        const lunchDuration = 60; // Default 60 minutes
        
        console.log('[Workflow: Schedule] Planning for date:', targetDate);
        
        // Get existing schedule
        const existingBlocks = await scheduleService.getScheduleForDate(targetDate);
        
        // If schedule already exists and is reasonably full, inform user
        if (existingBlocks.length >= 4) {
          const totalMinutes = existingBlocks.reduce((sum: number, block: any) => {
            const duration = (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60);
            return sum + duration;
          }, 0);
          
          const utilization = Math.round((totalMinutes / 480) * 100); // Assume 8-hour day
          
          return {
            success: true,
            phase: 'completed',
            requiresConfirmation: false,
            message: `Your schedule for ${targetDate} is already ${utilization}% utilized with ${existingBlocks.length} blocks`,
            date: targetDate,
            blocks: existingBlocks.map((block: any) => ({
              id: block.id,
              type: block.type,
              title: block.title,
              description: block.description || '',
              startTime: block.startTime.toISOString(),
              endTime: block.endTime.toISOString(),
              metadata: block.metadata || {},
            })),
            changes: [],
            summary: `Schedule already ${utilization}% utilized`,
          };
        }
        
        // Generate optimized schedule
        const proposedBlocks = await generateOptimizedSchedule(
          targetDate,
          workStart,
          workEnd,
          lunchTime,
          lunchDuration,
          existingBlocks
        );
        
        // Calculate utilization
        const totalMinutes = proposedBlocks.reduce((sum: number, block: any) => {
          const start = new Date(block.startTime);
          const end = new Date(block.endTime);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60);
        }, 0);
        
        const existingMinutes = existingBlocks.reduce((sum: number, block: any) => {
          return sum + (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60);
        }, 0);
        
        const newUtilization = Math.round((totalMinutes / 480) * 100);
        const oldUtilization = Math.round((existingMinutes / 480) * 100);
        
        // Count blocks by type
        const blocksByType = proposedBlocks.reduce((acc: Record<string, number>, block: any) => {
          acc[block.type] = (acc[block.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const summary = [];
        if (blocksByType.work) summary.push(`${blocksByType.work} work block${blocksByType.work > 1 ? 's' : ''}`);
        if (blocksByType.break) summary.push(`${blocksByType.break} break${blocksByType.break > 1 ? 's' : ''}`);
        
        // Save the proposal
        // Get userId from the service config - for now use a placeholder
        const userId = 'workflow-user'; // This will be properly set from context
        const proposalId = proposalStore.saveProposal(
          userId,
          'schedule',
          'workflow_schedule',
          targetDate,
          {
            blocks: proposedBlocks,
            utilization: newUtilization,
            summary: summary.join(', '),
          }
        );
        
        console.log('[Workflow: Schedule] Saved proposal:', proposalId);
        
        // Return proposal for review
        return {
          success: true,
          phase: 'proposal',
          requiresConfirmation: true,
          proposalId,
          message: "Here's your proposed schedule. Would you like me to create these time blocks?",
          date: targetDate,
          blocks: proposedBlocks,
          changes: [],
          summary: `Proposing ${summary.join(', ')}`,
          utilizationBefore: oldUtilization,
          utilizationAfter: newUtilization,
        };
        
      } catch (error) {
        console.error('[Workflow: Schedule] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create schedule',
          phase: 'completed',
          requiresConfirmation: false,
          date: targetDate,
          blocks: [],
          changes: [],
          summary: 'Failed to create schedule',
        };
      }
    },
  })
);

// Helper function to generate schedule proposals
function generateScheduleProposals(
  existingBlocks: any[],
  gaps: any[],
  utilization: any,
  preferences: any,
  feedback?: string
): {
  blocks: any[];
  changes: any[];
  summary: string;
  estimatedUtilization: number;
} {
  const proposals: any[] = [];
  const changes: any[] = [];
  
  console.log('[Schedule Proposals] Starting generation with:', {
    existingBlocksCount: existingBlocks.length,
    gapsCount: gaps.length,
    gaps: gaps,
    preferences,
    feedback
  });
  
  // Parse feedback for adjustments
  const adjustments = parseFeedback(feedback, preferences);
  
  // Sort gaps by start time
  const sortedGaps = gaps.sort((a, b) => {
    const aTime = parse(a.startTime, 'HH:mm', new Date());
    const bTime = parse(b.startTime, 'HH:mm', new Date());
    return aTime.getTime() - bTime.getTime();
  });
  
  // Analyze existing schedule
  const hasLunch = existingBlocks.some(b => 
    b.type === 'break' && b.title?.toLowerCase().includes('lunch')
  );
  const hasEmailTime = existingBlocks.some(b => b.type === 'email');
  const meetingCount = existingBlocks.filter(b => b.type === 'meeting').length;
  const workBlockCount = existingBlocks.filter(b => b.type === 'work').length;
  
  // Track what we've added
  let addedLunch = false;
  let addedEmailBlock = false;
  let addedMorningBreak = false;
  let addedAfternoonBreak = false;
  let addedWorkBlocks = 0;
  
  // Process each gap
  for (const gap of sortedGaps) {
    const gapStart = parse(gap.startTime, 'HH:mm', new Date());
    const gapEnd = parse(gap.endTime, 'HH:mm', new Date());
    let currentTime = gapStart;
    let remainingTime = gap.duration;
    
    console.log(`[Schedule Proposals] Processing gap: ${gap.startTime}-${gap.endTime} (${gap.duration} min)`);
    
    // Skip if gap is too small
    if (gap.duration < 15) {
      console.log('[Schedule Proposals] Gap too small, skipping');
      continue;
    }
    
    while (remainingTime >= 15 && currentTime < gapEnd) {
      const currentHour = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();
      
      // Determine what to add based on time and what's missing
      let blockToAdd = null;
      
      // Morning routine (7-9am) - only if very early
      if (currentHour < 8 && remainingTime >= 30) {
        blockToAdd = {
          type: 'blocked',
          title: 'Morning Routine',
          duration: Math.min(60, remainingTime),
          description: 'Prepare for the day'
        };
      }
      // Morning break (10-11am)
      else if (!addedMorningBreak && currentHour >= 10 && currentHour < 11 && remainingTime >= 15) {
        blockToAdd = {
          type: 'break',
          title: 'Morning Break',
          duration: 15,
          description: 'Quick refresh'
        };
        addedMorningBreak = true;
      }
      // Lunch (11:30am-1:30pm)
      else if (!hasLunch && !addedLunch && currentHour >= 11 && currentHour < 14 && remainingTime >= 45) {
        // Prefer noon-ish for lunch
        if ((currentHour === 11 && currentMinutes >= 30) || currentHour === 12 || (currentHour === 13 && currentMinutes === 0)) {
          blockToAdd = {
            type: 'break',
            title: 'Lunch Break',
            duration: Math.min(60, remainingTime),
            description: 'Recharge with a meal'
          };
          addedLunch = true;
        }
      }
      // Email block (2-4pm)
      else if (!hasEmailTime && !addedEmailBlock && currentHour >= 14 && currentHour < 16 && remainingTime >= 30) {
        blockToAdd = {
          type: 'email',
          title: 'Email Processing',
          duration: Math.min(45, remainingTime),
          description: 'Batch process emails'
        };
        addedEmailBlock = true;
      }
      // Afternoon break (3-4pm)
      else if (!addedAfternoonBreak && currentHour >= 15 && currentHour < 16 && remainingTime >= 15) {
        blockToAdd = {
          type: 'break',
          title: 'Afternoon Break',
          duration: 15,
          description: 'Recharge for final push'
        };
        addedAfternoonBreak = true;
      }
      // Work blocks based on time of day
      else if (currentHour >= 8 && currentHour < 18 && remainingTime >= 30) {
        const duration = Math.min(120, remainingTime); // Max 2 hours
        
        // Determine work block type based on time
        let title, description;
        if (currentHour < 12 && workBlockCount + addedWorkBlocks === 0) {
          title = 'Deep Work Block';
          description = 'Prime focus time for complex tasks';
        } else if (currentHour < 12) {
          title = 'Morning Focus Block';
          description = 'Continue morning productivity';
        } else if (currentHour < 15) {
          title = 'Afternoon Work Block';
          description = 'Collaborative work and meetings';
        } else if (currentHour < 17) {
          title = 'Project Time';
          description = 'Dedicated project work';
        } else {
          title = 'Admin & Planning';
          description = 'Wrap up and plan ahead';
        }
        
        blockToAdd = {
          type: 'work',
          title,
          duration: duration >= 60 ? duration : Math.max(30, remainingTime), // At least 30 min for work
          description
        };
        addedWorkBlocks++;
      }
      // Evening wind-down (after 6pm)
      else if (currentHour >= 18 && remainingTime >= 30) {
        blockToAdd = {
          type: 'blocked',
          title: 'Evening Time',
          duration: remainingTime,
          description: 'Personal time'
        };
      }
      
      // Add the block if we found something suitable
      if (blockToAdd) {
        const endTime = addMinutes(currentTime, blockToAdd.duration);
        
        // Make sure we don't exceed the gap
        if (endTime > gapEnd) {
          blockToAdd.duration = differenceInMinutes(gapEnd, currentTime);
          if (blockToAdd.duration < 15) break; // Too small
        }
        
        const proposal = {
          type: blockToAdd.type,
          title: blockToAdd.title,
          startTime: format(currentTime, 'HH:mm'),
          endTime: format(addMinutes(currentTime, blockToAdd.duration), 'HH:mm'),
          description: blockToAdd.description
        };
        
        proposals.push(proposal);
        changes.push({
          action: 'create',
          block: blockToAdd.title,
          reason: getBlockReason(blockToAdd.type, blockToAdd.title, currentHour)
        });
        
        console.log(`[Schedule Proposals] Added ${blockToAdd.title}:`, proposal);
        
        currentTime = addMinutes(currentTime, blockToAdd.duration);
        remainingTime -= blockToAdd.duration;
      } else {
        // If we can't find anything suitable, move forward 15 minutes
        currentTime = addMinutes(currentTime, 15);
        remainingTime -= 15;
      }
    }
  }
  
  // Add recommendations for missing essential blocks
  if (!hasLunch && !addedLunch) {
    changes.push({
      action: 'recommend',
      block: 'Lunch Break',
      reason: 'No lunch break scheduled - consider adding one around noon'
    });
  }
  
  if (!hasEmailTime && !addedEmailBlock && proposals.length > 0) {
    changes.push({
      action: 'recommend',
      block: 'Email Time',
      reason: 'No dedicated email time - consider batching emails in the afternoon'
    });
  }
  
  console.log('[Schedule Proposals] Generated proposals:', {
    proposalsCount: proposals.length,
    proposals
  });
  
  // Calculate estimated utilization
  const totalProposedMinutes = proposals.reduce((sum, block) => {
    const start = parse(block.startTime, 'HH:mm', new Date());
    const end = parse(block.endTime, 'HH:mm', new Date());
    return sum + differenceInMinutes(end, start);
  }, 0);
  
  const existingMinutes = utilization.totalScheduledMinutes || 0;
  const totalMinutes = existingMinutes + totalProposedMinutes;
  const workDayMinutes = 480; // 8-hour work day
  const estimatedUtilization = Math.round((totalMinutes / workDayMinutes) * 100);
  
  // Generate summary
  const workBlocks = proposals.filter(b => b.type === 'work').length;
  const emailBlocks = proposals.filter(b => b.type === 'email').length;
  const breaks = proposals.filter(b => b.type === 'break').length;
  const blocked = proposals.filter(b => b.type === 'blocked').length;
  
  let summaryParts = [];
  if (workBlocks > 0) summaryParts.push(`${workBlocks} work block${workBlocks !== 1 ? 's' : ''}`);
  if (emailBlocks > 0) summaryParts.push(`${emailBlocks} email block${emailBlocks !== 1 ? 's' : ''}`);
  if (breaks > 0) summaryParts.push(`${breaks} break${breaks !== 1 ? 's' : ''}`);
  if (blocked > 0) summaryParts.push(`${blocked} personal block${blocked !== 1 ? 's' : ''}`);
  
  let summary: string;
  if (summaryParts.length > 0) {
    summary = `Proposing ${summaryParts.join(', ')}`;
  } else if (existingBlocks.length > 0) {
    // Provide helpful feedback when schedule already has blocks
    const totalGapMinutes = gaps.reduce((sum, gap) => sum + gap.duration, 0);
    if (totalGapMinutes < 60) {
      summary = `Your schedule is already well-filled with ${existingBlocks.length} blocks. Only small gaps remain.`;
    } else {
      const gapHours = Math.floor(totalGapMinutes / 60);
      const gapMinutes = totalGapMinutes % 60;
      const timeStr = gapHours > 0 ? `${gapHours}h ${gapMinutes}m` : `${gapMinutes}m`;
      summary = `Found ${gaps.length} gaps totaling ${timeStr} in your schedule. Consider adding specific activities or keeping as buffer time.`;
    }
  } else {
    summary = 'Your day is completely open. Would you like me to create a full schedule?';
  }
  
  // Add context about existing schedule
  if (existingBlocks.length > 0 && proposals.length === 0) {
    const meetingCount = existingBlocks.filter(b => b.type === 'meeting').length;
    const workCount = existingBlocks.filter(b => b.type === 'work').length;
    
    changes.push({
      action: 'info',
      block: 'Current Schedule',
      reason: `You have ${existingBlocks.length} blocks scheduled${meetingCount > 0 ? ` including ${meetingCount} meeting${meetingCount !== 1 ? 's' : ''}` : ''}`
    });
    
    if (!hasLunch && gaps.some(g => {
      const start = parse(g.startTime, 'HH:mm', new Date());
      const hour = start.getHours();
      return hour >= 11 && hour <= 14 && g.duration >= 45;
    })) {
      changes.push({
        action: 'suggest',
        block: 'Lunch Break',
        reason: 'No lunch scheduled - you have time available around midday'
      });
    }
  }
  
  return {
    blocks: proposals,
    changes,
    summary,
    estimatedUtilization
  };
}

// Helper function to get contextual reason for block
function getBlockReason(type: string, title: string, hour: number): string {
  const reasons: Record<string, string> = {
    // Work blocks
    'work-deep work block': 'Morning is ideal for deep, focused work',
    'work-morning focus block': 'Continue productive morning momentum',
    'work-afternoon work block': 'Good time for collaborative tasks',
    'work-project time': 'Dedicated time for project progress',
    'work-admin & planning': 'Wrap up tasks and prepare for tomorrow',
    
    // Breaks
    'break-morning break': 'Short break to maintain energy',
    'break-lunch break': 'Essential midday break for sustained productivity',
    'break-afternoon break': 'Combat afternoon fatigue',
    
    // Other
    'email-email processing': 'Batch process emails for efficiency',
    'blocked-morning routine': 'Protected time for morning preparation',
    'blocked-evening time': 'Maintain work-life balance',
  };
  
  const key = `${type}-${title.toLowerCase()}`;
  return reasons[key] || `Optimize your ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'} schedule`;
}

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
  
  // Parse work preferences
  if (feedback.match(/more\s+breaks/i)) {
    adjustments.breakDuration = 20;
  }
  
  if (feedback.match(/longer\s+work\s+blocks/i)) {
    adjustments.preferLongBlocks = true;
  }
  
  return adjustments;
}

// Helper function to generate optimized schedule
async function generateOptimizedSchedule(
  targetDate: string,
  workStart: string,
  workEnd: string,
  lunchTime: string,
  lunchDuration: number,
  existingBlocks: any[]
): Promise<any[]> {
  const blocks = [];
  
  // Parse work hours
  const startParts = workStart.split(':');
  const startHour = parseInt(startParts[0] || '9');
  const startMin = parseInt(startParts[1] || '0');
  
  const endParts = workEnd.split(':');
  const endHour = parseInt(endParts[0] || '17');
  const endMin = parseInt(endParts[1] || '0');
  
  const lunchParts = lunchTime.split(':');
  const lunchHour = parseInt(lunchParts[0] || '12');
  const lunchMin = parseInt(lunchParts[1] || '0');
  
  // Create date objects for the target date
  const date = new Date(targetDate);
  const workStartTime = new Date(date);
  workStartTime.setHours(startHour, startMin, 0, 0);
  
  const workEndTime = new Date(date);
  workEndTime.setHours(endHour, endMin, 0, 0);
  
  const lunchStartTime = new Date(date);
  lunchStartTime.setHours(lunchHour, lunchMin, 0, 0);
  
  const lunchEndTime = new Date(lunchStartTime);
  lunchEndTime.setMinutes(lunchEndTime.getMinutes() + lunchDuration);
  
  // Morning work block (start to lunch)
  if (workStartTime < lunchStartTime) {
    blocks.push({
      type: 'work',
      title: 'Morning Focus Block',
      description: 'Deep work on priority tasks',
      startTime: workStartTime.toISOString(),
      endTime: lunchStartTime.toISOString(),
      metadata: {},
    });
  }
  
  // Lunch break
  blocks.push({
    type: 'break',
    title: 'Lunch Break',
    description: 'Recharge with a meal',
    startTime: lunchStartTime.toISOString(),
    endTime: lunchEndTime.toISOString(),
    metadata: {},
  });
  
  // Afternoon work block (after lunch to end)
  if (lunchEndTime < workEndTime) {
    blocks.push({
      type: 'work',
      title: 'Afternoon Work Block',
      description: 'Collaborative work and meetings',
      startTime: lunchEndTime.toISOString(),
      endTime: workEndTime.toISOString(),
      metadata: {},
    });
  }
  
  return blocks;
} 