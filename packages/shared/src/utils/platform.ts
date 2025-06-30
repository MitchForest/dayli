// Platform detection utilities

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
      }
      [key: string]: unknown;
    };
  }
}

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
};

export const isWeb = (): boolean => {
  return typeof window !== 'undefined' && !isTauri();
};

export const isServer = (): boolean => {
  return typeof window === 'undefined';
};

// Platform-specific features
export const canUseFileSystem = (): boolean => {
  return isTauri();
};

export const canUseNotifications = (): boolean => {
  return isTauri() || ('Notification' in window && Notification.permission === 'granted');
}; 