'use client';

import { useRef } from 'react';
import {
  ChevronRight, MessageSquare, Plus, Trash2, Download, Mic, MicOff, Send, AlertCircle,
  BookOpen, Volume2, VolumeX, MessageCircle,
} from 'lucide-react';
import { useChatbotChat } from '../hooks/useChatbotChat';
import type { BotLookup } from '../hooks/useChatbotChat';
import { useChatbotSTT } from '../hooks/useChatbotSTT';
import { PURPOSE_LABELS } from '@/lib/chatbot-api';
import type {
  ChatbotItem, ChatMessage, ChatbotMode, ConversationItem,
} from '@/lib/chatbot-api';

interface Props {
  lookup: BotLookup;
}

/**
 * Trang chat tương tác cho 1 chatbot cụ thể (ví dụ /chatbot/ke-toan).
 *
 * Layout (full-width, KHÔNG có sidebar "GẦN ĐÂY"):
 *   ┌─────────────────────────────────────────────────┐
 *   │ Breadcrumb: Chatbot AI thông minh > <Bot name>  │
 *   ├─────────────────────────────────────────────────┤
 *   │ Bot header: avatar + name + subtitle + actions  │
 *   ├─────────────────────────────────────────────────┤
 *   │                                                 │
 *   │   Empty state (centered) OR message stream      │
 *   │                                                 │
 *   ├─────────────────────────────────────────────────┤
 *   │ Composer: input + mic + send                    │
 *   └─────────────────────────────────────────────────┘
 */
