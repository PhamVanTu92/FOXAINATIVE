'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Code2, FileCode2, Webhook, Copy, Check, FileText, Cpu, Layers, Pencil,
} from 'lucide-react';
import { buildEmbedSnippet } from '@/lib/chatbot-api';
import type { ChatbotItem, EmbedKind, OverlapType, UpdateChatbotPayload } from '@/lib/chatbot-api';
import { useRoutePermission } from '@/hooks/usePermission';

interface Props {
  bot: ChatbotItem;
  onUpdateConfig: (id: string, patch: UpdateChatbotPayload) => void;
  onEdit: () => void;
}

export function ChatbotDetailView({ bot, onUpdateConfig, onEdit }: Props) {
  return (
    <div className="flex-1 overflow-y-auto bg-dark-50/40">
      <div className="px-6 py-6 space-y-6 max-w-5xl">
        <BotHeader bot={bot} onEdit={onEdit} />
        <ChunkSection bot={bot} onUpdateConfig={onUpdateConfig} />
        <IntegrationSection bot={bot} />
      </div>
    </div>
  );
}

function BotHeader({ bot, onEdit }: { bot: ChatbotItem; onEdit: () => void }) {
  const canUpdate = useRoutePermission('UPDATE');

  return (
    <div className="bg-white rounded-xl border border-dark-200 shadow-sm px-5 py-4
      flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-dark-800 truncate">{bot.name}</h2>
        <p className="text-xs text-dark-500 mt-0.5 truncate">
          {bot.shortDescription || '—'}
          <span className="mx-1.5 text-dark-300">·</span>
          {bot.knowledgeBaseIds.length} bộ tri thức
          <span className="mx-1.5 text-dark-300">·</span>
          {bot.faqs.length} FAQ
        </p>
      </div>
      {canUpdate && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
            border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100
            rounded-lg transition-colors shrink-0"
        >
          <Pencil size={13} /> Chỉnh sửa
        </button>
      )}
    </div>
  );
}

// ─── Chunk config ─────────────────────────────────────────────────────────────

