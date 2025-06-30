import { WORK_DAY_START, WORK_DAY_END, FIFTEEN_MINUTE_HEIGHT } from '@/lib/constants';

export interface TimeGridPosition {
  row: number;
  span: number;
}

/**
 * Convert a time string (e.g., "9:00 AM") to a grid row position
 * Each row represents 15 minutes, starting from 8 AM (row 1)
 */
export function calculateGridRow(timeString: string): number {
  const time = parseTimeString(timeString);
  const startOfDay = WORK_DAY_START * 60; // 8 AM in minutes
  const timeInMinutes = time.hours * 60 + time.minutes;
  const minutesFromStart = timeInMinutes - startOfDay;
  
  // Each row is 15 minutes, add 1 because CSS Grid is 1-indexed
  return Math.floor(minutesFromStart / 15) + 1;
}

/**
 * Calculate grid position (row and span) for a time block
 */
export function getTimeGridPosition(startTime: string, endTime: string): TimeGridPosition {
  const startRow = calculateGridRow(startTime);
  const endRow = calculateGridRow(endTime);
  const span = endRow - startRow;
  
  return {
    row: startRow,
    span: Math.max(1, span), // Minimum span of 1
  };
}

/**
 * Parse a time string into hours and minutes
 * Handles formats like "9:00 AM", "12:30 PM", etc.
 */
export function parseTimeString(timeString: string): { hours: number; minutes: number } {
  const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    throw new Error(`Invalid time format: ${timeString}`);
  }
  
  let hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const period = (match[3] ?? 'AM').toUpperCase();
  
  if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${timeString}`);
  }
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

/**
 * Format a Date object to a time string (e.g., "9:00 AM")
 */
export function formatTimeString(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }
  
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours}:${minutesStr} ${period}`;
}

/**
 * Check if a time is within work hours
 */
export function isWithinWorkHours(date: Date): boolean {
  const hours = date.getHours();
  return hours >= WORK_DAY_START && hours < WORK_DAY_END;
}

/**
 * Get the current time's grid row position
 */
export function getCurrentTimeGridRow(): number {
  const now = new Date();
  const timeString = formatTimeString(now);
  return calculateGridRow(timeString);
}

/**
 * Generate hour labels for the schedule (8 AM to 6 PM)
 */
export function generateHourLabels(): string[] {
  const labels: string[] = [];
  for (let hour = WORK_DAY_START; hour <= WORK_DAY_END; hour++) {
    if (hour === 12) {
      labels.push('12:00 PM');
    } else if (hour > 12) {
      labels.push(`${hour - 12}:00 PM`);
    } else {
      labels.push(`${hour}:00 AM`);
    }
  }
  return labels;
}

export function timeToPosition(time: string, hourHeight: number): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) {
    return 0; // or handle error appropriately
  }

  let hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const period = (match[3] ?? 'AM').toUpperCase();
  
  if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${time}`);
  }
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  const timeInMinutes = hours * 60 + minutes;
  const startOfDay = WORK_DAY_START * 60; // 8 AM in minutes
  const minutesFromStart = timeInMinutes - startOfDay;
  
  // Each row is 15 minutes, add 1 because CSS Grid is 1-indexed
  return Math.floor(minutesFromStart / 15) + 1;
} 