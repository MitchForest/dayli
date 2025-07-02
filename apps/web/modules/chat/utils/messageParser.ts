import { Entity, ParsedSegment, ListItem } from '../types/chat.types';
import { 
  CheckSquare, 
  Mail, 
  Calendar, 
  Clock, 
  User, 
  Coffee, 
  Circle,
  Briefcase,
  Users
} from 'lucide-react';

/**
 * Parses AI message content to identify entities and structure
 * Returns an array of segments for rich rendering
 */
export function parseMessageContent(
  content: string,
  providedEntities?: Entity[]
): { segments: ParsedSegment[] } {
  const segments: ParsedSegment[] = [];
  
  // First, handle schedule blocks (multi-line format)
  // Updated pattern to handle various formats including numbered lists
  const scheduleBlockPatterns = [
    // Format: **7:00 AM - 7:15 AM**: Daily Planning
    /\*\*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\*\*:\s*(.+)/g,
    // Format: **Title (2:00 PM - 2:30 PM)**
    /\*\*([^*]+)\s*\(\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*\)\*\*/g,
    // Format: 2:00 PM - 2:30 PM: Title
    /^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)):\s*(.+)$/gm,
    // Format: • 2:00 PM - 2:30 PM: Title
    /^[•\-\*]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)):\s*(.+)$/gm,
    // Format: 1. **Title** (time - time): Description
    /^\d+\.\s*\*\*([^*]+)\*\*\s*\(\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*\)(?::\s*(.+))?/gm,
    // Format: Time - Time\nTitle\nDescription (multiline)
    /^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*\n([^\n]+)(?:\n([^\n]+))?/gm,
  ];
  
  // New pattern for numbered list format with **Title**, **Time:**, **Description:**
  // This handles the format where times are on separate lines
  const numberedListPattern = /^\d+\.\s*\*\*([^*]+)\*\*\s*\n\s*-\s*\*\*Time:\*\*\s*\n?(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*\n?\s*[-–]\s*\n?(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*(?:\n\s*-\s*\*\*Description:\*\*\s*([^\n]+))?/gm;
  
  const blocks: any[] = [];
  let processedContent = content;
  const matchedRanges: Array<{start: number, end: number}> = [];
  
  // First try the numbered list pattern
  const numberedMatches = Array.from(content.matchAll(numberedListPattern));
  
  for (const match of numberedMatches) {
    const title = match[1]?.trim();
    const startTime = normalizeTime(match[2] || '');
    const endTime = normalizeTime(match[3] || '');
    const description = match[4]?.trim();
    
    if (title && startTime && endTime) {
      const block: any = {
        id: generateId(),
        startTime,
        endTime,
        title,
        type: inferBlockType(title)
      };
      
      blocks.push(block);
      
      matchedRanges.push({
        start: match.index!,
        end: match.index! + match[0].length
      });
    }
  }
  
  // If no numbered list matches, try a more flexible approach
  if (blocks.length === 0) {
    // Look for numbered items with title and time
    const flexiblePattern = /\d+\.\s*\*\*([^*]+)\*\*[\s\S]*?(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/g;
    const flexibleMatches = Array.from(content.matchAll(flexiblePattern));
    
    for (const match of flexibleMatches) {
      const title = match[1]?.trim();
      const startTime = normalizeTime(match[2] || '');
      const endTime = normalizeTime(match[3] || '');
      
      if (title && startTime && endTime) {
        const block: any = {
          id: generateId(),
          startTime,
          endTime,
          title,
          type: inferBlockType(title)
        };
        
        blocks.push(block);
        
        matchedRanges.push({
          start: match.index!,
          end: match.index! + match[0].length
        });
      }
    }
  }
  
  // If we already found blocks, don't try other patterns to avoid duplicates
  if (blocks.length > 0) {
    // Remove all matched schedule blocks from the content
    if (matchedRanges.length > 0) {
      // Sort ranges by start position in reverse order
      matchedRanges.sort((a, b) => b.start - a.start);
      
      // Remove each matched range
      for (const range of matchedRanges) {
        processedContent = processedContent.substring(0, range.start) + processedContent.substring(range.end);
      }
    }
  } else {
    // Only try other patterns if we haven't found blocks yet
    for (const pattern of scheduleBlockPatterns) {
      const matches = Array.from(processedContent.matchAll(pattern));
      
      for (const match of matches) {
        let title, startTime, endTime, description;
        
        // Handle different capture group orders based on pattern
        if (match[0].includes('**') && match[0].indexOf(':') < match[0].indexOf('**', 2)) {
          // Format: **time - time**: Title
          startTime = normalizeTime(match[1] || '');
          endTime = normalizeTime(match[2] || '');
          title = match[3]?.trim() || '';
        } else if (match[0].startsWith('**')) {
          // Format: **Title (time)**
          title = match[1]?.trim() || '';
          startTime = normalizeTime(match[2] || '');
          endTime = normalizeTime(match[3] || '');
        } else if (match[0].match(/^\d+\./)) {
          // Format: 1. **Title** (time - time): Description
          title = match[1]?.trim() || '';
          startTime = normalizeTime(match[2] || '');
          endTime = normalizeTime(match[3] || '');
          description = match[4]?.trim();
        } else if (match[0].includes('\n')) {
          // Format: Time - Time\nTitle\nDescription
          startTime = normalizeTime(match[1] || '');
          endTime = normalizeTime(match[2] || '');
          title = match[3]?.trim() || '';
          description = match[4]?.trim();
        } else {
          // Format: time - time: Title
          startTime = normalizeTime(match[1] || '');
          endTime = normalizeTime(match[2] || '');
          title = match[3]?.trim() || '';
        }
        
        if (title && startTime && endTime) {
          const block: any = {
            id: generateId(),
            startTime,
            endTime,
            title,
            type: inferBlockType(title)
          };
          
          blocks.push(block);
          
          // Track the matched range to remove it later
          matchedRanges.push({
            start: match.index!,
            end: match.index! + match[0].length
          });
        }
      }
    }
  }
  
  // Remove all matched schedule blocks from the content
  if (matchedRanges.length > 0) {
    // Sort ranges by start position in reverse order
    matchedRanges.sort((a, b) => b.start - a.start);
    
    // Remove each matched range
    for (const range of matchedRanges) {
      processedContent = processedContent.substring(0, range.start) + processedContent.substring(range.end);
    }
  }
  
  // Clean up any leftover schedule-related text
  const cleanupPatterns = [
    /Here'?s your schedule for.*?:\s*/gi,
    /Your schedule for.*?:\s*/gi,
    /Schedule for.*?:\s*/gi,
    /Today'?s schedule.*?:\s*/gi,
    /Would you like to.*?\?/gi,
    /Suggested actions\s*/gi,
    /^\s*\.\s*$/gm, // Lone periods
    /^\s*schedule_getSchedule\s*$/gm, // Tool names
    /^\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*$/gm, // Lone timestamps
    /\*\*Description:\*\*[^\n]*/gm, // Description lines
    /Your day includes.*$/gm, // Summary text
    /^\s*\)\s*$/gm, // Lone closing parentheses
    /^\s*-\s*[A-Z][^.]*\.\s*$/gm, // Partial description lines starting with dash
    /^\s*\)\s*-.*$/gm, // Lines starting with ) -
    /[^.]*(?:Process urgent|Expense report|update task list)[^.]*$/gm, // Partial sentences
    /^.*(?:bloced|cheduled).*$/gm, // Typos and partial words
  ];
  
  for (const pattern of cleanupPatterns) {
    processedContent = processedContent.replace(pattern, '');
  }
  
  if (blocks.length > 0) {
    segments.push({
      type: 'schedule',
      blocks
    });
  }
  
  // Handle bullet lists using the processed content
  const listPattern = /^[\*\-•]\s+(.+)$/gm;
  const listMatches = Array.from(processedContent.matchAll(listPattern));
  
  if (listMatches.length > 0) {
    const items: ListItem[] = listMatches.map(match => ({
      title: (match[1] || '').trim(),
      icon: inferListIcon(match[1] || '')
    }));
    
    segments.push({
      type: 'list',
      items
    });
    
    // Remove list items from content
    processedContent = processedContent.replace(listPattern, '');
  }
  
  // Now process remaining text for inline entities
  const remainingText = processedContent.trim();
  if (remainingText && remainingText.length > 0) {
    const inlineSegments = parseInlineEntities(remainingText, providedEntities);
    segments.push(...inlineSegments);
  }
  
  return { segments };
}

