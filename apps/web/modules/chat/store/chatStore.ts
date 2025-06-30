import { create } from 'zustand';
import type { ChatMessage, ChatState } from '../types/chat.types';

interface ChatStore extends ChatState {
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  toggleCollapsed: () => void;
  setLoading: (isLoading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isCollapsed: true, // Start collapsed for focus
  isLoading: false,
  
  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
    };
    
    set({ messages: [...get().messages, newMessage] });
  },
  
  toggleCollapsed: () => {
    set({ isCollapsed: !get().isCollapsed });
  },
  
  setLoading: (isLoading) => {
    set({ isLoading });
  },
  
  clearMessages: () => {
    set({ messages: [] });
  },
})); 