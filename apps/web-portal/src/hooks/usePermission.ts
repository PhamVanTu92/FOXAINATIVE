import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { resolveModuleCode } from '@/lib/route-permissions';

const SUPER_ADMIN_CODE = 'SUPER_ADMIN';

function checkPermission(
  userPermissions: string[],
  userRoles: string[],
  moduleCode: string,
  actionCode?: string,
): boolean {
  if (userRoles.includes(SUPER_ADMIN_CODE)) return true;
  const prefix = actionCode
    ? `${moduleCode}.${actionCode}`
    : moduleCode + '.';
  return actionCode
    ? userPermissions.includes(prefix)
    : userPermissions.some((p) => p.startsWith(prefix));
}

/**
 * Kiểm tra user có quyền READ (hoặc bất kỳ quyền nào) trên module.
 * - moduleCode = undefined → không yêu cầu quyền → true.
 */
export function usePermission(moduleCode?: string): boolean {
  const user = useAuthStore((s) => s.user);
  if (!moduleCode) return true;
  if (!user) return false;
  return checkPermission(user.permissions, user.roles, moduleCode);
}

/**
 * Kiểm tra user có quyền cụ thể (READ/CREATE/UPDATE/DELETE/EXPORT) trên module.
 */
export function useActionPermission(moduleCode: string, actionCode: string): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return checkPermission(user.permissions, user.roles, moduleCode, actionCode);
}

/**
 * Tự động resolve module code từ URL hiện tại rồi kiểm tra action.
 * Dùng trong views: const canCreate = useRoutePermission('CREATE');
 */
export function useRoutePermission(actionCode: string): boolean {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (user.roles.includes(SUPER_ADMIN_CODE)) return true;
  const moduleCode = resolveModuleCode(pathname);
  if (!moduleCode) return true;
  return user.permissions.includes(`${moduleCode}.${actionCode}`);
}

/**
 * Kiểm tra user có ít nhất một trong các moduleCode không (OR logic).
 */
export function useAnyPermission(moduleCodes: string[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (moduleCodes.length === 0) return true;
  if (!user) return false;
  if (user.roles.includes(SUPER_ADMIN_CODE)) return true;
  return moduleCodes.some((code) =>
    user.permissions.some((p) => p.startsWith(code + '.'))
  );
}
