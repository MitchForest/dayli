import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBlockContextMenu } from '../../hooks/useBlockContextMenu';

interface BlockContextMenuProps {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
  color?: string;
}

export function BlockContextMenu({ 
  id, 
  title, 
  type, 
  startTime, 
  endTime,
  color = 'blue'
}: BlockContextMenuProps) {
  const { handleAddToChat, handleEdit, handleDelete } = useBlockContextMenu({
    id,
    title,
    type,
    startTime,
    endTime,
  });
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-${color}-600/20`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={14} className={`text-${color}-700`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleAddToChat}>
          <span className="text-sm">Add to AI chat</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit}>
          <span className="text-sm">Edit block</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleDelete}
          className="text-red-600"
        >
          <span className="text-sm">Delete block</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 