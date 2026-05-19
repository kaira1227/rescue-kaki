import { useState, useEffect, useCallback } from 'react';
import { Clock, Download, Search, Filter, FileJson, FileSpreadsheet, Mic, Camera, Map, ClipboardList, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Entry, ModuleType } from '@/types';
import { fetchEntries } from '@/services/entries';
import { exportEntries } from '@/lib/export';

const MODULE_META: Record<ModuleType, { label: string; Icon: React.ElementType; className: string }> = {
  voice:  { label: 'Voice',  Icon: Mic,           className: 'module-voice'  },
  photo:  { label: 'Photo',  Icon: Camera,         className: 'module-photo'  },
  gps:    { label: 'GPS',    Icon: Map,            className: 'module-gps'    },
  manual: { label: 'Log',    Icon: ClipboardList,  className: 'module-manual' },
};

export default function TimelineTab() {
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEntries();
      setAllEntries(data);
    } catch { toast.error('Failed to load timeline.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const clearFilters = () => { setStartTime(''); setEndTime(''); setSearchQuery(''); };

  const filtered = allEntries.filter((e) => {
    const ts = new Date(e.timestamp).getTime();
    if (startTime && ts < new Date(startTime).getTime()) return false;
    if (endTime && ts > new Date(endTime).getTime()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        e.summary,
        e.transcription ?? '',
        e.photo_caption ?? '',
        e.zone_label ?? '',
        e.location_tag ?? '',
        e.template_type ?? '',
        e.form_data ? JSON.stringify(e.form_data) : '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters = !!(searchQuery || startTime || endTime);

  const handleExport = (format: 'json' | 'csv') => {
    if (!filtered.length) { toast.error('No entries to export.'); return; }
    exportEntries(filtered, format);
    toast.success(`Exported ${filtered.length} entries as ${format.toUpperCase()}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all entries..."
              className="w-full h-10 bg-input border border-border rounded text-sm text-foreground placeholder:text-muted-foreground pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
            {searchQuery && (
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery('')}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`border h-10 gap-1.5 shrink-0 ${hasActiveFilters ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="w-4 h-4" />
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="border border-border text-muted-foreground hover:text-foreground h-10 gap-1.5 shrink-0" disabled={!filtered.length}>
                <Download className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem onClick={() => handleExport('json')} className="text-foreground hover:bg-muted gap-2 cursor-pointer">
                <FileJson className="w-4 h-4 text-accent" /> Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')} className="text-foreground hover:bg-muted gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-accent" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Time filter */}
        {showFilters && (
          <div className="space-y-2 pt-1 pb-0.5">
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 space-y-0.5">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-input border-border text-foreground h-9 text-sm focus-visible:ring-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-input border-border text-foreground h-9 text-sm focus-visible:ring-primary" />
              </div>
            </div>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-xs text-primary hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">{filtered.length}</span> of {allEntries.length} entries
        <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
          {(Object.entries(MODULE_META) as [ModuleType, typeof MODULE_META[ModuleType]][]).map(([type, meta]) => {
            const count = allEntries.filter((e) => e.module_type === type).length;
            if (!count) return null;
            return (
              <span key={type} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${meta.className}`}>
                <meta.Icon className="w-3 h-3" />{count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading timeline...</div>
        ) : allEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No entries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start recording across any module to build your timeline.</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-2 text-center">
            <p className="text-sm text-muted-foreground">No entries match your filters.</p>
            <button type="button" onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="relative flex flex-col gap-0 pb-4">
            {/* Timeline vertical line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-border" />

            {filtered.map((entry, idx) => (
              <TimelineEntry key={entry.id} entry={entry} isFirst={idx === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineEntry({ entry, isFirst }: { entry: Entry; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const meta = MODULE_META[entry.module_type];
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = new Date(entry.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  return (
    <div className={`relative flex items-start gap-3 py-3 ${!isFirst ? 'border-t border-border/30' : ''} pl-12`}>
      {/* Module icon on the timeline */}
      <div className={`absolute left-[10px] top-4 w-5 h-5 rounded-full flex items-center justify-center border ${meta.className} z-10 bg-background`}>
        <meta.Icon className="w-3 h-3" />
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setExpanded((v) => !v); }}>
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <Badge className={`border text-[10px] py-0 h-4 px-1.5 ${meta.className}`}>{meta.label}</Badge>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{date} {time}</span>
          {entry.schematic_x != null && entry.schematic_y != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium" title="Pinned on schematic">
              <MapPin className="w-2.5 h-2.5" /> Pinned
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-foreground text-balance leading-snug">{entry.summary}</p>

        {/* Quick preview */}
        {entry.module_type === 'photo' && entry.photo_url && !expanded && (
          <div className="mt-1.5 w-12 h-12 rounded overflow-hidden border border-border">
            <img src={entry.photo_url} alt={entry.photo_caption ?? 'Photo'} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-2 space-y-1.5 text-xs text-foreground/80">
            {entry.transcription && (
              <p className="text-pretty leading-relaxed">{entry.transcription}</p>
            )}
            {entry.photo_url && (
              <img src={entry.photo_url} alt={entry.photo_caption ?? 'Photo'} className="w-full rounded max-h-48 object-contain border border-border" />
            )}
            {entry.latitude && entry.longitude && (
              <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" />{entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}</p>
            )}
            {entry.form_data && (
              <div className="space-y-0.5 border border-border/50 rounded p-2">
                {Object.entries(entry.form_data).map(([k, v]) =>
                  v !== null && v !== '' ? (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground capitalize w-28 shrink-0">{k.replace(/_/g, ' ')}:</span>
                      <span>{String(v)}</span>
                    </div>
                  ) : null
                )}
              </div>
            )}
            {entry.location_tag && (
              <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" />{entry.location_tag}</p>
            )}
            {entry.schematic_x != null && entry.schematic_y != null && (
              <p className="flex items-center gap-1 text-primary font-mono">
                <MapPin className="w-3 h-3" /> Schematic ({entry.schematic_x.toFixed(3)}, {entry.schematic_y.toFixed(3)})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
