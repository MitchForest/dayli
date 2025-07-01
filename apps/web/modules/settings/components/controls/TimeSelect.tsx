'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface TimeSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  step?: number // minutes
  className?: string
  id?: string
}

export function TimeSelect({ 
  label, 
  value, 
  onChange, 
  step = 15,
  className = '',
  id
}: TimeSelectProps) {
  // Generate time options based on step
  const generateTimeOptions = () => {
    const options = []
    const totalMinutes = 24 * 60
    
    for (let minutes = 0; minutes < totalMinutes; minutes += step) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      options.push(time)
    }
    
    return options
  }

  const timeOptions = generateTimeOptions()

  // Format time for display (e.g., "08:00" -> "8:00 AM")
  const formatTimeDisplay = (time: string) => {
    const parts = time.split(':')
    if (parts.length !== 2) return time
    
    const hours = Number(parts[0])
    const minutes = Number(parts[1])
    
    if (isNaN(hours) || isNaN(minutes)) return time
    
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{formatTimeDisplay(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {timeOptions.map((time) => (
            <SelectItem key={time} value={time}>
              {formatTimeDisplay(time)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
} 