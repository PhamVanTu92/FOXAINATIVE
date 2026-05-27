'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
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
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white font-bold text-base">
            F
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-wide leading-tight">FOXAI – NATIVE</p>
            <p className="text-slate-400 text-[11px] tracking-widest uppercase">Your trust partner</p>
          </div>
        </div>

        <h1 className="text-white text-2xl font-semibold mb-1">Đăng nhập</h1>
        <p className="text-slate-400 text-sm mb-7">Nhập thông tin tài khoản của bạn để tiếp tục</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Global error */}
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">
              Tên đăng nhập / Email
            </label>
            <input
              {...register('username')}
              type="text"
              autoComplete="username"
              placeholder="admin hoặc admin@foxai.vn"
              className={`w-full bg-[#0d1f3c] border rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors autofill:bg-[#0d1f3c] autofill:text-white [&:-webkit-autofill]:bg-[#0d1f3c] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#0d1f3c_inset] [&:-webkit-autofill]:text-white ${
                errors.username ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
              }`}
            />
            {errors.username && (
              <p className="mt-1.5 text-red-400 text-xs">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full bg-[#0d1f3c] border rounded-lg px-4 py-2.5 pr-11 text-white placeholder-slate-600 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#0d1f3c_inset] [&:-webkit-autofill]:text-white ${
                  errors.password ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-red-400 text-xs">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>

      <p className="text-center text-slate-600 text-xs mt-6">
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
