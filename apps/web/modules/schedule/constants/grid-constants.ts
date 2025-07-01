/**
 * Grid constants for beautiful infinite canvas design
 */

// Grid dimensions
export const HOUR_HEIGHT = 120; // 4 × 30px for 15-min cells (more readable)
export const CELL_HEIGHT = 30; // 15-minute cell
export const MIN_BLOCK_HEIGHT = 60; // Minimum 2 cells (30 minutes)
export const TIME_LABEL_WIDTH = 48; // Compact time labels
export const GRID_PADDING = 16; // Padding around grid
export const DAY_SPACING = 20; // Space between days

// Beautiful, calming color palette
export const CANVAS_COLORS = {
  // Backgrounds - using CSS variables for theme support
  canvasBackground: 'var(--background)', // Theme-aware background
  gridBackground: 'var(--card)', // Theme-aware card background
  
  // Grid lines - using opacity with foreground color for theme support
  gridLine: 'var(--border)', // Theme-aware border with 60% opacity
  gridLineQuarter: 'var(--border)', // Theme-aware border with 80% opacity
  gridLineHour: 'var(--border)', // Theme-aware border
  gridLineWorkHours: 'var(--primary)', // Theme-aware primary color with 15% opacity
  
  // Time elements
  timeLabel: 'var(--muted-foreground)', // Theme-aware muted text
  timeLabelHour: 'var(--foreground)', // Theme-aware foreground with 60% opacity
  currentTime: 'var(--primary)', // Theme-aware primary color
  currentTimeGlow: 'var(--primary)', // Theme-aware primary with 10% opacity
  
  // Navigation
  dateNavBackground: 'var(--card)', // Theme-aware card background with 80% opacity
  dateNavBorder: 'var(--border)',
  dateNavText: 'var(--foreground)',
  dateNavArrow: 'var(--muted-foreground)',
  
  // Shadows and effects
  blockShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  hoverShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04)',
  glassEffect: 'rgba(255, 255, 255, 0.7)',
};

// Block visual styles with beautiful gradients
export const BLOCK_STYLES = {
  deepWork: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    backgroundHover: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    color: '#1e40af',
    icon: '🎯', // Focus icon
  },
  meeting: {
    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    backgroundHover: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    color: '#334155',
    icon: '👥', // People icon
  },
  email: {
    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    backgroundHover: 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#047857',
    icon: '📧', // Email icon
  },
  blocked: {
    background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.02) 10px, rgba(0, 0, 0, 0.02) 20px)',
    backgroundColor: '#f9fafb',
    border: '1px solid rgba(107, 114, 128, 0.2)',
    color: '#374151',
    icon: '🚫', // Blocked icon
  },
  break: {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    backgroundHover: 'linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#92400e',
    icon: '☕', // Coffee icon
  },
};

// Animation constants
export const ANIMATION = {
  // Spring physics for smooth camera movement
  cameraSpring: {
    stiffness: 1.0,     // Maximum stiffness for instant response
    damping: 0.8,       // Balanced damping for quick settle without bounce
    mass: 0.02,         // Ultra-low mass for lightning fast movement
  },
  // Transition durations
  blockHover: '150ms',
  currentTime: '1000ms',
  dateNav: '100ms',    // Faster navigation
};

// Typography
export const TYPOGRAPHY = {
  timeLabel: {
    fontSize: '11px',
    fontWeight: '500',
    letterSpacing: '0.5px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  blockTitle: {
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },
  blockSubtitle: {
    fontSize: '12px',
    fontWeight: '400',
    opacity: 0.7,
  },
  dateNav: {
    fontSize: '15px',
    fontWeight: '500',
    letterSpacing: '-0.02em',
  },
}; 