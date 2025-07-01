'use client';

import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DailyTask } from '../types/schedule.types';

interface TaskSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTasks: (tasks: DailyTask[]) => void;
  blockCapacity: number;
  currentTaskCount: number;
}

// Mock backlog tasks
const MOCK_BACKLOG_TASKS: DailyTask[] = [
  { id: 'b1', title: 'Review Q1 OKRs and update team goals', completed: false },
  { id: 'b2', title: 'Prepare board presentation for next week', completed: false, source: 'email' },
  { id: 'b3', title: 'Code review for PR #234', completed: false },
  { id: 'b4', title: 'Fix production bug in auth flow', completed: false },
  { id: 'b5', title: 'Reply to Sarah about project timeline', completed: false, source: 'email' },
  { id: 'b6', title: 'Research competitor pricing strategies', completed: false },
  { id: 'b7', title: 'Update team documentation wiki', completed: false },
  { id: 'b8', title: 'Schedule 1:1 with new team member', completed: false },
  { id: 'b9', title: 'Complete annual security training', completed: false, source: 'email' },
  { id: 'b10', title: 'Analyze user feedback from last release', completed: false },
];

export function TaskSelectorModal({
  isOpen,
  onClose,
  onSelectTasks,
  blockCapacity,
  currentTaskCount,
}: TaskSelectorModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const availableSlots = blockCapacity - currentTaskCount;
  
  useEffect(() => {
    if (!isOpen) {
      setSelectedTasks([]);
      setSearchQuery('');
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const filteredTasks = MOCK_BACKLOG_TASKS.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleToggleTask = (taskId: string) => {
    if (selectedTasks.includes(taskId)) {
      setSelectedTasks(selectedTasks.filter(id => id !== taskId));
    } else if (selectedTasks.length < availableSlots) {
      setSelectedTasks([...selectedTasks, taskId]);
    }
  };
  
  const handleAddSelected = () => {
    const tasksToAdd = MOCK_BACKLOG_TASKS.filter(task => 
      selectedTasks.includes(task.id)
    );
    onSelectTasks(tasksToAdd);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl border w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Add Tasks from Backlog</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select up to {availableSlots} task{availableSlots !== 1 ? 's' : ''} to add to this block
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const isSelected = selectedTasks.includes(task.id);
              const isDisabled = !isSelected && selectedTasks.length >= availableSlots;
              
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    isSelected && "bg-primary/10 border-primary",
                    isDisabled && "opacity-50 cursor-not-allowed",
                    !isSelected && !isDisabled && "hover:bg-accent/50"
                  )}
                  onClick={() => !isDisabled && handleToggleTask(task.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => {}}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Source: {task.source || 'manual'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedTasks.length} of {availableSlots} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddSelected}
              disabled={selectedTasks.length === 0}
            >
              Add Selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 