function ChunkSection({
  bot, onUpdateConfig,
}: {
  bot: ChatbotItem;
  onUpdateConfig: (id: string, patch: UpdateChatbotPayload) => void;
}) {
  const [chunkSize, setChunkSize] = useState(bot.chunkSize);
  const [overlapType, setOverlapType] = useState<OverlapType>(bot.overlapType);
  const [overlapValue, setOverlapValue] = useState(bot.overlapValue);

  // Re-sync khi chuyển sang bot khác
  useEffect(() => {
    setChunkSize(bot.chunkSize);
    setOverlapType(bot.overlapType);
    setOverlapValue(bot.overlapValue);
  }, [bot.id, bot.chunkSize, bot.overlapType, bot.overlapValue]);

  const commitChunkSize = () => {
    if (chunkSize !== bot.chunkSize) onUpdateConfig(bot.id, { chunkSize });
  };
  const commitOverlap = (type: OverlapType, value: number) => {
    if (type !== bot.overlapType || value !== bot.overlapValue) {
      onUpdateConfig(bot.id, { overlapType: type, overlapValue: value });
    }
  };

  return (
    <div className="space-y-5">
      {/* Độ dài chunk */}
      <Field
        label="Độ dài phần đoạn (Ký tự)"
        required
        hint="Gợi ý: 256 – 1024 ký tự"
      >
        <div className="flex items-center gap-3 max-w-md">
          <input
            type="number"
            min={64} max={4096}
            value={chunkSize}
            onChange={e => setChunkSize(Number(e.target.value) || 0)}
            onBlur={commitChunkSize}
            className="w-32 border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          />
          <span className="text-xs text-dark-500">ký tự / chunk</span>
        </div>
      </Field>

      {/* Overlap */}
      <Field label="Overlap giữa các chunk">
        <div className="flex items-center gap-2 mb-2">
          <SegmentBtn
            active={overlapType === 'PERCENT'}
            onClick={() => { setOverlapType('PERCENT'); commitOverlap('PERCENT', overlapValue); }}
          >
            % Tỷ lệ (%)
          </SegmentBtn>
          <SegmentBtn
            active={overlapType === 'CHARS'}
            onClick={() => { setOverlapType('CHARS'); commitOverlap('CHARS', overlapValue); }}
          >
            Tr Số lượng (ký tự)
          </SegmentBtn>
        </div>
        <div className="flex items-center gap-3 max-w-md">
          <input
            type="number"
            min={0}
            value={overlapValue}
            onChange={e => setOverlapValue(Number(e.target.value) || 0)}
            onBlur={() => commitOverlap(overlapType, overlapValue)}
            className="w-32 border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          />
          <span className="text-xs text-dark-500">
            {overlapType === 'PERCENT'
              ? '% độ dài chunk  |  Gợi ý: 10 – 20%'
              : 'ký tự overlap  |  Gợi ý: 32 – 128 ký tự'}
          </span>
        </div>
      </Field>
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
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors
        ${active
          ? 'bg-primary-50 text-primary-700 border-primary-300 ring-2 ring-primary-100'
          : 'bg-white text-dark-600 border-dark-200 hover:bg-dark-50'}`}
    >
      <span className={`w-3 h-3 rounded-full border-2
        ${active ? 'border-primary-600 bg-primary-600 ring-2 ring-primary-200' : 'border-dark-300 bg-white'}`} />
      {children}
    </button>
  );
}

// ─── Integration ──────────────────────────────────────────────────────────────

function IntegrationSection({ bot }: { bot: ChatbotItem }) {
  const [kind, setKind] = useState<EmbedKind>('WIDGET');
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => buildEmbedSnippet(bot, kind), [bot, kind]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <section className="bg-white rounded-xl border border-dark-200 shadow-sm">
      <header className="px-5 py-4 border-b border-dark-100 flex items-center gap-2">
        <Code2 size={16} className="text-dark-500" />
        <h2 className="text-base font-semibold text-dark-800">Tích hợp</h2>
      </header>

      <div className="p-5 space-y-3">
        <p className="text-xs text-dark-500">
          Sao chép đoạn script bên dưới và dán vào mã nguồn của hệ thống bạn muốn nhúng chatbot.
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <TabBtn active={kind === 'WIDGET'} onClick={() => setKind('WIDGET')}
            icon={<FileCode2 size={13} />}>Web Widget</TabBtn>
          <TabBtn active={kind === 'IFRAME'} onClick={() => setKind('IFRAME')}
            icon={<Layers size={13} />}>iFrame</TabBtn>
          <TabBtn active={kind === 'REST'} onClick={() => setKind('REST')}
            icon={<Webhook size={13} />}>REST API</TabBtn>
        </div>

        {/* Code block */}
        <div className="relative rounded-lg border border-dark-800 bg-dark-900 overflow-hidden">
          <button
            onClick={copy}
            className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1
              text-[11px] font-medium rounded-md bg-dark-700 hover:bg-dark-600
              text-white border border-dark-600 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Đã chép' : 'Sao chép'}
          </button>
          <pre className="text-[12px] text-emerald-200 font-mono p-4 overflow-x-auto leading-relaxed">
            <code>{snippet}</code>
          </pre>
        </div>

        {/* Bot ID footer */}
        <div className="flex items-center flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
            bg-violet-50 text-violet-700 border border-violet-200 font-mono">
            <Cpu size={12} /> Bot ID: {bot.id}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
            bg-dark-100 text-dark-600 border border-dark-200 font-mono">
            <FileText size={12} /> file://
          </span>
        </div>
      </div>
    </section>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors
        ${active
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-dark-600 border-dark-200 hover:bg-dark-50'}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-700 mb-1.5">
        {label} {required && <span className="text-danger-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-dark-400 mt-1">{hint}</p>}
    </div>
  );
}
