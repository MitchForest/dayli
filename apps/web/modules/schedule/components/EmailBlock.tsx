import React from 'react';
import { TimeBlock } from './TimeBlock';
import { TIME_BLOCK_GRADIENTS } from '@/lib/constants';
import { Mail } from 'lucide-react';
import { EmailQueue } from '@/modules/email/components/EmailQueue';
import { useScheduleStore } from '@/stores';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface EmailBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  style?: React.CSSProperties;
}

export function EmailBlock({ block, gridPosition, style }: EmailBlockProps) {
  const { processEmailFromBlock } = useScheduleStore();
  const emailCount = block.emailQueue?.length || 0;
  
  return (
    <TimeBlock
      block={block}
      gridPosition={gridPosition}
      className="border-accent/20"
      style={{
        background: TIME_BLOCK_GRADIENTS.email,
        ...style,
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs text-muted-foreground">
            {emailCount} {emailCount === 1 ? 'email' : 'emails'} to process
          </span>
        </div>
        
        {block.emailQueue && block.emailQueue.length > 0 && (
          <EmailQueue
            emails={block.emailQueue}
            onDecision={processEmailFromBlock}
            compact={false}
          />
        )}
      </div>
    </TimeBlock>
  );
} 