'use client';

import { create } from 'zustand';

interface ToastState {
  msg: string;
  type: 'error' | 'success';
}

interface ConfirmState {
  title: string;
  body: string;
  onOk: () => void;
}

interface UIStore {
  toast: ToastState | null;
  showToast: (msg: string, type?: 'error' | 'success') => void;
  hideToast: () => void;

  confirm: ConfirmState | null;
  showConfirm: (opts: ConfirmState) => void;
  closeConfirm: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  toast: null,
  showToast: (msg, type = 'success') => set({ toast: { msg, type } }),
  hideToast: () => set({ toast: null }),

  confirm: null,
  showConfirm: (opts) => set({ confirm: opts }),
  closeConfirm: () => set({ confirm: null }),
}));
