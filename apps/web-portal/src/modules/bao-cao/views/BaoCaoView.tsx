'use client';

import { useRouter } from 'next/navigation';
import {
  ScanText, Brain, MessageSquare, Settings,
  RefreshCw, Bell, BarChart2, ChevronRight,
  LayoutDashboard,
} from 'lucide-react';
import { useBaoCao } from '../hooks/useBaoCao';
import type { BarEntry } from '../hooks/useBaoCao';
import { useAuthStore } from '@/stores/auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMonth(d: Date) {
  return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatNum({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5 text-center">
      <span className={`text-3xl font-extrabold leading-none ${color}`}>{value}</span>
      <span className="text-xs text-content-muted mt-1.5">{label}</span>
    </div>
  );
}

function HBar({ entry, max }: { entry: BarEntry; max: number }) {
  const pct = max > 0 ? Math.max(3, Math.round((entry.value / max) * 100)) : 3;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm text-content-secondary w-40 truncate shrink-0">{entry.label}</span>
      <div className="flex-1 h-4 bg-subtle rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${entry.color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-content-primary w-5 text-right shrink-0">{entry.value}</span>
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({
  icon: Icon, title, iconCls, borderCls, children,
}: {
  icon: React.ElementType; title: string; iconCls: string; borderCls: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-surface rounded-2xl border border-default shadow-sm overflow-hidden flex flex-col border-l-[3px] ${borderCls}`}>
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-default bg-surface">
        <Icon size={16} className={iconCls} />
        <span className="text-[15px] font-semibold text-content-primary">{title}</span>
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex-1">{children}</div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function BaoCaoView() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const now = new Date();

  const {
    ocrStats, schemaStats, docTypeBreakdown,
    kbStats, kbList, totalPdfFiles,
    chatbots, botPurposeBreakdown,
    userTotal, userActive, roleCount, userDeptBreakdown,
    loading, refresh,
  } = useBaoCao();

  const botsTotal  = chatbots.length;
  const botsActive = chatbots.filter(b => b.active).length;
  const botsScript = chatbots.filter(b => b.hasScript).length;
  const botsApi    = chatbots.filter(b => b.apiKeyCount > 0).length;

  const kbMaxFiles = Math.max(...kbList.map(kb => kb.totalFiles), 1);
  const kbBarData: BarEntry[] = kbList
    .sort((a, b) => b.totalFiles - a.totalFiles)
    .slice(0, 6)
    .map(kb => ({ label: kb.name, value: kb.totalFiles, color: 'bg-violet-500' }));

  const docTypeMax = Math.max(...docTypeBreakdown.map(d => d.value), 1);
  const botMax     = Math.max(...botPurposeBreakdown.map(d => d.value), 1);
  const deptMax    = Math.max(...userDeptBreakdown.map(d => d.value), 1);

  const dash = loading ? '—' : undefined;

  return (
    <div className="flex flex-col h-full bg-subtle">

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-surface border-b border-default shadow-sm shrink-0">
        <div className="flex items-center justify-between px-6 py-3.5">
          {/* Left: title */}
          <div className="flex items-center gap-2.5">
            <BarChart2 size={18} className="text-primary-600" />
            <h1 className="text-base font-bold text-content-primary">Báo cáo &amp; Thống kê</h1>
          </div>
          {/* Right: status + controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-xs font-medium text-success-600">AI đang hoạt động</span>
            </div>
            <span className="text-xs text-content-muted font-medium border border-default rounded-lg px-2.5 py-1">
              {fmtMonth(now)}
            </span>
            <button className="p-1.5 text-content-muted hover:text-content-primary transition-colors">
              <Bell size={16} />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Breadcrumb + refresh */}
        <div className="flex items-center gap-1.5 px-6 py-3 text-xs text-content-muted border-b border-default bg-surface">
          <button onClick={() => router.push('/')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">
            <LayoutDashboard size={12} /> Tổng quan
          </button>
          <ChevronRight size={11} />
          <span className="text-content-secondary font-medium">Báo cáo &amp; Thống kê</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>

        {/* ── 2×2 Panel grid ──────────────────────────────────────────── */}
        <div className="p-6 grid grid-cols-2 gap-5">

          {/* Panel 1 — Xử lý OCR */}
          <Panel icon={ScanText} title="Xử lý OCR" iconCls="text-teal-600" borderCls="border-l-teal-500">
            <div className="grid grid-cols-2 divide-x divide-y divide-default border border-default rounded-xl overflow-hidden">
              <StatNum value={dash ?? schemaStats?.activeSchemas ?? 0} label="Mẫu OCR"         color="text-teal-600" />
              <StatNum value={dash ?? ocrStats?.total ?? 0}            label="Tổng chứng từ"   color="text-indigo-600" />
              <StatNum value={dash ?? ocrStats?.confirmed ?? 0}        label="Đã xác nhận"    color="text-success-600" />
              <StatNum value={dash ?? ocrStats?.transferred ?? 0}      label="Vào kho tri thức" color="text-orange-500" />
            </div>

            {docTypeBreakdown.length > 0 && (
              <>
                <p className="text-sm font-medium text-content-secondary mt-5 mb-2">Loại chứng từ OCR</p>
                <div className="space-y-1">
                  {docTypeBreakdown.map(e => <HBar key={e.label} entry={e} max={docTypeMax} />)}
                </div>
              </>
            )}
            {!loading && docTypeBreakdown.length === 0 && (
              <p className="text-sm text-content-muted text-center py-6">Chưa có chứng từ nào.</p>
            )}
          </Panel>

          {/* Panel 2 — Kho tri thức */}
          <Panel icon={Brain} title="Kho tri thức" iconCls="text-violet-600" borderCls="border-l-violet-500">
            <div className="grid grid-cols-2 divide-x divide-y divide-default border border-default rounded-xl overflow-hidden">
              <StatNum value={dash ?? kbStats?.totalKnowledgeBases ?? 0}  label="Bộ tri thức" color="text-violet-600" />
              <StatNum value={dash ?? kbStats?.totalFiles ?? 0}           label="Tổng tệp"    color="text-indigo-600" />
              <StatNum value={dash ?? kbStats?.departmentsUsingCount ?? 0} label="Phòng ban"  color="text-success-600" />
              <StatNum value={dash ?? totalPdfFiles}                        label="Tệp PDF"    color="text-orange-500" />
            </div>

            {kbBarData.length > 0 && (
              <>
                <p className="text-sm font-medium text-content-secondary mt-5 mb-2">Tệp theo bộ tri thức</p>
                <div className="space-y-1">
                  {kbBarData.map(e => <HBar key={e.label} entry={e} max={kbMaxFiles} />)}
                </div>
              </>
            )}
            {!loading && kbBarData.length === 0 && (
              <p className="text-sm text-content-muted text-center py-6">Chưa có bộ tri thức nào.</p>
            )}
          </Panel>

          {/* Panel 3 — Chatbot AI */}
          <Panel icon={MessageSquare} title="Chatbot AI" iconCls="text-cyan-600" borderCls="border-l-cyan-500">
            <div className="grid grid-cols-2 divide-x divide-y divide-default border border-default rounded-xl overflow-hidden">
              <StatNum value={dash ?? botsTotal}  label="Tổng chatbot"    color="text-teal-600" />
              <StatNum value={dash ?? botsActive} label="Đang hoạt động" color="text-sky-600" />
              <StatNum value={dash ?? botsScript} label="Có kịch bản"    color="text-violet-600" />
              <StatNum value={dash ?? botsApi}    label="Kết nối API"    color="text-amber-500" />
            </div>

            {botPurposeBreakdown.length > 0 && (
              <>
                <p className="text-sm font-medium text-content-secondary mt-5 mb-2">Bot theo mục đích</p>
                <div className="space-y-1">
                  {botPurposeBreakdown.map(e => <HBar key={e.label} entry={e} max={botMax} />)}
                </div>
              </>
            )}
            {!loading && botPurposeBreakdown.length === 0 && (
              <p className="text-sm text-content-muted text-center py-6">Chưa cấu hình chatbot nào.</p>
            )}
          </Panel>

          {/* Panel 4 — Cấu hình hệ thống */}
          <Panel icon={Settings} title="Cấu hình hệ thống" iconCls="text-amber-500" borderCls="border-l-amber-400">
            <div className="grid grid-cols-2 divide-x divide-y divide-default border border-default rounded-xl overflow-hidden">
              <StatNum value={dash ?? userTotal}                       label="Người dùng"    color="text-amber-500" />
              <StatNum value={dash ?? userActive}                      label="Đang hoạt động" color="text-sky-600" />
              <StatNum value={dash ?? roleCount}                       label="Vai trò"       color="text-violet-600" />
              <StatNum value={dash ?? schemaStats?.activeSchemas ?? 0} label="Mẫu OCR"      color="text-success-600" />
            </div>

            {userDeptBreakdown.length > 0 && (
              <>
                <p className="text-sm font-medium text-content-secondary mt-5 mb-2">Người dùng theo phòng ban</p>
                <div className="space-y-1">
                  {userDeptBreakdown.map(e => <HBar key={e.label} entry={e} max={deptMax} />)}
                </div>
              </>
            )}
            {!loading && userDeptBreakdown.length === 0 && (
              <p className="text-sm text-content-muted text-center py-6">Chưa có dữ liệu người dùng.</p>
            )}
          </Panel>

        </div>
      </div>
    </div>
  );
}
