/**
 * Canvas store for viewport and camera state management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { SpringAnimation, getVisibleBounds } from './utils/camera-utils';
import { getToday, getDayOffset } from './utils/date-utils';
import { HOUR_HEIGHT, ANIMATION, DAY_SPACING } from '../constants/grid-constants';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';

export interface CanvasState {
  // Viewport dimensions
  viewport: {
    width: number;
    height: number;
  };
  
  // Camera position (global coordinates)
  camera: {
    x: number; // Horizontal position (days)
    y: number; // Vertical position (pixels)
    scale: number; // Zoom level (future)
  };
  
  // Animation state
  cameraAnimation: SpringAnimation | null;
  shouldRender: boolean;
  
  // Current date being viewed
  currentDate: Date;
  referenceDate: Date; // Today's date as reference
  
  // Scroll memory per day
  scrollMemory: Map<string, number>;
  
  // User preferences
  preferences: UserPreferencesTyped | null;
  
  // Actions
  initialize: (width: number, height: number) => void;
  setPreferences: (prefs: UserPreferencesTyped) => void;
  moveCamera: (deltaX: number, deltaY: number) => void;
  navigateToDate: (date: Date, animated?: boolean) => void;
  centerOnWorkHours: (animated?: boolean) => void;
  updateAnimation: (deltaTime: number) => void;
  saveScrollPosition: () => void;
  restoreScrollPosition: (date: Date) => void;
  navigateToToday: (animated?: boolean) => void;
  
  // Computed values
  getVisibleBounds: () => ReturnType<typeof getVisibleBounds>;
  getCurrentDayOffset: () => number;
}

export const useCanvasStore = create<CanvasState>()(
  subscribeWithSelector((set, get) => ({
    viewport: { width: 0, height: 0 },
    camera: { x: 0, y: 0, scale: 1 },
    cameraAnimation: null,
    shouldRender: true,
    currentDate: getToday(),
    referenceDate: getToday(),
    scrollMemory: new Map(),
    preferences: null,
    
    initialize: (width, height) => {
      set({
        viewport: { width, height },
        shouldRender: true,
      });
    },
    
    setPreferences: (prefs) => {
      const state = get();
      set({ preferences: prefs });
      
      // If we have preferences and this is first load, center on work hours
      if (!state.preferences && prefs) {
        get().centerOnWorkHours(false);
      }
    },
    
    moveCamera: (deltaX, deltaY) => {
      const { camera, viewport, currentDate } = get();
      
      // Handle vertical movement (hour scrolling)
      if (deltaY !== 0 && deltaX === 0) {
        const newY = camera.y + deltaY;
        
        // Constrain Y to valid range (0 to 24 hours)
        const maxY = 24 * HOUR_HEIGHT - viewport.height;
        const constrainedY = Math.max(0, Math.min(newY, maxY));
        
        set({
          camera: { ...camera, y: constrainedY },
          shouldRender: true,
        });
        return;
      }
      
      // Handle horizontal movement (day switching)
      if (deltaX !== 0) {
        let newX = camera.x + deltaX;
        
        // Day snapping logic
        const dayWidth = viewport.width + DAY_SPACING;
        const currentDayOffset = Math.round(camera.x / dayWidth);
        
        // Calculate which day we're closest to
        const exactDayOffset = newX / dayWidth;
        const nearestDayOffset = Math.round(exactDayOffset);
        
        // Calculate distance from nearest day boundary (0 to 0.5)
        const distanceFromBoundary = Math.abs(exactDayOffset - nearestDayOffset);
        
        // Snap threshold - only snap when very close to boundary (5%)
        const snapThreshold = 0.05;
        
        // Apply snapping if close to boundary
        if (distanceFromBoundary < snapThreshold) {
          // Interpolate between current position and snap position
          const snapStrength = 1 - (distanceFromBoundary / snapThreshold);
          const snapX = nearestDayOffset * dayWidth;
          newX = newX + (snapX - newX) * snapStrength * 0.05;
        }
        
        // Check if we've moved to a new day
        const newDayOffset = Math.round(newX / dayWidth);
        
        if (currentDayOffset !== newDayOffset) {
          // Update current date
          const newDate = new Date(get().referenceDate);
          newDate.setDate(newDate.getDate() + newDayOffset);
          
          set({
            camera: { ...camera, x: newX }, // Keep Y unchanged
            currentDate: newDate,
            shouldRender: true,
          });
        } else {
          set({
            camera: { ...camera, x: newX }, // Keep Y unchanged
            shouldRender: true,
          });
        }
      }
    },
    
    navigateToToday: (animated = true) => {
      const { viewport, camera, referenceDate } = get();
              const today = new Date();
        const dayOffset = getDayOffset(today, referenceDate);
        const targetX = dayOffset * (viewport.width + DAY_SPACING);
      
      // Calculate smart Y position based on current time
      const currentHour = today.getHours();
      const currentMinutes = today.getMinutes();
      const currentTimeInHours = currentHour + currentMinutes / 60;
      
      // Smart positioning logic
      let targetHour: number;
      if (currentTimeInHours < 9) {
        // Early morning: show from start of day
        targetHour = Math.max(0, currentTimeInHours - 2);
      } else if (currentTimeInHours < 12) {
        // Morning: show 3 hours before current time
        targetHour = currentTimeInHours - 3;
      } else if (currentTimeInHours < 17) {
        // Afternoon: show 4 hours before current time
        targetHour = currentTimeInHours - 4;
      } else {
        // Evening: show 5 hours before current time
        targetHour = currentTimeInHours - 5;
      }
      
      // Calculate Y position (show target hour near top of viewport)
      let targetY = Math.max(0, targetHour * HOUR_HEIGHT);
      
      // Ensure we don't show empty space at the bottom
      const maxY = Math.max(0, 24 * HOUR_HEIGHT - viewport.height);
      targetY = Math.min(targetY, maxY);
      
      if (animated) {
        // Simple fast animation
        const startX = camera.x;
        const startY = camera.y;
        const startTime = Date.now();
        const duration = 300; // 300ms for super fast animation
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3);
          
          const currentX = startX + (targetX - startX) * eased;
          const currentY = startY + (targetY - startY) * eased;
          
          set({
            camera: { ...camera, x: currentX, y: currentY },
            currentDate: today,
            shouldRender: true,
          });
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        animate();
      } else {
        set({
          camera: { ...camera, x: targetX, y: targetY },
          currentDate: today,
          shouldRender: true,
        });
      }
    },
    
    navigateToDate: (date, animated = true) => {
      const { viewport, camera, referenceDate } = get();
      const dayOffset = getDayOffset(date, referenceDate);
      const targetX = dayOffset * (viewport.width + DAY_SPACING);
      
      if (animated) {
        // Simple fast animation
        const startX = camera.x;
        const startTime = Date.now();
        const duration = 250; // 250ms for day navigation
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          
          const currentX = startX + (targetX - startX) * eased;
          
          set({
            camera: { ...camera, x: currentX },
            currentDate: date,
            shouldRender: true,
          });
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
          // Don't restore scroll position - maintain current Y
        };
        
        animate();
      } else {
        set({
          camera: { ...camera, x: targetX },
          currentDate: date,
          shouldRender: true,
        });
        
        // Don't restore scroll position - maintain current Y
      }
    },
    
    centerOnWorkHours: (animated = true) => {
      const { preferences, viewport, camera } = get();
      if (!preferences) return;
      
      // Parse work start time
      const timeParts = (preferences.work_start_time || '08:00').split(':').map(Number);
      const hours = timeParts[0] || 8;
      const targetY = hours * HOUR_HEIGHT - viewport.height / 3; // Show some context above
      
      // Ensure we don't show empty space at the bottom
      const maxY = Math.max(0, 24 * HOUR_HEIGHT - viewport.height);
      const constrainedY = Math.max(0, Math.min(targetY, maxY));
      
      if (animated) {
        // Simple fast animation
        const startY = camera.y;
        const startTime = Date.now();
        const duration = 250; // 250ms
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          
          const currentY = startY + (constrainedY - startY) * eased;
          
          set({
            camera: { ...camera, y: currentY },
            shouldRender: true,
          });
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        animate();
      } else {
        set({
          camera: { ...camera, y: constrainedY },
          shouldRender: true,
        });
      }
    },
    
    updateAnimation: (deltaTime) => {
      // Animation is now handled directly in navigateToDate and navigateToToday
      // This method is kept for compatibility but does nothing
    },
    
    saveScrollPosition: () => {
      const { currentDate, camera, scrollMemory } = get();
      const key = currentDate.toISOString().split('T')[0] || '';
      if (key) scrollMemory.set(key, camera.y);
    },
    
    restoreScrollPosition: (date) => {
      const { scrollMemory, camera } = get();
      const key = date.toISOString().split('T')[0] || '';
      if (!key) return;
      
      const savedY = scrollMemory.get(key);
      
      if (savedY !== undefined) {
        set({
          camera: { ...camera, y: savedY },
          shouldRender: true,
        });
      }
    },
    
    getVisibleBounds: () => {
      const { camera, viewport } = get();
      return getVisibleBounds(camera, viewport);
    },
    
    getCurrentDayOffset: () => {
      const { camera, viewport } = get();
      if (viewport.width === 0) return 0;
      return Math.round(camera.x / (viewport.width + DAY_SPACING));
    },
  }))
); 