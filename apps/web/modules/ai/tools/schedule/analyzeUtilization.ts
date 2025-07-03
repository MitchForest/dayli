import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type AnalyzeUtilizationResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { differenceInMinutes, parse, format } from 'date-fns';

const parameters = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

export const analyzeUtilization = registerTool(
  createTool<typeof parameters, AnalyzeUtilizationResponse>({
    name: 'schedule_analyzeUtilization',
    description: 'Analyze schedule efficiency and patterns',
    parameters,
    metadata: {
      category: 'schedule',
      displayName: 'Analyze Schedule Utilization',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ date }) => {
      try {
        const scheduleService = ServiceFactory.getInstance().getScheduleService();
        const blocks = await scheduleService.getScheduleForDate(date);
        
        // Sort blocks by start time
        const sortedBlocks = blocks.sort((a, b) => 
          a.startTime.getTime() - b.startTime.getTime()
        );
        
        // Calculate total scheduled time
        const totalScheduledMinutes = blocks.reduce((sum, block) => {
          return sum + differenceInMinutes(block.endTime, block.startTime);
        }, 0);
        
        // Calculate time by type
        const timeByType = blocks.reduce((acc, block) => {
          const duration = differenceInMinutes(block.endTime, block.startTime);
          acc[block.type] = (acc[block.type] || 0) + duration;
          return acc;
        }, {} as Record<string, number>);
        
        // Calculate focus time (work blocks)
        const focusTime = timeByType['work'] || 0;
        
        // Calculate meeting time
        const meetingTime = timeByType['meeting'] || 0;
        
        // Calculate break time
        const breakTime = timeByType['break'] || 0;
        
        // Calculate email time
        const emailTime = timeByType['email'] || 0;
        
        // Find fragmented time (gaps < 30 minutes)
        let fragmentedTime = 0;
        const workStart = parse('09:00', 'HH:mm', new Date(date));
        const workEnd = parse('17:00', 'HH:mm', new Date(date));
        
        // Check gap before first block
        if (sortedBlocks.length > 0) {
          const firstBlock = sortedBlocks[0];
          if (firstBlock) {
            const gap = differenceInMinutes(firstBlock.startTime, workStart);
            if (gap > 0 && gap < 30) {
              fragmentedTime += gap;
            }
          }
        }
        
        // Check gaps between blocks
        for (let i = 0; i < sortedBlocks.length - 1; i++) {
          const currentBlock = sortedBlocks[i];
          const nextBlock = sortedBlocks[i + 1];
          if (currentBlock && nextBlock) {
            const gap = differenceInMinutes(nextBlock.startTime, currentBlock.endTime);
            if (gap > 0 && gap < 30) {
              fragmentedTime += gap;
            }
          }
        }
        
        // Check gap after last block
        if (sortedBlocks.length > 0) {
          const lastBlock = sortedBlocks[sortedBlocks.length - 1];
          if (lastBlock) {
            const gap = differenceInMinutes(workEnd, lastBlock.endTime);
            if (gap > 0 && gap < 30) {
              fragmentedTime += gap;
            }
          }
        }
        
        // Calculate utilization percentage (based on 8-hour work day)
        const totalWorkMinutes = 8 * 60;
        const utilization = Math.round((totalScheduledMinutes / totalWorkMinutes) * 100);
        
        // Generate suggestions
        const suggestions: string[] = [];
        
        if (utilization < 70) {
          suggestions.push('Schedule is underutilized - consider adding more focused work blocks');
        } else if (utilization > 90) {
          suggestions.push('Schedule is very full - ensure you have buffer time for unexpected tasks');
        }
        
        if (focusTime < 180) { // Less than 3 hours
          suggestions.push('Limited deep work time - try to schedule longer uninterrupted work blocks');
        }
        
        if (breakTime < 30) {
          suggestions.push('Insufficient break time - add short breaks to maintain energy');
        }
        
        if (fragmentedTime > 60) {
          suggestions.push(`${Math.round(fragmentedTime / 60)} hours of fragmented time - consolidate small gaps`);
        }
        
        if (meetingTime > focusTime) {
          suggestions.push('Meetings dominate your schedule - protect time for focused work');
        }
        
        if (emailTime === 0) {
          suggestions.push('No dedicated email time - schedule blocks to avoid constant interruptions');
        }
        
        // Find longest uninterrupted work block
        let longestWorkBlock = 0;
        blocks
          .filter(b => b.type === 'work')
          .forEach(block => {
            const duration = differenceInMinutes(block.endTime, block.startTime);
            if (duration > longestWorkBlock) {
              longestWorkBlock = duration;
            }
          });
        
        console.log(`[Tool: analyzeUtilization] ${utilization}% utilization, ${suggestions.length} suggestions`);
        
        return {
          success: true,
          utilization,
          totalScheduledMinutes,
          focusTime,
          meetingTime,
          breakTime,
          emailTime,
          fragmentedTime,
          longestWorkBlock,
          suggestions,
          blockCount: blocks.length,
        };
        
      } catch (error) {
        console.error('[Tool: analyzeUtilization] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to analyze schedule',
          utilization: 0,
          totalScheduledMinutes: 0,
          focusTime: 0,
          meetingTime: 0,
          breakTime: 0,
          emailTime: 0,
          fragmentedTime: 0,
          longestWorkBlock: 0,
          suggestions: [],
          blockCount: 0,
        };
      }
    },
  })
); 