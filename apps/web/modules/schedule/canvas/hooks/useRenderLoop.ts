/**
 * React hook for render loop integration
 */

import { useEffect, useRef } from 'react';
import { getMainRenderLoop } from '../RenderLoop';
import { useCanvasStore } from '../CanvasStore';

export const useRenderLoop = () => {
  const renderLoopRef = useRef<ReturnType<typeof getMainRenderLoop> | null>(null);
  const updateAnimation = useCanvasStore(state => state.updateAnimation);
  
  useEffect(() => {
    // Only create render loop in browser
    if (typeof window === 'undefined') return;
    
    if (!renderLoopRef.current) {
      renderLoopRef.current = getMainRenderLoop();
    }
    
    const renderLoop = renderLoopRef.current;
    
    // Add animation update callback
    const unsubscribe = renderLoop.addCallback((deltaTime) => {
      updateAnimation(deltaTime);
    });
    
    // Start the render loop
    renderLoop.start();
    
    return () => {
      unsubscribe();
      // Don't stop the loop as other components might be using it
    };
  }, [updateAnimation]);
  
  return renderLoopRef.current;
}; 