import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, ZoomIn, ZoomOut, Layers, Settings, MapPin, Navigation,
  Shield, ChevronDown, ChevronUp, RotateCcw, X, Check,
  Crosshair, Eye, EyeOff, PanelRightOpen, PanelRightClose,
  Mic, Camera, ClipboardList, Clock, ImagePlus, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SchematicCanvas, SchematicCanvasHandle } from '@/components/SchematicCanvas';
import {
  Entry, Geofence, SchematicSettings, CalibrationData,
} from '@/types';
import {
  fetchEntries,
  fetchGeofences,
  insertGeofence,
  deleteGeofence,
  fetchSchematicSettings,
  upsertSchematicSettings,
  uploadSchematic,
  uploadPhoto,
  attachPhotoToEntry,
} from '@/services/entries';

// ─── Geofence zone types + palette ───────────────────────────────────────────
const ZONE_TYPES = [
  { id: 'hot',      label: 'Hot Zone',       color: '#ef4444' },
  { id: 'warm',     label: 'Warm Zone',      color: '#f97316' },
  { id: 'cold',     label: 'Cold Zone',      color: '#3b82f6' },
  { id: 'safe',     label: 'Safe Zone',      color: '#22c55e' },
  { id: 'restrict', label: 'Restricted',     color: '#a855f7' },
  { id: 'general',  label: 'General',        color: '#64748b' },
];

const MODULE_COLORS: Record<string, string> = {
  voice:  '#f97316',
  photo:  '#22c55e',
  gps:    '#3b82f6',
  manual: '#a855f7',
};

type MapMode = 'view' | 'addPin' | 'addGeofence' | 'calibrate';

