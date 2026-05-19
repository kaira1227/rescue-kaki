import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Edit2, Save, X, MapPin, Clock, FileText, Zap, Trash2 } from 'lucide-react';
import { Entry } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface VoiceEntryCardProps {
  entry: Entry;
  onUpdate: (id: string, updates: Partial<Entry>) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">{part}</mark>
    ) : part
  );
}

export function VoiceEntryCard({ entry, onUpdate, onDelete, searchQuery = '' }: VoiceEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSummary, setEditSummary] = useState(entry.summary);
  const [editTranscription, setEditTranscription] = useState(entry.transcription ?? '');
  const [editLocation, setEditLocation] = useState(entry.location_tag ?? '');
  const [flashing, setFlashing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const handleSave = () => {
    onUpdate(entry.id, {
      summary: editSummary.trim() || entry.summary,
      transcription: editTranscription.trim(),
      location_tag: editLocation.trim() || null,
    });
    setEditing(false);
    setFlashing(true);
    setTimeout(() => setFlashing(false), 400);
  };

  const handleCancel = () => {
    setEditSummary(entry.summary);
    setEditTranscription(entry.transcription ?? '');
    setEditLocation(entry.location_tag ?? '');
    setEditing(false);
  };

  return (
    <div ref={cardRef} className={['bg-card border border-border rounded shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-200', flashing ? 'save-flash' : '', editing ? 'border-primary/60' : ''].join(' ')}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => !editing && setExpanded((v) => !v)}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !editing && setExpanded((v) => !v); }}
        aria-expanded={expanded}
      >
        <div className="shrink-0 w-14 flex flex-col items-center pt-0.5">
          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mb-1" />
          <span className="text-[10px] text-muted-foreground font-mono text-center leading-tight">{time}</span>
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input value={editSummary} onChange={(e) => setEditSummary(e.target.value)} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold bg-input border-primary/60 text-foreground h-8 px-2" placeholder="Summary..." />
          ) : (
            <p className="text-sm font-semibold text-foreground text-balance leading-snug">{highlightText(entry.summary, searchQuery)}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {entry.location_tag && !editing && (
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground gap-1 py-0 h-5"><MapPin className="w-2.5 h-2.5" />{entry.location_tag}</Badge>
            )}
            {entry.is_edited && (
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground gap-1 py-0 h-5"><Edit2 className="w-2.5 h-2.5" />Edited</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!editing && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(true); setExpanded(true); }}><Edit2 className="w-3.5 h-3.5" /></Button>}
          {!editing && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(entry.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
          {!editing && <div className="text-muted-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>}
        </div>
      </div>

      {(expanded || editing) && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" /><span className="font-mono">{entry.timestamp}</span></div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider"><FileText className="w-3 h-3" /><span>Transcription</span></div>
            {editing ? (
              <Textarea value={editTranscription} onChange={(e) => setEditTranscription(e.target.value)} className="text-sm bg-input border-border text-foreground min-h-20 resize-none focus-visible:ring-primary px-3" placeholder="Full transcription..." />
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed text-pretty">
                {entry.transcription ? highlightText(entry.transcription, searchQuery) : <span className="text-muted-foreground italic">No transcription captured</span>}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider"><MapPin className="w-3 h-3" /><span>Location / Context</span></div>
            {editing ? (
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="text-sm bg-input border-border text-foreground h-9 px-3 focus-visible:ring-primary" placeholder="e.g. Sector A, North entrance..." />
            ) : (
              <p className="text-sm text-foreground/80">{entry.location_tag || <span className="text-muted-foreground italic">No location tag</span>}</p>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/30 pt-2"><Zap className="w-3 h-3 text-accent" /><span>AI-generated summary</span></div>
          )}
          {editing && (
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-1.5"><Save className="w-3.5 h-3.5" />Save</Button>
              <Button onClick={handleCancel} size="sm" variant="ghost" className="border border-border text-muted-foreground hover:text-foreground h-9 gap-1.5"><X className="w-3.5 h-3.5" />Cancel</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
