import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, MapPin, Edit2, Save, X, Trash2, Image } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MapPicker } from '@/components/MapPicker';
import { Entry } from '@/types';
import {
  fetchEntries, insertEntry, updateEntry, deleteEntry, uploadPhoto,
  fetchSchematicSettings, pinEntryOnSchematic,
} from '@/services/entries';

export default function CameraTab() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingGeo, setPendingGeo] = useState<{ lat: number; lon: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Pin on schematic
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [schematicImageUrl, setSchematicImageUrl] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const [data, s] = await Promise.all([fetchEntries('photo'), fetchSchematicSettings()]);
      setEntries(data);
      setSchematicImageUrl(s?.image_url ?? null);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const getGeo = (): Promise<{ lat: number; lon: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 10000 }
      );
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only image files are supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Maximum 10 MB.'); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setPendingFile(file);
    const geo = await getGeo();
    setPendingGeo(geo);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const photoUrl = await uploadPhoto(pendingFile);
      const id = await insertEntry({
        module_type: 'photo',
        timestamp: new Date().toISOString(),
        summary: caption.trim() || 'Photo captured',
        photo_url: photoUrl,
        photo_caption: caption.trim() || null,
        latitude: pendingGeo?.lat ?? null,
        longitude: pendingGeo?.lon ?? null,
      });
      toast.success('Photo entry logged');
      setPreview(null);
      setPendingFile(null);
      setCaption('');
      setPendingGeo(null);
      await loadEntries();
      // Offer to pin on schematic
      setPendingEntryId(id);
      setPinDialogOpen(true);
    } catch (err) {
      console.error('Photo save error:', err);
      toast.error('Failed to save photo. Check your connection.');
    } finally { setUploading(false); }
  };

  const handleDiscard = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPendingFile(null);
    setCaption('');
    setPendingGeo(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Photo entry deleted');
    } catch { toast.error('Failed to delete entry.'); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Capture area */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 py-5 flex flex-col items-center gap-4">
          {!preview ? (
            <div
              className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              role="button" tabIndex={0}
              aria-label="Capture or upload photo"
            >
              <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
                <Camera className="w-7 h-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Capture Photo</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tap to open camera or select from files</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="w-3.5 h-3.5" /><span>Camera</span>
                <span>·</span>
                <Upload className="w-3.5 h-3.5" /><span>Gallery</span>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Preview */}
              <div className="relative w-full aspect-video bg-muted rounded overflow-hidden">
                <img src={preview} alt="Captured preview" className="w-full h-full object-contain" />
              </div>
              {/* Geo indicator */}
              {pendingGeo && (
                <div className="flex items-center gap-1.5 text-xs text-accent">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{pendingGeo.lat.toFixed(5)}, {pendingGeo.lon.toFixed(5)}</span>
                </div>
              )}
              {!pendingGeo && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> No GPS available
                </p>
              )}
              {/* Caption */}
              <Input
                placeholder="Add annotation / caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={uploading} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-11 gap-1.5">
                  {uploading ? 'Saving...' : <><Save className="w-4 h-4" />Save Photo</>}
                </Button>
                <Button onClick={handleDiscard} variant="ghost" className="border border-border text-muted-foreground hover:text-foreground h-11">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Photo log */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading photos...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center">
              <Image className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No photos yet</p>
              <p className="text-xs text-muted-foreground mt-1">Capture a photo to document the scene.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {entries.map((entry) => (
              <PhotoCard key={entry.id} entry={entry} onUpdate={async (id, updates) => {
                try {
                  await updateEntry(id, updates);
                  setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates, is_edited: true } : e)));
                } catch { toast.error('Failed to update.'); }
              }} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Pin on Schematic dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(o) => { if (!o) { setPinDialogOpen(false); setPendingEntryId(null); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm">📍 Pin on Schematic</DialogTitle>
          </DialogHeader>
          <MapPicker
            imageUrl={schematicImageUrl}
            onConfirm={async (nx, ny) => {
              if (!pendingEntryId) return;
              try {
                await pinEntryOnSchematic(pendingEntryId, nx, ny);
                setEntries((prev) => prev.map((e) => e.id === pendingEntryId ? { ...e, schematic_x: nx, schematic_y: ny } : e));
                toast.success('Photo pinned on schematic.');
              } catch { toast.error('Failed to pin entry.'); }
              setPinDialogOpen(false);
              setPendingEntryId(null);
            }}
            onSkip={() => { setPinDialogOpen(false); setPendingEntryId(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoCard({ entry, onUpdate, onDelete }: {
  entry: Entry;
  onUpdate: (id: string, updates: Partial<Entry>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(entry.photo_caption ?? '');
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="bg-card border border-border rounded shadow-[0_2px_8px_rgba(0,0,0,0.4)] overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail */}
        {entry.photo_url && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="shrink-0 w-16 h-16 rounded overflow-hidden border border-border">
            <img src={entry.photo_url} alt={entry.photo_caption ?? 'Photo'} className="w-full h-full object-cover" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-muted-foreground font-mono">{time}</span>
          {editing ? (
            <Input value={editCaption} onChange={(e) => setEditCaption(e.target.value)} className="mt-1 text-sm bg-input border-primary/60 text-foreground h-8 px-2" placeholder="Caption..." />
          ) : (
            <p className="text-sm text-foreground mt-0.5 text-pretty">{entry.photo_caption || <span className="text-muted-foreground italic">No caption</span>}</p>
          )}
          {entry.latitude && entry.longitude && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}><Edit2 className="w-3.5 h-3.5" /></Button>}
          {!editing && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(entry.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
        </div>
      </div>

      {expanded && entry.photo_url && (
        <div className="px-3 pb-3">
          <img src={entry.photo_url} alt={entry.photo_caption ?? 'Full photo'} className="w-full rounded object-contain max-h-80" />
        </div>
      )}

      {editing && (
        <div className="px-3 pb-3 flex gap-2">
          <Button onClick={() => { onUpdate(entry.id, { photo_caption: editCaption.trim() || null, summary: editCaption.trim() || 'Photo captured' }); setEditing(false); }} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-1.5">
            <Save className="w-3.5 h-3.5" />Save
          </Button>
          <Button onClick={() => { setEditCaption(entry.photo_caption ?? ''); setEditing(false); }} size="sm" variant="ghost" className="border border-border text-muted-foreground h-9 gap-1.5">
            <X className="w-3.5 h-3.5" />Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
