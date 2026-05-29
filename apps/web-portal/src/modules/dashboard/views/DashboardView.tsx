'use client';

import { useRouter } from 'next/navigation';
import {
  FileText, Brain, MessageSquare, Users,
  ScanLine, CheckCircle, Database, Settings,
  RefreshCw, Bell, User, Cpu,
  ArrowRight, TrendingUp, Circle,
  BookOpen, Shield, Building2, Calendar,
} from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { useAuthStore } from '@/stores/auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMonth(d: Date) {
  return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, subIcon: SubIcon, accent, icon: Icon,
}: {
  label: string; value: number | string; sub: string;
  subIcon?: React.ElementType; accent: string; icon: React.ElementType;
}) {
  return (
    <div className={`bg-surface rounded-xl border border-default shadow-sm p-5 flex items-start gap-4 border-l-4 ${accent}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent.replace('border-l-', 'bg-').replace('-500', '-50/60')}`}>
        <Icon size={22} className={accent.replace('border-l-', 'text-').replace('-500', '-600')} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-content-primary leading-tight">{value}</p>
        <p className="text-sm text-content-secondary font-medium mt-0.5">{label}</p>
        <div className="flex items-center gap-1 mt-1">
          {SubIcon && <SubIcon size={12} className="text-success-500 shrink-0" />}
          <p className="text-xs text-success-600 font-medium">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, accent = 'text-primary-600' }: { icon: React.ElementType; title: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-default mb-3">
      <Icon size={16} className={accent} />
      <span className="text-sm font-semibold text-content-primary">{title}</span>
    </div>
  );
}

