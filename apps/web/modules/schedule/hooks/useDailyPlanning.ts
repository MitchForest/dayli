import { useState } from 'react';

export function useDailyPlanning() {
  const [isPlanning, setIsPlanning] = useState(false);
  
  const triggerDailyPlanning = async () => {
    setIsPlanning(true);

    try {
      const response = await fetch('/api/workflows/daily-planning', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate schedule');
      }
      
      // Return the result so the caller can handle it
      return data;
    } catch (error) {
      console.error('Daily planning error:', error);
      throw error;
    } finally {
      setIsPlanning(false);
    }
  };

  return { triggerDailyPlanning, isPlanning };
} 