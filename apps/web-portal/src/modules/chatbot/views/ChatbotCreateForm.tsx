'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Info, BookOpen, ListChecks, Layout, AlertCircle,
  Plus, Trash2, ChevronDown, X, Check,
} from 'lucide-react';
import { useChatbotForm } from '../hooks/useChatbotForm';
import { PURPOSE_LABELS, MODE_LABELS } from '@/lib/chatbot-api';
import type { ChatbotItem } from '@/lib/chatbot-api';
import type { Collection } from '@/lib/collections-api';

interface Props {
  collections: Collection[];
  /** Khi truyền `editing` → form chạy ở chế độ chỉnh sửa, submit gọi update. */
  editing?: ChatbotItem | null;
  onSaved: (bot: ChatbotItem) => void;
  onCancel: () => void;
}

const inputCls =
  'w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 ' +
  'placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ' +
  'focus:border-transparent bg-white';

/**
 * Form chatbot — gồm 4 section đánh số. Dùng cho cả CREATE và EDIT:
 *   1. Thông tin cơ bản
 *   2. Nguồn tri thức đầu vào (multi-select collection từ index-service)
 *   3. Kịch bản (System Prompt + danh sách FAQ)
 *   4. Thiết lập widget (welcome message + enabled)
 *
 * Khi prop `editing` được truyền, hook init state từ bot và submit gọi update.
 */
