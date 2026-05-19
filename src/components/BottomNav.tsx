import { Mic, Map, ClipboardList, Clock } from 'lucide-react';
import { TabId } from '@/types';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'voice',    label: 'Voice',    Icon: Mic },
  { id: 'map',      label: 'Map',      Icon: Map },
  { id: 'log',      label: 'Log',      Icon: ClipboardList },
  { id: 'timeline', label: 'Timeline', Icon: Clock },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-16 flex items-stretch">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-0 transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              isActive
                ? 'text-primary border-t-2 border-primary bg-primary/5'
                : 'text-muted-foreground border-t-2 border-transparent hover:text-foreground',
            ].join(' ')}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[10px] tracking-wide font-medium ${isActive ? 'text-primary' : ''}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
