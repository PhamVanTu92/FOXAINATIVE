'use client';

import { useState } from 'react';
import { chatbotApi, DEFAULT_WIDGET } from '@/lib/chatbot-api';
import type {
  ChatbotItem, ChatbotMode, ChatbotPurpose,
  CreateChatbotPayload, UpdateChatbotPayload,
  FAQItem, WidgetSettings,
} from '@/lib/chatbot-api';
import type { Collection } from '@/lib/collections-api';

/**
 * Quản lý state form "Thêm chatbot mới" hoặc "Chỉnh sửa chatbot".
 *
 *   - `editing = null` → CREATE: submit gọi chatbotApi.create
 *   - `editing = bot`  → EDIT  : init state từ bot, submit gọi chatbotApi.update
 *
 * View bind input vào setter rồi gọi `submit()`.
 */
export function useChatbotForm(
  onSaved: (bot: ChatbotItem) => void,
  collections: Collection[],
  editing: ChatbotItem | null = null,
) {
  const isEdit = editing !== null;

  // ── Section 1 ──
  const [name, setName] = useState(editing?.name ?? '');
  const [purpose, setPurpose] = useState<ChatbotPurpose | ''>(editing?.purpose ?? '');
  const [mode, setMode] = useState<ChatbotMode | ''>(editing?.mode ?? '');
  const [active, setActive] = useState<boolean>(editing?.active ?? true);
  const [shortDescription, setShortDescription] = useState(editing?.shortDescription ?? '');

  // ── Section 2 ──
  const [collectionIds, setCollectionIds] = useState<string[]>(
    editing?.knowledgeBaseIds ?? [],
  );
  const toggleCollection = (id: string) => {
    setCollectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  // ── Section 3 ──
  const [systemPrompt, setSystemPrompt] = useState(editing?.systemPrompt ?? '');
  const [faqs, setFaqs] = useState<FAQItem[]>(editing?.faqs ?? []);
  const addFaq    = () => setFaqs(prev => [...prev, { question: '', answer: '' }]);
  const removeFaq = (idx: number) => setFaqs(prev => prev.filter((_, i) => i !== idx));
  const updateFaq = (idx: number, patch: Partial<FAQItem>) =>
    setFaqs(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  // ── Section 3b — bổ sung ──
  const [saveHistory, setSaveHistory] = useState<boolean>(editing?.saveHistory ?? true);

  // ── Chunk config ──
  const [chunkSize, setChunkSize]     = useState<number>(editing?.chunkSize ?? 512);
  const [overlapType, setOverlapType] = useState<'PERCENT' | 'CHARS'>(editing?.overlapType ?? 'PERCENT');
  const [overlapValue, setOverlapValue] = useState<number>(editing?.overlapValue ?? 10);

  // ── Section 4 ──
  const [widget, setWidget] = useState<WidgetSettings>(editing?.widget ?? { ...DEFAULT_WIDGET });
  const patchWidget = (patch: Partial<WidgetSettings>) =>
    setWidget(prev => ({ ...prev, ...patch }));

  // ── Submit ──
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(editing?.name ?? '');
    setPurpose(editing?.purpose ?? '');
    setMode(editing?.mode ?? '');
    setActive(editing?.active ?? true);
    setShortDescription(editing?.shortDescription ?? '');
    setCollectionIds(editing?.knowledgeBaseIds ?? []);
    setSystemPrompt(editing?.systemPrompt ?? '');
    setFaqs(editing?.faqs ?? []);
    setWidget(editing?.widget ?? { ...DEFAULT_WIDGET });
    setError('');
  };

  const submit = async () => {
    if (!name.trim()) { setError('Vui lòng nhập tên chatbot.'); return; }
    if (!purpose)     { setError('Vui lòng chọn mục đích sử dụng.'); return; }
    if (!mode)        { setError('Vui lòng chọn hình thức.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const cleanFaqs = faqs.filter(f => f.question.trim() && f.answer.trim());
      const cleanCollections = collectionIds
        .map(id => collections.find(c => c.id === id))
        .filter((c): c is Collection => Boolean(c))
        .map(c => ({ id: c.id, name: c.name }));

      let saved: ChatbotItem;
      if (isEdit && editing) {
        const patch: UpdateChatbotPayload = {
          name: name.trim(),
          shortDescription: shortDescription.trim(),
          purpose,
          mode,
          active,
          saveHistory,
          knowledgeBaseIds: collectionIds,
          collections: cleanCollections,
          systemPrompt: systemPrompt.trim(),
          faqs: cleanFaqs,
          widget,
          chunkSize,
          overlapType,
          overlapValue,
        };
        saved = await chatbotApi.update(editing.id, patch);
      } else {
        const payload: CreateChatbotPayload = {
          name: name.trim(),
          shortDescription: shortDescription.trim() || undefined,
          purpose,
          mode,
          active,
          saveHistory,
          knowledgeBaseIds: collectionIds,
          collections: cleanCollections,
          systemPrompt: systemPrompt.trim() || undefined,
          faqs: cleanFaqs,
          widget,
        };
        saved = await chatbotApi.create(payload);
      }
      onSaved(saved);
      if (!isEdit) reset();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isEdit,
    // section 1
    name, setName,
    purpose, setPurpose,
    mode, setMode,
    active, setActive,
    shortDescription, setShortDescription,
    // section 2
    collectionIds, toggleCollection,
    // section 3
    systemPrompt, setSystemPrompt,
    faqs, addFaq, removeFaq, updateFaq,
    saveHistory, setSaveHistory,
    // chunk
    chunkSize, setChunkSize,
    overlapType, setOverlapType,
    overlapValue, setOverlapValue,
    // section 4
    widget, patchWidget,
    // submit
    error,
    submitting,
    submit,
    reset,
  };
}
