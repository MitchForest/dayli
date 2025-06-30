"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function TestDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div>
      <h3 className="mb-4">Radix UI Dropdown Test:</h3>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Click Me</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>First Item</DropdownMenuItem>
          <DropdownMenuItem>Second Item</DropdownMenuItem>
          <DropdownMenuItem>Third Item</DropdownMenuItem>
          <DropdownMenuItem>Fourth Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <div className="mt-8">
        <h3 className="mb-4">Custom Dropdown Test:</h3>
        <div className="relative">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(!isOpen)}
          >
            Custom Dropdown
          </Button>
          {isOpen && (
            <div className="absolute top-full mt-2 w-56 bg-white dark:bg-gray-800 border rounded-md shadow-lg z-50">
              <div className="p-2">
                <button 
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => {
                    console.log('First clicked')
                    setIsOpen(false)
                  }}
                >
                  First Item
                </button>
                <button 
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => {
                    console.log('Second clicked')
                    setIsOpen(false)
                  }}
                >
                  Second Item
                </button>
                <button 
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => {
                    console.log('Third clicked')
                    setIsOpen(false)
                  }}
                >
                  Third Item
                </button>
                <button 
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  onClick={() => {
                    console.log('Fourth clicked')
                    setIsOpen(false)
                  }}
                >
                  Fourth Item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8">
        <h3 className="mb-4">Plain HTML Test:</h3>
        <details>
          <summary className="cursor-pointer">Click to expand</summary>
          <div className="border p-4 mt-2">
            <div>First Item</div>
            <div>Second Item</div>
            <div>Third Item</div>
            <div>Fourth Item</div>
          </div>
        </details>
      </div>
    </div>
  )
} 