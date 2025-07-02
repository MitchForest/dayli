'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Briefcase,
  Mail,
  Calendar,
  Coffee,
  Users,
  Clock,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';

// Import the TimeBlock type from schedule module
import type { TimeBlock } from '@/modules/schedule/types/schedule.types';

interface SchedulePreviewProps {
  blocks: TimeBlock[];
  maxBlocks?: number;
  className?: string;
}

// Icon mapping for block types
const blockIcons = {
  work: Briefcase,
  meeting: Users,
  email: Mail,
  break: Coffee,
  blocked: Lock,
} as const;

// Color classes mapping - matching the actual schedule block components
const blockColors = {
  work: 'from-blue-100 to-blue-200 border-blue-500/20 text-blue-900',
  meeting: 'from-red-100 to-red-200 border-red-500/20 text-red-900',
  email: 'from-purple-100 to-purple-200 border-purple-500/20 text-purple-900',
  break: 'from-green-100 to-green-200 border-green-500/20 text-green-900',
  blocked: 'from-gray-100 to-gray-200 border-gray-500/20 text-gray-900',
} as const;

export function SchedulePreview({ 
  blocks, 
  maxBlocks = 5,
  className 
}: SchedulePreviewProps) {
  // Sort blocks by start time
  const sortedBlocks = [...blocks]
    .sort((a, b) => {
      const timeA = parseTimeToMinutes(a.startTime);
      const timeB = parseTimeToMinutes(b.startTime);
      return timeA - timeB;
    })
    .slice(0, maxBlocks);

  if (sortedBlocks.length === 0) {
    return null;
  }

  return (
    <Card className={cn('my-3 overflow-hidden', className)}>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Schedule Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {sortedBlocks.map((block) => (
            <ScheduleBlockRow key={block.id} block={block} />
          ))}
        </div>
        {blocks.length > maxBlocks && (
          <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t">
            +{blocks.length - maxBlocks} more blocks
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleBlockRow({ block }: { block: TimeBlock }) {
  const Icon = blockIcons[block.type];
  const colorClasses = blockColors[block.type];
  
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'bg-gradient-to-br border-l-4',
        colorClasses
      )}
    >
      <div className="flex-shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {block.title}
        </div>
        {block.tasks && block.tasks.length > 0 && (
          <div className="text-xs opacity-75 mt-0.5">
            {block.tasks.length} task{block.tasks.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      <div className="flex-shrink-0 text-xs font-medium">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatTimeRange(block.startTime, block.endTime)}</span>
        </div>
      </div>
    </div>
  );
}

// Helper function to parse time string to minutes for sorting
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(/\s+/);
  const time = parts[0];
  const period = parts[1];
  
  if (!time) return 0;
  
  const timeParts = time.split(':');
  const hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  
  let totalMinutes = hours * 60 + minutes;
  
  // Handle AM/PM
  if (period?.toUpperCase() === 'PM' && hours !== 12) {
    totalMinutes += 12 * 60;
  } else if (period?.toUpperCase() === 'AM' && hours === 12) {
    totalMinutes -= 12 * 60;
  }
  
  return totalMinutes;
}

// Helper function to format time range
function formatTimeRange(startTime: string, endTime: string): string {
  // If times are already in format like "9:00 AM", just combine them
  const start = startTime.replace(/\s+/g, ' ').trim();
  const end = endTime.replace(/\s+/g, ' ').trim();
  
  // If both times have the same AM/PM, only show it once
  const startPeriod = start.match(/[AP]M/i)?.[0];
  const endPeriod = end.match(/[AP]M/i)?.[0];
  
  if (startPeriod && endPeriod && startPeriod === endPeriod) {
    const startWithoutPeriod = start.replace(/\s*[AP]M/i, '');
    return `${startWithoutPeriod} - ${end}`;
  }
  
  return `${start} - ${end}`;
}

export default SchedulePreview; 