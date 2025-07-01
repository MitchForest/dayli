/**
 * Render loop for smooth 60fps canvas performance
 */

export type FrameCallback = (deltaTime: number, timestamp: number) => void;

export class RenderLoop {
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private isRunning = false;
  private callbacks: Set<FrameCallback> = new Set();
  
  constructor(private targetFps: number = 60) {}
  
  /**
   * Add a callback to be called on each frame
   */
  addCallback(callback: FrameCallback): () => void {
    this.callbacks.add(callback);
    // Return unsubscribe function
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * Start the render loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop();
  }
  
  /**
   * Stop the render loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Main render loop
   */
  private loop = (): void => {
    if (!this.isRunning) return;
    
    const timestamp = performance.now();
    const deltaTime = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1); // Cap at 100ms
    
    // Only update if enough time has passed for target FPS
    const targetFrameTime = 1000 / this.targetFps;
    if (timestamp - this.lastTimestamp >= targetFrameTime) {
      // Call all registered callbacks
      this.callbacks.forEach(callback => {
        try {
          callback(deltaTime, timestamp);
        } catch (error) {
          console.error('Error in render loop callback:', error);
        }
      });
      
      this.lastTimestamp = timestamp;
    }
    
    this.animationFrameId = requestAnimationFrame(this.loop);
  };
  
  /**
   * Check if the loop is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

// Singleton instance for the main render loop
let mainRenderLoop: RenderLoop | null = null;

export const getMainRenderLoop = (): RenderLoop => {
  if (!mainRenderLoop) {
    mainRenderLoop = new RenderLoop(60);
  }
  return mainRenderLoop;
}; 