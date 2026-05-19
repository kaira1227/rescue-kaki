/**
 * MapPicker
 * Compact "tap-to-pin" schematic picker shown after an entry is saved.
 * Renders a scaled-down version of the uploaded schematic. User taps a
 * location and a preview pin appears. They can confirm or skip.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, X, Check, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapPickerProps {
  imageUrl: string | null;
  /** Called with confirmed normalized (0–1) coords */
  onConfirm: (nx: number, ny: number) => void;
  /** Called when user skips pinning */
  onSkip: () => void;
}

export function MapPicker({ imageUrl, onConfirm, onSkip }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState<{ nx: number; ny: number } | null>(null);
  const [imgNaturalRatio, setImgNaturalRatio] = useState(1);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Track container size for correct coordinate calculation
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalRatio(img.naturalWidth / img.naturalHeight);
  };

  // Compute displayed image rect inside the container (object-contain logic)
  const getDisplayedImageRect = useCallback(() => {
    const cw = containerSize.w;
    const ch = containerSize.h;
    if (!cw || !ch) return null;
    const cr = cw / ch;
    let iw: number, ih: number;
    if (imgNaturalRatio > cr) { iw = cw; ih = cw / imgNaturalRatio; }
    else                      { ih = ch; iw = ch * imgNaturalRatio; }
    return { x: (cw - iw) / 2, y: (ch - ih) / 2, w: iw, h: ih };
  }, [containerSize, imgNaturalRatio]);

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      let cx: number, cy: number;
      if ('touches' in e) {
        cx = e.changedTouches[0].clientX - rect.left;
        cy = e.changedTouches[0].clientY - rect.top;
      } else {
        cx = (e as React.MouseEvent).clientX - rect.left;
        cy = (e as React.MouseEvent).clientY - rect.top;
      }

      const imgRect = getDisplayedImageRect();
      if (!imgRect) return;

      const nx = (cx - imgRect.x) / imgRect.w;
      const ny = (cy - imgRect.y) / imgRect.h;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
      setPin({ nx, ny });
    },
    [getDisplayedImageRect]
  );

  // Pin position in px within the container
  const imgRect = getDisplayedImageRect();
  const pinPx = pin && imgRect
    ? { x: imgRect.x + pin.nx * imgRect.w, y: imgRect.y + pin.ny * imgRect.h }
    : null;

  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
          <MapPin className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground text-center text-pretty px-4">
          No schematic uploaded. Upload a floor plan in the Map tab to enable pinning.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="border border-border text-muted-foreground hover:text-foreground h-9 gap-1.5"
        >
          <SkipForward className="w-3.5 h-3.5" /> Skip
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground text-center">
        Tap where this event occurred on the schematic
      </p>

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="relative w-full bg-muted rounded border border-border overflow-hidden"
        style={{ height: 220, cursor: 'crosshair' }}
        onClick={handleClick}
        onTouchEnd={handleClick}
      >
        <img
          src={imageUrl}
          alt="Schematic"
          onLoad={handleImgLoad}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Pin marker */}
        {pinPx && (
          <div
            className="absolute pointer-events-none"
            style={{ left: pinPx.x, top: pinPx.y, transform: 'translate(-50%, -100%)' }}
          >
            <div className="flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-primary border-2 border-white shadow-md flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="w-0.5 h-2.5 bg-primary" />
            </div>
          </div>
        )}

        {/* Instruction overlay when no pin yet */}
        {!pin && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-background/70 backdrop-blur-sm border border-border rounded px-3 py-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Tap to place pin
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Coordinates preview */}
      {pin && (
        <p className="text-[10px] text-muted-foreground font-mono text-center">
          x: {pin.nx.toFixed(4)} · y: {pin.ny.toFixed(4)}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => { if (pin) onConfirm(pin.nx, pin.ny); }}
          disabled={!pin}
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 gap-2"
        >
          <Check className="w-4 h-4" />
          Confirm Pin
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setPin(null); onSkip(); }}
          className="border border-border text-muted-foreground hover:text-foreground h-10 gap-2"
        >
          <X className="w-4 h-4" />
          Skip
        </Button>
      </div>
    </div>
  );
}
