// Configuration for API URLs across environments
export function getApiUrl() {
  // Check if running in Tauri desktop app
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return 'https://dayli-web-qttm.vercel.app';
  }
  // For web, use relative URLs (same origin)
  return '';
}

// Helper to construct full API URLs
export function getFullApiUrl(path: string) {
  const baseUrl = getApiUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
} 