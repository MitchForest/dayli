import type { UniversalToolResponse } from '../schemas/universal.schema';

/**
 * Attempts to repair malformed tool responses
 */
export function repairToolResponse(response: any): UniversalToolResponse | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  try {
    // Ensure required metadata fields
    const metadata = response.metadata || {};
    const repaired: UniversalToolResponse = {
      metadata: {
        toolName: metadata.toolName || 'unknown',
        operation: metadata.operation || 'read',
        resourceType: metadata.resourceType || 'unknown',
        timestamp: metadata.timestamp || new Date().toISOString(),
        executionTime: metadata.executionTime || 0,
      },
      
      data: response.data || null,
      
      display: response.display || {
        type: 'card',
        title: 'Operation Result',
        components: [],
      },
      
      ui: response.ui || {
        suggestions: [],
        actions: [],
        confirmationRequired: false,
      },
    };

    // Add optional fields if present
    if (response.streaming) {
      repaired.streaming = response.streaming;
    }
    
    if (response.error) {
      repaired.error = {
        code: response.error.code || 'UNKNOWN_ERROR',
        message: response.error.message || 'An error occurred',
        recoverable: response.error.recoverable !== false,
        suggestedActions: response.error.suggestedActions || [],
        details: response.error.details,
      };
    }

    return repaired;
  } catch (error) {
    console.error('[Repair] Failed to repair response:', error);
    return null;
  }
}

/**
 * Repairs time format issues
 */
export function repairTimeFormat(time: string): string {
  // Handle various time formats and convert to standard h:mm AM/PM
  const patterns = [
    // 24-hour format: 14:30, 14:30:00
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/,
    // 12-hour without AM/PM: 2:30
    /^(\d{1,2}):(\d{2})$/,
    // Natural language: 2pm, 2:30pm
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/i,
  ];

  for (const pattern of patterns) {
    const match = time.match(pattern);
    if (match) {
      let hours = parseInt(match[1] || '0', 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3];

      // Convert 24-hour to 12-hour
      if (!period && hours > 12) {
        hours = hours - 12;
        return `${hours}:${minutes.toString().padStart(2, '0')} PM`;
      } else if (!period && hours === 0) {
        return `12:${minutes.toString().padStart(2, '0')} AM`;
      } else if (!period && hours === 12) {
        return `12:${minutes.toString().padStart(2, '0')} PM`;
      } else if (!period) {
        // Assume AM for times before 12 without period
        return `${hours}:${minutes.toString().padStart(2, '0')} ${hours < 8 ? 'AM' : 'PM'}`;
      }

      // Handle period
      if (period) {
        const normalizedPeriod = period.toUpperCase();
        if (normalizedPeriod === 'PM' && hours < 12) {
          hours += 12;
        } else if (normalizedPeriod === 'AM' && hours === 12) {
          hours = 0;
        }
        
        // Convert back to 12-hour
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${normalizedPeriod}`;
      }
    }
  }

  // Return original if no pattern matches
  return time;
}

/**
 * Repairs date format issues
 */
export function repairDateFormat(date: string): string {
  try {
    // Try to parse as date
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0] || date; // yyyy-MM-dd
    }
  } catch {
    // Ignore parse errors
  }

  // Handle common formats
  const patterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // DD/MM/YYYY or DD-MM-YYYY (assume European format)
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
  ];

  for (const pattern of patterns) {
    const match = date.match(pattern);
    if (match && match[1] && match[2] && match[3]) {
      const month = match[1].padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }

  return date;
} 