import type { Database } from './database.types';

// Database table types
export type Tables = Database['public']['Tables'];
export type Profile = Tables['profiles']['Row'];
export type ProfileInsert = Tables['profiles']['Insert'];
export type ProfileUpdate = Tables['profiles']['Update'];

// Query result types
export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export interface QueryListResult<T> {
  data: T[] | null;
  error: string | null;
  count?: number;
}

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

// Filter types
export interface FilterOptions {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Combined query options
export interface QueryOptions extends PaginationOptions, FilterOptions {}

// Auth types specific to database operations
export interface DatabaseAuthUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// RLS policy helpers
export type RLSPolicy = 'authenticated' | 'public' | 'owner_only';

// Database error types
export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} 