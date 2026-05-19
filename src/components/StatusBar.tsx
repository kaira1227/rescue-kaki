import { useEffect, useState } from 'react';
import { WifiOff, Clock } from 'lucide-react';

export function StatusBar() {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateStr = currentTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="sticky top-0 z-50 h-12 bg-background border-b border-border flex items-center px-4 gap-4 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-base font-bold gradient-text tracking-wider">IGNIS</span>
        <span className="text-xs text-muted-foreground hidden md:inline uppercase tracking-wider">v2.0</span>
      </div>

      <div className="flex-1" />

      {/* Time */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-foreground font-mono tabular-nums">{timeStr}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{dateStr} UTC</span>
      </div>

      {/* Online/offline indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isOnline ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-xs text-accent hidden sm:inline font-medium">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline font-medium">Offline</span>
          </div>
        )}
      </div>
    </div>
  );
}
