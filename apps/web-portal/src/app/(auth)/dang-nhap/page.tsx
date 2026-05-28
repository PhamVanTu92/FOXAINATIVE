'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const schema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập hoặc email'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  async function onSubmit(values: FormValues) {
    await login(values.username, values.password);
    const { accessToken } = useAuthStore.getState();
    if (accessToken) router.replace(redirect);
  }

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="bg-surface border border-default rounded-2xl p-8 shadow-lg">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white font-bold text-base">
            F
          </div>
          <div>
            <p className="text-content-primary font-bold text-base tracking-wide leading-tight">FOXAI – NATIVE</p>
            <p className="text-content-muted text-[11px] tracking-widest uppercase">Your trust partner</p>
          </div>
        </div>

        <h1 className="text-content-primary text-2xl font-semibold mb-1">Đăng nhập</h1>
        <p className="text-content-secondary text-sm mb-7">Nhập thông tin tài khoản của bạn để tiếp tục</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Global error */}
          {error && (
            <div className="bg-danger-50/10 border border-danger-500/30 rounded-lg px-4 py-3 text-danger-700 text-sm">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-content-secondary text-sm font-medium mb-1.5">
              Tên đăng nhập / Email
            </label>
            <input
              {...register('username')}
              type="text"
              autoComplete="username"
              placeholder="admin hoặc admin@foxai.vn"
              className={`w-full bg-surface border rounded-lg px-4 py-2.5 text-content-primary placeholder:text-content-muted text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_var(--bg-surface)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--text-primary)] ${
                errors.username ? 'border-danger-400' : 'border-default hover:border-strong'
              }`}
            />
            {errors.username && (
              <p className="mt-1.5 text-danger-600 text-xs">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-content-secondary text-sm font-medium mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full bg-surface border rounded-lg px-4 py-2.5 pr-11 text-content-primary placeholder:text-content-muted text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_var(--bg-surface)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--text-primary)] ${
                  errors.password ? 'border-danger-400' : 'border-default hover:border-strong'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-danger-600 text-xs">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>

      <p className="text-center text-content-muted text-xs mt-6">
        © {new Date().getFullYear()} FOXAI. All rights reserved.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
