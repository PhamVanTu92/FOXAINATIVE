'use client';

import { useMemo, useState } from 'react';
import {
  X, Save, Lightbulb, BookOpen, History, Globe,
  Webhook, Check, Code2, FileCode2, Layers, Copy,
  AlertCircle, Cpu, FileText, Settings2, Trash2,
} from 'lucide-react';
import { useChatbotForm } from '../hooks/useChatbotForm';
import { PURPOSE_LABELS, MODE_LABELS, buildEmbedSnippet } from '@/lib/chatbot-api';
import type { ChatbotItem, EmbedKind } from '@/lib/chatbot-api';
import type { Collection } from '@/lib/collections-api';

interface Props {
  collections: Collection[];
  editing?: ChatbotItem | null;
  onSaved: (bot: ChatbotItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const inputCls =
  'w-full border border-default rounded-lg px-3 py-2 text-sm text-content-primary ' +
  'placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary-500 ' +
  'focus:border-transparent bg-surface';

export function ChatbotCreateForm({ collections, editing = null, onSaved, onCancel, onDelete }: Props) {
  const f = useChatbotForm(onSaved, collections, editing);

  const [hasScenario, setHasScenario] = useState(!!editing?.systemPrompt);
  const [kbTab, setKbTab] = useState<'kb' | 'api'>('kb');

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-default px-6 py-4
        flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-content-primary truncate">
            {f.isEdit ? `Sửa: ${editing?.name ?? f.name}` : 'Thêm chatbot mới'}
          </h2>
          <p className="text-xs text-content-secondary mt-0.5">
            {f.isEdit ? 'Cập nhật cấu hình chatbot' : 'Tạo mới chatbot'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {f.isEdit && onDelete && (
            <button type="button" onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                border border-danger-300 text-danger-600 rounded-lg hover:bg-danger-50 transition-colors">
              <Trash2 size={14} /> Xóa chatbot
            </button>
          )}
          <button type="button" onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              border border-default text-content-secondary rounded-lg hover:bg-subtle transition-colors">
            <X size={14} /> Hủy
          </button>
          <button type="button" onClick={f.submit} disabled={f.submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
              bg-warning-500 hover:bg-warning-600 text-white rounded-lg shadow-sm
              disabled:opacity-60 transition-colors">
            <Save size={14} />
            {f.submitting ? 'Đang lưu…' : 'Lưu chatbot'}
          </button>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-dark-50/40">
        <div className="px-6 py-6 space-y-5 max-w-5xl">

          {/* 1. Thông tin cơ bản */}
          <SectionCard icon={<Lightbulb size={16} className="text-warning-500" />} title="Thông tin cơ bản">
            <Field label="Tên chatbot" required>
              <input className={inputCls} placeholder="VD: Bot hỗ trợ kế toán nội bộ"
                value={f.name} onChange={e => f.setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mục đích sử dụng" required>
                <select className={inputCls} value={f.purpose}
                  onChange={e => f.setPurpose(e.target.value as typeof f.purpose)}>
                  <option value="">-- Chọn mục đích --</option>
                  {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Hình thức" required>
                <select className={inputCls} value={f.mode}
                  onChange={e => f.setMode(e.target.value as typeof f.mode)}>
                  <option value="">-- Chọn hình thức --</option>
                  {Object.entries(MODE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Trạng thái">
              <Toggle checked={f.active} onChange={f.setActive} labelOn="Kích hoạt" labelOff="Vô hiệu" />
            </Field>
            <Field label="Mô tả ngắn">
              <input className={inputCls} placeholder="Mô tả chức năng của chatbot này..."
                value={f.shortDescription} onChange={e => f.setShortDescription(e.target.value)} />
            </Field>
          </SectionCard>

          {/* 2. Chatbot có kịch bản */}
          <div className="bg-surface rounded-xl border border-default shadow-sm">
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <BookOpen size={16} className="text-warning-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-content-primary">Chatbot có kịch bản</p>
                  <p className="text-xs text-content-secondary mt-0.5">Kịch bản hỏi đáp định sẵn cho chatbot</p>
                </div>
              </div>
              <Toggle checked={hasScenario} onChange={v => {
                setHasScenario(v);
                if (!v) f.setSystemPrompt('');
              }} />
            </div>
            {hasScenario && (
              <div className="px-5 pb-5 border-t border-default pt-4">
                <label className="block text-sm font-medium text-content-primary mb-1.5">
                  Mô tả kịch bản hỏi đáp
                </label>
                <textarea
                  className={inputCls + ' resize-y min-h-[120px]'}
                  rows={5}
                  placeholder={"Bước 1: Chào hỏi và xác định nhu cầu.\nBước 2: Tra cứu tài liệu liên quan.\nBước 3: Đưa ra hướng dẫn cụ thể kèm trích dẫn tài liệu."}
                  value={f.systemPrompt}
                  onChange={e => f.setSystemPrompt(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 3. Lưu lịch sử hội thoại */}
          <div className="bg-surface rounded-xl border border-default shadow-sm px-5 py-4
            flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <History size={16} className="text-warning-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-content-primary">Lưu lịch sử hội thoại</p>
                <p className="text-xs text-content-secondary mt-0.5">
                  Ghi lại toàn bộ cuộc hội thoại của bot này để xem lại và phân tích
                </p>
              </div>
            </div>
            <Toggle checked={f.saveHistory} onChange={f.setSaveHistory} />
          </div>

          {/* 4. Nguồn tri thức đầu vào */}
          <SectionCard icon={<Globe size={16} className="text-violet-600" />} title="Nguồn tri thức đầu vào">
            <div className="flex items-center gap-2">
              <KbTabBtn active={kbTab === 'kb'} onClick={() => setKbTab('kb')}
                icon={<BookOpen size={13} />}>Bộ tri thức</KbTabBtn>
              <KbTabBtn active={kbTab === 'api'} onClick={() => setKbTab('api')}
                icon={<Webhook size={13} />}>Kết nối API</KbTabBtn>
            </div>

            {kbTab === 'kb' && (
              <>
                <p className="text-sm text-content-secondary">
                  Tích chọn các bộ tri thức mà chatbot này được phép truy cập:
                </p>
                {collections.length === 0 ? (
                  <p className="text-sm text-content-muted italic">
                    Chưa có bộ tri thức nào. Hãy tạo collection trong &quot;Tri thức AI&quot; trước.
                  </p>
                ) : (
                  <div className="max-h-[370px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    {collections.map(c => {
                      const checked = f.collectionIds.includes(c.id);
                      return (
                        <button key={c.id} type="button" onClick={() => f.toggleCollection(c.id)}
                          className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border
                            transition-all ${checked
                              ? 'border-violet-400 bg-violet-50/60 ring-1 ring-violet-200'
                              : 'border-default bg-surface hover:border-strong hover:bg-subtle'}`}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center
                            justify-center shrink-0 transition-colors
                            ${checked ? 'border-violet-600 bg-violet-600' : 'border-strong bg-surface'}`}>
                            {checked && <Check size={10} className="text-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate">{c.name}</p>
                            {c.description && (
                              <p className="text-xs text-content-secondary mt-0.5 truncate">{c.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                )}
              </>
            )}

            {kbTab === 'api' && (
              <div className="rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-3
                text-sm text-primary-700">
                Nguồn từ API sẽ được hỗ trợ trong phiên bản tiếp theo.
              </div>
            )}
          </SectionCard>

          {/* 5. Chunking dữ liệu (chỉ edit mode) */}
          {/* {f.isEdit && (
            <SectionCard icon={<Settings2 size={16} className="text-sky-600" />} title="Chunking dữ liệu">
              <Field label="Chiến lược phân đoạn">
                <div className="grid grid-cols-2 gap-3">
                  <StrategyCard active icon={<FileText size={14} />}
                    title="Theo độ dài" desc="Phân đoạn theo số ký tự cố định" />
                  <StrategyCard active={false} icon={<Layers size={14} />}
                    title="Theo cấu trúc" desc="Phân đoạn theo thành phần tài liệu" />
                </div>
              </Field>

              <Field label="Độ dài phân đoạn (Ký tự)" required>
                <div className="flex items-center gap-3">
                  <input type="number" min={64} max={4096}
                    value={f.chunkSize}
                    onChange={e => f.setChunkSize(Number(e.target.value) || 0)}
                    className="w-32 border border-default rounded-lg px-3 py-2 text-sm
                      text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500
                      focus:border-transparent bg-surface"
                  />
                  <span className="text-xs text-content-secondary">ký tự / chunk</span>
                  <span className="text-xs text-content-muted">|  Gợi ý: 256 – 1024 ký tự</span>
                </div>
              </Field>

              <Field label="Overlap giữa các chunk">
                <div className="flex items-center gap-2 mb-3">
                  <SegmentBtn active={f.overlapType === 'PERCENT'}
                    onClick={() => f.setOverlapType('PERCENT')}>
                    % Tỷ lệ (%)
                  </SegmentBtn>
                  <SegmentBtn active={f.overlapType === 'CHARS'}
                    onClick={() => f.setOverlapType('CHARS')}>
                    Tr Số lượng (ký tự)
                  </SegmentBtn>
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" min={0}
                    value={f.overlapValue}
                    onChange={e => f.setOverlapValue(Number(e.target.value) || 0)}
                    className="w-32 border border-default rounded-lg px-3 py-2 text-sm
                      text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500
                      focus:border-transparent bg-surface"
                  />
                  <span className="text-xs text-content-secondary">
                    {f.overlapType === 'PERCENT'
                      ? '% độ dài chunk  |  Gợi ý: 10 – 20%'
                      : 'ký tự overlap  |  Gợi ý: 32 – 128 ký tự'}
                  </span>
                </div>
              </Field>
            </SectionCard>
          )} */}

          {/* 6. Tích hợp (chỉ edit mode) */}
          {f.isEdit && editing && (
            <IntegrationPanel bot={editing} />
          )}

          {f.error && (
            <div className="flex items-start gap-2 bg-danger-50 border border-danger-200
              text-danger-700 rounded-lg px-4 py-3 text-sm whitespace-pre-line">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{f.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── IntegrationPanel ─────────────────────────────────────────────────────────

function IntegrationPanel({ bot }: { bot: ChatbotItem }) {
  const [kind, setKind] = useState<EmbedKind>('WIDGET');
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => buildEmbedSnippet(bot, kind), [bot, kind]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <SectionCard icon={<Code2 size={16} className="text-sky-600" />} title="Tích hợp">
      <p className="text-xs text-content-secondary">
        Sao chép đoạn script bên dưới và dán vào mã nguồn của hệ thống bạn muốn nhúng chatbot.
      </p>

      <div className="flex items-center gap-2">
        <EmbedTabBtn active={kind === 'WIDGET'} onClick={() => setKind('WIDGET')}
          icon={<FileCode2 size={13} />}>Web Widget</EmbedTabBtn>
        <EmbedTabBtn active={kind === 'IFRAME'} onClick={() => setKind('IFRAME')}
          icon={<Layers size={13} />}>iFrame</EmbedTabBtn>
        <EmbedTabBtn active={kind === 'REST'} onClick={() => setKind('REST')}
          icon={<Webhook size={13} />}>REST API</EmbedTabBtn>
      </div>

      {/* Code block — intentionally dark in both themes */}
      <div className="relative rounded-lg border border-dark-800 bg-dark-900 overflow-hidden">
        <button onClick={copy}
          className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1
            text-[11px] font-medium rounded-md bg-dark-700 hover:bg-dark-600
            text-white border border-dark-600 transition-colors">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
        <pre className="text-[12px] text-emerald-200 font-mono p-4 overflow-x-auto leading-relaxed">
          <code>{snippet}</code>
        </pre>
      </div>

      <div className="flex items-center flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
          bg-violet-50 text-violet-700 border border-violet-200 font-mono">
          <Cpu size={12} /> Bot ID: {bot.id}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
          bg-subtle text-content-secondary border border-default font-mono">
          <FileText size={12} /> {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}
        </span>
      </div>
    </SectionCard>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  icon, title, children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface rounded-xl border border-default shadow-sm">
      <header className="px-5 py-4 border-b border-default flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-primary mb-1.5">
        {label} {required && <span className="text-danger-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked, onChange, labelOn = 'Bật', labelOff = 'Tắt',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 shrink-0">
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
        ${checked ? 'bg-warning-500' : 'bg-dark-400'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${checked ? 'text-warning-700' : 'text-content-muted'}`}>
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
}

function KbTabBtn({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
        rounded-md border transition-colors
        ${active
          ? 'bg-violet-600 text-white border-violet-600'
          : 'bg-surface text-content-secondary border-default hover:bg-subtle'}`}
    >
      {icon} {children}
    </button>
  );
}

function EmbedTabBtn({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
        rounded-md border transition-colors
        ${active
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-surface text-content-secondary border-default hover:bg-subtle'}`}
    >
      {icon} {children}
    </button>
  );
}

function StrategyCard({
  active, icon, title, desc,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border
      ${active
        ? 'border-primary-300 bg-primary-50/60 ring-1 ring-primary-100'
        : 'border-default bg-surface'}`}
    >
      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center
        ${active ? 'border-primary-600 bg-primary-600' : 'border-strong bg-surface'}`}>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-content-secondary">{icon}</span>
          <span className="text-sm font-medium text-content-primary">{title}</span>
        </div>
        <p className="text-xs text-content-secondary mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function SegmentBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors
        ${active
          ? 'bg-primary-50 text-primary-700 border-primary-300 ring-2 ring-primary-100'
          : 'bg-surface text-content-secondary border-default hover:bg-subtle'}`}
    >
      <span className={`w-3 h-3 rounded-full border-2
        ${active ? 'border-primary-600 bg-primary-600' : 'border-strong bg-surface'}`} />
      {children}
    </button>
  );
}
