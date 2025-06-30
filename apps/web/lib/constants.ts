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