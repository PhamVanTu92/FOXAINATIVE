'use client';

import { ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ForbiddenView() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center mb-5">
        <ShieldOff size={32} className="text-danger-500" />
      </div>

      <h1 className="text-xl font-bold text-content-primary mb-2">
        Không có quyền truy cập
      </h1>
      <p className="text-sm text-content-secondary max-w-sm mb-6">
        Tài khoản của bạn không có quyền xem trang này. Vui lòng liên hệ quản trị
        viên để được cấp quyền.
      </p>

      <button
        onClick={() => router.back()}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
      >
        Quay lại
      </button>
    </div>
  );
}
