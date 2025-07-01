/**
 * Position component for placing elements on the infinite canvas
 */

import React, { memo, useMemo } from 'react';
import { useCanvasStore } from '../../canvas/CanvasStore';
import { inBounds } from '../../canvas/utils/math-utils';

export interface PositionProps {
  // Global coordinates
  x: number;
  y: number;
  width: number;
  height: number;
  
  // Optional z-index
  zIndex?: number;
  
  // Children to render
  children: React.ReactNode;
}

export const Position = memo(({
  x,
  y,
  width,
  height,
  zIndex = 0,
  children,
}: PositionProps) => {
  const camera = useCanvasStore(state => state.camera);
  const viewport = useCanvasStore(state => state.viewport);
  const shouldRender = useCanvasStore(state => state.shouldRender);
  
  // Calculate if element is visible
  const isVisible = useMemo(() => {
    const elementBounds = { left: x, top: y, width, height };
    const viewportBounds = {
      left: camera.x,
      top: camera.y,
      width: viewport.width,
      height: viewport.height,
    };
    
    return inBounds(elementBounds, viewportBounds);
  }, [x, y, width, height, camera.x, camera.y, viewport.width, viewport.height, shouldRender]);
  
  // Calculate screen position
  const screenPosition = useMemo(() => {
    return {
      x: x - camera.x,
      y: y - camera.y,
    };
  }, [x, y, camera.x, camera.y]);
  
  // Don't render if not visible
  if (!isVisible) return null;
  
  return (
    <div
      className="absolute"
      style={{
        transform: `translate(${screenPosition.x}px, ${screenPosition.y}px)`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
});

Position.displayName = 'Position'; 