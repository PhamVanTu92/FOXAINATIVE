'use client';

import {
  Info, BookOpen, AlertCircle, BookText, Webhook, ListChecks, History,
} from 'lucide-react';
import { useChatbotForm } from '../hooks/useChatbotForm';
import { PURPOSE_LABELS, MODE_LABELS } from '@/lib/chatbot-api';
import type { ChatbotItem, KnowledgeBase } from '@/lib/chatbot-api';
import { useState } from 'react';

interface Props {
  knowledgeBases: KnowledgeBase[];
  onCreated: (bot: ChatbotItem) => void;
  onCancel: () => void;
}

export function ChatbotCreateForm({ knowledgeBases, onCreated, onCancel }: Props) {
  const f = useChatbotForm(onCreated);
  const [sourceTab, setSourceTab] = useState<'KB' | 'API'>('KB');

  const inputCls =
    'w-full border border-dark-200 rounded-lg px-3 py-2 text-sm text-dark-800 ' +
    'placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ' +
    'focus:border-transparent bg-white';

  return (
    <div className="flex-1 overflow-y-auto bg-dark-50/40">
      {/* Sub-header: tiêu đề + nút Hủy / Lưu */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-dark-200 px-6 py-4
        flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-dark-800">Thêm chatbot mới</h1>
          <p className="text-xs text-dark-500 mt-0.5">
            Cấu hình thông tin và nguồn tri thức cho chatbot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-dark-200 text-dark-600 rounded-lg
              hover:bg-dark-50 transition-colors"
          >
            ✕ Hủy
          </button>
          <button
            type="button"
            disabled={f.submitting}
            onClick={f.submit}
            className="px-4 py-2 text-sm font-medium bg-warning-500 hover:bg-warning-600
              text-white rounded-lg shadow-sm disabled:opacity-60 transition-colors"
          >
            {f.submitting ? 'Đang lưu…' : '💾 Lưu chatbot'}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-5xl">
        {/* Section: Thông tin cơ bản */}
        <Section icon={<Info size={16} />} title="Thông tin cơ bản">
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

        {/* Toggle rows */}
        <ToggleRow
          icon={<ListChecks size={16} className="text-violet-600" />}
          title="Chatbot có kịch bản"
          description="Kịch bản hỏi đáp định sẵn cho chatbot"
          checked={f.hasScript}
          onChange={f.setHasScript}
        />
        <ToggleRow
          icon={<History size={16} className="text-warning-600" />}
          title="Lưu lịch sử hội thoại"
          description="Ghi lại toàn bộ cuộc hội thoại của bot này để xem lại và phân tích"
          checked={f.saveHistory}
          onChange={f.setSaveHistory}
        />

        {/* Section: Nguồn tri thức */}
        <Section icon={<BookOpen size={16} />} title="Nguồn tri thức đầu vào">
          <div className="flex items-center gap-2 mb-3">
            <TabPill active={sourceTab === 'KB'} onClick={() => setSourceTab('KB')}
              icon={<BookText size={13} />}>Bộ tri thức</TabPill>
            <TabPill active={sourceTab === 'API'} onClick={() => setSourceTab('API')}
              icon={<Webhook size={13} />}>Kết nối API</TabPill>
          </div>

          {sourceTab === 'KB' ? (
            <>
              <p className="text-xs text-dark-500 mb-3">
                Tích chọn các bộ tri thức mà chatbot này được phép truy cập:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {knowledgeBases.map(kb => {
                  const checked = f.knowledgeBaseIds.includes(kb.id);
                  return (
                    <label
                      key={kb.id}
                      className={`flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer
                        transition-colors
                        ${checked
                          ? 'bg-primary-50/60 border-primary-300 ring-1 ring-primary-200'
                          : 'bg-white border-dark-200 hover:border-dark-300 hover:bg-dark-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => f.toggleKnowledgeBase(kb.id)}
                        className="mt-0.5 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-800 truncate">{kb.name}</p>
                        <p className="text-xs text-dark-500 mt-0.5 inline-flex items-center gap-1">
                          <BookOpen size={11} /> {kb.ownerOrg}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-dark-500 p-6 text-center border border-dashed border-dark-200 rounded-lg">
              Tính năng kết nối API tri thức bên ngoài sẽ sớm có mặt.
            </p>
          )}
        </Section>

        {f.error && (
          <div className="flex items-center gap-2 bg-danger-50 border border-danger-200
            text-danger-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={15} className="shrink-0" />
            {f.error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-dark-200 shadow-sm">
      <header className="px-5 py-4 border-b border-dark-100 flex items-center gap-2">
        <span className="text-dark-500">{icon}</span>
        <h2 className="text-base font-semibold text-dark-800">{title}</h2>
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
        ${checked ? 'bg-warning-500' : 'bg-dark-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
      <span className={`text-xs font-medium ${checked ? 'text-warning-700' : 'text-dark-400'}`}>
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
}

function ToggleRow({
  icon, title, description, checked, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-dark-200 shadow-sm px-5 py-4
      flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dark-800">{title}</p>
          <p className="text-xs text-dark-500 mt-0.5">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function TabPill({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors
        ${active
          ? 'bg-violet-600 text-white border-violet-600'
          : 'bg-white text-dark-600 border-dark-200 hover:bg-dark-50'}`}
    >
      {icon}
      {children}
    </button>
  );
}
