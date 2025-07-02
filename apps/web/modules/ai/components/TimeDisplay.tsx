'use client';

import { memo } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

interface TimeDisplayProps {
  time?: string;
  date?: string;
  showIcon?: boolean;
  className?: string;
}

export const TimeDisplay = memo(function TimeDisplay({
  time,
  date,
  showIcon = true,
  className
}: TimeDisplayProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMM d');
  };

  if (!time && !date) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      {showIcon && (
        <>
          {time && <Clock className="h-3 w-3 text-muted-foreground" />}
          {!time && date && <Calendar className="h-3 w-3 text-muted-foreground" />}
        </>
      )}
      {date && <span className="font-medium">{formatDate(date)}</span>}
      {time && date && <span className="text-muted-foreground">at</span>}
      {time && <span className="font-medium">{time}</span>}
    </div>
  );
});

interface DurationDisplayProps {
  minutes: number;
  className?: string;
}

export const DurationDisplay = memo(function DurationDisplay({
  minutes,
  className
}: DurationDisplayProps) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  let display = '';
  if (hours > 0) {
    display = `${hours}h`;
    if (mins > 0) display += ` ${mins}m`;
  } else {
    display = `${mins}m`;
  }
  
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span>{display}</span>
    </span>
  );
});

interface TimeRangeDisplayProps {
  startTime: string;
  endTime: string;
  date?: string;
  className?: string;
}

export const TimeRangeDisplay = memo(function TimeRangeDisplay({
  startTime,
  endTime,
  date,
  className
}: TimeRangeDisplayProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{startTime} - {endTime}</span>
      {date && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{format(new Date(date), 'MMM d')}</span>
        </>
      )}
    </div>
  );
}); 