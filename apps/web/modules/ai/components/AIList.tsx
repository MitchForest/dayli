'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface AIListProps {
  title?: string;
  description?: string;
  items: React.ReactNode[];
  emptyState?: string;
  className?: string;
}

export const AIList = memo(function AIList({
  title,
  description,
  items,
  emptyState = 'No items found',
  className
}: AIListProps) {
  if (items.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        {title && (
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        )}
        <div className="text-sm text-muted-foreground py-8 text-center">
          {emptyState}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        {items}
      </div>
    </div>
  );
}); 