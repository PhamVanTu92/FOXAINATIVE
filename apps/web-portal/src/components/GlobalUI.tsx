'use client';

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import { useUIStore } from '@/stores/ui';

export function GlobalUI() {
  const { toast, hideToast, confirm, closeConfirm } = useUIStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hideToast, 3000);
    return () => clearTimeout(t);
  }, [toast, hideToast]);

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] flex items-center gap-2.5 px-4 py-3
          rounded-lg shadow-lg text-sm font-medium max-w-sm border
          ${toast.type === 'error'
            ? 'bg-danger-50 border-danger-200 text-danger-700'
            : 'bg-success-50 border-success-200 text-success-700'}`}>
          {toast.type === 'error'
            ? <XCircle size={16} className="shrink-0" />
            : <CheckCircle size={16} className="shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={hideToast} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-danger-500 shrink-0" />
                <h2 className="font-semibold text-dark-800 text-base">{confirm.title}</h2>
              </div>
              <button onClick={closeConfirm}
                className="text-dark-400 hover:text-dark-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-dark-600">{confirm.body}</p>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-100">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 text-sm font-medium border border-dark-200
                  text-dark-600 rounded-lg hover:bg-dark-50 transition-colors">
                Hủy
              </button>
              <button
                onClick={() => { confirm.onOk(); closeConfirm(); }}
                className="px-4 py-2 text-sm font-semibold bg-danger-600 text-white
                  rounded-lg hover:bg-danger-700 transition-colors">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
