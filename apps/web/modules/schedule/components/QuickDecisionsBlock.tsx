import React from 'react';
import { TimeBlock } from './TimeBlock';
import { TIME_BLOCK_GRADIENTS } from '@/lib/constants';
import { Zap } from 'lucide-react';
import { EmailQueue } from '@/modules/email/components/EmailQueue';
import { useScheduleStore } from '@/stores';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface QuickDecisionsBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  style?: React.CSSProperties;
}

export function QuickDecisionsBlock({ block, gridPosition, style }: QuickDecisionsBlockProps) {
  const { processEmailFromBlock } = useScheduleStore();
  const emailCount = block.emailQueue?.length || 0;
  
  return (
    <TimeBlock
      block={block}
      gridPosition={gridPosition}
      className="border-warning/20"
      style={{
        background: TIME_BLOCK_GRADIENTS['quick-decisions'],
        ...style,
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs text-muted-foreground">
            {emailCount} quick {emailCount === 1 ? 'decision' : 'decisions'}
          </span>
        </div>
        
        {block.emailQueue && block.emailQueue.length > 0 && (
          <EmailQueue
            emails={block.emailQueue}
            onDecision={processEmailFromBlock}
            compact={true}
          />
        )}
      </div>
    </TimeBlock>
  );
} 