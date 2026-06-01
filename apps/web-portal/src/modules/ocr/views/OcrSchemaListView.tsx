'use client';

import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, Pencil, RefreshCw, FileText, AlertCircle,
  Search, Download, Grid3X3, Table2, Settings, ScanLine, ChevronRight,
} from 'lucide-react';
import { useOcrSchemas } from '../hooks/useOcrSchemas';
import { TYPE_CONFIG, TYPE_OPTIONS } from '../constants';
import type { DocType } from '@/lib/ocr-api';
import { useRoutePermission } from '@/hooks/usePermission';
import { useUIStore } from '@/stores/ui';

function StatusToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 group"
      title={active ? 'Nhấn để tắt' : 'Nhấn để bật'}
    >
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-success-500' : 'bg-content-muted'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${active ? 'text-success-600' : 'text-content-muted'}`}>
        {active ? 'Áp dụng' : 'Tắt'}
      </span>
    </button>
  );
}

export function OcrSchemaListView() {
  const router = useRouter();
  const { showToast } = useUIStore();
  const {
    schemas, stats, loading, error,
    search, setSearch, typeFilter, setTypeFilter,
    load, toggleActive, handleDelete,
  } = useOcrSchemas();

  const canCreate = useRoutePermission('CREATE');
  const canUpdate = useRoutePermission('UPDATE');
  const canDelete = useRoutePermission('DELETE');
  const canExport = useRoutePermission('EXPORT');

  return (
    <div className="min-h-screen bg-subtle">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-surface border-b border-default shadow-sm px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-content-muted mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Cấu hình hệ thống</span>
          <ChevronRight className="w-3 h-3" />
          <ScanLine className="w-3.5 h-3.5" />
          <span>Cấu hình OCR</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-content-secondary font-medium">Thiết lập Chứng từ OCR</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-content-primary">Thiết lập Chứng từ OCR</h1>
              <p className="text-xs text-content-muted mt-0.5">Quản lý các schema cấu hình nhận dạng chứng từ</p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg text-content-muted hover:bg-subtle" title="Làm mới">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Stats cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Tổng chứng từ',   value: stats.totalSchemas,  icon: FileText, iconBg: 'bg-primary-100', iconColor: 'text-primary-600',  accent: 'border-l-primary-500'  },
            { label: 'Đang áp dụng',    value: stats.activeSchemas, icon: FileText, iconBg: 'bg-success-100', iconColor: 'text-success-600',  accent: 'border-l-success-500'  },
            { label: 'Tổng trường OCR', value: stats.totalFields,   icon: Grid3X3,  iconBg: 'bg-violet-100',  iconColor: 'text-violet-600',   accent: 'border-l-violet-500'   },
            { label: 'Tổng bảng OCR',   value: stats.totalTables,   icon: Table2,   iconBg: 'bg-warning-100',  iconColor: 'text-warning-600',   accent: 'border-l-warning-500'   },
          ].map(({ label, value, icon: Icon, iconBg, iconColor, accent }) => (
            <div key={label} className={`bg-surface rounded-xl border-l-4 border border-strong shadow-sm px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow duration-base ${accent}`}>
              <div>
                <p className="text-xs text-content-secondary">{label}</p>
                <p className="text-2xl font-bold text-content-primary mt-1">{value}</p>
              </div>
              <div className={`p-3 rounded-xl ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm chứng từ OCR..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-surface transition-all text-content-primary"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as DocType | '')}
            className="px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-surface text-content-secondary transition-all"
          >
            <option value="">Tất cả loại</option>
            {TYPE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>

          <div className="flex-1" />

          {canExport && (
            <button
              onClick={() => showToast('Tính năng xuất Excel đang phát triển.', 'error')}
              className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary border border-default rounded-lg hover:bg-subtle transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => router.push('/he-thong/ocr/tao-moi')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md hover:opacity-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Tạo mới chứng từ OCR
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-surface rounded-xl border border-default shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-100 border-b border-primary-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-12">STT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Mã chứng từ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Tên chứng từ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-32">Số trường OCR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-28">Số bảng OCR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide">Mô tả</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wide w-32">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-600 uppercase tracking-wide w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-strong">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-content-muted">Đang tải...</td>
                </tr>
              ) : schemas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <FileText className="w-10 h-10 text-content-muted opacity-50 mx-auto mb-2" />
                    <p className="text-content-muted text-sm">Chưa có chứng từ OCR nào. Nhấn &quot;Tạo mới&quot; để bắt đầu.</p>
                  </td>
                </tr>
              ) : schemas.map((schema, idx) => {
                const typeConf = TYPE_CONFIG[schema.type];
                return (
                  <tr key={schema.id} className="hover:bg-subtle transition-colors">
                    <td className="px-4 py-3 text-content-muted text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-strong text-content-secondary px-2 py-0.5 rounded font-mono border border-default">
                        {schema.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium text-content-primary">{schema.name}</td>
                    <td className="px-4 py-3">
                      {typeConf && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          typeConf.color === 'bg-teal-100 text-teal-700' ? 'bg-teal-100 text-teal-700' :
                          typeConf.color === 'bg-blue-100 text-blue-700' ? 'bg-blue-100 text-blue-700' :
                          typeConf.color === 'bg-purple-100 text-purple-700' ? 'bg-purple-100 text-purple-700' :
                          typeConf.color
                        }`}>
                          {typeConf.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-content-secondary text-sm">
                        <Grid3X3 className="w-3.5 h-3.5 text-violet-400" />
                        {schema._count.fields}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-content-secondary text-sm">
                        <Table2 className="w-3.5 h-3.5 text-orange-400" />
                        {schema._count.tables}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-content-secondary max-w-[200px]">
                      <span className="truncate block text-xs" title={schema.description ?? ''}>
                        {schema.description ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusToggle active={schema.isActive} onToggle={() => toggleActive(schema)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/he-thong/ocr/${schema.id}`)}
                            className="p-1.5 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(schema)}
                            className="p-1.5 text-content-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={schema._count.documents > 0 ? `Đang dùng bởi ${schema._count.documents} chứng từ` : 'Xóa'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
