import { format, parse, setHours, setMinutes } from 'date-fns';
import type { Tables } from '@/database.types';

type TimeBlock = Tables<'time_blocks'>;

export interface ParsedTime {
  hour: number;
  minute: number;
  formatted: string; // HH:mm format
  displayFormatted: string; // h:mm a format
}

/**
 * Parse flexible time input into structured format
 * Handles: "9am", "9 am", "9:00", "9", "3:30pm", "15:30", etc.
 */
export function parseFlexibleTime(input: string): ParsedTime | null {
  if (!input || typeof input !== 'string') return null;
  
  // Normalize input: trim and lowercase
  const normalized = input.trim().toLowerCase();
  
  // Try different patterns
  let hour: number | null = null;
  let minute = 0;
  let isPM = false;
  
  // Pattern 1: "3:30 pm" or "3:30pm" or "15:30"
  const timeWithColonMatch = normalized.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (timeWithColonMatch) {
    hour = parseInt(timeWithColonMatch[1] || '0', 10);
    minute = parseInt(timeWithColonMatch[2] || '0', 10);
    isPM = timeWithColonMatch[3] === 'pm';
  }
  
  // Pattern 2: "3 pm" or "3pm" or just "3"
  if (hour === null) {
    const simpleTimeMatch = normalized.match(/(\d{1,2})\s*(am|pm)?/);
    if (simpleTimeMatch) {
      hour = parseInt(simpleTimeMatch[1] || '0', 10);
      isPM = simpleTimeMatch[2] === 'pm';
    }
  }
  
  // Validation
  if (hour === null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  
  // Handle 12-hour format
  if (normalized.includes('am') || normalized.includes('pm')) {
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }
  
  // Create date object for formatting
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  
  return {
    hour,
    minute,
    formatted: format(date, 'HH:mm'),
    displayFormatted: format(date, 'h:mm a'),
  };
}

/**
 * Convert any time format to military time (HH:mm)
 */
export function toMilitaryTime(input: string): string {
  const parsed = parseFlexibleTime(input);
  return parsed ? parsed.formatted : input;
}

/**
 * Convert military time to 12-hour format
 */
export function to12HourFormat(militaryTime: string): string {
  const parts = militaryTime.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, 'h:mm a');
}

/**
 * Find a time block by flexible description
 * Searches by title, time references, and block type
 */
export function findBlockByFlexibleDescription(
  blocks: TimeBlock[],
  description: string
): TimeBlock | null {
  if (!blocks || blocks.length === 0 || !description) return null;
  
  const searchLower = description.toLowerCase().trim();
  
  // First, try exact match
  const exactMatch = blocks.find(block => 
    block.title.toLowerCase() === searchLower
  );
  if (exactMatch) return exactMatch;
  
  // Extract time if mentioned in description
  let searchTime: ParsedTime | null = null;
  const timeMatch = searchLower.match(/(?:at|@)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
  if (timeMatch && timeMatch[1]) {
    searchTime = parseFlexibleTime(timeMatch[1]);
  } else {
    // Try parsing the whole description as time
    searchTime = parseFlexibleTime(searchLower);
  }
  
  // Score each block based on multiple criteria
  const scoredBlocks = blocks.map(block => {
    let score = 0;
    
    // Title matching (partial)
    if (block.title.toLowerCase().includes(searchLower)) {
      score += 10;
    } else {
      // Check individual words
      const searchWords = searchLower.split(/\s+/);
      const titleWords = block.title.toLowerCase().split(/\s+/);
      const matchingWords = searchWords.filter(word => 
        titleWords.some(titleWord => titleWord.includes(word))
      );
      score += matchingWords.length * 2;
    }
    
    // Time matching
    if (searchTime && block.start_time) {
      const blockTime = parseFlexibleTime(block.start_time);
      if (blockTime) {
        if (blockTime.hour === searchTime.hour) {
          score += 5;
          if (blockTime.minute === searchTime.minute) {
            score += 3;
          }
        }
      }
    }
    
    // Type matching
    const blockTypeLower = block.type?.toLowerCase() || '';
    if (searchLower.includes(blockTypeLower) || blockTypeLower.includes(searchLower)) {
      score += 3;
    }
    
    // Check description field
    if (block.description?.toLowerCase().includes(searchLower)) {
      score += 2;
    }
    
    return { block, score };
  });
  
  // Sort by score and return best match if score > 0
  const bestMatch = scoredBlocks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  return bestMatch ? bestMatch.block : null;
}

/**
 * Get suggestions for similar blocks when search fails
 */
export function getSimilarBlockSuggestions(
  blocks: TimeBlock[],
  description: string,
  maxSuggestions = 3
): TimeBlock[] {
  const searchLower = description.toLowerCase();
  
  // Score all blocks
  const scored = blocks.map(block => {
    let score = 0;
    
    // Partial word matching
    const searchWords = searchLower.split(/\s+/);
    const titleWords = block.title.toLowerCase().split(/\s+/);
    
    searchWords.forEach(searchWord => {
      titleWords.forEach(titleWord => {
        if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
          score += 1;
        }
      });
    });
    
    // Type similarity
    if (block.type && searchLower.includes(block.type.toLowerCase())) {
      score += 0.5;
    }
    
    return { block, score };
  });
  
  // Return top suggestions
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map(item => item.block);
}

/**
 * Format time range for display
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = parseFlexibleTime(startTime);
  const end = parseFlexibleTime(endTime);
  
  if (!start || !end) {
    // Fallback to original if parsing fails
    return `${startTime} - ${endTime}`;
  }
  
  return `${start.displayFormatted} - ${end.displayFormatted}`;
} 