export function ChatbotChatView({ lookup }: Props) {
  const c = useChatbotChat(lookup);

  if (c.loadingBot) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-dark-400">
        Đang tải chatbot...
      </div>
    );
  }
  if (c.error || !c.bot) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-center gap-2 bg-danger-50 border border-danger-200
          text-danger-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {c.error ?? 'Không tìm thấy chatbot.'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <Breadcrumb botName={c.bot.name} />

      <div className="flex-1 flex min-h-0">
        {/* Sidebar GẦN ĐÂY — danh sách phiên chat của bot */}
        <RecentSidebar
          conversations={c.conversations}
          activeId={c.conversationId}
          loading={c.loadingHistory}
          onSelect={c.selectConversation}
          onNew={c.newSession}
          onDelete={c.deleteConversation}
        />

        {/* Main chat column */}
        <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-6">
          <BotHeader
            bot={c.bot}
            onNewSession={c.newSession}
            canClear={!c.isEmpty}
            speaking={c.speaking}
            onStopSpeaking={c.stopSpeaking}
          />

          {/* Messages / Empty */}
          <div className="flex-1 overflow-y-auto py-4">
            {c.loadingMessages ? (
              <div className="h-full flex items-center justify-center text-sm text-dark-400">
                Đang tải tin nhắn...
              </div>
            ) : c.isEmpty ? (
              <EmptyState bot={c.bot} onPick={c.sendMessage} />
            ) : (
              <MessageList messages={c.messages} sending={c.sending} bot={c.bot} />
            )}
            <div ref={c.scrollAnchorRef} />
          </div>

          <Composer
            value={c.input}
            onChange={c.setInput}
            onSubmit={c.submitInput}
            onVoiceFinal={(text) => c.sendMessage(text)}
            sending={c.sending}
            mode={c.bot.mode}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecentSidebar({
  conversations, activeId, loading, onSelect, onNew, onDelete,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="w-[280px] shrink-0 border-r border-dark-200 bg-white flex flex-col">
      {/* CTA — Đoạn chat mới */}
      <div className="p-3 border-b border-dark-100">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold
            bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition-colors"
        >
          <Plus size={14} /> Đoạn chat mới
        </button>
      </div>

      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-dark-400 uppercase">
        Gần đây
      </p>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {loading && conversations.length === 0 ? (
          <div className="text-center text-xs text-dark-400 py-6">Đang tải…</div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-xs text-dark-400 py-6">
            Chưa có đoạn chat nào.
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={() => onSelect(conv.id)}
              onDelete={() => onDelete(conv.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ConversationRow({
  conv, active, onSelect, onDelete,
}: {
  conv: ConversationItem;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-md text-sm cursor-pointer
        transition-colors
        ${active
          ? 'bg-primary-50 text-primary-700'
          : 'text-dark-700 hover:bg-dark-50'}`}
    >
      <MessageCircle size={13} className={active ? 'text-primary-600' : 'text-dark-400'} />
      <span className="flex-1 truncate text-[13px]">
        {conv.title || 'Đoạn chat'}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('Xóa đoạn chat này?')) onDelete();
        }}
        className="p-1 rounded text-dark-400 opacity-0 group-hover:opacity-100
          hover:text-danger-600 hover:bg-danger-50 transition-all"
        title="Xóa đoạn chat"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function Breadcrumb({ botName }: { botName: string }) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-dark-200 bg-white">
      <MessageSquare size={14} className="text-violet-600" />
      <span className="text-sm text-dark-400">Chatbot AI thông minh</span>
      <ChevronRight size={14} className="text-dark-300" />
      <span className="text-sm font-semibold text-dark-700">{botName}</span>
    </div>
  );
}

function BotHeader({
  bot, onNewSession, canClear, speaking, onStopSpeaking,
}: {
  bot: ChatbotItem;
  onNewSession: () => void;
  canClear: boolean;
  speaking: boolean;
  onStopSpeaking: () => void;
}) {
  const tone = avatarTone(bot.purpose);
  const voiceEnabled = bot.mode === 'voice' || bot.mode === 'both';
  return (
    <div className="flex items-center gap-3 py-4 border-b border-dark-100">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone.bg}`}>
        <MessageSquare size={20} className={tone.fg} />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold text-dark-800 truncate">{bot.name}</h1>
        <p className="text-xs text-dark-500 mt-0.5 inline-flex items-center gap-1.5">
          {PURPOSE_LABELS[bot.purpose]}
          <span className="text-dark-300">·</span>
          <BookOpen size={11} />
          {bot.knowledgeBaseIds.length} bộ tri thức
          {voiceEnabled && (
            <>
              <span className="text-dark-300">·</span>
              <Volume2 size={11} className="text-violet-600" />
              <span className="text-violet-600 font-medium">Voice</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {speaking && (
          <button
            onClick={onStopSpeaking}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
              bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200
              rounded-lg transition-colors animate-pulse"
            title="Dừng đọc"
          >
            <VolumeX size={13} /> Đang đọc…
          </button>
        )}
        <button
          onClick={onNewSession}
          disabled={!canClear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            bg-primary-600 hover:bg-primary-700 text-white rounded-lg
            disabled:opacity-50 disabled:hover:bg-primary-600 transition-colors"
          title="Bắt đầu đoạn chat mới"
        >
          <Plus size={13} /> Đoạn chat mới
        </button>
        <button
          className="p-2 text-dark-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
          title="Xóa đoạn chat"
          disabled={!canClear}
          onClick={onNewSession}
        >
          <Trash2 size={15} />
        </button>
        <button
          className="p-2 text-dark-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="Tải xuống"
        >
          <Download size={15} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  bot, onPick,
}: {
  bot: ChatbotItem;
  onPick: (text: string) => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
        <MessageSquare size={26} />
      </div>
      <h2 className="text-base font-semibold text-dark-800">
        Xin chào! Tôi có thể giúp gì cho bạn?
      </h2>
      <p className="text-xs text-dark-500 mt-1">
        Nhập câu hỏi hoặc chọn gợi ý bên dưới để bắt đầu.
      </p>

      {bot.suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
          {bot.suggestions.map(s => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="px-3.5 py-2 text-sm rounded-full border border-primary-200
                bg-primary-50/50 text-primary-700 hover:bg-primary-50 hover:border-primary-300
                transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageList({
  messages, sending, bot,
}: {
  messages: ChatMessage[];
  sending: boolean;
  bot: ChatbotItem;
}) {
  const tone = avatarTone(bot.purpose);
  return (
    <div className="space-y-4">
      {messages.map(m => (
        <Bubble key={m.id} msg={m} botTone={tone} />
      ))}
      {sending && (
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone.bg}`}>
            <MessageSquare size={14} className={tone.fg} />
          </div>
          <div className="bg-dark-50 border border-dark-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
            <Typing />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  msg, botTone,
}: {
  msg: ChatMessage;
  botTone: { bg: string; fg: string };
}) {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[78%] bg-primary-600 text-white rounded-2xl rounded-tr-sm
          px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${botTone.bg}`}>
        <MessageSquare size={14} className={botTone.fg} />
      </div>
      <div className="max-w-[78%] bg-dark-50 border border-dark-100 rounded-2xl rounded-tl-sm
        px-4 py-2.5 text-sm text-dark-800 whitespace-pre-wrap leading-relaxed">
        {msg.content}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <span className="inline-flex items-center gap-1">
      <Dot delay="0ms" />
      <Dot delay="160ms" />
      <Dot delay="320ms" />
    </span>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-dark-400 inline-block animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}

function Composer({
  value, onChange, onSubmit, onVoiceFinal, sending, mode,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onVoiceFinal: (text: string) => void;
  sending: boolean;
  mode: ChatbotMode;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const voiceEnabled = mode === 'voice' || mode === 'both';

  // STT — show interim transcript trong input; khi final → auto-send (voice UX)
  const stt = useChatbotSTT({
    lang: 'vi-VN',
    onResult: (text, isFinal) => {
      if (!isFinal) onChange(text);
    },
    onFinal: (text) => {
      onChange('');
      onVoiceFinal(text);
    },
  });

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  const toggleMic = () => (stt.recording ? stt.stop() : stt.start());

  // Tooltip + state cho mic button
  let micDisabled = false;
  let micTitle = 'Nhập bằng giọng nói';
  if (!voiceEnabled) {
    micDisabled = true;
    micTitle = 'Bot này không bật chế độ Voice — chỉnh "Hình thức" sang Voice hoặc Chat + Voice';
  } else if (!stt.supported) {
    micDisabled = true;
    micTitle = 'Trình duyệt không hỗ trợ Speech Recognition (dùng Chrome / Edge)';
  } else if (stt.recording) {
    micTitle = 'Bấm để dừng ghi';
  }

  return (
    <div className="border-t border-dark-100 py-4">
      <div className={`relative rounded-2xl border-2 bg-white shadow-sm transition-colors
        ${stt.recording
          ? 'border-danger-300 ring-2 ring-danger-100'
          : 'border-primary-200 focus-within:border-primary-400'}`}>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={stt.recording ? 'Đang nghe…' : 'Nhập câu hỏi...'}
          className="w-full resize-none bg-transparent text-sm text-dark-800
            placeholder:text-dark-400 px-4 py-3 pr-24 focus:outline-none max-h-40"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMic}
            disabled={micDisabled}
            className={`p-2 rounded-lg transition-colors
              ${stt.recording
                ? 'bg-danger-500 text-white hover:bg-danger-600 animate-pulse'
                : 'text-dark-400 hover:text-primary-600 hover:bg-primary-50'}
              disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-dark-400`}
            title={micTitle}
          >
            {stt.recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={sending || !value.trim()}
            className="p-2 rounded-lg bg-primary-600 hover:bg-primary-700
              text-white disabled:opacity-40 disabled:hover:bg-primary-600
              transition-colors shadow-sm"
            title="Gửi"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-dark-400">
        {stt.error && (
          <span className="text-danger-600">⚠ {stt.error} · </span>
        )}
        © Nhấn <kbd className="px-1 rounded bg-dark-100 text-dark-600 font-mono">Enter</kbd> để gửi
        {' · '}
        <kbd className="px-1 rounded bg-dark-100 text-dark-600 font-mono">Shift+Enter</kbd> để xuống dòng
        {voiceEnabled && (
          <>
            {' · '}
            Nhấn mic để nói (tiếng Việt)
          </>
        )}
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarTone(purpose: ChatbotItem['purpose']): { bg: string; fg: string } {
  switch (purpose) {
    case 'customer_care': return { bg: 'bg-violet-100',  fg: 'text-violet-700' };
    case 'sales':         return { bg: 'bg-orange-100',  fg: 'text-orange-700' };
    case 'tech_support':  return { bg: 'bg-teal-100',    fg: 'text-teal-700' };
    case 'other':         return { bg: 'bg-primary-100', fg: 'text-primary-700' };
    default:              return { bg: 'bg-sky-100',     fg: 'text-sky-700' };
  }
}
