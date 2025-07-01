/**
 * Camera utilities for infinite canvas viewport management
 */

import { Point } from './math-utils';

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Convert global coordinates to screen coordinates
 */
export const globalToScreen = (
  globalPoint: Point,
  camera: Camera,
  viewport: Viewport
): Point => {
  return {
    x: (globalPoint.x - camera.x) * camera.scale + viewport.width / 2,
    y: (globalPoint.y - camera.y) * camera.scale + viewport.height / 2,
  };
};

/**
 * Convert screen coordinates to global coordinates
 */
export const screenToGlobal = (
  screenPoint: Point,
  camera: Camera,
  viewport: Viewport
): Point => {
  return {
    x: (screenPoint.x - viewport.width / 2) / camera.scale + camera.x,
    y: (screenPoint.y - viewport.height / 2) / camera.scale + camera.y,
  };
};

/**
 * Calculate visible bounds in global coordinates
 */
export const getVisibleBounds = (camera: Camera, viewport: Viewport) => {
  const halfWidth = viewport.width / 2 / camera.scale;
  const halfHeight = viewport.height / 2 / camera.scale;
  
  return {
    left: camera.x - halfWidth,
    top: camera.y - halfHeight,
    right: camera.x + halfWidth,
    bottom: camera.y + halfHeight,
    width: viewport.width / camera.scale,
    height: viewport.height / camera.scale,
  };
};

/**
 * Smooth camera animation using spring physics
 */
export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export const DEFAULT_SPRING: SpringConfig = {
  stiffness: 0.15,
  damping: 0.8,
  mass: 1,
};

export class SpringAnimation {
  private velocity: Point = { x: 0, y: 0 };
  
  constructor(
    private current: Point,
    private target: Point,
    private config: SpringConfig = DEFAULT_SPRING
  ) {}
  
  update(deltaTime: number): boolean {
    const dx = this.target.x - this.current.x;
    const dy = this.target.y - this.current.y;
    
    // Spring force
    const springForceX = dx * this.config.stiffness;
    const springForceY = dy * this.config.stiffness;
    
    // Damping force
    const dampingForceX = -this.velocity.x * this.config.damping;
    const dampingForceY = -this.velocity.y * this.config.damping;
    
    // Update velocity
    this.velocity.x += (springForceX + dampingForceX) / this.config.mass * deltaTime;
    this.velocity.y += (springForceY + dampingForceY) / this.config.mass * deltaTime;
    
    // Update position
    this.current.x += this.velocity.x * deltaTime;
    this.current.y += this.velocity.y * deltaTime;
    
    // Check if animation is complete
    const threshold = 0.01;
    const velocityThreshold = 0.01;
    
    return (
      Math.abs(dx) < threshold &&
      Math.abs(dy) < threshold &&
      Math.abs(this.velocity.x) < velocityThreshold &&
      Math.abs(this.velocity.y) < velocityThreshold
    );
  }
  
  getCurrent(): Point {
    return { ...this.current };
  }
  
  setTarget(target: Point) {
    this.target = { ...target };
  }
} 