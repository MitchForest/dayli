import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type WorkflowScheduleResponse } from '../types/responses';
import { format, parse, addMinutes, differenceInMinutes, addDays } from 'date-fns';
import { proposalStore } from '../../utils/proposal-store';

// Import our atomic tools
import { viewSchedule } from '../schedule/viewSchedule';
import { findGaps } from '../schedule/findGaps';
import { analyzeUtilization } from '../schedule/analyzeUtilization';
import { batchCreateBlocks } from '../schedule/batchCreateBlocks';

const parameters = z.object({
  date: z.string().optional().describe("Date to schedule in YYYY-MM-DD format"),
  preferences: z.object({
    workStart: z.string().default("09:00"),
    workEnd: z.string().default("17:00"),
    lunchDuration: z.number().default(60),
    breakDuration: z.number().default(15)
  }).optional(),
  feedback: z.string().optional().describe("User feedback about schedule adjustments"),
  confirmation: z.object({
    approved: z.boolean(),
    proposalId: z.string(),
    modifiedBlocks: z.array(z.object({
      type: z.enum(['work', 'meeting', 'email', 'break', 'blocked']),
      title: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      description: z.string().optional(),
    })).optional()
  }).optional().describe("Confirmation of proposed schedule")
});

export const schedule = registerTool(
  createTool<typeof parameters, WorkflowScheduleResponse>({
    name: 'workflow_schedule',
    description: "Multi-step schedule optimization workflow with user confirmation",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Plan My Day',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ date, preferences = {}, feedback, confirmation }) => {
      try {
        // Smart date determination
        const now = new Date();
        const currentHour = now.getHours();
        let targetDate = date;
        
        if (!targetDate) {
          // If it's after 3 PM, assume they mean tomorrow
          if (currentHour >= 15) {
            targetDate = format(addDays(now, 1), 'yyyy-MM-dd');
            console.log('[Schedule Workflow] Evening request detected, planning for tomorrow:', targetDate);
          } else {
            targetDate = format(now, 'yyyy-MM-dd');
          }
        }
        
        // Merge with default preferences
        const userPrefs = {
          workStart: "09:00",
          workEnd: "17:00",
          lunchDuration: 60,
          breakDuration: 15,
          ...preferences
        };
        
        // PHASE 1: ANALYSIS & PROPOSAL (no confirmation provided)
        if (!confirmation) {
          console.log('[Schedule Workflow] Phase 1: Analyzing and generating proposals');
          
          // Step 1: Get current schedule using atomic tool
          const currentScheduleResult = await viewSchedule.execute({ date: targetDate });
          if (!currentScheduleResult.success) {
            throw new Error('Failed to get current schedule');
          }
          
          // Step 2: Find gaps using atomic tool
          const gapsResult = await findGaps.execute({
            date: targetDate,
            minDuration: 30,
            between: {
              start: userPrefs.workStart,
              end: userPrefs.workEnd
            }
          });
          if (!gapsResult.success) {
            throw new Error('Failed to find schedule gaps');
          }
          
          // Step 3: Analyze utilization using atomic tool
          const utilizationResult = await analyzeUtilization.execute({ date: targetDate });
          if (!utilizationResult.success) {
            throw new Error('Failed to analyze schedule');
          }
          
          // Step 4: Generate block proposals based on analysis
          const proposals = generateScheduleProposals(
            currentScheduleResult.blocks,
            gapsResult.gaps,
            utilizationResult,
            userPrefs,
            feedback
          );
          
          // Store proposal for later confirmation
          const proposalId = crypto.randomUUID();
          proposalStore.store(proposalId, 'workflow_schedule', {
            date: targetDate,
            blocks: proposals.blocks,
            changes: proposals.changes,
            timestamp: new Date()
          }, { date: targetDate });
          
          // Return proposal for user review
          return {
            success: true,
            phase: 'proposal',
            requiresConfirmation: true,
            proposalId,
            date: targetDate,
            blocks: proposals.blocks,
            changes: proposals.changes,
            summary: proposals.summary,
            message: "Here's your proposed schedule. Would you like me to create these time blocks?",
            utilizationBefore: utilizationResult.utilization,
            utilizationAfter: proposals.estimatedUtilization,
          };
        }
        
        // PHASE 2: EXECUTION (user confirmed)
        console.log('[Schedule Workflow] Phase 2: Executing approved schedule');
        
        // Get the stored proposal
        const storedProposal = proposalStore.get(confirmation.proposalId);
        if (!storedProposal) {
          throw new Error('Proposal not found or expired');
        }
        
        const proposal = storedProposal.data;
        const proposalDate = proposal.date; // Get the date from the proposal
        
        console.log('[Schedule Workflow] Using date from proposal:', proposalDate);
        
        // Use modified blocks if provided, otherwise use original proposal
        const blocksToCreate = confirmation.modifiedBlocks || proposal.blocks;
        
        // Filter out existing blocks (only create new ones)
        const existingSchedule = await viewSchedule.execute({ date: proposalDate });
        const existingBlockIds = new Set(existingSchedule.blocks.map((b: any) => b.id));
        
        const newBlocks = blocksToCreate.filter((block: any) => 
          !block.id || !existingBlockIds.has(block.id)
        );
        
        // Step 5: Create blocks using atomic tool
        const createResult = await batchCreateBlocks.execute({
          date: proposalDate,
          blocks: newBlocks
        });
        
        if (!createResult.success) {
          throw new Error('Failed to create time blocks');
        }
        
        // Step 6: Get final schedule and utilization
        const finalSchedule = await viewSchedule.execute({ date: proposalDate });
        const finalUtilization = await analyzeUtilization.execute({ date: proposalDate });
        
        // Clean up proposal
        proposalStore.delete(confirmation.proposalId);
        
        return {
          success: true,
          phase: 'completed',
          date: proposalDate,
          blocks: finalSchedule.blocks,
          changes: [
            ...proposal.changes,
            {
              action: 'executed',
              block: 'All blocks',
              reason: `Created ${createResult.totalCreated} blocks, ${createResult.conflicts.length} conflicts`
            }
          ],
          summary: `Successfully created ${createResult.totalCreated} time blocks. Your day is ${finalUtilization.utilization}% scheduled.`,
          created: createResult.created,
          conflicts: createResult.conflicts,
        };
        
      } catch (error) {
        console.error('[Workflow: schedule] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to manage schedule',
          phase: confirmation ? 'execution' : 'proposal',
          date: date || format(new Date(), 'yyyy-MM-dd'),
          blocks: [],
          changes: [],
          summary: 'Failed to manage schedule'
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