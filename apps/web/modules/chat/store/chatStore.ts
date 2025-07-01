import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatStore {
  commandHistory: string[];
  isCollapsed: boolean;
  addToHistory: (command: string) => void;
  toggleCollapsed: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      commandHistory: [],
      isCollapsed: false,
      
      addToHistory: (command) => {
        set((state) => ({
          commandHistory: [command, ...state.commandHistory.slice(0, 9)],
        }));
      },
      
      toggleCollapsed: () => {
        set((state) => ({ isCollapsed: !state.isCollapsed }));
      },
    }),
    {
      name: 'dayli-chat-store',
    }
  )
); 