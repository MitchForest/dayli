'use client';

import { memo, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DataCardProps {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  children?: ReactNode;
  className?: string;
}

export const DataCard = memo(function DataCard({
  title,
  description,
  priority = 'medium',
  children,
  className,
}: DataCardProps) {
  const priorityColors = {
    high: 'border-red-500/50 bg-red-50/10',
    medium: 'border-yellow-500/50 bg-yellow-50/10',
    low: 'border-green-500/50 bg-green-50/10',
  };

  const priorityBadgeVariants = {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  } as const;

  return (
    <Card className={cn(
      'transition-all hover:shadow-md',
      priorityColors[priority],
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          <Badge variant={priorityBadgeVariants[priority]} className="text-xs">
            {priority}
          </Badge>
        </div>
      </CardHeader>
      {children && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}); 