/**
 * Parse inline entities within text
 */
function parseInlineEntities(text: string, providedEntities?: Entity[]): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  
  // Combined pattern for all inline entities
  const patterns = {
    // Time patterns - be specific to avoid false positives
    time: /\b((?:at\s+)?(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))|(?:tomorrow|today|yesterday)\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s*(?:tomorrow|today))\b/gi,
    
    // Email patterns
    email: /\bemail\s+from\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/gi,
    
    // Meeting patterns
    meeting: /\bmeeting\s+with\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/gi,
    
    // Task patterns
    task: /\btask:\s*([^.!?\n]+)/gi,
  };
  
  // Collect all matches with their positions
  interface Match {
    type: Entity['type'];
    value: string;
    start: number;
    end: number;
  }
  
  const matches: Match[] = [];
  
  // Find all time matches
  let match;
  while ((match = patterns.time.exec(text)) !== null) {
    matches.push({
      type: 'time',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // Find all email matches
  patterns.email.lastIndex = 0;
  while ((match = patterns.email.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'person',
        value: match[1],
        start: match.index + match[0].indexOf(match[1]),
        end: match.index + match[0].indexOf(match[1]) + match[1].length
      });
    }
  }
  
  // Find all meeting matches
  patterns.meeting.lastIndex = 0;
  while ((match = patterns.meeting.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'person',
        value: match[1],
        start: match.index + match[0].indexOf(match[1]),
        end: match.index + match[0].indexOf(match[1]) + match[1].length
      });
    }
  }
  
  // Find all task matches
  patterns.task.lastIndex = 0;
  while ((match = patterns.task.exec(text)) !== null) {
    if (match[1]) {
      matches.push({
        type: 'task',
        value: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  
  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);
  
  // Build segments
  let lastEnd = 0;
  
  for (const match of matches) {
    // Add text before this match
    if (match.start > lastEnd) {
      const textBefore = text.substring(lastEnd, match.start);
      if (textBefore.trim()) {
        segments.push({
          type: 'text',
          value: textBefore
        });
      }
    }
    
    // Add the entity
    segments.push({
      type: 'entity',
      entity: {
        type: match.type,
        value: match.value
      }
    });
    
    lastEnd = match.end;
  }
  
  // Add any remaining text
  if (lastEnd < text.length) {
    const remainingText = text.substring(lastEnd);
    if (remainingText.trim()) {
      segments.push({
        type: 'text',
        value: remainingText
      });
    }
  }
  
  // If no entities found, return the whole text
  if (segments.length === 0 && text.trim()) {
    segments.push({
      type: 'text',
      value: text
    });
  }
  
  return segments;
}

/**
 * Infer block type from title
 */
function inferBlockType(title: string): 'work' | 'meeting' | 'email' | 'break' | 'blocked' {
  const lower = title.toLowerCase();
  
  if (lower.includes('meeting') || lower.includes('call') || lower.includes('1:1') || lower.includes('sync') || lower.includes('review')) {
    return 'meeting';
  }
  if (lower.includes('email') || lower.includes('inbox') || lower.includes('messages') || lower.includes('triage') || lower.includes('email check')) {
    return 'email';
  }
  // Special case: "End of Day Wrap-up" is typically email checking
  if (lower.includes('end of day') && lower.includes('wrap')) {
    return 'email';
  }
  if (lower.includes('break') || lower.includes('lunch') || lower.includes('coffee') || lower.includes('walk') || lower.includes('stretch')) {
    return 'break';
  }
  if (lower.includes('blocked') || lower.includes('busy') || lower.includes('unavailable')) {
    return 'blocked';
  }
  
  // Default to work for work blocks (planning, tasks, wrap-up, etc)
  return 'work';
}

/**
 * Infer icon for list items
 */
function inferListIcon(text: string): any {
  const lower = text.toLowerCase();
  
  if (lower.includes('email')) return Mail;
  if (lower.includes('meeting') || lower.includes('call')) return Calendar;
  if (lower.includes('task') || lower.includes('todo')) return CheckSquare;
  if (lower.includes('break') || lower.includes('lunch')) return Coffee;
  if (lower.includes('work') || lower.includes('focus')) return Briefcase;
  if (lower.includes('team') || lower.includes('people')) return Users;
  
  return Circle;
}

/**
 * Normalize time format
 */
function normalizeTime(time: string): string {
  // Convert to consistent format (e.g., "2:00 PM" -> "2:00 PM")
  return time.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Find matching entity from provided entities
 * This allows for more accurate entity detection when we have context
 */
export function findMatchingEntity(
  text: string,
  entities?: Entity[]
): Entity | null {
  if (!entities || entities.length === 0) return null;
  
  const normalizedText = text.toLowerCase().trim();
  
  return entities.find(entity => 
    entity.value.toLowerCase() === normalizedText ||
    entity.value.toLowerCase().includes(normalizedText) ||
    normalizedText.includes(entity.value.toLowerCase())
  ) || null;
} 