export default function MapTab() {
  // ── Data state ─────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<SchematicSettings | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [gpsBreadcrumb, setGpsBreadcrumb] = useState<Array<{ x: number; y: number }>>([]);
  const [loading, setLoading] = useState(true);

  // ── Canvas ref for imperative zoom/pan ────────────────────────────────────
  const canvasRef = useRef<SchematicCanvasHandle>(null);

  // ── Map interaction mode ──────────────────────────────────────────────────
  const [mode, setMode] = useState<MapMode>('view');

  // ── Layer visibility toggles ──────────────────────────────────────────────
  const [showPins, setShowPins] = useState(true);
  const [showGps, setShowGps] = useState(true);
  const [showFences, setShowFences] = useState(true);

  // ── Selected pin (detail card) ────────────────────────────────────────────
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  // ── Mini timeline ─────────────────────────────────────────────────────────
  const [miniTimelineOpen, setMiniTimelineOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<string>('all');

  // ── Geofence drawing state ────────────────────────────────────────────────
  const [geofenceCenter, setGeofenceCenter] = useState<{ nx: number; ny: number } | null>(null);
  const [geofenceLabel, setGeofenceLabel] = useState('');
  const [geofenceZoneType, setGeofenceZoneType] = useState(ZONE_TYPES[0].id);
  const [geofenceRadius, setGeofenceRadius] = useState(0.06);
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);

  // ── Calibration state ────────────────────────────────────────────────────
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [calibrationPoints, setCalibrationPoints] = useState<Partial<CalibrationData['points']>>([]);
  const [calibPoint, setCalibPoint] = useState<{ schematic_x: number; schematic_y: number } | null>(null);
  const [calibGpsLat, setCalibGpsLat] = useState('');
  const [calibGpsLng, setCalibGpsLng] = useState('');
  const [showCalibModal, setShowCalibModal] = useState(false);

  // ── Settings sheet state ──────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── GPS tracking ──────────────────────────────────────────────────────────
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);

  // ── Photo attachment state ────────────────────────────────────────────────
  const [attachingPhoto, setAttachingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ─── Photo attachment handler ───────────────────────────────────────────
  const handleAttachPhoto = async (file: File, entry: Entry) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, or WebP images supported.'); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20 MB limit.'); return;
    }
    setAttachingPhoto(true);
    try {
      const url = await uploadPhoto(file);
      await attachPhotoToEntry(entry.id, url, photoCaption || undefined);
      toast.success('Photo attached to entry.');
      setPhotoCaption('');
      // Refresh entries so updated photo_url shows everywhere
      const updated = await fetchEntries();
      setEntries(updated);
      // Sync selectedEntry so detail dialog reflects new photo immediately
      const refreshed = updated.find((e) => e.id === entry.id) ?? null;
      setSelectedEntry(refreshed);
    } catch {
      toast.error('Failed to attach photo.');
    } finally {
      setAttachingPhoto(false);
    }
  };

  // ─── Load data ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, g] = await Promise.all([
        fetchSchematicSettings(),
        fetchEntries(),
        fetchGeofences(),
      ]);
      setSettings(s);
      setEntries(e);
      setGeofences(g);
    } catch { toast.error('Failed to load map data.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Schematic upload ───────────────────────────────────────────────────
  const handleSchematicUpload = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, or WebP images supported.'); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20 MB limit.'); return;
    }
    setUploading(true);
    try {
      const url = await uploadSchematic(file);
      const updated = await upsertSchematicSettings({
        id: settings?.id,
        image_url: url,
        calibration_data: settings?.calibration_data ?? null,
      });
      setSettings(updated);
      toast.success('Schematic uploaded successfully.');
    } catch { toast.error('Upload failed. Please try again.'); } finally { setUploading(false); }
  };

  // ─── Canvas click handler (mode-aware) ────────────────────────────────
  const handleCanvasClick = useCallback(async (nx: number, ny: number) => {
    if (mode === 'addGeofence') {
      setGeofenceCenter({ nx, ny });
      setShowGeofenceForm(true);
      setMode('view');
      return;
    }
    if (mode === 'calibrate') {
      setCalibPoint({ schematic_x: nx, schematic_y: ny });
      setShowCalibModal(true);
      setMode('view');
    }
  }, [mode]);

  // ─── Save geofence ─────────────────────────────────────────────────────
  const handleSaveGeofence = async () => {
    if (!geofenceCenter || !geofenceLabel.trim()) {
      toast.error('Please enter a zone label.'); return;
    }
    const zoneType = ZONE_TYPES.find((z) => z.id === geofenceZoneType) ?? ZONE_TYPES[0];
    try {
      const gf = await insertGeofence({
        label: geofenceLabel.trim(),
        zone_type: geofenceZoneType,
        center_x: geofenceCenter.nx,
        center_y: geofenceCenter.ny,
        radius: geofenceRadius,
        color: zoneType.color,
      });
      setGeofences((prev) => [...prev, gf]);
      toast.success(`Geofence "${gf.label}" added.`);
      setGeofenceLabel('');
      setGeofenceCenter(null);
      setShowGeofenceForm(false);
      setGeofenceRadius(0.06);
    } catch { toast.error('Failed to save geofence.'); }
  };

  const handleDeleteGeofence = async (id: string) => {
    try {
      await deleteGeofence(id);
      setGeofences((prev) => prev.filter((g) => g.id !== id));
      toast.success('Geofence removed.');
    } catch { toast.error('Failed to delete geofence.'); }
  };

  // ─── Calibration ───────────────────────────────────────────────────────
  const handleUseCurrentGps = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCalibGpsLat(pos.coords.latitude.toFixed(6));
        setCalibGpsLng(pos.coords.longitude.toFixed(6));
      },
      () => toast.error('Could not get GPS position.')
    );
  };

  const handleConfirmCalibPoint = async () => {
    if (!calibPoint || !calibGpsLat || !calibGpsLng) {
      toast.error('Enter GPS coordinates or use current position.'); return;
    }
    const newPoint = {
      schematic_x: calibPoint.schematic_x,
      schematic_y: calibPoint.schematic_y,
      gps_lat: parseFloat(calibGpsLat),
      gps_lng: parseFloat(calibGpsLng),
    };
    const nextPoints = [...(calibrationPoints as typeof newPoint[]), newPoint];
    if (nextPoints.length < 2) {
      setCalibrationPoints(nextPoints as Partial<CalibrationData['points']>);
      setCalibrationStep(1);
      setCalibPoint(null);
      setCalibGpsLat(''); setCalibGpsLng('');
      setShowCalibModal(false);
      setMode('calibrate');
      toast.success('Reference point 1 saved. Tap point 2 on the schematic.');
    } else {
      // Both points done — save calibration
      const calibData: CalibrationData = {
        points: [nextPoints[0], nextPoints[1]] as CalibrationData['points'],
      };
      try {
        const updated = await upsertSchematicSettings({
          id: settings?.id,
          image_url: settings?.image_url ?? '',
          calibration_data: calibData,
        });
        setSettings(updated);
        toast.success('GPS calibration saved! Breadcrumb trail will now plot on schematic.');
      } catch { toast.error('Failed to save calibration.'); }
      setCalibrationPoints([]);
      setCalibrationStep(0);
      setCalibPoint(null);
      setCalibGpsLat(''); setCalibGpsLng('');
      setShowCalibModal(false);
    }
  };

  const handleResetCalibration = async () => {
    if (!settings) return;
    try {
      const updated = await upsertSchematicSettings({
        id: settings.id,
        image_url: settings.image_url,
        calibration_data: null,
      });
      setSettings(updated);
      setGpsBreadcrumb([]);
      toast.success('Calibration reset.');
    } catch { toast.error('Failed to reset calibration.'); }
  };

  // ─── GPS tracking ──────────────────────────────────────────────────────
  const applyCalibration = useCallback((lat: number, lng: number): { x: number; y: number } | null => {
    const cal = settings?.calibration_data;
    if (!cal || cal.points.length < 2) return null;
    const [p1, p2] = cal.points;
    const dLat = p2.gps_lat - p1.gps_lat;
    const dLng = p2.gps_lng - p1.gps_lng;
    if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) return null;
    const tx = (lat - p1.gps_lat) / (dLat || 1e-9);
    const ty = (lng - p1.gps_lng) / (dLng || 1e-9);
    return {
      x: p1.schematic_x + tx * (p2.schematic_x - p1.schematic_x),
      y: p1.schematic_y + ty * (p2.schematic_y - p1.schematic_y),
    };
  }, [settings]);

  const toggleGpsTracking = () => {
    if (gpsActive && gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      setGpsWatchId(null);
      setGpsActive(false);
      toast.success('GPS tracking stopped.');
      return;
    }
    if (!navigator.geolocation) { toast.error('Geolocation not supported.'); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const mapped = applyCalibration(pos.coords.latitude, pos.coords.longitude);
        if (mapped) {
          setGpsBreadcrumb((prev) => [...prev.slice(-199), mapped]);
        }
      },
      () => toast.error('GPS position unavailable.'),
      { enableHighAccuracy: true }
    );
    setGpsWatchId(id);
    setGpsActive(true);
    toast.success('GPS tracking started.');
  };

  // Stop GPS on unmount
  useEffect(() => {
    return () => { if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId); };
  }, [gpsWatchId]);

  const pinnedEntries = entries.filter((e) => e.schematic_x != null && e.schematic_y != null);

  // ─── No schematic uploaded ─────────────────────────────────────────────
  if (!loading && !settings?.image_url) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-6 px-8 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
          <MapPin className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground text-balance">Upload Facility Schematic</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty max-w-xs">
            Upload a floor plan or site map (JPG/PNG, max 20 MB) to begin pinning events and tracking movement.
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-11"
          disabled={uploading}
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload Schematic'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSchematicUpload(f); e.target.value = ''; }}
        />
      </div>
    );
  }

  // ─── Module icon helper ──────────────────────────────────────────────────
  const ModuleIcon = ({ type }: { type: string }) => {
    const cls = 'w-3.5 h-3.5 shrink-0';
    if (type === 'voice')  return <Mic className={cls} />;
    if (type === 'photo')  return <Camera className={cls} />;
    if (type === 'manual') return <ClipboardList className={cls} />;
    return <Clock className={cls} />;
  };

  // ─── Summary panel entries (all entries, sorted newest first) ────────────
  const filteredSummary = (summaryFilter === 'all'
    ? [...entries]
    : entries.filter((e) => e.module_type === summaryFilter)
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        {/* Zoom buttons */}
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground border border-border"
          onClick={() => canvasRef.current?.focusPoint(0.5, 0.5, 2)}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground border border-border"
          onClick={() => canvasRef.current?.resetView()}>
          <ZoomOut className="w-4 h-4" />
        </Button>

        <div className="flex-1" />

        {/* GPS toggle */}
        <Button
          variant="ghost" size="sm"
          onClick={toggleGpsTracking}
          className={`h-9 w-9 p-0 border ${gpsActive ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          <Navigation className={`w-4 h-4 ${gpsActive ? 'animate-pulse' : ''}`} />
        </Button>

        {/* Layer toggles popover */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 border border-border text-muted-foreground hover:text-foreground">
              <Layers className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-sidebar border-border w-64">
            <SheetHeader>
              <SheetTitle className="text-foreground text-sm">Layer Visibility</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Entry Pins', value: showPins, toggle: setShowPins, color: '#f97316' },
                { label: 'GPS Trail', value: showGps, toggle: setShowGps, color: '#3b82f6' },
                { label: 'Geofences', value: showFences, toggle: setShowFences, color: '#22c55e' },
              ].map(({ label, value, toggle, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggle((v: boolean) => !v)}
                  className="flex items-center gap-3 w-full text-sm text-foreground"
                >
                  <div className={`w-3 h-3 rounded-full border-2`} style={{ background: value ? color : 'transparent', borderColor: color }} />
                  {label}
                  {value ? <Eye className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Settings */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 border border-border text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-sidebar border-border w-72">
            <SheetHeader>
              <SheetTitle className="text-foreground text-sm">Schematic Settings</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                variant="ghost" className="w-full justify-start border border-border text-foreground hover:bg-muted gap-2 h-10">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Replace Schematic'}
              </Button>
              <Button
                onClick={() => { setMode('calibrate'); setCalibrationStep(0); setCalibrationPoints([]); toast.success('Tap reference point 1 on the schematic.'); }}
                variant="ghost" className="w-full justify-start border border-border text-foreground hover:bg-muted gap-2 h-10">
                <Crosshair className="w-4 h-4" /> Calibrate GPS (2 points)
              </Button>
              {settings?.calibration_data && (
                <Button onClick={handleResetCalibration}
                  variant="ghost" className="w-full justify-start border border-border text-foreground hover:bg-muted gap-2 h-10">
                  <RotateCcw className="w-4 h-4" /> Reset Calibration
                </Button>
              )}
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Calibration status</p>
                <p className="text-xs text-foreground">
                  {settings?.calibration_data ? '✅ Calibrated (2 reference points)' : '⚠️ Not calibrated — GPS trail won\'t plot'}
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Summary panel toggle — desktop side panel */}
        <Button
          variant="ghost" size="sm"
          onClick={() => setSummaryOpen((v) => !v)}
          className={"hidden md:flex h-9 w-9 p-0 border " + (summaryOpen ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
          title="Activity Summary"
        >
          {summaryOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </Button>

        {/* Summary sheet trigger — mobile bottom sheet */}
        <Button
          variant="ghost" size="sm"
          onClick={() => setMobileSummaryOpen(true)}
          className={"flex md:hidden h-9 w-9 p-0 border " + (mobileSummaryOpen ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
          title="Activity Summary"
        >
          <PanelRightOpen className="w-4 h-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSchematicUpload(f); e.target.value = ''; }}
        />
      </div>

      {/* ── Mode banner ──────────────────────────────────────────────────── */}
      {mode !== 'view' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/30 text-xs text-primary font-medium shrink-0">
          <Crosshair className="w-3.5 h-3.5 shrink-0" />
          {mode === 'addGeofence' && 'Tap on the schematic to place geofence center'}
          {mode === 'calibrate' && `Tap reference point ${calibrationStep + 1} on the schematic`}
          {mode === 'addPin' && 'Tap on the schematic to place a pin'}
          <button type="button" className="ml-auto" onClick={() => setMode('view')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Main area: canvas + optional summary panel ──────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: canvas column ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Canvas ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground animate-pulse">
            Loading schematic…
          </div>
        ) : !settings?.image_url ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-8 text-center">
            No schematic uploaded — use Settings (⚙) to upload a floor plan.
          </div>
        ) : (
          <SchematicCanvas
            ref={canvasRef}
            imageUrl={settings.image_url}
            entries={entries}
            geofences={geofences}
            gpsBreadcrumb={gpsBreadcrumb}
            showEntryPins={showPins}
            showGpsBreadcrumb={showGps}
            showGeofences={showFences}
            onCanvasClick={handleCanvasClick}
            onPinClick={setSelectedEntry}
            onPinAttachPhoto={(entry) => {
              setSelectedEntry(entry);
              setPhotoCaption(entry.photo_caption ?? '');
              // Trigger file picker after state settles
              setTimeout(() => photoInputRef.current?.click(), 50);
            }}
            onGeofenceDelete={handleDeleteGeofence}
            pinPlacementMode={mode !== 'view'}
          />
        )}

        {/* Hidden photo file input for attach workflow */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && selectedEntry) handleAttachPhoto(f, selectedEntry);
            e.target.value = '';
          }}
        />

        {/* ── Floating action buttons ─────────────────────────────────── */}
        <div className="absolute bottom-4 left-3 md:left-auto md:right-4 flex flex-col gap-2">
          <Button
            onClick={() => setMode(mode === 'addGeofence' ? 'view' : 'addGeofence')}
            className={`h-11 w-11 rounded-full shadow-lg p-0 ${mode === 'addGeofence' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
          >
            <Shield className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setMode(mode === 'calibrate' ? 'view' : 'calibrate')}
            className={`h-11 w-11 rounded-full shadow-lg p-0 ${mode === 'calibrate' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
          >
            <Crosshair className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ── Mini timeline — desktop only (mobile uses bottom sheet) ────── */}
      <div className="hidden md:block border-t border-border shrink-0 bg-background">
        <button
          type="button"
          onClick={() => setMiniTimelineOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="font-medium">{pinnedEntries.length} pinned {pinnedEntries.length === 1 ? 'entry' : 'entries'}</span>
          {miniTimelineOpen ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronUp className="w-3.5 h-3.5 ml-auto" />}
        </button>
        {miniTimelineOpen && (
          <div className="overflow-y-auto max-h-48 divide-y divide-border/50 px-4 pb-2">
            {pinnedEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">No pinned entries yet.</p>
            ) : (
              pinnedEntries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    canvasRef.current?.focusPoint(e.schematic_x!, e.schematic_y!, 2.5);
                    setSelectedEntry(e);
                  }}
                  className="w-full flex items-center gap-3 py-2 text-left hover:bg-muted/40 rounded transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: MODULE_COLORS[e.module_type] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{e.summary}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>{/* end mini-timeline */}
        </div>{/* end left canvas column */}

        {/* ── Right: Summary Panel — desktop only ─────────────────────── */}
        {summaryOpen && (
          <div className="hidden md:flex md:w-72 shrink-0 border-l border-border bg-card flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Activity Summary</h2>
                <button type="button" onClick={() => setSummaryOpen(false)}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{entries.length} total {entries.length === 1 ? 'entry' : 'entries'}</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-px bg-border shrink-0">
              {[
                { type: 'voice',  label: 'Voice',  color: '#f97316', Icon: Mic },
                { type: 'photo',  label: 'Photo',  color: '#22c55e', Icon: Camera },
                { type: 'manual', label: 'Log',    color: '#a855f7', Icon: ClipboardList },
                { type: 'gps',    label: 'GPS',    color: '#3b82f6', Icon: Clock },
              ].map(({ type, label, color, Icon }) => {
                const count = entries.filter((e) => e.module_type === type).length;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSummaryFilter(summaryFilter === type ? 'all' : type)}
                    className={'bg-card flex flex-col items-center justify-center py-2 gap-0.5 ' + (summaryFilter === type ? 'ring-2 ring-inset ring-primary/60' : '')}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-sm font-bold text-foreground">{count}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
              {['all', 'voice', 'photo', 'manual', 'gps'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSummaryFilter(f)}
                  className={'text-[10px] px-2 py-0.5 rounded-full capitalize border transition-colors ' +
                    (summaryFilter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground')}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>

            {/* Entry list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-2">
                  <MapPin className="w-6 h-6 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No entries yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredSummary.map((e) => {
                    const color = MODULE_COLORS[e.module_type] ?? '#888';
                    const time = new Date(e.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                    });
                    const date = new Date(e.timestamp).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    });
                    const isPinned = e.schematic_x != null && e.schematic_y != null;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          setSelectedEntry(e);
                          if (isPinned) canvasRef.current?.focusPoint(e.schematic_x!, e.schematic_y!, 2.5);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        {/* Top row: module dot + type + time */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <ModuleIcon type={e.module_type} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {e.module_type}
                          </span>
                          {isPinned && (
                            <span className="ml-auto text-[9px] text-primary/70 font-mono flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" /> pinned
                            </span>
                          )}
                        </div>
                        {/* Summary */}
                        <p className="text-xs font-medium text-foreground leading-snug text-balance line-clamp-2 mb-1">
                          {e.summary}
                        </p>
                        {/* Transcript / caption snippet */}
                        {(e.transcription || e.photo_caption) && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 text-pretty mb-1">
                            {e.transcription ?? e.photo_caption}
                          </p>
                        )}
                        {/* Form data snippet */}
                        {e.form_data && Object.keys(e.form_data).length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {Object.entries(e.form_data).slice(0, 3).map(([k, v]) =>
                              v != null && v !== '' ? (
                                <span key={k} className="text-[9px] text-muted-foreground">
                                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>: {String(v)}
                                </span>
                              ) : null
                            )}
                          </div>
                        )}
                        {/* Timestamp */}
                        <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">{date} · {time}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer: pinned count */}
            <div className="px-4 py-2.5 border-t border-border shrink-0 bg-muted/30">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">{pinnedEntries.length}</span> of {entries.length} entries pinned on schematic
              </p>
            </div>
          </div>
        )}

      </div>{/* end flex row: canvas + summary */}

      {/* ── Mobile summary bottom Sheet ─────────────────────────────────── */}
      <Sheet open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
        <SheetContent side="bottom" className="md:hidden bg-card border-border rounded-t-xl p-0 flex flex-col" style={{ maxHeight: '75dvh' }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Activity Summary</h2>
              <button type="button" onClick={() => setMobileSummaryOpen(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {entries.length} total · <span className="text-foreground font-medium">{pinnedEntries.length}</span> pinned
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-px bg-border shrink-0">
            {[
              { type: 'voice',  label: 'Voice',  color: '#f97316', Icon: Mic },
              { type: 'photo',  label: 'Photo',  color: '#22c55e', Icon: Camera },
              { type: 'manual', label: 'Log',    color: '#a855f7', Icon: ClipboardList },
              { type: 'gps',    label: 'GPS',    color: '#3b82f6', Icon: Clock },
            ].map(({ type, label, color, Icon }) => {
              const count = entries.filter((e) => e.module_type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSummaryFilter(summaryFilter === type ? 'all' : type)}
                  className={'bg-card flex flex-col items-center justify-center py-2.5 gap-0.5 ' + (summaryFilter === type ? 'ring-2 ring-inset ring-primary/60' : '')}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-bold text-foreground">{count}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border shrink-0 overflow-x-auto whitespace-nowrap">
            {['all', 'voice', 'photo', 'manual', 'gps'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSummaryFilter(f)}
                className={'text-[10px] px-2.5 py-1 rounded-full capitalize border transition-colors shrink-0 ' +
                  (summaryFilter === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground')}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredSummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-2">
                <MapPin className="w-6 h-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No entries yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredSummary.map((e) => {
                  const color = MODULE_COLORS[e.module_type] ?? '#888';
                  const time = new Date(e.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                  });
                  const date = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const isPinned = e.schematic_x != null && e.schematic_y != null;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setMobileSummaryOpen(false);
                        setSelectedEntry(e);
                        if (isPinned) canvasRef.current?.focusPoint(e.schematic_x!, e.schematic_y!, 2.5);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors min-h-12"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <ModuleIcon type={e.module_type} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{e.module_type}</span>
                        <span className="ml-auto text-[9px] font-mono text-muted-foreground/60">{date} · {time}</span>
                        {isPinned && <MapPin className="w-2.5 h-2.5 text-primary/60 shrink-0" />}
                      </div>
                      <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 text-balance">
                        {e.summary}
                      </p>
                      {(e.transcription || e.photo_caption) && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 text-pretty">
                          {e.transcription ?? e.photo_caption}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Pin detail dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedEntry} onOpenChange={(o) => { if (!o) { setSelectedEntry(null); setPhotoCaption(''); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm flex items-center gap-2">
              <Badge className={`border text-[10px] module-${selectedEntry?.module_type}`}>
                {selectedEntry?.module_type?.toUpperCase()}
              </Badge>
              Pin Detail
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto pr-1">
              <p className="font-semibold text-foreground text-balance">{selectedEntry.summary}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{selectedEntry.timestamp}</p>
              {selectedEntry.transcription && (
                <p className="text-xs text-foreground/80 text-pretty leading-relaxed">{selectedEntry.transcription}</p>
              )}
              {selectedEntry.form_data && (
                <div className="space-y-1 text-xs">
                  {Object.entries(selectedEntry.form_data).map(([k, v]) =>
                    v != null && v !== '' ? (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground capitalize w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-foreground">{String(v)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* ── Photo section ─────────────────────────────────────── */}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Site Photo
                  </p>
                  {selectedEntry.photo_url && (
                    <button
                      type="button"
                      onClick={async () => {
                        await attachPhotoToEntry(selectedEntry.id, '', undefined);
                        const updated = await fetchEntries();
                        setEntries(updated);
                        setSelectedEntry(updated.find((e) => e.id === selectedEntry.id) ?? null);
                      }}
                      className="flex items-center gap-1 text-[10px] text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                {selectedEntry.photo_url ? (
                  <div className="space-y-1.5">
                    <img
                      src={selectedEntry.photo_url}
                      alt={selectedEntry.photo_caption ?? 'Site photo'}
                      className="w-full rounded max-h-52 object-contain border border-border bg-muted/30"
                    />
                    {selectedEntry.photo_caption && (
                      <p className="text-[10px] text-muted-foreground italic">{selectedEntry.photo_caption}</p>
                    )}
                    {/* Replace photo */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 border border-border text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={attachingPhoto}
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {attachingPhoto ? 'Uploading…' : 'Replace photo'}
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <ImagePlus className="w-7 h-7 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center">
                      {attachingPhoto ? 'Uploading…' : 'Tap to attach a site photo (JPG/PNG, max 20 MB)'}
                    </p>
                  </div>
                )}

                {/* Caption input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Photo caption (optional)</label>
                  <Input
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="Describe what the photo shows…"
                    className="bg-input border-border text-foreground h-9 text-xs focus-visible:ring-primary"
                  />
                </div>
                {/* Save caption separately if photo already exists */}
                {selectedEntry.photo_url && (
                  <Button
                    size="sm"
                    className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs"
                    onClick={async () => {
                      await attachPhotoToEntry(selectedEntry.id, selectedEntry.photo_url!, photoCaption || undefined);
                      toast.success('Caption saved.');
                      const updated = await fetchEntries();
                      setEntries(updated);
                      setSelectedEntry(updated.find((e) => e.id === selectedEntry.id) ?? null);
                    }}
                    disabled={attachingPhoto}
                  >
                    <Check className="w-3.5 h-3.5" /> Save caption
                  </Button>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground font-mono">
                Schematic: ({selectedEntry.schematic_x?.toFixed(4)}, {selectedEntry.schematic_y?.toFixed(4)})
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Geofence form dialog ────────────────────────────────────────── */}
      <Dialog open={showGeofenceForm} onOpenChange={setShowGeofenceForm}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Add Geofence Zone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Zone Name</label>
              <Input value={geofenceLabel} onChange={(e) => setGeofenceLabel(e.target.value)}
                placeholder="e.g. Hot Zone A" className="bg-input border-border text-foreground h-10 focus-visible:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Zone Type</label>
              <div className="grid grid-cols-3 gap-2">
                {ZONE_TYPES.map((z) => (
                  <button key={z.id} type="button"
                    onClick={() => setGeofenceZoneType(z.id)}
                    className={`px-2 py-1.5 text-xs rounded border transition-colors ${geofenceZoneType === z.id ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                    style={{ borderColor: geofenceZoneType === z.id ? z.color : undefined }}
                  >
                    <span className="block w-2 h-2 rounded-full mx-auto mb-1" style={{ background: z.color }} />
                    {z.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Radius (normalized): {geofenceRadius.toFixed(2)}</label>
              <input type="range" min={0.02} max={0.3} step={0.01} value={geofenceRadius}
                onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveGeofence} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 gap-2">
                <Check className="w-4 h-4" /> Save Zone
              </Button>
              <Button variant="ghost" onClick={() => setShowGeofenceForm(false)}
                className="border border-border text-muted-foreground hover:text-foreground h-10">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Calibration modal ───────────────────────────────────────────── */}
      <Dialog open={showCalibModal} onOpenChange={setShowCalibModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-primary" />
              GPS Calibration — Point {calibrationStep + 1}/2
            </DialogTitle>
          </DialogHeader>
          {calibPoint && (
            <div className="space-y-3 mt-2">
              <p className="text-xs text-muted-foreground">
                Schematic coords: ({calibPoint.schematic_x.toFixed(4)}, {calibPoint.schematic_y.toFixed(4)})
              </p>
              <p className="text-xs text-foreground font-medium">Enter the real GPS coordinates for this point:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Latitude</label>
                  <Input type="number" step="any" value={calibGpsLat} onChange={(e) => setCalibGpsLat(e.target.value)}
                    placeholder="1.350000" className="bg-input border-border text-foreground h-10 focus-visible:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Longitude</label>
                  <Input type="number" step="any" value={calibGpsLng} onChange={(e) => setCalibGpsLng(e.target.value)}
                    placeholder="103.820000" className="bg-input border-border text-foreground h-10 focus-visible:ring-primary" />
                </div>
              </div>
              <Button variant="ghost" onClick={handleUseCurrentGps}
                className="w-full border border-border text-muted-foreground hover:text-foreground h-9 gap-2 text-xs">
                <Navigation className="w-3.5 h-3.5" /> Use Current GPS Position
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleConfirmCalibPoint} disabled={!calibGpsLat || !calibGpsLng}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 gap-2">
                  <Check className="w-4 h-4" /> Confirm Point {calibrationStep + 1}
                </Button>
                <Button variant="ghost" onClick={() => { setShowCalibModal(false); setMode('view'); }}
                  className="border border-border text-muted-foreground hover:text-foreground h-10">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
