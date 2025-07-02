'use client';

import { cn } from '@/lib/utils';
import { Calendar, Clock, Mail, Coffee, Users, Briefcase, Ban } from 'lucide-react';

interface ScheduleBlock {
  id?: string;
  type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  tasks?: string[];
}

interface ScheduleBlockDisplayProps {
  block: ScheduleBlock;
  className?: string;
}

export function ScheduleBlockDisplay({ block, className }: ScheduleBlockDisplayProps) {
  const getIcon = () => {
    switch (block.type) {
      case 'work':
        return Briefcase;
      case 'meeting':
        return Users;
      case 'email':
        return Mail;
      case 'break':
        return Coffee;
      case 'blocked':
        return Ban;
      default:
        return Calendar;
    }
  };

  const getColorClasses = () => {
    switch (block.type) {
      case 'work':
        return {
          bg: 'bg-blue-500',
          text: 'text-white',
          border: 'border-blue-600'
        };
      case 'meeting':
        return {
          bg: 'bg-red-500',
          text: 'text-white',
          border: 'border-red-600'
        };
      case 'email':
        return {
          bg: 'bg-purple-500',
          text: 'text-white',
          border: 'border-purple-600'
        };
      case 'break':
        return {
          bg: 'bg-green-500',
          text: 'text-white',
          border: 'border-green-600'
        };
      case 'blocked':
        return {
          bg: 'bg-gray-500',
          text: 'text-white',
          border: 'border-gray-600'
        };
      default:
        return {
          bg: 'bg-gray-400',
          text: 'text-white',
          border: 'border-gray-500'
        };
    }
  };

  const Icon = getIcon();
  const colors = getColorClasses();

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors',
        className
      )}
    >
      {/* Icon and Time Column */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center',
          colors.bg,
          colors.text
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {block.startTime} - {block.endTime}
        </div>
      </div>

      {/* Title and Details Column */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm leading-tight">{block.title}</h4>
        {block.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{block.description}</p>
        )}
        {block.tasks && block.tasks.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {block.tasks.map((task, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="opacity-60 mt-0.5">•</span>
                <span>{task}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Component to render multiple blocks
interface ScheduleBlockListProps {
  blocks: ScheduleBlock[];
  className?: string;
}

export function ScheduleBlockList({ blocks, className }: ScheduleBlockListProps) {
  if (!blocks || blocks.length === 0) return null;

  // Sort blocks by start time
  const sortedBlocks = [...blocks].sort((a, b) => {
    const timeA = a.startTime.replace(/[^\d:]/g, '');
    const timeB = b.startTime.replace(/[^\d:]/g, '');
    return timeA.localeCompare(timeB);
  });

  return (
    <div className={cn('space-y-2 my-3', className)}>
      {sortedBlocks.map((block, idx) => (
        <ScheduleBlockDisplay key={block.id || idx} block={block} />
      ))}
    </div>
  );
} 