'use client';

import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, Pencil, RefreshCw, FileText, AlertCircle,
  Search, Download, Grid3X3, Table2, Settings, ScanLine, ChevronRight,
} from 'lucide-react';
import { useOcrSchemas } from '../hooks/useOcrSchemas';
import { TYPE_CONFIG, TYPE_OPTIONS } from '../constants';
import type { DocType } from '@/lib/ocr-api';

function StatusToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 group"
      title={active ? 'Nhấn để tắt' : 'Nhấn để bật'}
    >
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${active ? 'text-green-600' : 'text-gray-400'}`}>
        {active ? 'Áp dụng' : 'Tắt'}
      </span>
    </button>
  );
}

export function OcrSchemaListView() {
  const router = useRouter();
  const {
    schemas, stats, loading, error,
    search, setSearch, typeFilter, setTypeFilter,
    load, toggleActive, handleDelete,
  } = useOcrSchemas();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Cấu hình hệ thống</span>
          <ChevronRight className="w-3 h-3" />
          <ScanLine className="w-3.5 h-3.5" />
          <span>Cấu hình OCR</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">Thiết lập Chứng từ OCR</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Thiết lập Chứng từ OCR</h1>
            <p className="text-xs text-gray-400 mt-0.5">Quản lý các schema cấu hình nhận dạng chứng từ</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100" title="Làm mới">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Stats cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Tổng chứng từ', value: stats.totalSchemas, icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
            { label: 'Đang áp dụng', value: stats.activeSchemas, icon: FileText, iconBg: 'bg-green-50', iconColor: 'text-green-500' },
            { label: 'Tổng trường OCR', value: stats.totalFields, icon: Grid3X3, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
            { label: 'Tổng bảng OCR', value: stats.totalTables, icon: Table2, iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <div key={label} className="bg-white rounded-xl border px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm chứng từ OCR..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as DocType | '')}
            className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
          >
            <option value="">Tất cả loại</option>
            {TYPE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>

          <div className="flex-1" />

          <button
            onClick={() => alert('Tính năng xuất Excel đang phát triển.')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>
          <button
            onClick={() => router.push('/he-thong/ocr/tao-moi')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo mới chứng từ OCR
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">STT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã chứng từ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tên chứng từ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Số trường OCR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Số bảng OCR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mô tả</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">Đang tải...</td>
                </tr>
              ) : schemas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Chưa có chứng từ OCR nào. Nhấn &quot;Tạo mới&quot; để bắt đầu.</p>
                  </td>
                </tr>
              ) : schemas.map((schema, idx) => {
                const typeConf = TYPE_CONFIG[schema.type];
                return (
                  <tr key={schema.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono border border-gray-200">
                        {schema.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{schema.name}</td>
                    <td className="px-4 py-3">
                      {typeConf && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-700 text-sm">
                        <Grid3X3 className="w-3.5 h-3.5 text-indigo-400" />
                        {schema._count.fields}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-700 text-sm">
                        <Table2 className="w-3.5 h-3.5 text-orange-400" />
                        {schema._count.tables}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                      <span className="truncate block text-xs" title={schema.description ?? ''}>
                        {schema.description ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusToggle active={schema.isActive} onToggle={() => toggleActive(schema)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => router.push(`/he-thong/ocr/${schema.id}`)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(schema)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title={schema._count.documents > 0 ? `Đang dùng bởi ${schema._count.documents} chứng từ` : 'Xóa'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