export function ChatbotCreateForm({ collections, editing = null, onSaved, onCancel }: Props) {
  const f = useChatbotForm(onSaved, collections, editing);

  return (
    <div className="flex-1 overflow-y-auto bg-dark-50/40">
      <div className="px-6 py-6 space-y-6 max-w-5xl">

        {/* ── 1. Thông tin cơ bản ───────────────────────────────── */}
        <Section number={1} icon={<Info size={16} />} title="Thông tin cơ bản">
          <Field label="Tên chatbot" required>
            <input
              className={inputCls}
              placeholder="VD: Bot hỗ trợ kế toán nội bộ"
              value={f.name}
              onChange={e => f.setName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mục đích sử dụng" required>
              <select
                className={inputCls}
                value={f.purpose}
                onChange={e => f.setPurpose(e.target.value as typeof f.purpose)}
              >
                <option value="">-- Chọn mục đích --</option>
                {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>

            <Field label="Hình thức" required>
              <select
                className={inputCls}
                value={f.mode}
                onChange={e => f.setMode(e.target.value as typeof f.mode)}
              >
                <option value="">-- Chọn hình thức --</option>
                {Object.entries(MODE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Trạng thái">
            <Toggle
              checked={f.active}
              onChange={f.setActive}
              labelOn="Kích hoạt"
              labelOff="Vô hiệu"
            />
          </Field>

          <Field label="Mô tả ngắn">
            <input
              className={inputCls}
              placeholder="Mô tả chức năng của chatbot này..."
              value={f.shortDescription}
              onChange={e => f.setShortDescription(e.target.value)}
            />
          </Field>
        </Section>

        {/* ── 2. Nguồn tri thức đầu vào ─────────────────────────── */}
        <Section number={2} icon={<BookOpen size={16} />} title="Nguồn tri thức đầu vào">
          <p className="text-sm text-dark-600">
            Chọn một hoặc nhiều kho tri thức (collection) chatbot được phép tra cứu.
          </p>

          <CollectionMultiSelect
            collections={collections}
            selectedIds={f.collectionIds}
            onToggle={f.toggleCollection}
          />

          <div className="rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-3
            text-sm text-primary-700">
            Nguồn từ API sẽ được hỗ trợ trong phiên bản tiếp theo.
          </div>
        </Section>

        {/* ── 3. Kịch bản ───────────────────────────────────────── */}
        <Section number={3} icon={<ListChecks size={16} />} title="Kịch bản">
          <Field label="Hướng dẫn hệ thống (System Prompt)">
            <textarea
              className={inputCls + ' resize-y min-h-[120px]'}
              rows={5}
              placeholder="VD: Bạn là trợ lý ABC. Trả lời ngắn gọn, lịch sự, ưu tiên nguồn tri thức nội bộ. Không trả lời các câu hỏi ngoài lĩnh vực ngân hàng."
              value={f.systemPrompt}
              onChange={e => f.setSystemPrompt(e.target.value)}
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-dark-700">Danh sách FAQ</span>
              <button
                type="button"
                onClick={f.addFaq}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
                  text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
              >
                <Plus size={13} /> Thêm FAQ
              </button>
            </div>

            {f.faqs.length === 0 ? (
              <p className="text-sm text-dark-400 italic">Chưa có FAQ nào.</p>
            ) : (
              <div className="space-y-3">
                {f.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-dark-200 bg-dark-50/40 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-dark-600">
                        FAQ #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => f.removeFaq(idx)}
                        className="p-1 text-dark-400 hover:text-danger-600 hover:bg-danger-50
                          rounded transition-colors"
                        title="Xóa FAQ"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        className={inputCls}
                        placeholder="Câu hỏi của người dùng"
                        value={faq.question}
                        onChange={e => f.updateFaq(idx, { question: e.target.value })}
                      />
                      <textarea
                        className={inputCls + ' resize-none'}
                        rows={2}
                        placeholder="Câu trả lời chatbot sẽ phản hồi..."
                        value={faq.answer}
                        onChange={e => f.updateFaq(idx, { answer: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── 4. Thiết lập widget ───────────────────────────────── */}
        <Section number={4} icon={<Layout size={16} />} title="Thiết lập widget">
          <Field label="Tin nhắn chào mừng">
            <input
              className={inputCls}
              placeholder="VD: Xin chào! Tôi có thể giúp gì cho bạn?"
              value={f.widget.welcomeMessage}
              onChange={e => f.patchWidget({ welcomeMessage: e.target.value })}
            />
          </Field>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
              checked={f.widget.enabled}
              onChange={e => f.patchWidget({ enabled: e.target.checked })}
            />
            <span className="text-sm text-dark-700">Kích hoạt</span>
          </label>
        </Section>

        {f.error && (
          <div className="flex items-start gap-2 bg-danger-50 border border-danger-200
            text-danger-700 rounded-lg px-4 py-3 text-sm whitespace-pre-line">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{f.error}</span>
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium
              border border-dark-200 text-dark-600 rounded-lg hover:bg-dark-50
              transition-colors"
          >
            <X size={14} /> Hủy
          </button>
          <button
            type="button"
            onClick={f.submit}
            disabled={f.submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium
              bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm
              disabled:opacity-60 transition-colors"
          >
            <Check size={14} />
            {f.submitting
              ? (f.isEdit ? 'Đang lưu…' : 'Đang tạo…')
              : (f.isEdit ? 'Lưu thay đổi' : 'Tạo & lấy script')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({
  number, icon, title, children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-dark-200 shadow-sm">
      <header className="px-5 py-4 border-b border-dark-100 flex items-center gap-2">
        <span className="text-dark-500">{icon}</span>
        <h2 className="text-base font-semibold text-dark-800">
          {number}. {title}
        </h2>
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-700 mb-1.5">
        {label} {required && <span className="text-danger-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked, onChange, labelOn = 'Bật', labelOff = 'Tắt',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
        ${checked ? 'bg-primary-500' : 'bg-dark-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${checked ? 'text-primary-700' : 'text-dark-400'}`}>
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
}

function CollectionMultiSelect({
  collections, selectedIds, onToggle,
}: {
  collections: Collection[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click ngoài để đóng
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const selectedSet = new Set(selectedIds);
  const selected = collections.filter(c => selectedSet.has(c.id));

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm
          border rounded-lg bg-white transition-colors
          ${open
            ? 'border-primary-400 ring-2 ring-primary-100'
            : 'border-dark-200 hover:border-dark-300'}`}
      >
        <div className="min-w-0 flex-1 text-left flex items-center gap-1.5 flex-wrap">
          {selected.length === 0 ? (
            <span className="text-dark-400">Chọn kho tri thức</span>
          ) : (
            selected.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                  bg-primary-50 text-primary-700 text-xs font-medium border border-primary-200"
              >
                <BookOpen size={11} /> {c.name}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onToggle(c.id); }}
                  className="ml-0.5 text-primary-500 hover:text-danger-600"
                >
                  <X size={11} />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown size={16} className={`text-dark-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-dark-200 bg-white shadow-lg
          max-h-72 overflow-y-auto">
          {collections.length === 0 ? (
            <p className="px-3 py-4 text-sm text-dark-400 text-center">
              Chưa có collection nào. Hãy tạo collection trong "Tri thức AI" trước.
            </p>
          ) : (
            <ul className="py-1">
              {collections.map(c => {
                const checked = selectedSet.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(c.id)}
                      className={`w-full text-left flex items-start gap-2 px-3 py-2 text-sm
                        ${checked ? 'bg-primary-50/60' : 'hover:bg-dark-50'}`}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={checked}
                        className="mt-0.5 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-dark-800 truncate">{c.name}</span>
                        {c.description && (
                          <span className="block text-xs text-dark-500 truncate mt-0.5">
                            {c.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
