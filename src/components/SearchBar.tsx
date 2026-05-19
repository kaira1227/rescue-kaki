import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
}

export function SearchBar({ value, onChange, resultCount, totalCount }: SearchBarProps) {
  const isFiltering = value.trim().length > 0;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search entries by keyword, location, or time..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 pr-9 h-11 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary text-sm"
        />
        {isFiltering && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isFiltering && resultCount !== undefined && totalCount !== undefined && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {resultCount} / {totalCount}
        </span>
      )}
    </div>
  );
}
