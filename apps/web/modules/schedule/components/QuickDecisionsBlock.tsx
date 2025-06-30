import React from 'react';
import { TimeBlock } from './TimeBlock';
import { TIME_BLOCK_GRADIENTS } from '@/lib/constants';
import { Zap } from 'lucide-react';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface QuickDecisionsBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  style?: React.CSSProperties;
}

export function QuickDecisionsBlock({ block, gridPosition, style }: QuickDecisionsBlockProps) {
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
            {emailCount} quick decisions
          </span>
        </div>
        {emailCount > 0 && block.emailQueue && (
          <div className="text-xs text-muted-foreground">
            <div>Now: {block.emailQueue.filter(e => e.decision === 'now').length}</div>
            <div>Tomorrow: {block.emailQueue.filter(e => e.decision === 'tomorrow').length}</div>
            <div>Never: {block.emailQueue.filter(e => e.decision === 'never').length}</div>
          </div>
        )}
      </div>
    </TimeBlock>
  );
} 