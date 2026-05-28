'use client';

import { ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import { useChatbots } from '../hooks/useChatbots';
import { ChatbotSidebar } from './ChatbotSidebar';
import { ChatbotDetailView } from './ChatbotDetailView';
import { ChatbotCreateForm } from './ChatbotCreateForm';

/**
 * View orchestrator cho trang "Thiết lập bot hội thoại".
 *
 * Layout 2 cột:
 *  - Sidebar trái: danh sách chatbot + nút "+ Thêm chatbot mới"
 *  - Panel phải:
 *      • Khi đang tạo mới → ChatbotCreateForm
 *      • Khi đã chọn chatbot → ChatbotDetailView (cấu hình + tích hợp)
 */
export function ChatbotConfigView() {
  const c = useChatbots();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-dark-200 bg-white">
        <MessageSquare size={14} className="text-primary-600" />
        <span className="text-sm text-dark-400">Cấu hình hệ thống</span>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm text-dark-400">Cấu hình chatbot AI</span>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm font-semibold text-dark-700">Thiết lập bot hội thoại</span>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <ChatbotSidebar
          bots={c.bots}
          selectedId={c.selectedId}
          creating={c.creating}
          onSelect={c.selectBot}
          onStartCreate={c.startCreate}
          onDelete={c.handleDelete}
        />

        {/* Right panel */}
        {c.loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-dark-400">
            Đang tải dữ liệu...
          </div>
        ) : c.error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200
              text-danger-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              {c.error}
            </div>
          </div>
        ) : c.creating ? (
          <ChatbotCreateForm
            knowledgeBases={c.knowledgeBases}
            onCreated={c.handleCreated}
            onCancel={c.cancelCreate}
          />
        ) : c.selected ? (
          <ChatbotDetailView
            bot={c.selected}
            onUpdateConfig={c.handleUpdateConfig}
          />
        ) : (
          <EmptyState onStartCreate={c.startCreate} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onStartCreate }: { onStartCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
        <MessageSquare size={28} />
      </div>
      <p className="text-sm font-medium text-dark-700">Chưa có chatbot nào</p>
      <p className="text-xs text-dark-500 mt-1 max-w-xs">
        Tạo chatbot đầu tiên để bắt đầu cấu hình tri thức và nhúng vào hệ thống của bạn.
      </p>
      <button
        onClick={onStartCreate}
        className="mt-4 px-4 py-2 text-sm font-medium bg-warning-500 hover:bg-warning-600
          text-white rounded-lg shadow-sm transition-colors"
      >
        + Thêm chatbot mới
      </button>
    </div>
  );
}
