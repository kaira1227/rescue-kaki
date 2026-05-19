/**
 * SchematicCanvas
 * Interactive 2D canvas for displaying a floor-plan / facility blueprint.
 *
 * Features:
 *  - Pan (mouse drag / one-finger drag)
 *  - Pinch-to-zoom (touch) + scroll-wheel zoom
 *  - Zoom range: 0.5× – 5×
 *  - SVG overlay rendered on top of the image at the same transform
 *  - Tap/click emits normalized (0–1) coordinates for pin placement
 *  - Exposes a ref-based imperative API (zoomTo, panTo, resetView)
 */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { Entry, Geofence } from '@/types';

// ─── Public API exposed via ref ───────────────────────────────────────────────
export interface SchematicCanvasHandle {
  /** Pan + zoom so the normalized (nx, ny) point fills the center at the given scale */
  focusPoint(nx: number, ny: number, scale?: number): void;
  resetView(): void;
}

// ─── Module colours ───────────────────────────────────────────────────────────
const MODULE_COLORS: Record<string, string> = {
  voice:  '#f97316', // orange
  photo:  '#22c55e', // green
  gps:    '#3b82f6', // blue
  manual: '#a855f7', // purple
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface SchematicCanvasProps {
  imageUrl: string;
  entries: Entry[];
  geofences: Geofence[];
  gpsBreadcrumb: Array<{ x: number; y: number }>;
  showEntryPins: boolean;
  showGpsBreadcrumb: boolean;
  showGeofences: boolean;
  /** Called with normalized (0–1) coords when the canvas is tapped/clicked (not on a pin) */
  onCanvasClick?: (nx: number, ny: number) => void;
  /** Called when a pin is clicked */
  onPinClick?: (entry: Entry) => void;
  /** Called when the attach-photo button in the hover tooltip is clicked */
  onPinAttachPhoto?: (entry: Entry) => void;
  /** Called when a geofence "×" is pressed */
  onGeofenceDelete?: (id: string) => void;
  /** If true the cursor shows a crosshair and every click fires onCanvasClick */
  pinPlacementMode?: boolean;
}

// ─── Hover tooltip state ─────────────────────────────────────────────────────
interface TooltipState {
  entry: Entry;
  /** Pixel coords relative to container */
  cx: number;
  cy: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;

export const SchematicCanvas = forwardRef<SchematicCanvasHandle, SchematicCanvasProps>(
  (
    {
      imageUrl,
      entries,
      geofences,
      gpsBreadcrumb,
      showEntryPins,
      showGpsBreadcrumb,
      showGeofences,
      onCanvasClick,
      onPinClick,
      onPinAttachPhoto,
      onGeofenceDelete,
      pinPlacementMode = false,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Transform state: offset (pixels from top-left of container) + scale
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

    // Hover tooltip
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    // Drag state (mouse)
    const dragging = useRef(false);
    const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

    // Pinch state (touch)
    const lastPinchDist = useRef<number | null>(null);

    // ── Image natural size ──────────────────────────────────────────────────
    const handleImageLoad = useCallback(() => {
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let iw: number, ih: number;
      if (ir > cr) { iw = cw; ih = cw / ir; }
      else          { ih = ch; iw = ch * ir; }
      setImgSize({ w: iw, h: ih });
      setScale(1);
      setOffset({ x: (cw - iw) / 2, y: (ch - ih) / 2 });
    }, []);

    useEffect(() => {
      // Recalculate on resize
      const ro = new ResizeObserver(handleImageLoad);
      if (containerRef.current) ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, [handleImageLoad, imageUrl]);

    // ── Clamp offset so we don't lose the image entirely ───────────────────
    const clampOffset = useCallback(
      (ox: number, oy: number, sc: number) => {
        const cw = containerRef.current?.clientWidth ?? 0;
        const ch = containerRef.current?.clientHeight ?? 0;
        const iw = imgSize.w * sc;
        const ih = imgSize.h * sc;
        const minX = Math.min(0, cw - iw);
        const minY = Math.min(0, ch - ih);
        const maxX = Math.max(0, cw - iw);
        const maxY = Math.max(0, ch - ih);
        return {
          x: Math.max(minX, Math.min(maxX, ox)),
          y: Math.max(minY, Math.min(maxY, oy)),
        };
      },
      [imgSize]
    );

    // ── Imperative API ──────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      focusPoint(nx, ny, targetScale = 2.5) {
        const cw = containerRef.current?.clientWidth ?? 0;
        const ch = containerRef.current?.clientHeight ?? 0;
        const sc = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetScale));
        const px = nx * imgSize.w * sc;
        const py = ny * imgSize.h * sc;
        const ox = cw / 2 - px;
        const oy = ch / 2 - py;
        setScale(sc);
        setOffset(clampOffset(ox, oy, sc));
      },
      resetView() {
        const cw = containerRef.current?.clientWidth ?? 0;
        const ch = containerRef.current?.clientHeight ?? 0;
        setScale(1);
        setOffset(clampOffset((cw - imgSize.w) / 2, (ch - imgSize.h) / 2, 1));
      },
    }));

    // ── Convert container-pixel coords → normalized schematic coords ────────
    const toNormalized = useCallback(
      (cx: number, cy: number): { nx: number; ny: number } | null => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || imgSize.w === 0) return null;
        const px = cx - rect.left;
        const py = cy - rect.top;
        // Position relative to the image origin
        const ix = (px - offset.x) / (imgSize.w * scale);
        const iy = (py - offset.y) / (imgSize.h * scale);
        if (ix < 0 || ix > 1 || iy < 0 || iy > 1) return null;
        return { nx: ix, ny: iy };
      },
      [offset, scale, imgSize]
    );

    // ── Mouse handlers ──────────────────────────────────────────────────────
    const onMouseDown = useCallback((e: MouseEvent) => {
      dragging.current = true;
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    }, [offset]);

    const onMouseMove = useCallback((e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale));
    }, [clampOffset, scale]);

    const onMouseUp = useCallback((e: MouseEvent) => {
      const moved =
        Math.abs(e.clientX - dragStart.current.mx) > 4 ||
        Math.abs(e.clientY - dragStart.current.my) > 4;
      dragging.current = false;
      if (!moved && onCanvasClick) {
        const coords = toNormalized(e.clientX, e.clientY);
        if (coords) onCanvasClick(coords.nx, coords.ny);
      }
    }, [onCanvasClick, toNormalized]);

    // ── Touch handlers ──────────────────────────────────────────────────────
    const onTouchStart = useCallback((e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging.current = true;
        dragStart.current = {
          mx: e.touches[0].clientX,
          my: e.touches[0].clientY,
          ox: offset.x,
          oy: offset.y,
        };
      } else if (e.touches.length === 2) {
        dragging.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist.current = Math.hypot(dx, dy);
      }
    }, [offset]);

    const onTouchEnd = useCallback(
      (e: TouchEvent) => {
        if (e.changedTouches.length === 1 && dragging.current) {
          const moved =
            Math.abs(e.changedTouches[0].clientX - dragStart.current.mx) > 8 ||
            Math.abs(e.changedTouches[0].clientY - dragStart.current.my) > 8;
          dragging.current = false;
          if (!moved && onCanvasClick) {
            const coords = toNormalized(
              e.changedTouches[0].clientX,
              e.changedTouches[0].clientY
            );
            if (coords) onCanvasClick(coords.nx, coords.ny);
          }
        }
        if (e.touches.length < 2) lastPinchDist.current = null;
      },
      [onCanvasClick, toNormalized]
    );

    // ── Scroll-wheel zoom (moved to native useEffect below) ─────────────────

    // ── Native non-passive listeners for wheel + touchmove ──────────────────
    // React 18 registers onWheel/onTouchMove as passive by default.
    // Calling e.preventDefault() inside a passive listener throws a browser error
    // and breaks panning/zooming entirely. We attach them directly as non-passive.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const handleWheel = (e: globalThis.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        setScale((s) => {
          const ns = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s + delta));
          const rect = el.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          setOffset((o) =>
            clampOffset(
              px - ((px - o.x) / s) * ns,
              py - ((py - o.y) / s) * ns,
              ns
            )
          );
          return ns;
        });
      };
      const handleTouchMove = (e: globalThis.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && dragging.current) {
          const dx = e.touches[0].clientX - dragStart.current.mx;
          const dy = e.touches[0].clientY - dragStart.current.my;
          setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale));
        } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const ratio = dist / lastPinchDist.current;
          lastPinchDist.current = dist;
          setScale((s) => {
            const ns = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s * ratio));
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const rect = el.getBoundingClientRect();
            const px = mx - rect.left;
            const py = my - rect.top;
            setOffset((o) =>
              clampOffset(
                px - ((px - o.x) / s) * ns,
                py - ((py - o.y) / s) * ns,
                ns
              )
            );
            return ns;
          });
        }
      };
      el.addEventListener('wheel', handleWheel, { passive: false });
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
      return () => {
        el.removeEventListener('wheel', handleWheel);
        el.removeEventListener('touchmove', handleTouchMove);
      };
    }, [clampOffset, scale]);

    // ── SVG helpers ─────────────────────────────────────────────────────────
    // Convert normalized (0–1) coords to SVG pixel coords within the image bounds
    const toSvgPx = (nx: number, ny: number) => ({
      x: nx * imgSize.w,
      y: ny * imgSize.h,
    });

    const svgW = imgSize.w * scale;
    const svgH = imgSize.h * scale;

    // Pin radius that stays visually constant regardless of zoom
    const pinR = 10 / scale;

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden select-none bg-background"
        style={{ cursor: pinPlacementMode ? 'crosshair' : dragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { dragging.current = false; }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Schematic image */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Facility schematic"
          draggable={false}
          onLoad={handleImageLoad}
          style={{
            position: 'absolute',
            top: offset.y,
            left: offset.x,
            width: imgSize.w * scale,
            height: imgSize.h * scale,
            imageRendering: 'crisp-edges',
            pointerEvents: 'none',
          }}
        />

        {/* SVG overlay — same origin / size as the image */}
        <svg
          style={{
            position: 'absolute',
            top: offset.y,
            left: offset.x,
            width: svgW,
            height: svgH,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
        >
          {/* Geofence circles */}
          {showGeofences &&
            geofences.map((gf) => {
              const cx = gf.center_x * imgSize.w;
              const cy = gf.center_y * imgSize.h;
              const r  = gf.radius  * imgSize.w;
              return (
                <g key={gf.id} style={{ pointerEvents: 'all' }}>
                  <circle
                    cx={cx} cy={cy} r={r}
                    fill={gf.color + '30'}
                    stroke={gf.color}
                    strokeWidth={1.5 / scale}
                    strokeDasharray={`${4 / scale} ${3 / scale}`}
                  />
                  <text
                    x={cx} y={cy - r - 4 / scale}
                    textAnchor="middle"
                    fontSize={10 / scale}
                    fill={gf.color}
                    fontWeight="600"
                    fontFamily="sans-serif"
                  >
                    {gf.label}
                  </text>
                  {onGeofenceDelete && (
                    <text
                      x={cx + r + 6 / scale} y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10 / scale}
                      fill={gf.color}
                      fontWeight="700"
                      fontFamily="sans-serif"
                      style={{ cursor: 'pointer', pointerEvents: 'all' }}
                      onClick={(e) => { e.stopPropagation(); onGeofenceDelete(gf.id); }}
                    >
                      ×
                    </text>
                  )}
                </g>
              );
            })}

          {/* GPS breadcrumb polyline */}
          {showGpsBreadcrumb && gpsBreadcrumb.length > 1 && (
            <polyline
              points={gpsBreadcrumb.map((p) => `${p.x * imgSize.w},${p.y * imgSize.h}`).join(' ')}
              fill="none"
              stroke="#f97316"
              strokeWidth={2 / scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${5 / scale} ${3 / scale}`}
            />
          )}

          {/* Active GPS position (last breadcrumb point) */}
          {showGpsBreadcrumb && gpsBreadcrumb.length > 0 && (() => {
            const last = gpsBreadcrumb[gpsBreadcrumb.length - 1];
            const { x, y } = toSvgPx(last.x, last.y);
            return (
              <g>
                <circle cx={x} cy={y} r={pinR * 2.4} fill="#f9731620" />
                <circle cx={x} cy={y} r={pinR * 1.2} fill="#f97316" stroke="#fff" strokeWidth={1 / scale} />
              </g>
            );
          })()}

          {/* Entry pins */}
          {showEntryPins &&
            entries
              .filter((e) => e.schematic_x != null && e.schematic_y != null)
              .map((entry) => {
                const { x, y } = toSvgPx(entry.schematic_x!, entry.schematic_y!);
                const color = MODULE_COLORS[entry.module_type] ?? '#888';
                return (
                  <g
                    key={entry.id}
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onClick={(e) => { e.stopPropagation(); onPinClick?.(entry); }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setTooltip({ entry, cx: e.clientX - rect.left, cy: e.clientY - rect.top });
                    }}
                    onMouseMove={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setTooltip((t) => t ? { ...t, cx: e.clientX - rect.left, cy: e.clientY - rect.top } : null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* Drop shadow */}
                    <circle cx={x + 0.5 / scale} cy={y + 1 / scale} r={pinR} fill="rgba(0,0,0,0.35)" />
                    {/* Pin body */}
                    <circle cx={x} cy={y} r={pinR} fill={color} stroke="#fff" strokeWidth={1.5 / scale} />
                    {/* Inner dot */}
                    <circle cx={x} cy={y} r={pinR * 0.35} fill="#fff" />
                  </g>
                );
              })}
        </svg>

        {/* ── Hover Tooltip ──────────────────────────────────────────────── */}
        {tooltip && (() => {
          const { entry, cx, cy } = tooltip;
          const cw = containerRef.current?.clientWidth ?? 0;
          const ch = containerRef.current?.clientHeight ?? 0;
          // Tooltip size estimate: 240px wide, ~140px tall (taller to fit action row)
          const tipW = 240;
          const tipH = 140;
          const OFFSET = 14;
          let left = cx + OFFSET;
          let top  = cy - tipH / 2;
          if (left + tipW > cw - 8) left = cx - tipW - OFFSET;
          if (top < 8) top = 8;
          if (top + tipH > ch - 8) top = ch - tipH - 8;
          const color = MODULE_COLORS[entry.module_type] ?? '#888';
          const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          });
          return (
            <div
              className="absolute z-50"
              style={{ left, top, width: tipW }}
              // Keep tooltip interactive (for buttons) without closing on leave
              onMouseEnter={() => setTooltip((t) => t)}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className="bg-popover border border-border rounded shadow-lg p-3 space-y-1.5">
                {/* Module badge + time */}
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {entry.module_type}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-auto">{time}</span>
                </div>
                {/* Summary */}
                <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 text-balance">
                  {entry.summary}
                </p>
                {/* Existing photo thumbnail */}
                {entry.photo_url && (
                  <img
                    src={entry.photo_url}
                    alt={entry.photo_caption ?? 'Attached photo'}
                    className="w-full h-16 object-cover rounded border border-border"
                  />
                )}
                {/* Transcript / caption preview (no photo) */}
                {!entry.photo_url && (entry.transcription || entry.photo_caption) && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 text-pretty">
                    {entry.transcription ?? entry.photo_caption}
                  </p>
                )}
                {/* Action row */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPinClick?.(entry); setTooltip(null); }}
                    className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-background hover:bg-muted transition-colors"
                  >
                    View detail
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPinAttachPhoto?.(entry); setTooltip(null); }}
                    className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 border border-primary/40 rounded px-2 py-1 bg-primary/5 hover:bg-primary/10 transition-colors shrink-0"
                  >
                    <span className="w-3 h-3 inline-block">
                      {/* camera icon inline SVG to avoid import issue in canvas */}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </span>
                    {entry.photo_url ? 'Replace' : 'Attach photo'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
);

SchematicCanvas.displayName = 'SchematicCanvas';
