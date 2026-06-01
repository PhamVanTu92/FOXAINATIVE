'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { chatbotApi, chatApi, conversationsApi } from '@/lib/chatbot-api';
import { useUIStore } from '@/stores/ui';
import type {
  ChatbotItem, ChatMessage, ChatbotPurpose, ConversationItem, TtsVoice,
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
const LS_VOICE     = (botId: string) => `chatbot:voice:${botId}`;

/**
 * Quản lý state chat của 1 bot — kiểu ChatGPT/Gemini:
 *  - Active conversation lưu trong URL (?c=<id>) — refresh/navigate vẫn giữ phiên
 *  - Backup vào localStorage: nếu URL không có, lấy "phiên xem cuối" của bot
 *  - Tin nhắn cũ luôn fetch từ backend → switch phiên là load lại history
 *  - TTS auto-play nếu bot.mode ∈ {voice, both}
 */
export function useChatbotChat(lookup: BotLookup) {
  const { showToast } = useUIStore();
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
  const [paused,   setPaused]   = useState(false);
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voiceId, setVoiceIdState] = useState<string>('');

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const cancelRef       = useRef<(() => void) | null>(null);
  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef     = useRef<string | null>(null);
  // TTS pipeline
  const ttsSessionRef   = useRef(0);
  const ttsPausedRef    = useRef(false); // audio đang pause (không phải stop)
  const ttsSlotsRef     = useRef<Array<{ blob: Blob | null; ready: boolean; error: boolean }>>([]);
  const ttsPlayIdxRef   = useRef(0);
  const ttsPlayingRef   = useRef(false);
  const ttsStreamingRef = useRef(false); // true khi bot vẫn đang stream
  const sentBufRef      = useRef('');

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

  // ── Helpers voice ──
  const setVoiceId = useCallback((id: string) => {
    setVoiceIdState(id);
    if (bot) {
      if (id) localStorage.setItem(LS_VOICE(bot.id), id);
      else     localStorage.removeItem(LS_VOICE(bot.id));
    }
  }, [bot]);

  // ── Load voices khi bot sẵn sàng và có voice mode ──
  useEffect(() => {
    if (!bot || (bot.mode !== 'voice' && bot.mode !== 'both')) return;
    const savedVoice = localStorage.getItem(LS_VOICE(bot.id)) ?? '';
    setVoiceIdState(savedVoice);
    chatApi.getVoices().then(list => {
      setVoices(list);
      if (savedVoice && !list.find(v => v.id === savedVoice)) {
        setVoiceIdState(list[0]?.id ?? '');
      } else if (!savedVoice && list.length > 0) {
        setVoiceIdState(list[0]?.id ?? '');
      }
    }).catch(() => {});
  }, [bot]);

  // ── Cleanup khi unmount ──
  useEffect(() => () => {
    cancelRef.current?.();
    stopSpeakingNow();
  }, []);

  // ── TTS Pipeline ──────────────────────────────────────────────────────────────
  //
  // Mô hình: slot-based parallel synthesis + sequential playback
  //
  //  extract câu 1 → synthesize(1) ──────────────────────────────► blob1 ─┐
  //  extract câu 2 → synthesize(2) ──────────────────┐           blob2    │ play 1 → play 2 → play 3
  //  extract câu 3 → synthesize(3) ──────┐           ▼           blob3    │  (zero gap nếu blob đã ready)
  //                                      └──────────►               ...   ┘
  //
  // Mỗi câu được gán 1 slot có index. Player chỉ tiến index nếu slot đó READY.
  // Vì synthesis song song, lúc câu 1 vừa phát xong thì câu 2 thường đã sẵn.

  function stopSpeakingNow() {
    ttsSessionRef.current++;
    ttsPausedRef.current    = false;
    ttsSlotsRef.current     = [];
    ttsPlayIdxRef.current   = 0;
    ttsPlayingRef.current   = false;
    ttsStreamingRef.current = false;
    sentBufRef.current      = '';
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
    setPaused(false);
  }

  /**
   * Tạm dừng audio đang phát. Promise trong tryPlayNext vẫn treo —
   * khi resume thì audio tiếp tục và onended tự resolve đúng chỗ.
   */
  function pauseSpeaking() {
    if (!audioRef.current || ttsPausedRef.current || !speaking) return;
    audioRef.current.pause();
    ttsPausedRef.current = true;
    setSpeaking(false);
    setPaused(true);
  }

  /** Tiếp tục từ điểm đã tạm dừng. */
  function resumeSpeaking() {
    if (!audioRef.current || !ttsPausedRef.current) return;
    ttsPausedRef.current = false;
    setPaused(false);
    setSpeaking(true);
    audioRef.current.play().catch(() => {});
  }

  /**
   * Cố gắng phát slot tại ttsPlayIdxRef.
   * - Nếu slot chưa ready → thoát, sẽ được gọi lại khi synthesis về.
   * - Nếu slot ready → phát ngay, rồi đệ quy sang slot tiếp theo.
   */
  async function tryPlayNext(session: number) {
    if (ttsPlayingRef.current) return;
    if (ttsSessionRef.current !== session) return;

    const idx  = ttsPlayIdxRef.current;
    const slot = ttsSlotsRef.current[idx];

    if (!slot) {
      // Hết slot: nếu stream vẫn đang chạy thì chờ, ngược lại done
      if (!ttsStreamingRef.current) setSpeaking(false);
      return;
    }
    if (!slot.ready) return; // Chưa synthesize xong, chờ callback

    if (slot.error) {
      ttsPlayIdxRef.current++;
      void tryPlayNext(session);
      return;
    }

    ttsPlayingRef.current = true;
    setSpeaking(true);

    const url = URL.createObjectURL(slot.blob!);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    await new Promise<void>(resolve => {
      audio.onended = () => { URL.revokeObjectURL(url); audioUrlRef.current = null; resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioUrlRef.current = null; resolve(); };
      audio.play().catch(() => resolve());
    });

    if (ttsSessionRef.current !== session) return; // bị stop trong lúc phát

    ttsPlayIdxRef.current++;
    ttsPlayingRef.current = false;
    void tryPlayNext(session); // ngay lập tức thử câu kế
  }

  /**
   * Giao một câu vào pipeline:
   * 1. Tạo slot (giữ chỗ thứ tự)
   * 2. Synthesize SONG SONG với các câu khác
   * 3. Khi blob về → đánh dấu ready → thử play nếu đang chờ đúng slot này
   */
  function enqueueTts(text: string, b: ChatbotItem, vid?: string) {
    if (!text.trim() || (b.mode !== 'voice' && b.mode !== 'both')) return;
    const session = ttsSessionRef.current;
    const slot = { blob: null as Blob | null, ready: false, error: false };
    ttsSlotsRef.current.push(slot);

    chatApi.synthesize(text, b.publicId, vid)
      .then(blob => {
        if (ttsSessionRef.current !== session) return; // stale → discard
        slot.blob  = blob;
        slot.ready = true;
        void tryPlayNext(session);
      })
      .catch(() => {
        if (ttsSessionRef.current !== session) return;
        slot.error = true;
        slot.ready = true;
        void tryPlayNext(session);
      });
  }

  /** Tách câu hoàn chỉnh từ buffer stream (min 10 ký tự). */
  function extractSentences(buf: string): { sentences: string[]; rest: string } {
    const sentences: string[] = [];
    let rest = buf;
    const re = /^([\s\S]{10,}?[.?!。！？])(\s+|$)/;
    let m;
    while ((m = rest.match(re)) !== null) {
      const s = (m[1] ?? '').replace(/\n+/g, ' ').trim();
      if (s) sentences.push(s);
      rest = rest.slice(m[0].length);
    }
    // Tách theo newline nếu đoạn đủ dài
    const nlIdx = rest.indexOf('\n');
    if (nlIdx >= 15) {
      sentences.push(rest.slice(0, nlIdx).trim());
      rest = rest.slice(nlIdx + 1);
    }
    return { sentences, rest };
  }

  const speak = useCallback(async (text: string, b: ChatbotItem, vid?: string) => {
    if (!text.trim() || (b.mode !== 'voice' && b.mode !== 'both')) return;
    stopSpeakingNow();
    ttsStreamingRef.current = false;
    enqueueTts(text, b, vid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    sentBufRef.current = '';
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
    sentBufRef.current = '';
    if (bot.mode === 'voice' || bot.mode === 'both') ttsStreamingRef.current = true;

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
        // Sentence-streaming TTS: phát từng câu ngay khi hoàn chỉnh
        if (bot.mode === 'voice' || bot.mode === 'both') {
          sentBufRef.current += chunk;
          const { sentences, rest } = extractSentences(sentBufRef.current);
          sentBufRef.current = rest;
          for (const s of sentences) enqueueTts(s, bot, voiceId || undefined);
        }
      },
      onMeta: (meta) => {
        if (meta.conversationId && meta.conversationId !== conversationId) {
          setConversationId(meta.conversationId);
        }
      },
      onDone: () => {
        setSending(false);
        cancelRef.current = null;
        if (bot.mode === 'voice' || bot.mode === 'both') {
          // Flush phần text còn dư (câu cuối không có dấu chấm)
          if (sentBufRef.current.trim()) {
            enqueueTts(sentBufRef.current.trim(), bot, voiceId || undefined);
            sentBufRef.current = '';
          }
          // Báo stream xong để tryPlayNext biết khi slots hết thì setSpeaking(false)
          ttsStreamingRef.current = false;
          // Nếu tất cả slots đã ready mà player đang chờ → kick-start
          const session = ttsSessionRef.current;
          void tryPlayNext(session);
        }
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
      showToast((e as Error).message, 'error');
    }
  }, [bot, conversationId, newSession, showToast]);

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
    paused,
    // voice
    voices,
    voiceId,
    setVoiceId,
    // refs
    scrollAnchorRef,
    // actions
    sendMessage,
    submitInput,
    newSession,
    selectConversation,
    deleteConversation,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
  };
}
