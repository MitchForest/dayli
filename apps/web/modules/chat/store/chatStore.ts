import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ChatState } from '../types/chat.types';

interface ChatStore extends ChatState {
  commandHistory: string[];
  isCollapsed: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setLoading: (isLoading: boolean) => void;
  clearMessages: () => void;
  addToHistory: (command: string) => void;
  toggleCollapsed: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      commandHistory: [],
      isCollapsed: false,
      
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}`,
          timestamp: new Date(),
        };
        
        set({ messages: [...get().messages, newMessage] });
      },
      
      setLoading: (isLoading) => {
        set({ isLoading });
      },
      
      clearMessages: () => {
        set({ messages: [] });
      },
      
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
      partialize: (state) => ({ 
        commandHistory: state.commandHistory,
        isCollapsed: state.isCollapsed,
      }), // Persist command history and collapsed state
    }
  )
); 