'use client';

import { useState } from 'react';
import { chatbotApi } from '@/lib/chatbot-api';
import type {
  ChatbotItem, ChatbotMode, ChatbotPurpose, CreateChatbotPayload,
} from '@/lib/chatbot-api';

/**
 * Quản lý state của form "Thêm chatbot mới".
 * View chỉ bind input vào các setter rồi gọi `submit()` khi bấm "Lưu chatbot".
 */
export function useChatbotForm(onCreated: (bot: ChatbotItem) => void) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState<ChatbotPurpose | ''>('');
  const [mode, setMode] = useState<ChatbotMode | ''>('');
  const [active, setActive] = useState(true);
  const [shortDescription, setShortDescription] = useState('');
  const [hasScript, setHasScript] = useState(false);
  const [saveHistory, setSaveHistory] = useState(false);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleKnowledgeBase = (id: string) => {
    setKnowledgeBaseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const reset = () => {
    setName('');
    setPurpose('');
    setMode('');
    setActive(true);
    setShortDescription('');
    setHasScript(false);
    setSaveHistory(false);
    setKnowledgeBaseIds([]);
    setError('');
  };

  const submit = async () => {
    if (!name.trim()) { setError('Vui lòng nhập tên chatbot.'); return; }
    if (!purpose)     { setError('Vui lòng chọn mục đích sử dụng.'); return; }
    if (!mode)        { setError('Vui lòng chọn hình thức.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const payload: CreateChatbotPayload = {
        name: name.trim(),
        shortDescription: shortDescription.trim() || undefined,
        purpose,
        mode,
        active,
        hasScript,
        saveHistory,
        knowledgeBaseIds,
      };
      const created = await chatbotApi.create(payload);
      onCreated(created);
      reset();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    // values
    name, setName,
    purpose, setPurpose,
    mode, setMode,
    active, setActive,
    shortDescription, setShortDescription,
    hasScript, setHasScript,
    saveHistory, setSaveHistory,
    knowledgeBaseIds, toggleKnowledgeBase,
    // status
    error,
    submitting,
    // actions
    submit,
    reset,
  };
}
