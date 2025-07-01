/**
 * Canvas store for viewport and camera state management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getToday, getDayOffset, parseTime } from './utils/date-utils';
import { HOUR_HEIGHT, DAY_SPACING, ANIMATION, TIME_LABEL_WIDTH } from '../constants/grid-constants';
import { getVisibleBounds, SpringAnimation, Point } from './utils/camera-utils';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';

export interface CanvasState {
  viewport: { width: number; height: number };
  camera: Point;
  cameraAnimation: SpringAnimation | null;
  shouldRender: boolean;
  currentDate: Date;
  referenceDate: Date;
  scrollMemory: Map<string, number>;
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
  navigateToNextDay: (animated?: boolean) => void;
  navigateToPreviousDay: (animated?: boolean) => void;
  snapToNearestDay: () => void;
  centerOnCurrentTime: (animated?: boolean) => void;
  
  // Computed
  getVisibleBounds: () => ReturnType<typeof getVisibleBounds>;
  getCurrentDayOffset: () => number;
}

export const useCanvasStore = create<CanvasState>()(
  subscribeWithSelector((set, get) => ({
    viewport: { width: 0, height: 0 },
    camera: { x: 0, y: 0 },
    cameraAnimation: null,
    shouldRender: true,
    currentDate: getToday(),
    referenceDate: getToday(),
    scrollMemory: new Map(),
    preferences: null,
    
    // --- ACTIONS ---
    
    initialize: (width, height) => {
      set({ viewport: { width, height }, shouldRender: true });
      // Navigate to today and center on work hours
      const { camera } = get();
      // Set camera X to 0 for today (since referenceDate is today)
      set({ camera: { x: -TIME_LABEL_WIDTH, y: camera.y } });
      get().centerOnWorkHours(false);
    },
    
    setPreferences: (prefs) => {
      set({ preferences: prefs });
      get().centerOnWorkHours(false);
    },
    
    moveCamera: (deltaX, deltaY) => {
      const { camera, viewport } = get();
      const newX = camera.x + deltaX;
      const newY = camera.y + deltaY;
      const maxY = 24 * HOUR_HEIGHT - viewport.height;
      const constrainedY = Math.max(0, Math.min(newY, maxY));
      
      set({ camera: { x: newX, y: constrainedY }, shouldRender: true });
      
      const dayWidth = viewport.width + DAY_SPACING;
      const currentDayOffset = Math.round((camera.x + TIME_LABEL_WIDTH) / dayWidth);
      const newDayOffset = Math.round((newX + TIME_LABEL_WIDTH) / dayWidth);
      
      if (currentDayOffset !== newDayOffset) {
        get().saveScrollPosition();
        const newDate = new Date(get().referenceDate);
        newDate.setDate(newDate.getDate() + newDayOffset);
        set({ currentDate: newDate });
        get().restoreScrollPosition(newDate);
      }
    },
    
    navigateToToday: (animated = true) => {
      const { currentDate, referenceDate } = get();
      const today = getToday();
      const currentOffset = getDayOffset(currentDate, referenceDate);
      const todayOffset = getDayOffset(today, referenceDate);

      // If we are already on today's date, just center on the current time
      if (currentOffset === todayOffset) {
        get().centerOnCurrentTime(animated);
      } else {
        // Otherwise, navigate to today's date, which will auto-center
        get().navigateToDate(today, animated);
      }
    },
    
    navigateToDate: (date, animated = true) => {
      const { viewport, camera, referenceDate } = get();
      const dayOffset = getDayOffset(date, referenceDate);
      const targetX = dayOffset * (viewport.width + DAY_SPACING) - TIME_LABEL_WIDTH;
      
      if (animated) {
        const animation = new SpringAnimation(
          camera,
          { x: targetX, y: camera.y },
          ANIMATION.cameraSpring
        );
        set({ cameraAnimation: animation, currentDate: date, shouldRender: true });
      } else {
        set({ camera: { ...camera, x: targetX }, currentDate: date, shouldRender: true });
      }
      // When navigating to a new date, center on work hours by default
      get().centerOnWorkHours(false);
    },
    
    centerOnWorkHours: (animated = true) => {
      const { preferences, viewport, camera } = get();
      if (!preferences) return;
      
      const start = parseTime(preferences.work_start_time || '08:00');
      const end = parseTime(preferences.work_end_time || '18:00');
      const centerHour = start.hour + (end.hour - start.hour) / 2;
      let targetY = centerHour * HOUR_HEIGHT - viewport.height / 2;
      
      const maxY = 24 * HOUR_HEIGHT - viewport.height;
      targetY = Math.max(0, Math.min(targetY, maxY));
      
      if (animated) {
        const animation = new SpringAnimation(
          camera,
          { x: camera.x, y: targetY },
          ANIMATION.cameraSpring
        );
        set({ cameraAnimation: animation, shouldRender: true });
      } else {
        set({ camera: { ...camera, y: targetY }, shouldRender: true });
      }
    },
    
    updateAnimation: (deltaTime) => {
      const { cameraAnimation } = get();
      if (!cameraAnimation) return;
      
      const isDone = cameraAnimation.update(deltaTime / 1000); // Expects seconds
      set({ camera: cameraAnimation.getCurrent(), shouldRender: true });
      
      if (isDone) {
        set({ cameraAnimation: null, shouldRender: false });
      }
    },
    
    saveScrollPosition: () => {
      const { currentDate, camera, scrollMemory } = get();
      const dateKey = currentDate.toISOString().split('T')[0];
      if (dateKey) scrollMemory.set(dateKey, camera.y);
    },
    
    restoreScrollPosition: (date) => {
      const { scrollMemory, camera } = get();
      const dateKey = date.toISOString().split('T')[0];
      const savedY = dateKey ? scrollMemory.get(dateKey) : undefined;
      
      if (savedY !== undefined) {
        set({ camera: { ...camera, y: savedY } });
      } else {
        get().centerOnWorkHours(false);
      }
    },
    
    navigateToNextDay: (animated = true) => {
      const { currentDate } = get();
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      get().navigateToDate(nextDay, animated);
    },

    navigateToPreviousDay: (animated = true) => {
      const { currentDate } = get();
      const prevDay = new Date(currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
      get().navigateToDate(prevDay, animated);
    },

    centerOnCurrentTime: (animated = true) => {
      const { viewport, camera } = get();
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      let targetY = currentHour * HOUR_HEIGHT - viewport.height / 3;
      const maxY = 24 * HOUR_HEIGHT - viewport.height;
      targetY = Math.max(0, Math.min(targetY, maxY));

      if (animated) {
        const animation = new SpringAnimation(
          camera,
          { x: camera.x, y: targetY },
          ANIMATION.cameraSpring
        );
        set({ cameraAnimation: animation, shouldRender: true });
      } else {
        set({ camera: { ...camera, y: targetY }, shouldRender: true });
      }
    },

    snapToNearestDay: () => {
      const { camera, viewport, referenceDate } = get();
      const dayWidth = viewport.width + DAY_SPACING;
      if (dayWidth <= 0) return;

      const currentOffset = camera.x / dayWidth;
      const nearestDayOffset = Math.round(currentOffset);

      const newDate = new Date(referenceDate);
      newDate.setDate(referenceDate.getDate() + nearestDayOffset);

      // Don't re-animate if we are already at the target
      const currentTargetOffset = getDayOffset(get().currentDate, referenceDate);
      if (currentTargetOffset === nearestDayOffset) {
        return;
      }

      get().navigateToDate(newDate, true);
    },
    
    // --- COMPUTED ---
    
    getVisibleBounds: () => {
      const { camera, viewport } = get();
      return getVisibleBounds({ ...camera, scale: 1 }, viewport);
    },
    
    getCurrentDayOffset: () => {
      const { camera, viewport } = get();
      if (viewport.width === 0) return 0;
      // Account for TIME_LABEL_WIDTH when calculating offset
      return Math.round((camera.x + TIME_LABEL_WIDTH) / (viewport.width + DAY_SPACING));
    },
  }))
); 