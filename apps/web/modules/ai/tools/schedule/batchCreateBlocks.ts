import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type BatchCreateBlocksResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { parse, format, isAfter, isBefore, areIntervalsOverlapping } from 'date-fns';

const parameters = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  blocks: z.array(z.object({
    type: z.enum(['work', 'meeting', 'email', 'break', 'blocked']),
    title: z.string(),
    startTime: z.string().describe('Time in HH:mm format'),
    endTime: z.string().describe('Time in HH:mm format'),
    description: z.string().optional(),
  })).describe('Array of blocks to create')
});

export const batchCreateBlocks = registerTool(
  createTool<typeof parameters, BatchCreateBlocksResponse>({
    name: 'schedule_batchCreateBlocks',
    description: 'Create multiple time blocks atomically with conflict detection',
    parameters,
    metadata: {
      category: 'schedule',
      displayName: 'Batch Create Blocks',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ date, blocks }) => {
      try {
        const scheduleService = ServiceFactory.getInstance().getScheduleService();
        
        // Get existing blocks to check for conflicts
        const existingBlocks = await scheduleService.getScheduleForDate(date);
        
        const created: Array<{
          id: string;
          type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
          title: string;
          startTime: Date;
          endTime: Date;
          description?: string;
        }> = [];
        
        const conflicts: Array<{
          block: {
            type: string;
            title: string;
            startTime: string;
            endTime: string;
          };
          reason: string;
          conflictsWith?: string;
        }> = [];
        
        // Check each block for conflicts and validity
        for (const block of blocks) {
          const startTime = parse(block.startTime, 'HH:mm', new Date(date));
          const endTime = parse(block.endTime, 'HH:mm', new Date(date));
          
          // Validate time order
          if (!isAfter(endTime, startTime)) {
            conflicts.push({
              block: {
                type: block.type,
                title: block.title,
                startTime: block.startTime,
                endTime: block.endTime
              },
              reason: 'End time must be after start time'
            });
            continue;
          }
          
          // Check for conflicts with existing blocks
          let hasConflict = false;
          for (const existing of existingBlocks) {
            const overlaps = areIntervalsOverlapping(
              { start: startTime, end: endTime },
              { start: existing.startTime, end: existing.endTime }
            );
            
            if (overlaps) {
              conflicts.push({
                block: {
                  type: block.type,
                  title: block.title,
                  startTime: block.startTime,
                  endTime: block.endTime
                },
                reason: 'Conflicts with existing block',
                conflictsWith: existing.title
              });
              hasConflict = true;
              break;
            }
          }
          
          // Check for conflicts with other blocks in the batch
          if (!hasConflict) {
            for (const createdBlock of created) {
              const overlaps = areIntervalsOverlapping(
                { start: startTime, end: endTime },
                { start: createdBlock.startTime, end: createdBlock.endTime }
              );
              
              if (overlaps) {
                conflicts.push({
                  block: {
                    type: block.type,
                    title: block.title,
                    startTime: block.startTime,
                    endTime: block.endTime
                  },
                  reason: 'Conflicts with another block in batch',
                  conflictsWith: createdBlock.title
                });
                hasConflict = true;
                break;
              }
            }
          }
          
          // If no conflicts, create the block
          if (!hasConflict) {
            try {
              const newBlock = await scheduleService.createTimeBlock({
                type: block.type,
                title: block.title,
                startTime: block.startTime,
                endTime: block.endTime,
                date: date,
                description: block.description,
              });
              
              created.push({
                id: newBlock.id,
                type: newBlock.type as 'work' | 'meeting' | 'email' | 'break' | 'blocked',
                title: newBlock.title,
                startTime: newBlock.startTime,
                endTime: newBlock.endTime,
                description: newBlock.description,
              });
            } catch (error) {
              conflicts.push({
                block: {
                  type: block.type,
                  title: block.title,
                  startTime: block.startTime,
                  endTime: block.endTime
                },
                reason: error instanceof Error ? error.message : 'Failed to create block'
              });
            }
          }
        }
        
        console.log(`[Tool: batchCreateBlocks] Created ${created.length} blocks, ${conflicts.length} conflicts`);
        
        return {
          success: true,
          created,
          conflicts,
          totalRequested: blocks.length,
          totalCreated: created.length,
        };
        
      } catch (error) {
        console.error('[Tool: batchCreateBlocks] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create blocks',
          created: [],
          conflicts: [],
          totalRequested: blocks.length,
          totalCreated: 0,
        };
      }
    },
  })
); 