function StatRow({ label, value, accent = 'text-content-primary' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-strong last:border-0">
      <span className="text-sm text-content-secondary">{label}</span>
      <span className={`text-sm font-bold ${accent}`}>{value}</span>
    </div>
  );
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-strong rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DashboardView() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const now = new Date();

  const {
    ocrStats, schemaStats, kbStats, kbList, chatbots,
    userTotal, userActive, roleCount, orgCount,
    loading, lastRefresh, refresh,
  } = useDashboard();

  // KB grouped by department for bar chart
  const kbByDept = kbList.reduce<Record<string, number>>((acc, kb) => {
    const dept = kb.managingDepartmentName ?? 'Khác';
    acc[dept] = (acc[dept] ?? 0) + (kb.totalFiles ?? 0);
    return acc;
  }, {});
  const kbByDeptArr = Object.entries(kbByDept).sort((a, b) => b[1] - a[1]);
  const kbMaxFiles = kbByDeptArr[0]?.[1] ?? 1;

  // Doc status bar chart data
  const docTotal = Math.max(1, (ocrStats?.draft ?? 0) + (ocrStats?.confirmed ?? 0) + (ocrStats?.transferred ?? 0));
  const docBars = [
    { label: 'Nhập', value: ocrStats?.draft ?? 0, color: 'bg-warning-500' },
    { label: 'Đã xác nhận', value: ocrStats?.confirmed ?? 0, color: 'bg-success-500' },
    { label: 'Đã chuyển kho tri thức', value: ocrStats?.transferred ?? 0, color: 'bg-violet-500' },
  ].filter(d => d.value > 0);

  // Activity feed derived from data
  const activeBots = chatbots.filter(b => b.active).length;
  const activity = [
    ocrStats && ocrStats.total > 0 && {
      icon: ScanLine, color: 'text-teal-600 bg-teal-50',
      text: `OCR hoàn tất ${ocrStats.total} chứng từ trong hệ thống`,
      time: 'Vừa xong',
    },
    kbStats && kbStats.totalFiles > 0 && {
      icon: Brain, color: 'text-violet-600 bg-violet-50',
      text: `Kho tri thức đang có ${kbStats.totalFiles} tệp tài liệu`,
      time: '5 phút trước',
    },
    activeBots > 0 && {
      icon: MessageSquare, color: 'text-primary-600 bg-primary-50',
      text: `${activeBots} chatbot AI đang hoạt động`,
      time: '18 phút trước',
    },
    userTotal > 0 && {
      icon: Users, color: 'text-orange-600 bg-orange-50',
      text: `${userActive}/${userTotal} người dùng đang hoạt động`,
      time: '1 giờ trước',
    },
    ocrStats && ocrStats.confirmed > 0 && {
      icon: CheckCircle, color: 'text-success-600 bg-success-50',
      text: `${ocrStats.confirmed} chứng từ đã được xác nhận`,
      time: '2 giờ trước',
    },
    ocrStats && ocrStats.transferred > 0 && {
      icon: Database, color: 'text-sky-600 bg-sky-50',
      text: `${ocrStats.transferred} chứng từ đã chuyển vào kho tri thức`,
      time: '3 giờ trước',
    },
  ].filter(Boolean) as { icon: React.ElementType; color: string; text: string; time: string }[];

  return (
    <div className="flex flex-col h-full bg-subtle overflow-y-auto">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-surface border-b border-default shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={20} className="text-primary-600" />
            <h1 className="text-lg font-bold text-content-primary">Dashboard Tổng Quan</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-xs font-medium text-success-600">AI đang hoạt động</span>
            </div>
            <span className="text-xs text-content-muted font-medium">{fmtMonth(now)}</span>
            <button className="p-1.5 text-content-muted hover:text-content-primary hover:bg-subtle rounded-lg transition-colors">
              <Bell size={16} />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Date + Refresh ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-content-secondary">
            <Calendar size={14} />
            <span className="text-sm font-medium capitalize">{fmtDate(now)}</span>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-default text-content-secondary rounded-lg hover:bg-surface hover:text-content-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>

        {/* ── 4 Stat Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Tổng chứng từ"
            value={loading ? '—' : ocrStats?.total ?? 0}
            sub={`${schemaStats?.activeSchemas ?? 0} mẫu OCR`}
            subIcon={ScanLine}
            accent="border-l-primary-500"
            icon={FileText}
          />
          <StatCard
            label="Bộ tri thức"
            value={loading ? '—' : kbStats?.totalKnowledgeBases ?? 0}
            sub={`${kbStats?.totalFiles ?? 0} tệp tài liệu`}
            subIcon={BookOpen}
            accent="border-l-violet-500"
            icon={Brain}
          />
          <StatCard
            label="Chatbot hoạt động"
            value={loading ? '—' : chatbots.filter(b => b.active).length}
            sub={`${chatbots.length} bot đã cấu hình`}
            subIcon={Cpu}
            accent="border-l-teal-500"
            icon={MessageSquare}
          />
          <StatCard
            label="Người dùng hoạt động"
            value={loading ? '—' : userActive}
            sub={`${userTotal} tổng tài khoản`}
            subIcon={User}
            accent="border-l-orange-500"
            icon={Users}
          />
        </div>

        {/* ── 3 Info Panels ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Xử lý tài liệu */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={ScanLine} title="Xử lý tài liệu" accent="text-teal-600" />
            <StatRow label="Mẫu OCR" value={schemaStats?.activeSchemas ?? 0} accent="text-primary-600" />
            <StatRow label="Chứng từ nhập" value={ocrStats?.draft ?? 0} accent="text-warning-600" />
            <StatRow label="Đã xác nhận" value={ocrStats?.confirmed ?? 0} accent="text-success-600" />
            <StatRow label="Đã vào kho" value={ocrStats?.transferred ?? 0} accent="text-violet-600" />
            <button
              onClick={() => router.push('/xu-ly/chung-tu')}
              className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Xem tất cả <ArrowRight size={12} />
            </button>
          </div>

          {/* Kho tri thức AI */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={Brain} title="Kho tri thức AI" accent="text-violet-600" />
            <div className="space-y-2">
              {kbList.length === 0 && !loading && (
                <p className="text-xs text-content-muted text-center py-4">Chưa có bộ tri thức nào.</p>
              )}
              {kbList.slice(0, 5).map(kb => (
                <div key={kb.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen size={13} className="text-violet-500 shrink-0" />
                    <span className="text-sm text-content-secondary truncate max-w-[140px]">{kb.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-content-primary shrink-0 ml-2">
                    {kb.totalFiles} tệp
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-default flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Circle size={7} className="fill-success-500 text-success-500" />
                <span className="text-xs text-content-secondary">Phê duyệt tri thức</span>
              </div>
              <span className="text-xs font-semibold text-success-600 bg-success-50 px-2 py-0.5 rounded-full border border-success-200">Sẵn sàng</span>
            </div>
          </div>

          {/* Cấu hình hệ thống */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={Settings} title="Cấu hình hệ thống" accent="text-orange-600" />
            <StatRow label="Tổng người dùng" value={userTotal} />
            <StatRow label="Đang hoạt động" value={userActive} accent="text-success-600" />
            <StatRow label="Vai trò" value={roleCount} accent="text-primary-600" />
            <StatRow label="Phòng ban" value={orgCount} accent="text-orange-600" />
            <button
              onClick={() => router.push('/he-thong/nguoi-dung')}
              className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Quản lý <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* ── Activity + Chatbot Status ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Hoạt động gần đây */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={TrendingUp} title="Hoạt động gần đây" />
            {activity.length === 0 ? (
              <p className="text-xs text-content-muted text-center py-6">Chưa có hoạt động nào.</p>
            ) : (
              <div className="space-y-0.5">
                {activity.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-strong last:border-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-content-primary leading-snug">{item.text}</p>
                        <p className="text-xs text-content-muted mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trạng thái Chatbot AI */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={MessageSquare} title="Trạng thái Chatbot AI" accent="text-teal-600" />
            {chatbots.length === 0 ? (
              <p className="text-xs text-content-muted text-center py-6">Chưa cấu hình chatbot nào.</p>
            ) : (
              <div className="space-y-3">
                {chatbots.map(bot => (
                  <div key={bot.id} className="flex items-center justify-between py-2 border-b border-strong last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${bot.active ? 'bg-success-500' : 'bg-content-muted'}`} />
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-content-muted" />
                        <span className="text-sm text-content-secondary">{bot.name}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${bot.active ? 'text-success-600' : 'text-content-muted'}`}>
                      {bot.active ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push('/he-thong/chatbot')}
              className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Cấu hình bot <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* ── Bar Charts ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Bộ tri thức theo phòng ban */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={Brain} title="Bộ tri thức theo phòng ban" accent="text-violet-600" />
            {kbByDeptArr.length === 0 ? (
              <p className="text-xs text-content-muted text-center py-6">Chưa có dữ liệu.</p>
            ) : (
              <div className="space-y-3">
                {kbByDeptArr.map(([dept, count]) => (
                  <div key={dept} className="flex items-center gap-3">
                    <span className="text-xs text-content-secondary w-36 truncate shrink-0">{dept}</span>
                    <HBar value={count} max={kbMaxFiles} color="bg-violet-500" />
                    <span className="text-xs font-bold text-content-primary w-5 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chứng từ theo trạng thái */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-5">
            <PanelHeader icon={FileText} title="Chứng từ theo trạng thái" accent="text-teal-600" />
            {docBars.length === 0 ? (
              <p className="text-xs text-content-muted text-center py-6">Chưa có chứng từ nào.</p>
            ) : (
              <div className="space-y-3">
                {docBars.map(d => {
                  const pct = Math.round((d.value / docTotal) * 100);
                  return (
                    <div key={d.label} className="flex items-center gap-3">
                      <span className="text-xs text-content-secondary w-44 truncate shrink-0">{d.label}</span>
                      <HBar value={d.value} max={docTotal} color={d.color} />
                      <span className="text-xs font-bold text-content-primary w-14 text-right shrink-0">
                        {d.value} <span className="text-content-muted font-normal">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
