import { format, parse, addMinutes, differenceInMinutes } from 'date-fns';
import { toMilitaryTime } from '@/modules/ai/utils/time-parser';
import type { Change, RAGContext, UserPattern, TimeGap, Inefficiency } from '../types/domain-workflow.types';
import type { Task } from '@/services/interfaces/task.interface';
import type { UserPreferences } from '@/services/interfaces/preference.interface';
import type { TimeBlock } from '@/modules/ai/tools/types';

// Re-export types from domain workflow types
export type { TimeGap, Inefficiency } from '../types/domain-workflow.types';



/**
 * Find gaps in schedule
 */
export function findScheduleGaps(
  blocks: any[], 
  preferences: any
): TimeGap[] {
  const gaps: TimeGap[] = [];
  const sortedBlocks = [...blocks].sort((a, b) => {
    const aTime = new Date(`2000-01-01 ${a.start_time || a.startTime}`).getTime();
    const bTime = new Date(`2000-01-01 ${b.start_time || b.startTime}`).getTime();
    return aTime - bTime;
  });

  const workStart = new Date(`2000-01-01 ${preferences?.work_start_time || "09:00"}`);
  const workEnd = new Date(`2000-01-01 ${preferences?.work_end_time || "17:00"}`);

  // Check gap at start of day
  if (sortedBlocks.length === 0 || new Date(`2000-01-01 ${sortedBlocks[0].start_time || sortedBlocks[0].startTime}`) > workStart) {
    const gapEnd = sortedBlocks[0] ? new Date(`2000-01-01 ${sortedBlocks[0].start_time || sortedBlocks[0].startTime}`) : workEnd;
    gaps.push({
      startTime: format(workStart, 'HH:mm'),
      endTime: format(gapEnd, 'HH:mm'),
      duration: differenceInMinutes(gapEnd, workStart),
    });
  }

  // Check gaps between blocks
  for (let i = 0; i < sortedBlocks.length - 1; i++) {
    const currentEnd = new Date(`2000-01-01 ${sortedBlocks[i].end_time || sortedBlocks[i].endTime}`);
    const nextStart = new Date(`2000-01-01 ${sortedBlocks[i + 1].start_time || sortedBlocks[i + 1].startTime}`);
    const gapDuration = differenceInMinutes(nextStart, currentEnd);

    if (gapDuration > 15) {
      gaps.push({
        startTime: sortedBlocks[i].end_time || sortedBlocks[i].endTime,
        endTime: sortedBlocks[i + 1].start_time || sortedBlocks[i + 1].startTime,
        duration: gapDuration,
      });
    }
  }

  // Check gap at end of day
  if (sortedBlocks.length > 0) {
    const lastBlock = sortedBlocks[sortedBlocks.length - 1];
    const lastEnd = new Date(`2000-01-01 ${lastBlock.end_time || lastBlock.endTime}`);
    if (lastEnd < workEnd) {
      gaps.push({
        startTime: lastBlock.end_time || lastBlock.endTime,
        endTime: format(workEnd, 'HH:mm'),
        duration: differenceInMinutes(workEnd, lastEnd),
      });
    }
  }

  return gaps;
}

/**
 * Detect schedule inefficiencies
 */
export function detectInefficiencies(blocks: any[]): Inefficiency[] {
  const inefficiencies: Inefficiency[] = [];
  
  // Check for small gaps
  const gaps = findScheduleGaps(blocks, { work_start_time: '9:00', work_end_time: '17:00' });
  gaps.forEach(gap => {
    if (gap.duration >= 15 && gap.duration < 30) {
      inefficiencies.push({
        type: 'gap',
        description: `${gap.duration}-minute gap is too short for productive work`,
        severity: 'medium',
        affectedBlocks: [],
      });
    }
  });
  
  // Check for fragmented focus time
  const focusBlocks = blocks.filter(b => b.type === 'work');
  if (focusBlocks.length > 3) {
    inefficiencies.push({
      type: 'fragmentation',
      description: 'Focus time is fragmented across too many blocks',
      severity: 'high',
      affectedBlocks: focusBlocks.map(b => b.id),
    });
  }
  
  // Check for poor timing
  blocks.forEach((block, i) => {
    if (block.type === 'work' && block.start_time) {
      const startHour = parseInt(block.start_time.split(':')[0]);
      if (startHour >= 16) {
        inefficiencies.push({
          type: 'poor_timing',
          description: 'Deep work scheduled too late in the day',
          severity: 'medium',
          affectedBlocks: [block.id],
        });
      }
    }
  });
  
  return inefficiencies;
}

/**
 * Calculate duration in minutes between two time strings
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = parse(startTime, 'HH:mm', new Date());
  const end = parse(endTime, 'HH:mm', new Date());
  return differenceInMinutes(end, start);
}

/**
 * Check if a time block is during lunch time
 */
export function isLunchTime(block: any): boolean {
  const blockStart = new Date(`2000-01-01 ${block.start_time || block.startTime}`);
  const lunchStart = new Date(`2000-01-01 11:30`);
  const lunchEnd = new Date(`2000-01-01 13:30`);
  
  return blockStart >= lunchStart && blockStart <= lunchEnd && 
         block.type === "break";
}

/**
 * Parse time helper (uses existing time-parser)
 */
