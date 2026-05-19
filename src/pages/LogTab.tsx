import { useState, useCallback, useEffect } from 'react';
import { ClipboardList, ChevronRight, ChevronDown, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MapPicker } from '@/components/MapPicker';
import { Entry, Template, TemplateType } from '@/types';
import {
  fetchEntries, insertEntry, deleteEntry,
  fetchSchematicSettings, pinEntryOnSchematic,
} from '@/services/entries';

const TEMPLATES: Template[] = [
  {
    id: 'victim_assessment',
    label: 'Victim Assessment',
    icon: '🚑',
    fields: [
      { key: 'victim_count', label: 'Victim Count', type: 'number', required: true },
      { key: 'condition', label: 'Condition', type: 'select', options: ['Stable', 'Critical', 'Deceased', 'Unknown'], required: true },
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  {
    id: 'equipment_check',
    label: 'Equipment Check',
    icon: '🔧',
    fields: [
      { key: 'equipment_name', label: 'Equipment Name', type: 'text', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['OK', 'Damaged', 'Missing', 'Needs Repair'], required: true },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  {
    id: 'hazard_report',
    label: 'Hazard Report',
    icon: '⚠️',
    fields: [
      { key: 'hazard_type', label: 'Hazard Type', type: 'text', required: true },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'], required: true },
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'text' },
    ],
  },
  {
    id: 'general_note',
    label: 'General Note',
    icon: '📝',
    fields: [
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'body', label: 'Details', type: 'text', required: true },
    ],
  },
];

function getSummary(template: Template, formData: Record<string, string | number | null>): string {
  const t = template.id;
  if (t === 'victim_assessment') return `Victim Assessment: ${formData['victim_count'] ?? '?'} victim(s), ${formData['condition'] ?? ''} at ${formData['location'] ?? ''}`;
  if (t === 'equipment_check') return `Equipment: ${formData['equipment_name'] ?? ''} — ${formData['status'] ?? ''}`;
  if (t === 'hazard_report') return `Hazard [${formData['severity'] ?? '?'}]: ${formData['hazard_type'] ?? ''} at ${formData['location'] ?? ''}`;
  if (t === 'general_note') return `Note: ${formData['subject'] ?? ''}`;
  return template.label;
}

export default function LogTab() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateType | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number | null>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Pin on schematic
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [schematicImageUrl, setSchematicImageUrl] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const [data, s] = await Promise.all([fetchEntries('manual'), fetchSchematicSettings()]);
      setEntries(data);
      setSchematicImageUrl(s?.image_url ?? null);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const template = TEMPLATES.find((t) => t.id === activeTemplate);

  const handleFieldChange = (key: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectTemplate = (id: TemplateType) => {
    setActiveTemplate(id);
    setFormData({});
  };

  const handleSubmit = async () => {
    if (!template) return;
    // Validate required fields
    const missing = template.fields.filter((f) => f.required && !formData[f.key]);
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const id = await insertEntry({
        module_type: 'manual',
        timestamp: new Date().toISOString(),
        summary: getSummary(template, formData),
        template_type: template.id,
        form_data: formData,
      });
      toast.success(`${template.label} submitted`);
      setActiveTemplate(null);
      setFormData({});
      await loadEntries();
      // Offer to pin on schematic
      setPendingEntryId(id);
      setPinDialogOpen(true);
    } catch { toast.error('Failed to submit. Please try again.'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete.'); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Template selector or form */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        {!activeTemplate ? (
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Select Template</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t.id)}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded hover:border-primary/60 hover:bg-card/80 transition-colors text-left"
                >
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground text-balance leading-tight">{t.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setActiveTemplate(null); setFormData({}); }} className="text-muted-foreground hover:text-foreground">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-sm font-semibold text-foreground">{template?.icon} {template?.label}</span>
            </div>

            {template?.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs text-muted-foreground font-normal">
                  {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
                {field.type === 'select' ? (
                  <Select
                    value={String(formData[field.key] ?? '')}
                    onValueChange={(val) => handleFieldChange(field.key, val)}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground h-10 focus:ring-primary">
                      <SelectValue placeholder={`Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {field.options?.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-foreground hover:bg-muted">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'number' ? (
                  <Input
                    type="number"
                    min={0}
                    value={String(formData[field.key] ?? '')}
                    onChange={(e) => handleFieldChange(field.key, e.target.value === '' ? null : Number(e.target.value))}
                    className="bg-input border-border text-foreground h-10 focus-visible:ring-primary"
                    placeholder={`Enter ${field.label}`}
                  />
                ) : field.key === 'body' || field.key === 'description' || field.key === 'notes' ? (
                  <Textarea
                    value={String(formData[field.key] ?? '')}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="bg-input border-border text-foreground min-h-16 resize-none focus-visible:ring-primary px-3 text-sm"
                    placeholder={`Enter ${field.label}`}
                  />
                ) : (
                  <Input
                    value={String(formData[field.key] ?? '')}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="bg-input border-border text-foreground h-10 focus-visible:ring-primary"
                    placeholder={`Enter ${field.label}`}
                  />
                )}
              </div>
            ))}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 gap-2 mt-1"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Entry'}
            </Button>
          </div>
        )}
      </div>

      {/* Submitted entries */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Submitted Entries</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3 text-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No structured entries yet.<br />Select a template above to log data.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {entries.map((entry) => (
              <LogEntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
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
                toast.success('Log entry pinned on schematic.');
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

function LogEntryCard({ entry, onDelete }: { entry: Entry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const tpl = TEMPLATES.find((t) => t.id === entry.template_type);
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="bg-card border border-border rounded shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div
        className="flex items-start gap-3 p-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
      >
        <span className="text-xl shrink-0 mt-0.5">{tpl?.icon ?? '📋'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge className="module-manual border text-[10px] py-0 h-4 px-1.5">{tpl?.label ?? entry.template_type}</Badge>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{time}</span>
          </div>
          <p className="text-sm text-foreground leading-snug text-pretty">{entry.summary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(entry.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <div className="text-muted-foreground">{expanded ? <ChevronDown className="w-4 h-4 rotate-180" /> : <ChevronDown className="w-4 h-4" />}</div>
        </div>
      </div>

      {expanded && entry.form_data && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-1">
          {tpl?.fields.map((field) => {
            const val = entry.form_data?.[field.key];
            if (val === null || val === undefined || val === '') return null;
            return (
              <div key={field.key} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{field.label}:</span>
                <span className="text-xs text-foreground">{String(val)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
