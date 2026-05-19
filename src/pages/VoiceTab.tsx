import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Mic, Download, Trash2, AlertTriangle, FileJson, FileSpreadsheet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RecordButton } from '@/components/RecordButton';
import { SearchBar } from '@/components/SearchBar';
import { VoiceEntryCard } from '@/components/VoiceEntryCard';
import { MapPicker } from '@/components/MapPicker';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useLLMSummarize } from '@/hooks/use-llm-summarize';
import {
  fetchEntries, insertEntry, updateEntry, deleteEntry,
  fetchSchematicSettings, pinEntryOnSchematic,
} from '@/services/entries';
import { Entry, RecordingState } from '@/types';
import { exportEntries } from '@/lib/export';

export default function VoiceTab() {
  const { isSupported, transcript, interimTranscript, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();
  const { summarize } = useLLMSummarize();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [showLocationHint, setShowLocationHint] = useState(false);
  const [loading, setLoading] = useState(true);
  // Pin on schematic
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [schematicImageUrl, setSchematicImageUrl] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const [data, s] = await Promise.all([fetchEntries('voice'), fetchSchematicSettings()]);
      setEntries(data);
      setSchematicImageUrl(s?.image_url ?? null);
    } catch (err) {
      console.error('Failed to load voice entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    if (!isSupported) {
      toast.error('Speech recognition not supported. Use Chrome or Edge for full functionality.');
    }
  }, [loadEntries, isSupported]);

  const handleToggleRecording = async () => {
    if (recordingState === 'idle') {
      if (!isSupported) { toast.error('Speech recognition not supported.'); return; }
      resetTranscript();
      setRecordingState('recording');
      startListening();
    } else if (recordingState === 'recording') {
      stopListening();
      setRecordingState('processing');
      await new Promise((r) => setTimeout(r, 400));
      const finalTranscript = transcript || '';
      const utcTimestamp = new Date().toISOString();
      try {
        const summary = await summarize(finalTranscript);
        const id = await insertEntry({
          module_type: 'voice',
          timestamp: utcTimestamp,
          summary,
          transcription: finalTranscript,
          location_tag: locationInput.trim() || null,
        });
        toast.success('Voice entry logged');
        setLocationInput('');
        await loadEntries();
        // Offer to pin on schematic
        setPendingEntryId(id);
        setPinDialogOpen(true);
      } catch (err) {
        console.error('Failed to save voice entry:', err);
        toast.error('Failed to save entry. Please try again.');
      } finally {
        resetTranscript();
        setRecordingState('idle');
      }
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Entry>) => {
    try {
      await updateEntry(id, updates);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates, is_edited: true } : e)));
    } catch { toast.error('Failed to update entry.'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete entry.'); }
  };

  const handleClearAll = async () => {
    try {
      await Promise.all(entries.map((e) => deleteEntry(e.id)));
      setEntries([]);
    } catch { toast.error('Failed to clear entries.'); }
  };

  const handlePinConfirm = async (nx: number, ny: number) => {
    if (!pendingEntryId) return;
    try {
      await pinEntryOnSchematic(pendingEntryId, nx, ny);
      setEntries((prev) => prev.map((e) => e.id === pendingEntryId ? { ...e, schematic_x: nx, schematic_y: ny } : e));
      toast.success('Entry pinned on schematic.');
    } catch { toast.error('Failed to pin entry.'); }
    setPinDialogOpen(false);
    setPendingEntryId(null);
  };

  const handlePinSkip = () => {
    setPinDialogOpen(false);
    setPendingEntryId(null);
  };

  const filtered = searchQuery.trim()
    ? entries.filter(
        (e) =>
          e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.transcription ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.location_tag ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  const handleExport = (format: 'json' | 'csv') => {
    if (!entries.length) { toast.error('No entries to export.'); return; }
    exportEntries(entries, format);
    toast.success(`Exported ${entries.length} entries as ${format.toUpperCase()}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Recording panel */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 py-5 flex flex-col items-center gap-4">
          <RecordButton state={recordingState} onToggle={handleToggleRecording} />

          {/* Live transcript */}
          {recordingState === 'recording' && (
            <div className="w-full bg-card border border-primary/30 rounded p-3 min-h-14">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Live Transcription</p>
              <p className="text-sm text-foreground leading-relaxed">
                {transcript || interimTranscript || (
                  <span className="text-muted-foreground italic animate-pulse">Listening...</span>
                )}
                {interimTranscript && transcript && (
                  <span className="text-muted-foreground"> {interimTranscript}</span>
                )}
              </p>
            </div>
          )}

          {/* Location tag */}
          <div className="w-full">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Location / Context tag (optional) — e.g. Sector A"
                disabled={recordingState === 'processing'}
                className="flex-1 h-10 bg-input border border-border rounded text-sm text-foreground placeholder:text-muted-foreground px-3 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50"
              />
              <button type="button" onClick={() => setShowLocationHint((v) => !v)} className="text-muted-foreground hover:text-foreground shrink-0">
                <Info className="w-4 h-4" />
              </button>
            </div>
            {showLocationHint && (
              <p className="text-xs text-muted-foreground mt-1.5 px-1">
                Tag this recording with a sector or context. Supports future GPS integration.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="flex-1 min-w-0">
          <SearchBar value={searchQuery} onChange={setSearchQuery} resultCount={filtered.length} totalCount={entries.length} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="border border-border text-muted-foreground hover:text-foreground h-11 gap-1.5 shrink-0" disabled={!entries.length}>
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
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
        {entries.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="border border-border text-muted-foreground hover:text-destructive h-11 shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                  <AlertTriangle className="w-5 h-5 text-destructive" /> Clear All Voice Entries?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This will permanently delete all {entries.length} voice entries.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border text-muted-foreground hover:text-foreground bg-transparent">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center">
              <Mic className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No voice entries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Tap the record button above to log a command.</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-2 text-center">
            <p className="text-sm text-muted-foreground">No entries match <span className="text-foreground font-medium">"{searchQuery}"</span></p>
            <button type="button" onClick={() => setSearchQuery('')} className="text-xs text-primary hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground shrink-0 uppercase tracking-wider">
                {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {filtered.map((entry) => (
              <VoiceEntryCard key={entry.id} entry={entry} onUpdate={handleUpdate} onDelete={handleDelete} searchQuery={searchQuery} />
            ))}
          </div>
        )}
      </div>

      {/* Pin on Schematic dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(o) => { if (!o) handlePinSkip(); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm">📍 Pin on Schematic</DialogTitle>
          </DialogHeader>
          <MapPicker
            imageUrl={schematicImageUrl}
            onConfirm={handlePinConfirm}
            onSkip={handlePinSkip}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
