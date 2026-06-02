'use client';

import { useRef, useState } from 'react';
import {
  ChevronRight, MessageSquare, Plus, Trash2, Download, Mic, MicOff, Send, AlertCircle,
  BookOpen, Volume2, VolumeX, MessageCircle, ChevronDown, Pause, Play,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatbotChat } from '../hooks/useChatbotChat';
import type { BotLookup } from '../hooks/useChatbotChat';
import { useChatbotSTT } from '../hooks/useChatbotSTT';
import { PURPOSE_LABELS } from '@/lib/chatbot-api';
import { useUIStore } from '@/stores/ui';
import type {
  ChatbotItem, ChatMessage, ChatbotMode, ConversationItem, TtsVoice,
} from '@/lib/chatbot-api';

interface Props {
  lookup: BotLookup;
}

export function ChatbotChatView({ lookup }: Props) {
  const c = useChatbotChat(lookup);
  const voiceEnabled = c.bot ? (c.bot.mode === 'voice' || c.bot.mode === 'both') : false;

  if (c.loadingBot) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-content-muted">
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
    <div className="flex flex-col h-full bg-surface">
      <Breadcrumb botName={c.bot.name} />

      <div className="flex-1 flex min-h-0">
        <RecentSidebar
          conversations={c.conversations}
          activeId={c.conversationId}
          loading={c.loadingHistory}
          onSelect={c.selectConversation}
          onNew={c.newSession}
          onDelete={c.deleteConversation}
        />

        <div className="flex-1 flex flex-col min-h-0 w-full px-6">
          <BotHeader
            bot={c.bot}
            activeTitle={c.activeConversation?.title ?? null}
            speaking={c.speaking}
            paused={c.paused}
            onStopSpeaking={c.stopSpeaking}
            onPauseSpeaking={c.pauseSpeaking}
            onResumeSpeaking={c.resumeSpeaking}
            voices={voiceEnabled ? c.voices : []}
            voiceId={c.voiceId}
            onVoiceChange={c.setVoiceId}
          />

          <div className="flex-1 overflow-y-auto py-4">
            {c.bot.mode === 'voice' ? (
              <VoiceConversationUI
                bot={c.bot}
                speaking={c.speaking}
                paused={c.paused}
                sending={c.sending}
                onPause={c.pauseSpeaking}
                onResume={c.resumeSpeaking}
                onStop={c.stopSpeaking}
              />
            ) : c.messagesError ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="flex items-start gap-2 bg-danger-50 border border-danger-200
                  text-danger-700 rounded-lg px-4 py-3 text-sm max-w-md">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Không tải được tin nhắn</p>
                    <p className="mt-0.5 text-danger-600/80">{c.messagesError}</p>
                  </div>
                </div>
              </div>
            ) : c.loadingMessages ? (
              <div className="h-full flex items-center justify-center text-sm text-content-muted">
                Đang tải tin nhắn...
              </div>
            ) : c.isEmpty ? (
              <EmptyState />
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
    <aside className="w-[280px] shrink-0 border-r border-default bg-surface flex flex-col">
      <div className="p-3 border-b border-default">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold
            bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition-colors"
        >
          <Plus size={14} /> Đoạn chat mới
        </button>
      </div>

      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-content-muted uppercase">
        Gần đây
      </p>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {loading && conversations.length === 0 ? (
          <div className="text-center text-xs text-content-muted py-6">Đang tải…</div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-xs text-content-muted py-6">
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
  const { showConfirm } = useUIStore();
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
          : 'text-content-primary hover:bg-subtle'}`}
    >
      <MessageCircle size={13} className={active ? 'text-primary-600' : 'text-content-muted'} />
      <span className="flex-1 truncate text-[13px]">
        {conv.title || 'Đoạn chat'}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          showConfirm({ title: 'Xóa đoạn chat', body: 'Xóa đoạn chat này?', onOk: onDelete });
        }}
        className="p-1 rounded text-content-muted opacity-0 group-hover:opacity-100
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
    <div className="flex items-center gap-2 px-6 py-3 border-b border-default bg-surface">
      <MessageSquare size={14} className="text-violet-600" />
      <span className="text-sm text-content-muted">Chatbot AI thông minh</span>
      <ChevronRight size={14} className="text-dark-300" />
      <span className="text-sm font-semibold text-content-primary">{botName}</span>
    </div>
  );
}

function BotHeader({
  bot, activeTitle, speaking, paused, onStopSpeaking, onPauseSpeaking, onResumeSpeaking,
  voices, voiceId, onVoiceChange,
}: {
  bot: ChatbotItem;
  activeTitle: string | null;
  speaking: boolean;
  paused: boolean;
  onStopSpeaking: () => void;
  onPauseSpeaking: () => void;
  onResumeSpeaking: () => void;
  voices: TtsVoice[];
  voiceId: string;
  onVoiceChange: (id: string) => void;
}) {
  const tone = avatarTone(bot.purpose);
  const modeLabel = bot.mode === 'voice' ? 'Voice' : bot.mode === 'both' ? 'Chat + Voice' : 'Chat';
  const modeIcon  = bot.mode === 'voice' ? <Mic size={11} className="text-violet-600" />
                  : bot.mode === 'both'  ? <Volume2 size={11} className="text-violet-600" />
                  : <MessageSquare size={11} className="text-primary-600" />;
  const modeCls   = bot.mode === 'chat' ? 'text-primary-600' : 'text-violet-600 font-medium';
  return (
    <div className="flex items-center gap-3 py-4 border-b border-default">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone.bg}`}>
        <MessageSquare size={20} className={tone.fg} />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold text-content-primary truncate">
          {activeTitle || bot.name}
        </h1>
        <p className="text-xs text-content-secondary mt-0.5 inline-flex items-center gap-1.5">
          <span className="text-content-secondary font-medium">{bot.name}</span>
          <span className="text-dark-300">·</span>
          {PURPOSE_LABELS[bot.purpose]}
          <span className="text-dark-300">·</span>
          <BookOpen size={11} />
          {bot.knowledgeBaseIds.length} bộ tri thức
          <span className="text-dark-300">·</span>
          {modeIcon}
          <span className={modeCls}>{modeLabel}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {(bot.mode === 'voice' || bot.mode === 'both') && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium
            transition-colors
            ${speaking
              ? 'border-violet-300 bg-violet-50 text-violet-700'
              : 'border-default bg-surface text-content-secondary hover:border-primary-300 hover:bg-primary-50'}`}>
            <Volume2 size={12} className={speaking ? 'text-violet-600 animate-pulse' : 'text-content-muted'} />
            <select
              value={voiceId}
              onChange={e => onVoiceChange(e.target.value)}
              className="bg-transparent border-0 outline-none text-xs cursor-pointer
                appearance-none text-inherit max-w-[140px]"
              title="Chọn giọng đọc"
            >
              {voices.length === 0
                ? <option value="">Mặc định</option>
                : voices.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.gender ? ` · ${v.gender === 'female' ? 'Nữ' : v.gender === 'male' ? 'Nam' : v.gender}` : ''}
                    </option>
                  ))
              }
            </select>
            <ChevronDown size={10} className="text-content-muted pointer-events-none shrink-0" />
          </div>
        )}

        {(speaking || paused) && (
          <>
            {paused ? (
              <button onClick={onResumeSpeaking}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                  bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200
                  rounded-lg transition-colors"
                title="Tiếp tục đọc">
                <Play size={13} /> Tiếp tục
              </button>
            ) : (
              <button onClick={onPauseSpeaking}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                  bg-warning-50 hover:bg-warning-100 text-warning-700 border border-warning-200
                  rounded-lg transition-colors animate-pulse"
                title="Tạm dừng">
                <Pause size={13} /> Đang đọc…
              </button>
            )}
            <button onClick={onStopSpeaking}
              className="p-1.5 text-content-muted hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              title="Dừng hẳn">
              <VolumeX size={13} />
            </button>
          </>
        )}
        <button
          className="p-2 text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="Tải xuống đoạn chat"
        >
          <Download size={15} />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
        <MessageSquare size={26} />
      </div>
      <h2 className="text-base font-semibold text-content-primary">
        Xin chào! Tôi có thể giúp gì cho bạn?
      </h2>
      <p className="text-xs text-content-secondary mt-1">
        Nhập câu hỏi hoặc chọn gợi ý bên dưới để bắt đầu.
      </p>

    </div>
  );
}

// ─── Voice 1-on-1 UI ──────────────────────────────────────────────────────────

function VoiceConversationUI({
  bot, speaking, paused, sending, onPause, onResume, onStop,
}: {
  bot: ChatbotItem;
  speaking: boolean;
  paused: boolean;
  sending: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const tone = avatarTone(bot.purpose);
  const isActive = speaking || paused;

  const status = paused    ? 'Đã tạm dừng'
               : speaking  ? 'Đang trả lời…'
               : sending   ? 'Đang xử lý…'
               : 'Sẵn sàng lắng nghe';

  const statusColor = paused   ? 'text-warning-500'
                    : speaking ? 'text-violet-600'
                    : sending  ? 'text-primary-600'
                    : 'text-content-muted';

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 select-none">

      <div className="relative flex items-center justify-center">
        <span className={`absolute rounded-full transition-all duration-700
          ${speaking ? `w-44 h-44 ${tone.bg} opacity-20 animate-ping` : 'w-0 h-0 opacity-0'}`}
        />
        <span className={`absolute rounded-full transition-all duration-500
          ${speaking
            ? `w-36 h-36 ${tone.bg} opacity-30 animate-pulse`
            : sending ? `w-32 h-32 ${tone.bg} opacity-20 animate-pulse`
            : 'w-0 h-0 opacity-0'}`}
          style={{ animationDelay: '150ms' }}
        />
        <div className={`relative w-28 h-28 rounded-full flex items-center justify-center
          shadow-xl transition-all duration-300 ${tone.bg}
          ${speaking ? 'scale-110' : sending ? 'scale-105' : 'scale-100'}
          ${paused ? 'opacity-60' : 'opacity-100'}`}>
          <MessageSquare size={48} className={tone.fg} />
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <h2 className="text-2xl font-semibold text-content-primary">{bot.name}</h2>
        <div className={`flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${statusColor}`}>
          {speaking && (
            <span className="flex gap-0.5">
              {[0, 100, 200, 150, 250].map((delay, i) => (
                <span key={i}
                  className={`w-1 rounded-full bg-violet-500 animate-bounce ${i === 1 ? 'h-4' : i === 3 ? 'h-5' : 'h-3'}`}
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          )}
          {paused && <Pause size={13} className="text-warning-500" />}
          {sending && !speaking && !paused && (
            <span className="inline-flex gap-0.5">
              {[0, 120, 240].map((delay, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce"
                  style={{ animationDelay: `${delay}ms` }} />
              ))}
            </span>
          )}
          <span>{status}</span>
        </div>
      </div>

      {isActive && (
        <div className="flex items-center gap-3">
          {paused ? (
            <button onClick={onResume}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full
                bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium
                transition-colors shadow-md">
              <Play size={15} /> Tiếp tục
            </button>
          ) : (
            <button onClick={onPause}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full
                border border-warning-300 bg-warning-50 hover:bg-warning-100
                text-warning-700 text-sm font-medium transition-colors shadow-sm">
              <Pause size={15} /> Tạm dừng
            </button>
          )}
          <button onClick={onStop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full
              border border-default bg-surface hover:bg-subtle
              text-content-secondary text-sm font-medium transition-colors shadow-sm">
            <VolumeX size={15} /> Dừng hẳn
          </button>
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
      {messages.filter(m => !(m.role === 'assistant' && !m.content)).map(m => (
        <Bubble key={m.id} msg={m} botTone={tone} />
      ))}
      {sending && (
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone.bg}`}>
            <MessageSquare size={14} className={tone.fg} />
          </div>
          <div className="bg-subtle border border-default rounded-2xl rounded-tl-sm px-4 py-2.5">
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
      <div className="max-w-[78%] bg-subtle border border-default rounded-2xl rounded-tl-sm
        px-4 py-2.5 text-sm text-content-primary leading-relaxed prose prose-sm
        prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
        prose-headings:text-content-primary prose-strong:text-content-primary
        prose-code:text-primary-600 prose-code:bg-primary-50 prose-code:px-1 prose-code:rounded
        prose-a:text-primary-600 prose-a:underline">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {msg.content}
        </ReactMarkdown>
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

/**
 * Dispatcher: chọn UI phù hợp theo mode của bot.
 * - voice  → chỉ mic (VoiceOnlyComposer)
 * - chat   → chỉ text, không có mic (ChatComposer showMic=false)
 * - both   → text + mic (ChatComposer showMic=true)
 */
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
  if (mode === 'voice') {
    return <VoiceOnlyComposer onVoiceFinal={onVoiceFinal} sending={sending} />;
  }
  return (
    <ChatComposer
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onVoiceFinal={onVoiceFinal}
      sending={sending}
      showMic={mode === 'both'}
    />
  );
}

/** Chế độ Voice-only: hiển thị nút mic lớn, không có ô nhập text. */
function VoiceOnlyComposer({
  onVoiceFinal, sending,
}: {
  onVoiceFinal: (text: string) => void;
  sending: boolean;
}) {
  const [interimText, setInterimText] = useState('');

  const stt = useChatbotSTT({
    lang: 'vi-VN',
    onResult: (text, isFinal) => { if (!isFinal) setInterimText(text); },
    onFinal: (text) => { setInterimText(''); onVoiceFinal(text); },
  });

  const toggle = () => (stt.recording ? stt.stop() : stt.start());

  return (
    <div className="border-t border-default py-5 flex flex-col items-center gap-3">
      <div className="min-h-[20px] text-sm text-content-secondary italic text-center max-w-lg px-4 transition-all">
        {stt.recording && interimText && `"${interimText}"`}
        {sending && <span className="text-primary-600 not-italic">Đang gửi...</span>}
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={!stt.supported || sending}
        title={!stt.supported ? 'Trình duyệt không hỗ trợ (dùng Chrome / Edge)' : stt.recording ? 'Nhấn để dừng' : 'Nhấn để nói'}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center
          shadow-lg transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300
          disabled:opacity-40
          ${stt.recording
            ? 'bg-danger-500 hover:bg-danger-600 scale-110'
            : 'bg-primary-600 hover:bg-primary-700 hover:scale-105'}`}
      >
        {stt.recording && (
          <span className="absolute inset-0 rounded-full bg-danger-400 animate-ping opacity-25" />
        )}
        {stt.recording
          ? <MicOff size={30} className="text-white relative z-10" />
          : <Mic size={30} className="text-white" />}
      </button>

      <p className="text-xs text-content-muted text-center">
        {stt.error
          ? <span className="text-danger-600">⚠ {stt.error}</span>
          : stt.recording ? 'Đang nghe… nhấn để dừng' : 'Nhấn mic để nói (tiếng Việt)'}
      </p>
    </div>
  );
}

/** Chế độ Chat (và Chat+Voice): ô nhập text, tuỳ chọn hiển thị mic. */
function ChatComposer({
  value, onChange, onSubmit, onVoiceFinal, sending, showMic,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onVoiceFinal: (text: string) => void;
  sending: boolean;
  showMic: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const stt = useChatbotSTT({
    lang: 'vi-VN',
    onResult: (text, isFinal) => { if (!isFinal) onChange(text); },
    onFinal: (text) => { onChange(''); onVoiceFinal(text); },
  });

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  }

  const micDisabled = !stt.supported;
  const micTitle = !stt.supported
    ? 'Trình duyệt không hỗ trợ Speech Recognition (dùng Chrome / Edge)'
    : stt.recording ? 'Nhấn để dừng ghi' : 'Nhập bằng giọng nói';

  return (
    <div className="border-t border-default py-4">
      <div className={`relative rounded-2xl border-2 bg-surface shadow-sm transition-colors
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
          className="w-full resize-none bg-transparent text-sm text-content-primary
            placeholder:text-content-muted px-4 py-3 focus:outline-none max-h-40"
          style={{ paddingRight: showMic ? '6rem' : '3.5rem' }}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {showMic && (
            <button
              type="button"
              onClick={() => stt.recording ? stt.stop() : stt.start()}
              disabled={micDisabled}
              title={micTitle}
              className={`p-2 rounded-lg transition-colors
                ${stt.recording
                  ? 'bg-danger-500 text-white hover:bg-danger-600 animate-pulse'
                  : 'text-content-muted hover:text-primary-600 hover:bg-primary-50'}
                disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-content-muted`}
            >
              {stt.recording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={sending || !value.trim()}
            title="Gửi"
            className="p-2 rounded-lg bg-primary-600 hover:bg-primary-700
              text-white disabled:opacity-40 disabled:hover:bg-primary-600
              transition-colors shadow-sm"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-content-muted">
        {stt.error && <span className="text-danger-600">⚠ {stt.error} · </span>}
        © Nhấn <kbd className="px-1 rounded bg-subtle text-content-secondary font-mono">Enter</kbd> để gửi
        {' · '}
        <kbd className="px-1 rounded bg-subtle text-content-secondary font-mono">Shift+Enter</kbd> để xuống dòng
        {showMic && ' · Nhấn mic để nói (tiếng Việt)'}
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
