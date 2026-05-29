'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatbotApi, chatApi, conversationsApi } from '@/lib/chatbot-api';
import type {
  ChatbotItem, ChatMessage, ChatbotPurpose, ConversationItem,
} from '@/lib/chatbot-api';

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
 * Quản lý state cho phiên chat của 1 bot:
 *  - Load bot info + danh sách conversations đã tạo cho bot đó
 *  - Auto-load phiên mới nhất khi mount (persist khi navigate đi & quay lại)
 *  - "+ Đoạn chat mới" → reset state cục bộ, conversation_id=null;
 *    backend sẽ tạo conversation mới khi user gửi tin đầu tiên
 *  - selectConversation(id) → load messages cũ của phiên đó để xem/tiếp tục
 *  - TTS auto-play nếu bot.mode ∈ {voice, both}
 */
export function useChatbotChat(lookup: BotLookup) {
  const [bot, setBot] = useState<ChatbotItem | null>(null);
  const [loadingBot, setLoadingBot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Conversations list
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Current session
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const cancelRef       = useRef<(() => void) | null>(null);
  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef     = useRef<string | null>(null);

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

  // ── Load conversations + messages của phiên mới nhất ────────────────────────
  useEffect(() => {
    if (!bot) return;
    let cancelled = false;
    setLoadingHistory(true);

    (async () => {
      try {
        const list = await conversationsApi.list({ chatbotId: bot.id });
        if (cancelled) return;
        // Sort theo updated_at giảm dần (mới nhất lên đầu)
        list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        setConversations(list);

        const latest = list[0];
        if (latest) {
          setConversationId(latest.id);
          setLoadingMessages(true);
          try {
            const msgs = await conversationsApi.getMessages(latest.id);
            if (!cancelled) setMessages(msgs);
          } finally {
            if (!cancelled) setLoadingMessages(false);
          }
        } else {
          // Bot này chưa từng có conversation → state trống
          setConversationId(null);
          setMessages([]);
        }
      } catch {
        // Không fatal — chỉ là không load được history
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bot]);

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
      console.warn('[TTS] Failed:', (e as Error).message);
      stopSpeakingNow();
    }
  }, []);

  // ── Switch sang 1 conversation cũ trong sidebar ─────────────────────────────
  const selectConversation = useCallback(async (id: string) => {
    if (id === conversationId) return;
    cancelRef.current?.();
    cancelRef.current = null;
    stopSpeakingNow();
    setConversationId(id);
    setLoadingMessages(true);
    try {
      const msgs = await conversationsApi.getMessages(id);
      setMessages(msgs);
    } catch (e: unknown) {
      setMessages([]);
      console.warn('[Conversation] load failed:', (e as Error).message);
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationId]);

  // ── Tạo phiên mới: reset state, backend sẽ tạo conversation khi gửi tin đầu ─
  const newSession = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    stopSpeakingNow();
    setMessages([]);
    setInput('');
    setConversationId(null);
    setSending(false);
  }, []);

  // ── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !bot) return;

    stopSpeakingNow();

    const userMsg: ChatMessage = {
      id:        `msg-u-${Date.now()}`,
      role:      'user',
      content:   trimmed,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `msg-a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id:        assistantId,
      role:      'assistant',
      content:   '',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setSending(true);

    let accumulated = '';
    // Đây có phải tin đầu của phiên mới? Cần biết để refresh sidebar sau onDone.
    const wasNewConversation = conversationId == null;

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
        if (accumulated.trim()) void speak(accumulated, bot);
        // Refresh conversations list để hiển thị phiên mới (hoặc cập nhật title)
        if (wasNewConversation) void refreshConversations(bot.id);
        else                    void refreshConversations(bot.id, /*silent*/ true);
      },
      onError: (err) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `⚠️ Lỗi: ${err.message}` } : m,
        ));
        setSending(false);
        cancelRef.current = null;
      },
    });
  }, [bot, conversationId, sending, speak]);

  async function refreshConversations(botId: string, silent = false) {
    try {
      const list = await conversationsApi.list({ chatbotId: botId });
      list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      setConversations(list);
    } catch {
      if (!silent) {/* ignore */}
    }
  }

  const deleteConversation = useCallback(async (id: string) => {
    if (!bot) return;
    try {
      await conversationsApi.remove(id);
      // Nếu xoá đúng phiên đang xem → reset về phiên mới
      if (id === conversationId) {
        newSession();
      }
      await refreshConversations(bot.id);
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }, [bot, conversationId, newSession]);

  const submitInput = () => sendMessage(input);
  const stopSpeaking = () => stopSpeakingNow();

  return {
    // data
    bot,
    loadingBot,
    error,
    messages,
    isEmpty: messages.length === 0,
    conversationId,
    conversations,
    loadingHistory,
    loadingMessages,
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
    selectConversation,
    deleteConversation,
    stopSpeaking,
  };
}