function parseTime(timeStr: string): Date {
  const today = new Date();
  const militaryTime = toMilitaryTime(timeStr);
  const [hours, minutes] = militaryTime.split(':').map(Number);
  today.setHours(hours || 0, minutes || 0, 0, 0);
  return today;
}

/**
 * Generate natural language summary of proposed changes
 */
export function generateNaturalSummary(changes: Change[]): string {
  const parts = [];
  
  // Group by type
  const creates = changes.filter(c => c.type === 'create');
  const moves = changes.filter(c => c.type === 'move');
  const deletes = changes.filter(c => c.type === 'delete');
  const assigns = changes.filter(c => c.type === 'assign');
  const consolidates = changes.filter(c => c.type === 'consolidate');
  
  if (creates.length > 0) {
    const blockCreates = creates.filter(c => c.entity === 'block');
    const taskCreates = creates.filter(c => c.entity === 'task');
    
    if (blockCreates.length > 0) {
      parts.push(`Creating ${blockCreates.length} new time blocks`);
    }
    if (taskCreates.length > 0) {
      parts.push(`Creating ${taskCreates.length} new tasks`);
    }
  }
  
  if (moves.length > 0) {
    parts.push(`Moving ${moves.length} items to better times`);
  }
  
  if (deletes.length > 0) {
    parts.push(`Removing ${deletes.length} items`);
  }
  
  if (assigns.length > 0) {
    parts.push(`Assigning ${assigns.length} tasks to time blocks`);
  }
  
  if (consolidates.length > 0) {
    parts.push(`Consolidating schedule for better efficiency`);
  }
  
  return parts.length > 0 
    ? parts.join(', ') + '.'
    : 'No changes needed - your schedule looks good!';
}

/**
 * Format time range for display
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
}

/**
 * Calculate energy match score
 */
export function calculateEnergyMatch(
  task: any,
  currentEnergy: 'high' | 'medium' | 'low'
): number {
  const taskComplexity = task.priority === 'high' ? 'high' : 
                        task.priority === 'low' ? 'low' : 'medium';
  
  if (currentEnergy === 'high' && taskComplexity === 'high') return 100;
  if (currentEnergy === 'low' && taskComplexity === 'low') return 100;
  if (currentEnergy === 'medium' && taskComplexity === 'medium') return 100;
  
  if (currentEnergy === 'high' && taskComplexity === 'low') return 50;
  if (currentEnergy === 'low' && taskComplexity === 'high') return 25;
  
  return 75; // Default partial match
}

/**
 * Calculate pattern match score
 */
export function calculatePatternMatch(
  task: any,
  ragContext: RAGContext | undefined
): number {
  if (!ragContext?.patterns?.length) return 50; // No patterns = neutral score
  
  // Look for task completion patterns
  const relevantPatterns = ragContext.patterns.filter(p => 
    p.type === 'task_completion' && 
    p.content.toLowerCase().includes(task.title?.toLowerCase() || '')
  );
  
  if (relevantPatterns.length === 0) return 50;
  
  // Calculate score based on historical success
  const avgSuccess = relevantPatterns.reduce((sum, p) => 
    sum + (p.metadata?.successRate || 0), 0
  ) / relevantPatterns.length;
  
  return Math.round(avgSuccess);
}

/**
 * Generate reasoning for task scoring
 */
export function generateTaskReasoning(
  factors: {
    priority: number;
    urgency: number;
    age: number;
    energy: number;
    pattern: number;
  },
  task: any
): string {
  const reasons = [];
  
  if (factors.priority >= 100) {
    reasons.push('High priority task');
  }
  if (factors.urgency >= 80) {
    reasons.push('Urgent deadline approaching');
  }
  if (factors.age >= 15) {
    reasons.push('Task has been pending for a while');
  }
  if (factors.energy >= 90) {
    reasons.push('Perfect match for current energy level');
  }
  if (factors.pattern >= 80) {
    reasons.push('Historically successful at this time');
  }
  
  return reasons.length > 0 
    ? reasons.join('. ') + '.'
    : `Task "${task.title}" scored based on multiple factors.`;
}

/**
 * Determine email action based on importance and urgency
 */
export function determineEmailAction(
  importance: 'important' | 'not_important',
  urgency: 'urgent' | 'can_wait'
): string {
  if (importance === 'important' && urgency === 'urgent') {
    return 'respond_immediately';
  } else if (importance === 'important') {
    return 'schedule_response';
  } else if (urgency === 'urgent') {
    return 'quick_reply';
  }
  return 'review_later';
}

/**
 * Calculate response time based on email classification
 */
export function calculateResponseTime(
  importance: 'important' | 'not_important',
  urgency: 'urgent' | 'can_wait'
): number {
  if (importance === 'important' && urgency === 'urgent') {
    return 30; // 30 minutes
  } else if (importance === 'important') {
    return 240; // 4 hours
  } else if (urgency === 'urgent') {
    return 60; // 1 hour
  }
  return 1440; // 24 hours
}

/**
 * Find next available time slot
 */
export function findNextAvailableSlot(
  existingBlocks: any[],
  durationNeeded: number = 30
): string {
  const gaps = findScheduleGaps(existingBlocks, { 
    work_start_time: '09:00', 
    work_end_time: '17:00' 
  });
  
  const suitableGap = gaps.find(gap => gap.duration >= durationNeeded);
  return suitableGap ? suitableGap.startTime : '09:00'; // Default to start of day
} 