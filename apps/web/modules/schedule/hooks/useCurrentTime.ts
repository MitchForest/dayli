import { useEffect, useState } from 'react';
import { getCurrentTimeGridRow, isWithinWorkHours } from '../utils/timeGrid';

interface CurrentTimeState {
  time: Date;
  gridRow: number;
  isWithinWorkHours: boolean;
}

export function useCurrentTime(): CurrentTimeState {
  const [currentTime, setCurrentTime] = useState<CurrentTimeState>(() => {
    const now = new Date();
    return {
      time: now,
      gridRow: getCurrentTimeGridRow(),
      isWithinWorkHours: isWithinWorkHours(now),
    };
  });

  useEffect(() => {
    // Update immediately
    const updateTime = () => {
      const now = new Date();
      setCurrentTime({
        time: now,
        gridRow: getCurrentTimeGridRow(),
        isWithinWorkHours: isWithinWorkHours(now),
      });
    };

    // Calculate milliseconds until next minute
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    // Set timeout to sync with the minute boundary
    const timeout = setTimeout(() => {
      updateTime();
      
      // Then update every minute
      const interval = setInterval(updateTime, 60 * 1000);
      
      // Cleanup function
      return () => clearInterval(interval);
    }, msUntilNextMinute);

    // Cleanup timeout if component unmounts before first update
    return () => clearTimeout(timeout);
  }, []);

  return currentTime;
} 