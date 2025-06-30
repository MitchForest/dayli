// Time constants
export const WORK_DAY_START = 8; // 8 AM
export const WORK_DAY_END = 18; // 6 PM
export const TIME_SLOT_HEIGHT = 80; // pixels per hour
export const FIFTEEN_MINUTE_HEIGHT = TIME_SLOT_HEIGHT / 4;

// Task limits
export const MIN_DAILY_TASKS = 3;
export const MAX_DAILY_TASKS = 7;

// Time block colors (using CSS variables for consistency)
export const TIME_BLOCK_COLORS = {
  focus: 'var(--primary)',
  meeting: 'var(--muted)',
  email: 'var(--accent)',
  'quick-decisions': 'var(--warning)',
  break: 'var(--secondary)',
} as const;

// Time block gradients for subtle depth
export const TIME_BLOCK_GRADIENTS = {
  focus: 'linear-gradient(to bottom, oklch(var(--primary) / 0.12), oklch(var(--primary) / 0.08))',
  meeting: 'linear-gradient(to bottom, oklch(var(--muted) / 0.9), oklch(var(--muted) / 0.85))',
  email: 'linear-gradient(to bottom, oklch(var(--accent) / 0.12), oklch(var(--accent) / 0.08))',
  'quick-decisions': 'linear-gradient(to bottom, oklch(var(--warning) / 0.12), oklch(var(--warning) / 0.08))',
  break: 'linear-gradient(to bottom, oklch(var(--secondary) / 0.9), oklch(var(--secondary) / 0.85))',
} as const;

// Time block background opacity
export const TIME_BLOCK_OPACITY = '0.1';

// Mock data scenarios
export const MOCK_SCENARIOS = [
  'typical_day',
  'meeting_heavy',
  'focus_day',
  'email_heavy',
  'light_day',
] as const;

export type MockScenario = typeof MOCK_SCENARIOS[number]; 