import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type AssignToTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  taskIds: z.array(z.string()).describe('Array of task IDs to assign'),
  blockId: z.string().describe('Time block ID to assign tasks to'),
});

export const assignToTimeBlock = registerTool(
  createTool<typeof parameters, AssignToTimeBlockResponse>({
    name: 'task_assignToTimeBlock',
    description: 'Assign one or more tasks to a time block',
    parameters,
    metadata: {
      category: 'task',
      displayName: 'Assign Tasks to Block',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ taskIds, blockId }) => {
      try {
        const taskService = ServiceFactory.getInstance().getTaskService();
        const scheduleService = ServiceFactory.getInstance().getScheduleService();
        
        // Verify the block exists
        const block = await scheduleService.getTimeBlock(blockId);
        if (!block) {
          return {
            success: false,
            error: 'Time block not found',
            assigned: [],
            failed: taskIds.map(id => ({ taskId: id, reason: 'Time block not found' })),
            blockId,
            totalRequested: taskIds.length,
            totalAssigned: 0,
          };
        }
        
        // Only work blocks can have tasks assigned
        if (block.type !== 'work') {
          return {
            success: false,
            error: `Cannot assign tasks to ${block.type} blocks`,
            assigned: [],
            failed: taskIds.map(id => ({ taskId: id, reason: `Cannot assign to ${block.type} block` })),
            blockId,
            totalRequested: taskIds.length,
            totalAssigned: 0,
          };
        }
        
        const assigned: string[] = [];
        const failed: Array<{ taskId: string; reason: string }> = [];
        
        // Process each task
        for (const taskId of taskIds) {
          try {
            // Get the task to verify it exists
            const task = await taskService.getTask(taskId);
            if (!task) {
              failed.push({ taskId, reason: 'Task not found' });
              continue;
            }
            
            // Check if task is already completed
            if (task.status === 'completed') {
              failed.push({ taskId, reason: 'Task is already completed' });
              continue;
            }
            
            // Assign the task to the block
            await taskService.assignTaskToBlock(taskId, blockId);
            
            // Note: We can't update block metadata through the service
            // The task assignment is tracked in the task service
            
            assigned.push(taskId);
            
          } catch (error) {
            failed.push({
              taskId,
              reason: error instanceof Error ? error.message : 'Failed to assign task',
            });
          }
        }
        
        console.log(`[Tool: assignToTimeBlock] Assigned ${assigned.length}/${taskIds.length} tasks to block ${blockId}`);
        
        return {
          success: assigned.length > 0,
          assigned,
          failed,
          blockId,
          totalRequested: taskIds.length,
          totalAssigned: assigned.length,
        };
        
      } catch (error) {
        console.error('[Tool: assignToTimeBlock] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to assign tasks',
          assigned: [],
          failed: taskIds.map(id => ({ taskId: id, reason: 'System error' })),
          blockId,
          totalRequested: taskIds.length,
          totalAssigned: 0,
        };
      }
    },
  })
); 