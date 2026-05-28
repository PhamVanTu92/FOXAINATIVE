'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatbotApi, chatApi } from '@/lib/chatbot-api';
import type { ChatbotItem, ChatMessage, ChatbotPurpose } from '@/lib/chatbot-api';

/**
 * Hint để hook tự tìm bot tương ứng trên backend, vì route không biết UUID thật:
 *  - byId: nếu route đã có UUID (vd từ query string)
 *  - byPurpose: dùng cho /chatbot/ke-toan, /chatbot/cskh — pick bot đầu tiên
 *               có purpose khớp.
 *  - byNameContains: fallback theo tên (case-insensitive substring).
 */
export interface BotLookup {
  byId?: string;
  byPurpose?: ChatbotPurpose;
  byNameContains?: string;
}

/**
 * Quản lý state cho 1 phiên chat: load bot info, gửi tin nhắn, nhận chunk SSE
 * và accumulate vào assistant message hiện hành. Nếu bot.mode ∈ {voice, both}
 * → sau khi assistant trả xong sẽ auto TTS đọc lại câu trả lời.
 */
export function useChatbotChat(lookup: BotLookup) {
  const [bot, setBot] = useState<ChatbotItem | null>(null);
  const [loadingBot, setLoadingBot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // ── Resolve bot từ lookup hint ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingBot(true);
    setError(null);

    (async () => {
      try {
        let found: ChatbotItem | null = null;

        if (lookup.byId) {
          found = await chatbotApi.get(lookup.byId);
        } else {
          const list = await chatbotApi.list();
          if (lookup.byPurpose) {
            found = list.find(b => b.purpose === lookup.byPurpose) ?? null;
          }
          if (!found && lookup.byNameContains) {
            const needle = lookup.byNameContains.toLowerCase();
            found = list.find(b => b.name.toLowerCase().includes(needle)) ?? null;
          }
          // Fallback cuối: bot đầu tiên trong danh sách
          if (!found && list.length > 0) found = list[0] ?? null;
        }

        if (!cancelled) setBot(found);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoadingBot(false);
      }
    })();

    return () => { cancelled = true; };
  }, [lookup.byId, lookup.byPurpose, lookup.byNameContains]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  // ── Cleanup khi unmount ─────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelRef.current?.();
    stopSpeakingNow();
  }, []);

  function stopSpeakingNow() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeaking(false);
  }

  /** Phát TTS câu trả lời của bot — chỉ khi mode ∈ {voice, both}. */
  const speak = useCallback(async (text: string, b: ChatbotItem) => {
    if (!text.trim()) return;
    if (b.mode !== 'voice' && b.mode !== 'both') return;
    try {
      stopSpeakingNow();
      const blob = await chatApi.synthesize(text, b.publicId);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopSpeakingNow();
      audio.onerror = () => stopSpeakingNow();
      setSpeaking(true);
      await audio.play();
    } catch (e: unknown) {
      // Lỗi TTS không phải fatal — log và bỏ qua, text vẫn hiển thị bình thường
      console.warn('[TTS] Failed:', (e as Error).message);
      stopSpeakingNow();
    }
  }, []);

  // ── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !bot) return;

    // Ngắt audio đang phát trước khi gửi tin mới
    stopSpeakingNow();

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `msg-a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setSending(true);

    // Accumulator song song với state — để onDone có full text gọi TTS
    let accumulated = '';

    cancelRef.current = chatApi.stream({
      botId: bot.id,
      message: trimmed,
      conversationId,
      onChunk: (chunk) => {
        accumulated += chunk;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + chunk } : m,
        ));
      },
      onMeta: (meta) => {
        if (meta.conversationId) setConversationId(meta.conversationId);
      },
      onDone: () => {
        setSending(false);
        cancelRef.current = null;
        if (accumulated.trim()) {
          void speak(accumulated, bot);
        }
      },
      onError: (err) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `⚠️ Lỗi: ${err.message}` }
            : m,
        ));
        setSending(false);
        cancelRef.current = null;
      },
    });
  }, [bot, conversationId, sending, speak]);

  const submitInput = () => sendMessage(input);

  const newSession = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    stopSpeakingNow();
    setMessages([]);
    setInput('');
    setConversationId(null);
    setSending(false);
  };

  const stopSpeaking = () => stopSpeakingNow();

  return {
    // data
    bot,
    loadingBot,
    error,
    messages,
    isEmpty: messages.length === 0,
    conversationId,
    // input
    input,
    setInput,
    sending,
    speaking,
    // refs
    scrollAnchorRef,
    // actions
    sendMessage,
    submitInput,
    newSession,
    stopSpeaking,
  };
}
