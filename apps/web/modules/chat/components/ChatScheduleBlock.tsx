'use client';

import { cn } from '@/lib/utils';
import { 
  Briefcase, 
  Users, 
  Mail, 
  Coffee, 
  Lock,
  Clock
} from 'lucide-react';
import type { TimeBlock } from '@/modules/schedule/types/schedule.types';

interface ChatScheduleBlockProps {
  block: TimeBlock;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

// Block style configurations matching the scheduler exactly
const blockStyles = {
  work: {
    gradient: 'from-blue-100 to-blue-200',
    border: 'border-blue-500/20',
    text: 'text-blue-900',
    iconColor: 'text-blue-700',
    hover: 'hover:from-blue-200 hover:to-blue-300',
    shadow: 'hover:shadow-blue-300/20',
    icon: Briefcase
  },
  meeting: {
    gradient: 'from-red-100 to-red-200',
    border: 'border-red-500/20',
    text: 'text-red-900',
    iconColor: 'text-red-700',
    hover: 'hover:from-red-200 hover:to-red-300',
    shadow: 'hover:shadow-red-300/20',
    icon: Users
  },
  email: {
    gradient: 'from-purple-100 to-purple-200',
    border: 'border-purple-500/20',
    text: 'text-purple-900',
    iconColor: 'text-purple-700',
    hover: 'hover:from-purple-200 hover:to-purple-300',
    shadow: 'hover:shadow-purple-300/20',
    icon: Mail
  },
  break: {
    gradient: 'from-green-100 to-green-200',
    border: 'border-green-500/20',
    text: 'text-green-900',
    iconColor: 'text-green-700',
    hover: 'hover:from-green-200 hover:to-green-300',
    shadow: 'hover:shadow-green-300/20',
    icon: Coffee
  },
  blocked: {
    gradient: 'from-gray-100 to-gray-200',
    border: 'border-gray-500/20',
    text: 'text-gray-900',
    iconColor: 'text-gray-700',
    hover: 'hover:from-gray-200 hover:to-gray-300',
    shadow: 'hover:shadow-gray-300/20',
    icon: Lock
  }
} as const;

export function ChatScheduleBlock({ 
  block, 
  compact = false, 
  onClick,
  className 
}: ChatScheduleBlockProps) {
  const style = blockStyles[block.type] || blockStyles.work;
  const Icon = style.icon;
  
  // Format time range
  const formatTimeRange = (start: string, end: string) => {
    // Remove duplicate AM/PM if both times have the same period
    const startPeriod = start.match(/[AP]M/i)?.[0];
    const endPeriod = end.match(/[AP]M/i)?.[0];
    
    if (startPeriod && endPeriod && startPeriod === endPeriod) {
      const startWithoutPeriod = start.replace(/\s*[AP]M/i, '');
      return `${startWithoutPeriod} - ${end}`;
    }
    
    return `${start} - ${end}`;
  };
  
  return (
    <div
      className={cn(
        'rounded-md border transition-all duration-200',
        'bg-gradient-to-br shadow-sm',
        style.gradient,
        style.border,
        style.text,
        style.hover,
        style.shadow,
        onClick && 'cursor-pointer hover:shadow-md',
        'group',
        className
      )}
      onClick={onClick}
    >
      <div className={cn(
        'p-3',
        compact && 'p-2'
      )}>
        {/* First row: Icon and Time */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Icon className={cn(
              'w-4 h-4',
              style.iconColor
            )} />
            <span className={cn(
              'text-xs font-medium',
              style.text
            )}>
              {formatTimeRange(block.startTime, block.endTime)}
            </span>
          </div>
        </div>
        
        {/* Second row: Title */}
        <div className={cn(
          'font-semibold truncate',
          compact ? 'text-sm' : 'text-base'
        )}>
          {block.title}
        </div>
        
        {/* Task count - only show if not compact and has tasks */}
        {!compact && block.tasks && block.tasks.length > 0 && (
          <div className={cn(
            'text-xs mt-1',
            style.iconColor
          )}>
            {block.tasks.length} task{block.tasks.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatScheduleBlock; 