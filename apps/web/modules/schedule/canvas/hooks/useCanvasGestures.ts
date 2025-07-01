/**
 * Hook for handling canvas gestures (scroll, swipe, touch)
 */

import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../CanvasStore';
import { DAY_SPACING } from '../../constants/grid-constants';

interface GestureConfig {
  scrollSpeed?: number;
  swipeThreshold?: number;
  enableTouch?: boolean;
}

export const useCanvasGestures = (
  containerRef: React.RefObject<HTMLElement>,
  config: GestureConfig = {}
) => {
  const {
    scrollSpeed = 1,
    swipeThreshold = 50,
    enableTouch = true,
  } = config;
  
  const moveCamera = useCanvasStore(state => state.moveCamera);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Wheel handler for desktop scrolling - VERTICAL ONLY
    const handleWheel = (e: WheelEvent) => {
      // Only prevent default if we're actually scrolling
      if (e.deltaY !== 0) {
        e.preventDefault();
      }
      
      // macOS trackpad gives smoother values, so we need to adjust
      const isMacOS = /Mac/.test(navigator.platform);
      const multiplier = isMacOS ? 0.5 : 1;
      
      // Only vertical scroll (through hours)
      moveCamera(0, e.deltaY * scrollSpeed * multiplier);
    };
    
    // Mouse handlers for desktop dragging - HORIZONTAL ONLY
    const handleMouseDown = (e: MouseEvent) => {
      // Only start drag on left mouse button
      if (e.button !== 0) return;
      
      isDraggingRef.current = true;
      lastMouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
      
      // Change cursor to grabbing
      container.style.cursor = 'grabbing';
      
      // Prevent text selection while dragging
      e.preventDefault();
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !lastMouseRef.current) return;
      
      const deltaX = lastMouseRef.current.x - e.clientX;
      
      // Track velocity for momentum
      const now = Date.now();
      velocityRef.current = {
        x: deltaX,
        y: 0, // No vertical movement
        time: now,
      };
      
      // Only horizontal movement
      moveCamera(deltaX * scrollSpeed, 0);
      
      lastMouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    };
    
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      lastMouseRef.current = null;
      
      // Reset cursor
      container.style.cursor = 'grab';
      
      // Check for momentum
      const now = Date.now();
      const timeDelta = now - velocityRef.current.time;
      
      // If the last movement was recent (within 100ms), apply momentum
      if (timeDelta < 100 && Math.abs(velocityRef.current.x) > 2) {
        const store = useCanvasStore.getState();
        const { camera, viewport } = store;
        const dayWidth = viewport.width + DAY_SPACING;
        
        // Calculate momentum-based target
        const momentum = velocityRef.current.x * 10; // Amplify for effect
        const currentX = camera.x;
        const targetX = currentX + momentum;
        
        // Find nearest day to the momentum target
        const nearestDayOffset = Math.round(targetX / dayWidth);
        const snapTargetX = nearestDayOffset * dayWidth;
        
        // Navigate to that day
        store.navigateToDate(
          new Date(store.referenceDate.getTime() + nearestDayOffset * 24 * 60 * 60 * 1000),
          true // animated
        );
      } else {
        // Normal snap to nearest day
        const store = useCanvasStore.getState();
        const { camera, viewport } = store;
        const dayWidth = viewport.width + DAY_SPACING;
        const currentX = camera.x;
        const nearestDayOffset = Math.round(currentX / dayWidth);
        const targetX = nearestDayOffset * dayWidth;
        
        // Only snap if we're not already at a day boundary
        if (Math.abs(currentX - targetX) > 1) {
          store.navigateToDate(
            new Date(store.referenceDate.getTime() + nearestDayOffset * 24 * 60 * 60 * 1000),
            true // animated
          );
        }
      }
      
      // Reset velocity
      velocityRef.current = { x: 0, y: 0, time: 0 };
    };
    
    const handleMouseLeave = () => {
      // Stop dragging if mouse leaves the container
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        lastMouseRef.current = null;
        container.style.cursor = 'grab';
      }
    };
    
    // Touch handlers for mobile
    const handleTouchStart = (e: TouchEvent) => {
      if (!enableTouch) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      lastTouchRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!enableTouch || !touchStartRef.current || !lastTouchRef.current) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      
      const deltaX = lastTouchRef.current.x - touch.clientX;
      
      // Only horizontal movement for touch
      moveCamera(deltaX * scrollSpeed, 0);
      
      lastTouchRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (!enableTouch || !touchStartRef.current) return;
      
      const touch = e.changedTouches[0];
      if (!touch) return;
      
      const deltaX = touchStartRef.current.x - touch.clientX;
      const deltaTime = Date.now() - touchStartRef.current.time;
      
      // Detect swipe for day navigation
      if (Math.abs(deltaX) > swipeThreshold && deltaTime < 300) {
        const swipeDirection = deltaX > 0 ? 1 : -1;
        // Navigate to next/prev day on swipe
        const store = useCanvasStore.getState();
        const currentDayOffset = store.getCurrentDayOffset();
        const targetDate = new Date(store.referenceDate.getTime() + (currentDayOffset + swipeDirection) * 24 * 60 * 60 * 1000);
        store.navigateToDate(targetDate, true);
      } else {
        // Snap to nearest day on release (same as mouse)
        const store = useCanvasStore.getState();
        const { camera, viewport } = store;
        const dayWidth = viewport.width + DAY_SPACING;
        const currentX = camera.x;
        const nearestDayOffset = Math.round(currentX / dayWidth);
        const targetX = nearestDayOffset * dayWidth;
        
        // Only snap if we're not already at a day boundary
        if (Math.abs(currentX - targetX) > 1) {
          store.navigateToDate(
            new Date(store.referenceDate.getTime() + nearestDayOffset * 24 * 60 * 60 * 1000),
            true // animated
          );
        }
      }
      
      touchStartRef.current = null;
      lastTouchRef.current = null;
    };
    
    // Set initial cursor style
    container.style.cursor = 'grab';
    
    // Add event listeners
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Also listen for mouseup on document to catch releases outside container
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Reset cursor
      container.style.cursor = 'auto';
    };
  }, [containerRef, moveCamera, scrollSpeed, swipeThreshold, enableTouch]);
}; 