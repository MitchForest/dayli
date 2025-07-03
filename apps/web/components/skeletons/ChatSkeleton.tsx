import { Skeleton } from '@/components/ui/skeleton';

export function ChatSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <Skeleton className="h-8 w-48" />
      </div>
      
      {/* Messages area */}
      <div className="flex-1 p-4 space-y-4">
        {/* Welcome message skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        
        {/* Suggestion chips */}
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
} 