/**
 * Context Builder
 * 
 * Aggregates user state from multiple services for orchestration decisions
 */

import { ServiceFactory } from '@/services/factory/service.factory';
import type { OrchestrationContext } from './types';

/**
 * Build comprehensive orchestration context for a user
 */
export async function buildOrchestrationContext(
  userId: string,
  timezone: string = 'America/New_York'
): Promise<OrchestrationContext> {
  const startTime = Date.now();
  
  try {
    const factory = ServiceFactory.getInstance();
    
    // Ensure factory is configured
    if (!factory.isConfigured()) {
      throw new Error('ServiceFactory not configured');
    }
    
    // Get all services
    const scheduleService = factory.getScheduleService();
    const taskService = factory.getTaskService();
    const preferenceService = factory.getPreferenceService();
    
    // Fetch all data in parallel for performance
    const currentTime = new Date();
    const dateStr = currentTime.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const [
      todaySchedule,
      backlogTasks,
      preferences,
    ] = await Promise.all([
      scheduleService.getScheduleForDate(dateStr || new Date().toISOString().split('T')[0]),
      taskService.getTaskBacklog(),
      preferenceService.getUserPreferences(),
    ]);
    
    // Convert to the format expected by our functions
    const scheduleBlocks = todaySchedule.map(block => ({
      id: block.id,
      user_id: block.userId,
      start_time: block.startTime.toISOString(),
      end_time: block.endTime.toISOString(),
      type: block.type,
      title: block.title,
      created_at: block.createdAt.toISOString(),
    }));
    
    const taskData = backlogTasks.map(task => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      urgency: 50, // Default urgency
      days_in_backlog: 0, // Will be calculated later
      score: 0, // Will be calculated later
    }));
    
    // Calculate schedule state
    const scheduleState = calculateScheduleState(scheduleBlocks, currentTime);
    
    // Calculate task state
    const taskState = calculateTaskState(taskData);
    
    // Calculate email state (stub for now - email service integration pending)
    const emailState = {
      unreadCount: 0,
      urgentCount: 0,
      importantCount: 0,
    };
    
    // Extract user patterns from preferences
    const userPatterns = preferences ? {
      typicalStartTime: preferences.workStartTime,
      preferredBlockDuration: 60, // Default to 60 minutes
      commonRequests: [], // TODO: Implement when RAG is available
      rejectedActions: [], // TODO: Implement when RAG is available
    } : undefined;
    
    const context: OrchestrationContext = {
      userId,
      currentTime,
      timezone: timezone, // Use provided timezone or default
      recentMessages: [], // Will be provided by chat route
      scheduleState,
      taskState,
      emailState,
      userPatterns,
    };
    
    console.log('[Context Builder] Built context in', Date.now() - startTime, 'ms');
    
    return context;
    
  } catch (error) {
    console.error('[Context Builder] Failed to build context:', error);
    
    // Return minimal context on error
    return {
      userId,
      currentTime: new Date(),
      timezone,
      recentMessages: [],
      scheduleState: {
        hasBlocksToday: false,
        utilization: 0,
      },
      taskState: {
        pendingCount: 0,
        urgentCount: 0,
        overdueCount: 0,
      },
      emailState: {
        unreadCount: 0,
        urgentCount: 0,
        importantCount: 0,
      },
    };
  }
}

/**
 * Calculate schedule state from time blocks
 */
