'use client';

import { useState, useEffect, useCallback } from 'react';
import { chatbotApi } from '@/lib/chatbot-api';
import { collectionsApi } from '@/lib/collections-api';
import type { ChatbotItem, UpdateChatbotPayload } from '@/lib/chatbot-api';
import type { Collection } from '@/lib/collections-api';
import { useUIStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import type { UserProfile } from '@/lib/auth-api';

const SUPER_ADMIN = 'SUPER_ADMIN';

/** CHATBOT_{uuid-uppercase-no-hyphens}.READ */
function chatbotPermKey(botId: string) {
  return `CHATBOT_${botId.replace(/-/g, '').toUpperCase()}.READ`;
}

function filterByPermission(bots: ChatbotItem[], user: UserProfile | null): ChatbotItem[] {
  if (!user) return [];
  if (user.roles.includes(SUPER_ADMIN)) return bots;
  return bots.filter(bot => user.permissions.includes(chatbotPermKey(bot.id)));
}

/** Báo cho Sidebar (hoặc consumer khác) biết để refetch list chatbot. */
function notifyChatbotsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('chatbots:updated'));
  }
}

/**
 * Quản lý danh sách chatbot + chatbot đang chọn + thao tác CRUD/cấu hình.
 * View chỉ gọi các hàm/giá trị trả ra từ hook này, không trực tiếp gọi chatbotApi.
 */
export function useChatbots() {
  const { showToast, showConfirm } = useUIStore();
  const user = useAuthStore(s => s.user);

  const [bots, setBots] = useState<ChatbotItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, cols] = await Promise.all([
        chatbotApi.list(),
        collectionsApi.list().catch(() => [] as Collection[]),
      ]);
      const visibleBots = filterByPermission(list, user);
      setBots(visibleBots);
      setCollections(cols);
      // Giữ selection cũ nếu bot còn tồn tại; KHÔNG auto-select bot đầu tiên
      // — màn chờ ban đầu để trống cho tới khi user chủ động click 1 bot.
      setSelectedId(prev => (prev && list.some(b => b.id === prev) ? prev : null));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const selected = bots.find(b => b.id === selectedId) ?? null;

  const selectBot = (id: string) => {
    setCreating(false);
    setEditingId(null);
    setSelectedId(id);
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
  };

  const cancelCreate = () => {
    setCreating(false);
  };

  const startEdit = (bot: ChatbotItem) => {
    setCreating(false);
    setSelectedId(bot.id);
    setEditingId(bot.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const editingBot = editingId ? bots.find(b => b.id === editingId) ?? null : null;

  const handleCreated = (created: ChatbotItem) => {
    setBots(prev => [...prev, created]);
    setSelectedId(created.id);
    setCreating(false);
    notifyChatbotsChanged();
  };

  const handleEdited = (updated: ChatbotItem) => {
    setBots(prev => prev.map(b => b.id === updated.id ? updated : b));
    setEditingId(null);
    notifyChatbotsChanged();
  };

  const handleToggleActive = async (bot: ChatbotItem) => {
    try {
      const next = await chatbotApi.update(bot.id, { active: !bot.active });
      setBots(prev => prev.map(b => b.id === bot.id ? next : b));
      notifyChatbotsChanged();
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
    }
  };

  const handleUpdateConfig = async (id: string, patch: UpdateChatbotPayload) => {
    try {
      const next = await chatbotApi.update(id, patch);
      setBots(prev => prev.map(b => b.id === id ? next : b));
    } catch (e: unknown) {
      showToast((e as Error).message, 'error');
    }
  };

  const handleDelete = async (bot: ChatbotItem) => {
    showConfirm({
      title: `Xóa chatbot "${bot.name}"`,
      body: `Xóa chatbot "${bot.name}"? Hành động này không thể hoàn tác.`,
      onOk: async () => {
        try {
          await chatbotApi.remove(bot.id);
          setBots(prev => {
            const next = prev.filter(b => b.id !== bot.id);
            if (selectedId === bot.id) setSelectedId(next[0]?.id ?? null);
            return next;
          });
          notifyChatbotsChanged();
        } catch (e: unknown) {
          showToast((e as Error).message, 'error');
        }
      },
    });
    return;
  };

  return {
    // data
    bots,
    collections,
    selected,
    selectedId,
    creating,
    editingBot,
    // state
    loading,
    error,
    // selection / mode
    selectBot,
    startCreate,
    cancelCreate,
    startEdit,
    cancelEdit,
    // actions
    handleCreated,
    handleEdited,
    handleToggleActive,
    handleUpdateConfig,
    handleDelete,
    reload,
  };
}
