import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type FindGapsResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, parse, differenceInMinutes, isWithinInterval } from 'date-fns';

const parameters = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  minDuration: z.number().min(15).describe('Minimum gap duration in minutes'),
  between: z.object({
    start: z.string().describe('Start time in HH:mm format'),
    end: z.string().describe('End time in HH:mm format')
  }).optional().describe('Time range to search within')
});

export const findGaps = registerTool(
  createTool<typeof parameters, FindGapsResponse>({
    name: 'schedule_findGaps',
    description: 'Find available time slots in a schedule',
    parameters,
    metadata: {
      category: 'schedule',
      displayName: 'Find Schedule Gaps',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ date, minDuration, between }) => {
      try {
        const scheduleService = ServiceFactory.getInstance().getScheduleService();
        const blocks = await scheduleService.getScheduleForDate(date);
        
        // Sort blocks by start time
        const sortedBlocks = blocks.sort((a, b) => 
          a.startTime.getTime() - b.startTime.getTime()
        );
        
        // Define search boundaries
        const dayStart = between 
          ? parse(between.start, 'HH:mm', new Date(date))
          : parse('00:00', 'HH:mm', new Date(date));
        const dayEnd = between
          ? parse(between.end, 'HH:mm', new Date(date))
          : parse('23:59', 'HH:mm', new Date(date));
        
        // Ensure dayEnd is after dayStart (handle day boundary if needed)
        if (dayEnd <= dayStart) {
          // If end time appears before start time, assume it's next day
          dayEnd.setDate(dayEnd.getDate() + 1);
        }
        
        const gaps: Array<{
          startTime: string;
          endTime: string;
          duration: number;
        }> = [];
        
        console.log(`[Tool: findGaps] Searching between ${format(dayStart, 'HH:mm')} and ${format(dayEnd, 'HH:mm')}`);
        console.log(`[Tool: findGaps] Found ${sortedBlocks.length} blocks`);
        
        // Filter blocks to only those within or overlapping the search range
        const relevantBlocks = sortedBlocks.filter(block => {
          return block.endTime > dayStart && block.startTime < dayEnd;
        });
        
        console.log(`[Tool: findGaps] ${relevantBlocks.length} blocks within search range`);
        
        // Check gap before first block
        if (relevantBlocks.length > 0) {
          const firstBlock = relevantBlocks[0];
          if (firstBlock && firstBlock.startTime > dayStart) {
            const gapEnd = firstBlock.startTime > dayEnd ? dayEnd : firstBlock.startTime;
            const gapDuration = differenceInMinutes(gapEnd, dayStart);
            
            if (gapDuration >= minDuration) {
              gaps.push({
                startTime: format(dayStart, 'HH:mm'),
                endTime: format(gapEnd, 'HH:mm'),
                duration: gapDuration
              });
              console.log(`[Tool: findGaps] Gap before first block: ${format(dayStart, 'HH:mm')}-${format(gapEnd, 'HH:mm')} (${gapDuration} min)`);
            }
          }
        } else {
          // No blocks in range, entire search period is available
          const totalDuration = differenceInMinutes(dayEnd, dayStart);
          if (totalDuration >= minDuration) {
            gaps.push({
              startTime: format(dayStart, 'HH:mm'),
              endTime: format(dayEnd, 'HH:mm'),
              duration: totalDuration
            });
            console.log(`[Tool: findGaps] No blocks in range, entire period available: ${format(dayStart, 'HH:mm')}-${format(dayEnd, 'HH:mm')} (${totalDuration} min)`);
          }
        }
        
        // Find gaps between blocks
        for (let i = 0; i < relevantBlocks.length - 1; i++) {
          const currentBlock = relevantBlocks[i];
          const nextBlock = relevantBlocks[i + 1];
          
          if (currentBlock && nextBlock) {
            const gapStart = currentBlock.endTime < dayStart ? dayStart : currentBlock.endTime;
            const gapEnd = nextBlock.startTime > dayEnd ? dayEnd : nextBlock.startTime;
            
            if (gapEnd > gapStart) {
              const gapDuration = differenceInMinutes(gapEnd, gapStart);
              
              if (gapDuration >= minDuration) {
                gaps.push({
                  startTime: format(gapStart, 'HH:mm'),
                  endTime: format(gapEnd, 'HH:mm'),
                  duration: gapDuration
                });
                console.log(`[Tool: findGaps] Gap between blocks: ${format(gapStart, 'HH:mm')}-${format(gapEnd, 'HH:mm')} (${gapDuration} min)`);
              }
            }
          }
        }
        
        // Check gap after last block
        if (relevantBlocks.length > 0) {
          const lastBlock = relevantBlocks[relevantBlocks.length - 1];
          if (lastBlock && lastBlock.endTime < dayEnd) {
            const gapStart = lastBlock.endTime < dayStart ? dayStart : lastBlock.endTime;
            const gapDuration = differenceInMinutes(dayEnd, gapStart);
            
            if (gapDuration >= minDuration) {
              gaps.push({
                startTime: format(gapStart, 'HH:mm'),
                endTime: format(dayEnd, 'HH:mm'),
                duration: gapDuration
              });
              console.log(`[Tool: findGaps] Gap after last block: ${format(gapStart, 'HH:mm')}-${format(dayEnd, 'HH:mm')} (${gapDuration} min)`);
            }
          }
        }
        
        // Calculate total available minutes
        const totalAvailableMinutes = gaps.reduce((sum, gap) => sum + gap.duration, 0);
        
        console.log(`[Tool: findGaps] Found ${gaps.length} gaps totaling ${totalAvailableMinutes} minutes`);
        
        return {
          success: true,
          gaps,
          totalAvailableMinutes
        };
        
      } catch (error) {
        console.error('[Tool: findGaps] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to find schedule gaps',
          gaps: [],
          totalAvailableMinutes: 0
        };
      }
    },
  })
); 