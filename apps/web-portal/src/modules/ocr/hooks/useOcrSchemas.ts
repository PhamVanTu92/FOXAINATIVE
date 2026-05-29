'use client';

import { useState, useEffect, useCallback } from 'react';
import { ocrApi } from '@/lib/ocr-api';
import type { SchemaListItem, SchemaStats, DocType } from '@/lib/ocr-api';

export function useOcrSchemas() {
  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);
  const [stats, setStats] = useState<SchemaStats>({ totalSchemas: 0, activeSchemas: 0, totalFields: 0, totalTables: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.type = typeFilter;
      const [schemasData, statsData] = await Promise.all([
        ocrApi.getSchemas(params),
        ocrApi.getSchemaStats(),
      ]);
      setSchemas(schemasData);
      setStats(statsData);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (schema: SchemaListItem) => {
    try {
      await ocrApi.updateSchema(schema.id, { isActive: !schema.isActive });
      setSchemas(prev => prev.map(s => s.id === schema.id ? { ...s, isActive: !s.isActive } : s));
      setStats(prev => ({
        ...prev,
        activeSchemas: prev.activeSchemas + (schema.isActive ? -1 : 1),
      }));
      // Notify sidebar to refresh schema list
      window.dispatchEvent(new CustomEvent('schemas:updated'));
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleDelete = async (schema: SchemaListItem) => {
    if (schema._count.documents > 0) {
      alert(`Không thể xóa: schema đang được dùng bởi ${schema._count.documents} chứng từ.`);
      return;
    }
    if (!confirm(`Xóa schema "${schema.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await ocrApi.deleteSchema(schema.id);
      setSchemas(prev => prev.filter(s => s.id !== schema.id));
      setStats(prev => ({
        ...prev,
        totalSchemas: prev.totalSchemas - 1,
        activeSchemas: schema.isActive ? prev.activeSchemas - 1 : prev.activeSchemas,
        totalFields: prev.totalFields - schema._count.fields,
        totalTables: prev.totalTables - schema._count.tables,
      }));
    } catch (e: unknown) { alert((e as Error).message); }
  };

  return {
    schemas, stats, loading, error,
    search, setSearch,
    typeFilter, setTypeFilter: (v: DocType | '') => setTypeFilter(v),
    load, toggleActive, handleDelete,
  };
}
