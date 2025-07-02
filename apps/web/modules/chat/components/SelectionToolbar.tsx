'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Copy, CheckSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectionToolbarProps {
  selectedText: string;
  onCopy: () => void;
  onCreateTask: () => void;
  onDismiss: () => void;
}

export function SelectionToolbar({
  selectedText,
  onCopy,
  onCreateTask,
  onDismiss
}: SelectionToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Calculate position based on selection
  useEffect(() => {
    if (!selectedText) {
      setIsVisible(false);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position above the selection
    const top = rect.top + window.scrollY - 40; // 40px above selection
    const left = rect.left + window.scrollX + (rect.width / 2); // Center horizontally

    setPosition({ top, left });
    setIsVisible(true);
    setCopied(false);
  }, [selectedText]);

  // Handle clicks outside toolbar
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        // Check if the click is on a selection
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
          onDismiss();
        }
      }
    };

    // Add slight delay to prevent immediate dismissal
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onDismiss]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopied(true);
      onCopy();
      
      // Auto-dismiss after copy
      setTimeout(() => {
        onDismiss();
      }, 1500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [selectedText, onCopy, onDismiss]);

  const handleCreateTask = useCallback(() => {
    onCreateTask();
    onDismiss();
  }, [onCreateTask, onDismiss]);

  if (!isVisible || !selectedText) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className={cn(
        'fixed z-50 flex items-center gap-1 p-1',
        'bg-popover border border-border rounded-md shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)'
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-8 px-2 text-xs"
      >
        {copied ? (
          <>
            <CheckSquare className="h-3 w-3 mr-1 text-green-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </>
        )}
      </Button>
      
      <div className="w-px h-5 bg-border" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCreateTask}
        className="h-8 px-2 text-xs"
      >
        <CheckSquare className="h-3 w-3 mr-1" />
        Create Task
      </Button>
      
      <div className="w-px h-5 bg-border" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="h-8 w-8 p-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>,
    document.body
  );
}

// Hook to manage text selection
export function useTextSelection() {
  const [selectedText, setSelectedText] = useState('');
  const [selectionParent, setSelectionParent] = useState<Element | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedText('');
        setSelectionParent(null);
        return;
      }

      const text = selection.toString().trim();
      if (text) {
        // Check if selection is within a message content area
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE 
          ? container.parentElement 
          : container as Element;
        
        // Only show toolbar for assistant messages
        const messageContent = element?.closest('.message-content');
        const isAssistantMessage = element?.closest('[data-role="assistant"]');
        
        if (messageContent && isAssistantMessage) {
          setSelectedText(text);
          setSelectionParent(messageContent);
        } else {
          setSelectedText('');
          setSelectionParent(null);
        }
      } else {
        setSelectedText('');
        setSelectionParent(null);
      }
    };

    // Use selectionchange event for better support
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Also listen to mouseup for immediate response
    document.addEventListener('mouseup', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
    };
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelectedText('');
    setSelectionParent(null);
  }, []);

  return {
    selectedText,
    selectionParent,
    clearSelection
  };
}

export default SelectionToolbar; 