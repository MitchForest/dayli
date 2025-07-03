import { Skeleton } from '@/components/ui/skeleton';

export function ScheduleSkeleton() {
  return (
    <div className="h-full p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
      
      {/* Date navigation */}
      <Skeleton className="h-10 w-full rounded" />
      
      {/* Schedule grid */}
      <div className="relative h-[calc(100vh-200px)]">
        {/* Time labels */}
        <div className="absolute left-0 top-0 w-16 space-y-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-12" />
          ))}
        </div>
        
        {/* Grid content */}
        <div className="ml-20 space-y-2">
          <Skeleton className="h-20 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-24 w-full rounded" />
          <Skeleton className="h-20 w-full rounded" />
        </div>
      </div>
    </div>
  );
} 