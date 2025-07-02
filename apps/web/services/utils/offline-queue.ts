export interface QueuedOperation {
  id: string;
  service: string;
  method: string;
  args: any[];
  timestamp: string;
  retryCount?: number;
}

const QUEUE_KEY = 'dayli_offline_queue';
const MAX_QUEUE_SIZE = 100;

export async function queueForOffline(operation: Omit<QueuedOperation, 'id'>): Promise<void> {
  try {
    const queue = getQueue();
    
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest item to make room
      queue.shift();
    }
    
    const queuedOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      retryCount: 0
    };
    
    queue.push(queuedOp);
    saveQueue(queue);
    
    console.log(`[OfflineQueue] Queued operation: ${operation.service}.${operation.method}`);
  } catch (error) {
    console.error('[OfflineQueue] Failed to queue operation:', error);
  }
}

export function getQueue(): QueuedOperation[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[OfflineQueue] Failed to read queue:', error);
    return [];
  }
}

export function saveQueue(queue: QueuedOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineQueue] Failed to save queue:', error);
  }
}

export function removeFromQueue(id: string): void {
  const queue = getQueue();
  const filtered = queue.filter(op => op.id !== id);
  saveQueue(filtered);
}

export function clearQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (error) {
    console.error('[OfflineQueue] Failed to clear queue:', error);
  }
}

export async function processOfflineQueue(
  serviceFactory: any,
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;
  
  console.log(`[OfflineQueue] Processing ${queue.length} queued operations`);
  
  let processed = 0;
  const failed: QueuedOperation[] = [];
  
  for (const operation of queue) {
    try {
      const service = serviceFactory[`get${operation.service}Service`]();
      const method = service[operation.method];
      
      if (typeof method === 'function') {
        await method.apply(service, operation.args);
        processed++;
        
        if (onProgress) {
          onProgress(processed, queue.length);
        }
      } else {
        console.error(`[OfflineQueue] Method not found: ${operation.service}.${operation.method}`);
        failed.push(operation);
      }
    } catch (error) {
      console.error(`[OfflineQueue] Failed to process operation:`, error);
      
      // Increment retry count and keep in queue if under limit
      operation.retryCount = (operation.retryCount || 0) + 1;
      if (operation.retryCount < 3) {
        failed.push(operation);
      }
    }
  }
  
  // Save failed operations back to queue
  saveQueue(failed);
  
  console.log(`[OfflineQueue] Processed ${processed}/${queue.length} operations`);
}

// Check if we're online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Set up online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Back online, processing queue...');
    // Note: processOfflineQueue needs to be called from a component with access to ServiceFactory
  });
  
  window.addEventListener('offline', () => {
    console.log('[OfflineQueue] Gone offline, operations will be queued');
  });
} 