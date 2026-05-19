import { Entry, ExportFormat } from '@/types';

function toCSV(entries: Entry[]): string {
  const headers = [
    'id', 'timestamp', 'module_type', 'summary',
    'transcription', 'photo_url', 'photo_caption',
    'latitude', 'longitude', 'zone_label',
    'template_type', 'form_data', 'location_tag', 'is_edited',
  ];
  const escape = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const rows = entries.map((e) =>
    [
      e.id, e.timestamp, e.module_type, e.summary,
      e.transcription ?? '', e.photo_url ?? '', e.photo_caption ?? '',
      e.latitude ?? '', e.longitude ?? '', e.zone_label ?? '',
      e.template_type ?? '', e.form_data ? JSON.stringify(e.form_data) : '',
      e.location_tag ?? '', e.is_edited,
    ]
      .map(escape)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\r\n');
}

function toJSON(entries: Entry[]): string {
  return JSON.stringify(entries, null, 2);
}

export function exportEntries(entries: Entry[], format: ExportFormat): void {
  if (entries.length === 0) return;

  const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `rescue-kaki-${now}.${format}`;

  let content: string;
  let mimeType: string;

  if (format === 'csv') {
    content = toCSV(entries);
    mimeType = 'text/csv;charset=utf-8;';
  } else {
    content = toJSON(entries);
    mimeType = 'application/json;charset=utf-8;';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
