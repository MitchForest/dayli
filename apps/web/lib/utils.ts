import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isDesktop() {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return window.__TAURI__ !== undefined;
}
