import { useState, useCallback } from 'react';
import { Entry } from '@/types';

export function useJournal() {
  const [entries, setEntries] = useState<Entry[]>([]);

  const addEntry = useCallback(
    (entry: Omit<Entry, 'id' | 'created_at' | 'is_edited'>) => {
      const newEntry: Entry = {
        ...entry,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        is_edited: false,
      };
      setEntries((prev) => [newEntry, ...prev]);
      return newEntry;
    },
    []
  );

  const updateEntry = useCallback(
    (id: string, updates: Partial<Omit<Entry, 'id' | 'created_at' | 'module_type' | 'timestamp'>>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates, is_edited: true } : e))
      );
    },
    []
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => { setEntries([]); }, []);

  return { entries, addEntry, updateEntry, deleteEntry, clearAll };
}
