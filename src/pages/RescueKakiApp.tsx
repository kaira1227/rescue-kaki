import { useState, Suspense, lazy } from 'react';
import { StatusBar } from '@/components/StatusBar';
import { BottomNav } from '@/components/BottomNav';
import { TabId } from '@/types';

const VoiceTab    = lazy(() => import('./VoiceTab'));
const MapTab      = lazy(() => import('./MapTab'));
const LogTab      = lazy(() => import('./LogTab'));
const TimelineTab = lazy(() => import('./TimelineTab'));

const TAB_TITLES: Record<TabId, string> = {
  voice:    'Voice Log',
  map:      'GPS & Map',
  log:      'Structured Log',
  timeline: 'Unified Timeline',
};

function TabFallback() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm animate-pulse">
      Loading module...
    </div>
  );
}

export default function RescueKakiApp() {
  const [activeTab, setActiveTab] = useState<TabId>('voice');

  return (
    <div className="flex flex-col w-full h-full bg-background overflow-x-hidden">
      {/* Top status bar */}
      <StatusBar />

      {/* Tab heading */}
      <div className="px-4 py-2 border-b border-border flex items-center shrink-0">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Module {activeTab === 'voice' ? 'A' : activeTab === 'map' ? 'B' : activeTab === 'log' ? 'C' : '✦'} — {TAB_TITLES[activeTab]}
        </h1>
      </div>

      {/* Tab content area — above bottom nav */}
      <div className="flex-1 min-h-0 overflow-hidden pb-16">
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'voice'    && <VoiceTab />}
            {activeTab === 'map'      && <MapTab />}
            {activeTab === 'log'      && <LogTab />}
            {activeTab === 'timeline' && <TimelineTab />}
          </Suspense>
        </div>
      </div>

      {/* Bottom navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
