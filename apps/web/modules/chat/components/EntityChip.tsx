'use client';

import { cn } from '@/lib/utils';
import { Calendar, Clock, User, CheckSquare, Coffee } from 'lucide-react';
import type { Entity } from '../types/chat.types';

interface EntityChipProps {
  entity: Entity;
  onClick?: (entity: Entity) => void;
  className?: string;
}

export function EntityChip({ entity, onClick, className }: EntityChipProps) {
  // Icon mapping for entity types
  const getIcon = () => {
    switch (entity.type) {
      case 'time':
        return Clock;
      case 'person':
        return User;
      case 'task':
        return CheckSquare;
      case 'block':
        if (entity.metadata?.blockType === 'break') {
          return Coffee;
        }
        return Calendar;
      default:
        return null;
    }
  };

  // Color schemes for different entity types
  const getColorClasses = () => {
    switch (entity.type) {
      case 'time':
        return 'bg-orange-100 hover:bg-orange-200 text-orange-900 border-orange-200';
      case 'person':
        return 'bg-green-100 hover:bg-green-200 text-green-900 border-green-200';
      case 'task':
        return 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-200';
      case 'block':
        // Use block type colors from schedule
        switch (entity.metadata?.blockType) {
          case 'work':
            return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700';
          case 'meeting':
            return 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700';
          case 'email':
            return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700';
          case 'break':
            return 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700';
          default:
            return 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-200';
        }
      default:
        return 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-200';
    }
  };

  const Icon = getIcon();
  const colorClasses = getColorClasses();

  const handleClick = () => {
    if (onClick) {
      onClick(entity);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'text-xs font-medium border transition-colors',
        'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1',
        colorClasses,
        className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      <span>{entity.value}</span>
    </button>
  );
} 