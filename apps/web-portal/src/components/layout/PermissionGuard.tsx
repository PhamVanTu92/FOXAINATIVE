'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { resolveModuleCode } from '@/lib/route-permissions';
import ForbiddenView from '@/components/ForbiddenView';

const SUPER_ADMIN_CODE = 'SUPER_ADMIN';

export default function PermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  if (!user) return <>{children}</>;
  if (user.roles?.includes(SUPER_ADMIN_CODE)) return <>{children}</>;

  const moduleCode = resolveModuleCode(pathname);
  if (!moduleCode) return <>{children}</>;

  const hasAny = user.permissions?.some((p) => p.startsWith(moduleCode + '.'));
  if (!hasAny) return <ForbiddenView />;

  return <>{children}</>;
}
