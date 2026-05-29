'use client';

import { Plus, Trash2, BookOpen, MessageSquare, Webhook, Users } from 'lucide-react';
import type { ChatbotItem } from '@/lib/chatbot-api';
import { MODE_LABELS } from '@/lib/chatbot-api';

interface Props {
  bots: ChatbotItem[];
  selectedId: string | null;
  creating: boolean;
  editingId: string | null;
  onStartCreate: () => void;
  onStartEdit: (bot: ChatbotItem) => void;
  onDelete: (bot: ChatbotItem) => void;
}

export function ChatbotSidebar({
  bots, selectedId, creating, editingId,
  onStartCreate, onStartEdit, onDelete,
}: Props) {
  return (
    <aside className="w-[320px] shrink-0 border-r border-dark-200 bg-white flex flex-col">
      {/* CTA — Thêm chatbot mới */}
      <div className="p-4 border-b border-dark-100">
        <button
          onClick={onStartCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold
            bg-warning-500 hover:bg-warning-600 text-white rounded-lg shadow-sm transition-colors"
        >
          <Plus size={16} /> Thêm chatbot mới
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {bots.length === 0 && (
          <div className="text-center text-xs text-dark-400 py-8">
            Chưa có chatbot nào.
          </div>
        )}

        {bots.map(bot => {
          const isActiveItem = !creating && bot.id === selectedId;
          return (
            <BotRow
              key={bot.id}
              bot={bot}
              isSelected={isActiveItem}
              isEditing={editingId === bot.id}
              onEdit={() => onStartEdit(bot)}
              onDelete={() => onDelete(bot)}
            />
          );
        })}
      </div>
    </aside>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function BotRow({
  bot, isSelected, isEditing, onEdit, onDelete,
}: {
  bot: ChatbotItem;
  isSelected: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const highlight = isSelected || isEditing;
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`w-full text-left rounded-lg border transition-all p-3 group
        ${highlight
          ? 'border-primary-500 bg-primary-50/60 shadow-sm ring-1 ring-primary-200'
          : 'border-dark-200 bg-white hover:border-dark-300 hover:bg-dark-50'}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0
            ${bot.active ? 'bg-success-500' : 'bg-dark-300'}`} />
          <MessageSquare size={14} className="text-dark-400 shrink-0" />
          <span className="text-sm font-semibold text-dark-800 truncate">
            {bot.name}
          </span>
        </div>

        {highlight && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-dark-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Xóa"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="mt-1 text-xs text-dark-500 truncate pl-4">
        {bot.shortDescription || '—'}
      </p>

      {/* Tags */}
      <div className="mt-2 flex items-center flex-wrap gap-1.5 pl-4">
        <Badge tone="violet" icon={<Users size={11} />}>
          {MODE_LABELS[bot.mode]}
        </Badge>
        <Badge tone="success" icon={<BookOpen size={11} />}>
          {bot.knowledgeBaseIds.length} bộ TK
        </Badge>
        {bot.apiKeyCount > 0 && (
          <Badge tone="sky" icon={<Webhook size={11} />}>
            API
          </Badge>
        )}
      </div>
    </button>
  );
}

function Badge({
  tone, icon, children,
}: {
  tone: 'violet' | 'success' | 'sky';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls = {
    violet:  'bg-violet-50 text-violet-700 border-violet-200',
    success: 'bg-success-50 text-success-700 border-success-200',
    sky:     'bg-sky-50 text-sky-700 border-sky-200',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded
      text-[11px] font-medium border ${cls}`}>
      {icon}
      {children}
    </span>
  );
}