function calculateScheduleState(
  blocks: Array<{
    id: string;
    user_id: string;
    start_time: string;
    end_time: string;
    type: string;
    title: string;
    [key: string]: unknown;
  }>,
  currentTime: Date
): OrchestrationContext['scheduleState'] {
  if (!blocks || blocks.length === 0) {
    return {
      hasBlocksToday: false,
      utilization: 0,
      gaps: [],
    };
  }
  
  // Sort blocks by start time
  const sortedBlocks = [...blocks].sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  
  // Find next block
  const nextBlock = sortedBlocks.find(block => 
    new Date(block.start_time) > currentTime
  );
  
  // Calculate total scheduled time
  const totalMinutes = blocks.reduce((sum, block) => {
    const start = new Date(block.start_time);
    const end = new Date(block.end_time);
    return sum + (end.getTime() - start.getTime()) / (1000 * 60);
  }, 0);
  
  // Assume 8-hour work day for utilization calculation
  const workDayMinutes = 8 * 60;
  const utilization = Math.round((totalMinutes / workDayMinutes) * 100);
  
  // Find gaps between blocks
  const gaps = [];
  for (let i = 0; i < sortedBlocks.length - 1; i++) {
    const currentBlock = sortedBlocks[i];
    const nextBlock = sortedBlocks[i + 1];
    if (!currentBlock || !nextBlock) continue;
    
    const currentEnd = new Date(currentBlock.end_time);
    const nextStart = new Date(nextBlock.start_time);
    const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);
    
    if (gapMinutes > 15) { // Only consider gaps > 15 minutes
      gaps.push({
        startTime: currentEnd,
        endTime: nextStart,
        duration: gapMinutes,
      });
    }
  }
  
  return {
    hasBlocksToday: true,
    nextBlock: nextBlock ? {
      id: nextBlock.id,
      user_id: nextBlock.user_id,
      type: nextBlock.type,
      title: nextBlock.title,
      start_time: nextBlock.start_time,
      end_time: nextBlock.end_time,
      created_at: (nextBlock.created_at as string) || new Date().toISOString(),
    } : undefined,
    utilization: Math.min(utilization, 100),
    gaps,
  };
}

/**
 * Calculate task state from task list
 */
function calculateTaskState(
  tasks: Array<{
    id: string;
    title: string;
    priority?: string | 'high' | 'medium' | 'low';
    urgency?: number;
    days_in_backlog?: number;
    score?: number;
    [key: string]: unknown;
  }>
): OrchestrationContext['taskState'] {
  if (!tasks || tasks.length === 0) {
    return {
      pendingCount: 0,
      urgentCount: 0,
      overdueCount: 0,
    };
  }
  
  const pendingCount = tasks.length;
  
  // Count urgent tasks (high priority or urgency > 70)
  const urgentCount = tasks.filter(task => 
    task.priority === 'high' || (task.urgency && task.urgency > 70)
  ).length;
  
  // Count overdue tasks (in backlog for > 7 days)
  const overdueCount = tasks.filter(task => 
    task.days_in_backlog && task.days_in_backlog > 7
  ).length;
  
  // Get top scored tasks  
  const topTasks = [...tasks]
    .filter(task => task.title) // Ensure task has title
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5)
    .map(task => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      urgency: task.urgency,
      score: task.score || 0,
    }));
  
  return {
    pendingCount,
    urgentCount,
    overdueCount,
    topTasks,
  };
}

/**
 * Update context with email state (for future use)
 */
export async function enrichContextWithEmails(
  context: OrchestrationContext
): Promise<OrchestrationContext> {
  try {
    const factory = ServiceFactory.getInstance();
    if (!factory.isConfigured()) {
      return context;
    }
    
    // TODO: Implement when email service is available
    // const emailService = factory.getEmailService();
    // const emailStats = await emailService.getEmailStats(context.userId);
    
    return {
      ...context,
      emailState: {
        unreadCount: 0, // emailStats.unread,
        urgentCount: 0, // emailStats.urgent,
        importantCount: 0, // emailStats.important,
      },
    };
  } catch (error) {
    console.error('[Context Builder] Failed to enrich with emails:', error);
    return context;
  }
}

/**
 * Update context with RAG patterns (for future use)
 */
export async function enrichContextWithPatterns(
  context: OrchestrationContext
): Promise<OrchestrationContext> {
  try {
    // TODO: Implement when RAG context provider is available in sprint 4.4
    // const ragProvider = new RAGContextProvider();
    // const patterns = await ragProvider.getUserPatterns(context.userId);
    
    return {
      ...context,
      userPatterns: {
        ...context.userPatterns,
        // commonRequests: patterns.commonRequests,
        // rejectedActions: patterns.rejectedActions,
      },
    };
  } catch (error) {
    console.error('[Context Builder] Failed to enrich with patterns:', error);
    return context;
  }
}