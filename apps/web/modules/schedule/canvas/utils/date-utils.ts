/**
 * Date utilities for infinite canvas time grid
 */

import { format, startOfDay, addDays, differenceInDays, isSameDay } from 'date-fns';

/**
 * Format date for display in navigator
 */
export const formatDateForNav = (date: Date): string => {
  return format(date, 'MMMM d');
};

/**
 * Format time for grid labels
 */
export const formatTimeLabel = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

/**
 * Get the start of today
 */
export const getToday = (): Date => {
  return startOfDay(new Date());
};

/**
 * Calculate day offset from reference date
 */
export const getDayOffset = (date: Date, referenceDate: Date): number => {
  return differenceInDays(startOfDay(date), startOfDay(referenceDate));
};

/**
 * Get date from day offset
 */
export const getDateFromOffset = (offset: number, referenceDate: Date): Date => {
  return addDays(startOfDay(referenceDate), offset);
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};

/**
 * Parse time string to hour and minute
 */
export const parseTime = (timeStr: string): { hour: number; minute: number } => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
};

/**
 * Convert hour to Y position on grid
 */
export const hourToY = (hour: number, hourHeight: number): number => {
  return hour * hourHeight;
};

/**
 * Convert Y position to hour
 */
export const yToHour = (y: number, hourHeight: number): number => {
  return y / hourHeight;
};

/**
 * Get visible hours based on viewport
 */
export const getVisibleHours = (
  viewportTop: number,
  viewportHeight: number,
  hourHeight: number
): { start: number; end: number } => {
  const startHour = Math.floor(viewportTop / hourHeight);
  const endHour = Math.ceil((viewportTop + viewportHeight) / hourHeight);
  return {
    start: Math.max(0, startHour),
    end: Math.min(24, endHour),
  };
}; 