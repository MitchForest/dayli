/**
 * Hook for handling canvas gestures (scroll, swipe, touch)
 */

import { useEffect } from 'react';
import { useCanvasStore } from '../CanvasStore';

export function useCanvasGestures(ref: React.RefObject<HTMLDivElement>) {
  const moveCamera = useCanvasStore(state => state.moveCamera);
  const snapToNearestDay = useCanvasStore(state => state.snapToNearestDay);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let isDragging = false;
    let lastX = 0;

    // Pointer events for horizontal dragging
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only main button
      isDragging = true;
      lastX = e.clientX;
      element.style.cursor = 'grabbing';
      element.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moveCamera(-dx, 0); // Horizontal movement only
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      element.style.cursor = 'grab';
      element.releasePointerCapture(e.pointerId);
      snapToNearestDay();
    };

    // Wheel event for vertical scrolling (trackpad two-finger swipe)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      moveCamera(0, e.deltaY);
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.removeEventListener('wheel', handleWheel);
    };
  }, [ref, moveCamera, snapToNearestDay]);
} 