'use client';

import { ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import { useChatbots } from '../hooks/useChatbots';
import { ChatbotSidebar } from './ChatbotSidebar';
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
    <div className="flex flex-col h-full bg-surface">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-default bg-surface">
        <MessageSquare size={14} className="text-primary-600" />
        <span className="text-sm text-content-muted">Cấu hình hệ thống</span>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm text-content-muted">Cấu hình chatbot AI</span>
        <ChevronRight size={14} className="text-dark-300" />
        <span className="text-sm font-semibold text-content-primary">Thiết lập bot hội thoại</span>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <ChatbotSidebar
          bots={c.bots}
          selectedId={c.selectedId}
          creating={c.creating}
          editingId={c.editingBot?.id ?? null}
          onStartCreate={c.startCreate}
          onStartEdit={c.startEdit}
          onDelete={c.handleDelete}
        />

        {/* Right panel */}
        {c.loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-content-muted">
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
            collections={c.collections}
            onSaved={c.handleCreated}
            onCancel={c.cancelCreate}
          />
        ) : c.editingBot ? (
          <ChatbotCreateForm
            key={c.editingBot.id}
            editing={c.editingBot}
            collections={c.collections}
            onSaved={c.handleEdited}
            onCancel={c.cancelEdit}
          />
        ) : (
          // Click bot trong sidebar chỉ highlight, panel phải luôn để trống.
          // User dùng pencil-icon trong sidebar để mở form chỉnh sửa.
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
