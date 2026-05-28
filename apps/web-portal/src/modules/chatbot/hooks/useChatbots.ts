'use client';

import { useState, useEffect, useCallback } from 'react';
import { chatbotApi, knowledgeBasesApi } from '@/lib/chatbot-api';
import type {
  ChatbotItem, KnowledgeBase, UpdateChatbotPayload,
} from '@/lib/chatbot-api';

/**
 * Quản lý danh sách chatbot + chatbot đang chọn + thao tác CRUD/cấu hình.
 * View chỉ gọi các hàm/giá trị trả ra từ hook này, không trực tiếp gọi chatbotApi.
 */
export function useChatbots() {
  const [bots, setBots] = useState<ChatbotItem[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, kbs] = await Promise.all([
        chatbotApi.list(),
        knowledgeBasesApi.list(),
      ]);
      setBots(list);
      setKnowledgeBases(kbs);
      // Auto-select chatbot đầu tiên nếu chưa có selection và đang không tạo mới
      setSelectedId(prev => {
        if (prev && list.some(b => b.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const selected = bots.find(b => b.id === selectedId) ?? null;

  const selectBot = (id: string) => {
    setCreating(false);
    setSelectedId(id);
  };

  const startCreate = () => {
    setCreating(true);
  };

  const cancelCreate = () => {
    setCreating(false);
  };

  const handleCreated = (created: ChatbotItem) => {
    setBots(prev => [...prev, created]);
    setSelectedId(created.id);
    setCreating(false);
  };

  const handleToggleActive = async (bot: ChatbotItem) => {
    try {
      const next = await chatbotApi.update(bot.id, { active: !bot.active });
      setBots(prev => prev.map(b => b.id === bot.id ? next : b));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleUpdateConfig = async (id: string, patch: UpdateChatbotPayload) => {
    try {
      const next = await chatbotApi.update(id, patch);
      setBots(prev => prev.map(b => b.id === id ? next : b));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleDelete = async (bot: ChatbotItem) => {
    if (!confirm(`Xóa chatbot "${bot.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await chatbotApi.remove(bot.id);
      setBots(prev => {
        const next = prev.filter(b => b.id !== bot.id);
        if (selectedId === bot.id) setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  return {
    // data
    bots,
    knowledgeBases,
    selected,
    selectedId,
    creating,
    // state
    loading,
    error,
    // selection
    selectBot,
    startCreate,
    cancelCreate,
    // actions
    handleCreated,
    handleToggleActive,
    handleUpdateConfig,
    handleDelete,
    reload,
  };
}
