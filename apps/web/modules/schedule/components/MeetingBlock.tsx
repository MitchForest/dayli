import React from 'react';
import { TimeBlock } from './TimeBlock';
import { TIME_BLOCK_GRADIENTS } from '@/lib/constants';
import { Users } from 'lucide-react';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface MeetingBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  style?: React.CSSProperties;
}

export function MeetingBlock({ block, gridPosition, style }: MeetingBlockProps) {
  return (
    <TimeBlock
      block={block}
      gridPosition={gridPosition}
      className="border-muted-foreground/20"
      style={{
        background: TIME_BLOCK_GRADIENTS.meeting,
        ...style,
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span className="text-xs">Meeting</span>
      </div>
    </TimeBlock>
  );
} 