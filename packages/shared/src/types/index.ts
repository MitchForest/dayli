import { z } from 'zod';

// User related types
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid(),
  email: z.string().email().nullable(),
  oauth_provider: z.string(),
  oauth_id: z.string(),
  username: z.string().min(3).max(50).nullable(),
  display_name: z.string().max(100).nullable(),
  avatar_url: z.string().url().nullable(),
  bio: z.string().nullable(),
  is_private: z.boolean(),
  show_bankroll: z.boolean(),
  show_stats: z.boolean(),
  show_picks: z.boolean(),
  notification_settings: z.any(),
  privacy_settings: z.any(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;

// Auth related types
export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Common utility types
export type WithTimestamps<T> = T & {
  created_at: string;
  updated_at: string;
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>; 