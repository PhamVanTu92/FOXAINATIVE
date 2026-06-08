/**
 * Map pathname → module code.
 * Dùng chung giữa PermissionGuard (page-level) và useRoutePermission (action-level).
 * Module codes khớp với ModuleSeedData.cs trong backend.
 */

type RouteRule = { match: (p: string) => boolean; module: string };

const ROUTE_RULES: RouteRule[] = [
  { match: (p) => p === '/',                        module: 'DASHBOARD' },
  { match: (p) => p === '/bao-cao',                 module: 'REPORTS' },
  { match: (p) => p === '/thong-bao',               module: 'NOTIFICATIONS' },

  // Cấu hình hệ thống — exact trước prefix
  { match: (p) => p === '/he-thong/vai-tro',        module: 'ROLE_CONFIG' },
  { match: (p) => p === '/he-thong/nguoi-dung',     module: 'USER_CONFIG' },
  { match: (p) => p === '/he-thong/to-chuc',        module: 'ORG_STRUCTURE' },
  { match: (p) => p.startsWith('/he-thong/ocr'),    module: 'OCR_CONFIG' },
  { match: (p) => p === '/he-thong/chatbot',        module: 'CHATBOT_CONFIG' },

  // Tri thức AI
  { match: (p) => p === '/tri-thuc/kiem-duyet',     module: 'KNOWLEDGE_REVIEW' },
  { match: (p) => p === '/tri-thuc/upload',         module: 'KNOWLEDGE_UPLOAD' },
  { match: (p) => p === '/tri-thuc/ket-noi',        module: 'DATA_AUTO_SYNC' },
  { match: (p) => p === '/tri-thuc/ocr-chuan-hoa',  module: 'OCR_NORMALIZE' },
  { match: (p) => p.startsWith('/tri-thuc'),        module: 'KNOWLEDGE_MGMT' },

  // Xử lý tài liệu
  { match: (p) => p === '/xu-ly/chung-tu',          module: 'DOC_MGMT' },
  { match: (p) => p.startsWith('/xu-ly/'),          module: 'OCR_RECOGNIZE' },

  // Chatbot AI
  { match: (p) => p === '/chatbot/ke-toan',         module: 'CHATBOT_ACCOUNTING' },
  { match: (p) => p === '/chatbot/cskh',            module: 'CHATBOT_CSKH' },
  { match: (p) => p.startsWith('/chatbot/'),        module: 'CHATBOT_ACCOUNTING' },
];

export function resolveModuleCode(pathname: string): string | null {
  // Route chat theo từng bot: /chatbot/<uuid> → module CHATBOT_<uuid hex viết hoa>
  // (khớp chatbot_module_code() ở backend + system_modules.py). Nhờ vậy quyền XEM
  // per-bot (CHATBOT_<id>.READ) mới mở đúng trang chat của bot đó, thay vì bị rule
  // catch-all map nhầm sang CHATBOT_ACCOUNTING.
  const hex = pathname
    .match(
      /^\/chatbot\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/,
    )
    ?.[1]?.replace(/-/g, '')
    .toUpperCase();
  if (hex) return `CHATBOT_${hex}`;
  for (const rule of ROUTE_RULES) {
    if (rule.match(pathname)) return rule.module;
  }
  return null;
}

export type PermissionCheck = string | string[];

export const ROUTE_PERMISSIONS: Array<{
  match: (p: string) => boolean;
  permission: PermissionCheck;
}> = ROUTE_RULES.map((r) => ({ match: r.match, permission: r.module }));
