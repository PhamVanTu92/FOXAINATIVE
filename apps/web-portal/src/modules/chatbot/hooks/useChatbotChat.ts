'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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

const LS_LAST_CONV = (botId: string) => `chatbot:last-conv:${botId}`;

/**
 * Quản lý state chat của 1 bot — kiểu ChatGPT/Gemini:
 *  - Active conversation lưu trong URL (?c=<id>) — refresh/navigate vẫn giữ phiên
 *  - Backup vào localStorage: nếu URL không có, lấy "phiên xem cuối" của bot
 *  - Tin nhắn cũ luôn fetch từ backend → switch phiên là load lại history
 *  - TTS auto-play nếu bot.mode ∈ {voice, both}
 */
export function useChatbotChat(lookup: BotLookup) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlConvId = searchParams.get('c');

  const [bot, setBot] = useState<ChatbotItem | null>(null);
  const [loadingBot, setLoadingBot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const cancelRef       = useRef<(() => void) | null>(null);
  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef     = useRef<string | null>(null);

  /**
   * Helper: cập nhật conversationId đồng thời sync URL `?c=` + localStorage.
   * Truyền `null` để clear (phiên mới).
   */
  const setConversationId = useCallback((next: string | null, opts: { sync?: boolean } = {}) => {
    const sync = opts.sync ?? true;
    setConversationIdState(next);
    if (!sync || typeof window === 'undefined') return;

    // Sync URL ?c=
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next) params.set('c', next); else params.delete('c');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    // Sync localStorage last-conv per bot
    if (bot) {
      if (next) localStorage.setItem(LS_LAST_CONV(bot.id), next);
      else      localStorage.removeItem(LS_LAST_CONV(bot.id));
    }
  }, [bot, pathname, router, searchParams]);

  // ── Resolve bot từ lookup ──
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

  // ── Load conversations + chọn phiên ban đầu ──
  useEffect(() => {
    if (!bot) return;
    let cancelled = false;
    setLoadingHistory(true);

    (async () => {
      try {
        const list = await conversationsApi.list({ chatbotId: bot.id });
        if (cancelled) return;
        list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        setConversations(list);

        // Thứ tự ưu tiên chọn phiên active:
        //   1) URL ?c=  (vd: paste link)
        //   2) localStorage last-conv của bot
        //   3) Phiên mới nhất (latest by updatedAt)
        const lsId = typeof window !== 'undefined'
          ? localStorage.getItem(LS_LAST_CONV(bot.id))
          : null;
        const initialId =
          list.find(c => urlConvId && c.id === urlConvId)?.id ??
          list.find(c => !!lsId    && c.id === lsId)?.id      ??
          list[0]?.id ?? null;

        if (initialId) {
          // Sync URL nếu nó chưa có (cho UX consistent)
          setConversationId(initialId);
        } else {
          setConversationIdState(null);
          setMessages([]);
        }
      } catch (e: unknown) {
        if (!cancelled) console.warn('[Conversations] list failed:', (e as Error).message);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => { cancelled = true; };
    // setConversationId thay đổi reference theo searchParams → loop. Bỏ khỏi dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot]);

  // ── Khi conversationId đổi → fetch messages của phiên đó ──
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setMessagesError(null);
    (async () => {
      try {
        const msgs = await conversationsApi.getMessages(conversationId);
        if (!cancelled) setMessages(msgs);
      } catch (e: unknown) {
        if (!cancelled) {
          setMessages([]);
          setMessagesError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  // ── Auto-scroll khi có tin nhắn mới ──
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  // ── Cleanup khi unmount ──
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

  /** Phát TTS câu trả lời — chỉ khi mode ∈ {voice, both}. */
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

  // ── Switch phiên cũ ──
  const selectConversation = useCallback((id: string) => {
    if (id === conversationId) return;
    cancelRef.current?.();
    cancelRef.current = null;
    stopSpeakingNow();
    setConversationId(id);
  }, [conversationId, setConversationId]);

  // ── Đoạn chat mới: reset state cục bộ, backend sẽ tạo conv khi gửi tin đầu ──
  const newSession = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    stopSpeakingNow();
    setMessages([]);
    setInput('');
    setSending(false);
    setMessagesError(null);
    setConversationId(null);
  }, [setConversationId]);

  // ── Send ──
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
        if (meta.conversationId && meta.conversationId !== conversationId) {
          setConversationId(meta.conversationId);
        }
      },
      onDone: () => {
        setSending(false);
        cancelRef.current = null;
        if (accumulated.trim()) void speak(accumulated, bot);
        // Refresh sidebar list để hiển thị phiên mới hoặc cập nhật title
        void refreshConversations(bot.id, !wasNewConversation);
      },
      onError: (err) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `⚠️ Lỗi: ${err.message}` } : m,
        ));
        setSending(false);
        cancelRef.current = null;
      },
    });
  }, [bot, conversationId, sending, speak, setConversationId]);

  async function refreshConversations(botId: string, silent = false) {
    try {
      const list = await conversationsApi.list({ chatbotId: botId });
      list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      setConversations(list);
    } catch (e: unknown) {
      if (!silent) console.warn('[Conversations] refresh failed:', (e as Error).message);
    }
  }

  const deleteConversation = useCallback(async (id: string) => {
    if (!bot) return;
    try {
      await conversationsApi.remove(id);
      if (id === conversationId) newSession();
      await refreshConversations(bot.id);
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }, [bot, conversationId, newSession]);

  const submitInput = () => sendMessage(input);
  const stopSpeaking = () => stopSpeakingNow();

  const activeConversation =
    conversations.find(c => c.id === conversationId) ?? null;

  return {
    // data
    bot,
    loadingBot,
    error,
    messages,
    isEmpty: messages.length === 0,
    conversationId,
    conversations,
    activeConversation,
    loadingHistory,
    loadingMessages,
    messagesError,
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
