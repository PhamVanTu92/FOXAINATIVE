'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatbotApi, chatApi } from '@/lib/chatbot-api';
import type { ChatbotItem, ChatMessage } from '@/lib/chatbot-api';

/**
 * Quản lý state cho 1 phiên chat của 1 bot cụ thể.
 *
 * Trách nhiệm:
 *  - Load bot info (theo botId từ route)
 *  - Quản lý mảng messages cho session hiện tại
 *  - Quản lý input + trạng thái đang gửi
 *  - Action: sendMessage(text), newSession(), clearMessages()
 *
 * View chỉ bind giá trị từ đây, không gọi chatApi trực tiếp.
 */
export function useChatbotChat(botId: string) {
  const [bot, setBot] = useState<ChatbotItem | null>(null);
  const [loadingBot, setLoadingBot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  // ── Load bot info ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingBot(true);
    setError(null);
    chatbotApi.get(botId)
      .then(b => { if (!cancelled) setBot(b); })
      .catch((e: unknown) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoadingBot(false); });
    return () => { cancelled = true; };
  }, [botId]);

  // ── Auto-scroll khi có tin nhắn mới ─────────────────────────────────────────
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const reply = await chatApi.send(botId, trimmed);
      setMessages(prev => [...prev, reply]);
    } catch (e: unknown) {
      const errMsg: ChatMessage = {
        id: `msg-e-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Lỗi: ${(e as Error).message}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }, [botId, sending]);

  const submitInput = () => sendMessage(input);

  const newSession = () => {
    setMessages([]);
    setInput('');
  };

  return {
    // data
    bot,
    loadingBot,
    error,
    messages,
    isEmpty: messages.length === 0,
    // input
    input,
    setInput,
    sending,
    // refs
    scrollAnchorRef,
    // actions
    sendMessage,
    submitInput,
    newSession,
  };
}
