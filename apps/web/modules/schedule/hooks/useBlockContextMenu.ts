import { useCallback } from 'react';
import { useChatStore } from '@/modules/chat/store/chatStore';

interface BlockContextMenuOptions {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
}

export function useBlockContextMenu({ id, title, type, startTime, endTime }: BlockContextMenuOptions) {
  const addToHistory = useChatStore(state => state.addToHistory);
  
  const handleAddToChat = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers
    
    // Create a natural language reference to the block
    let blockReference = '';
    switch (type) {
      case 'work':
        blockReference = `Work on "${title}" from ${startTime} to ${endTime}`;
        break;
      case 'meeting':
        blockReference = `Meeting "${title}" from ${startTime} to ${endTime}`;
        break;
      case 'email':
        blockReference = `Email block "${title}" from ${startTime} to ${endTime}`;
        break;
      case 'break':
        blockReference = `Break "${title}" from ${startTime} to ${endTime}`;
        break;
      case 'blocked':
        blockReference = `Blocked time "${title}" from ${startTime} to ${endTime}`;
        break;
      default:
        blockReference = `"${title}" from ${startTime} to ${endTime}`;
    }
    
    addToHistory(blockReference);
    // Could also show a toast notification here
  }, [id, title, type, startTime, endTime, addToHistory]);
  
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement edit functionality
    console.log('Edit block:', id);
  }, [id]);
  
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete functionality
    console.log('Delete block:', id);
  }, [id]);
  
  return {
    handleAddToChat,
    handleEdit,
    handleDelete,
  };
} 