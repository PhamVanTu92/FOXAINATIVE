export type ActionId = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT';
export type NodeType = 'MODULE' | 'CATEGORY' | 'KNOWLEDGE_BASE' | 'FILE';
export type PermOrigin = 'role' | 'user';

export interface MatrixCell {
  allowed: boolean;
  origin: PermOrigin;
  indeterminate?: boolean;
}

export interface ResourcePermNode {
  id: string;
  name: string;
  type: NodeType;
  /** Columns that render a checkbox — other columns show N/A (—) */
  allowedActions: ActionId[];
  matrix: Partial<Record<ActionId, MatrixCell>>;
  children?: ResourcePermNode[];
}

export const ALL_ACTIONS: { id: ActionId; name: string }[] = [
  { id: 'READ',   name: 'Xem' },
  { id: 'CREATE', name: 'Thêm' },
  { id: 'UPDATE', name: 'Sửa' },
  { id: 'DELETE', name: 'Xóa' },
  { id: 'EXPORT', name: 'Xuất' },
  { id: 'IMPORT', name: 'Nhập' },
];

/**
 * Demo tree: 2 modules with different allowed action sets.
 *
 * Module 1 — HÀNG HÓA CMS: supports READ/CREATE/UPDATE/DELETE/EXPORT (no IMPORT)
 * Module 2 — CHATBOT AI:    supports READ/CREATE/UPDATE/DELETE only (no EXPORT, no IMPORT)
 *
 * Within Module 1, "Kế toán Quý 1" KB has UPDATE removed from allowedActions → N/A column.
 * Files never have CREATE (can't create sub-nodes).
 *
 * origin: 'role'  → value comes from the assigned role  → shows chain badge 🔗
 * origin: 'user'  → explicit user override on top of role → plain checkbox
 * indeterminate   → parent row aggregating mixed children → [-] state
 */
export const MOCK_RESOURCE_PERMISSIONS: ResourcePermNode[] = [
  // ─────────────────────────────────────────────────────── MODULE 1
  {
    id: 'mod_hanghoa',
    name: 'HÀNG HÓA - CMS',
    type: 'MODULE',
    allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
    matrix: {
      READ:   { allowed: true,  origin: 'role', indeterminate: true  },
      CREATE: { allowed: false, origin: 'role' },
      UPDATE: { allowed: false, origin: 'role', indeterminate: true  },
      DELETE: { allowed: false, origin: 'role' },
      EXPORT: { allowed: true,  origin: 'role', indeterminate: true  },
    },
    children: [
      // ── Category: Kế toán Nội bộ ────────────────────────────────
      {
        id: 'cat_ketoan',
        name: 'Kế toán Nội bộ',
        type: 'CATEGORY',
        allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
        matrix: {
          READ:   { allowed: true,  origin: 'role' },
          CREATE: { allowed: true,  origin: 'role' },
          UPDATE: { allowed: false, origin: 'role' },
          DELETE: { allowed: false, origin: 'role' },
          EXPORT: { allowed: true,  origin: 'role' },
        },
        children: [
          // KB: Thuế 2026 — UPDATE is user override (granted extra)
          {
            id: 'kb_thue2026',
            name: 'Thuế 2026',
            type: 'KNOWLEDGE_BASE',
            allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
            matrix: {
              READ:   { allowed: true,  origin: 'role' },
              CREATE: { allowed: true,  origin: 'role' },
              UPDATE: { allowed: true,  origin: 'user' }, // 👤 user override: granted UPDATE
              DELETE: { allowed: false, origin: 'role' },
              EXPORT: { allowed: true,  origin: 'role' },
            },
            children: [
              {
                id: 'file_huongdan',
                name: 'Huong_dan_khai_thue.pdf',
                type: 'FILE',
                allowedActions: ['READ', 'UPDATE', 'DELETE', 'EXPORT'], // CREATE N/A for files
                matrix: {
                  READ:   { allowed: true,  origin: 'role' },
                  UPDATE: { allowed: true,  origin: 'role' },
                  DELETE: { allowed: false, origin: 'role' },
                  EXPORT: { allowed: true,  origin: 'role' },
                },
              },
              {
                id: 'file_bieumau01',
                name: 'Bieu_mau_khai_thue_01.docx',
                type: 'FILE',
                allowedActions: ['READ', 'UPDATE', 'DELETE', 'EXPORT'],
                matrix: {
                  READ:   { allowed: true,  origin: 'role' },
                  UPDATE: { allowed: false, origin: 'user' }, // 👤 user override: locked UPDATE
                  DELETE: { allowed: false, origin: 'role' },
                  EXPORT: { allowed: true,  origin: 'role' },
                },
              },
              {
                id: 'file_qd2024',
                name: 'QD_thue_TNDN_2024.pdf',
                type: 'FILE',
                allowedActions: ['READ', 'UPDATE', 'DELETE', 'EXPORT'],
                matrix: {
                  READ:   { allowed: true,  origin: 'role' },
                  UPDATE: { allowed: false, origin: 'role' },
                  DELETE: { allowed: false, origin: 'role' },
                  EXPORT: { allowed: true,  origin: 'role' },
                },
              },
            ],
          },
          // KB: Kế toán Quý 1 — UPDATE removed from allowedActions → entire UPDATE column = N/A
          {
            id: 'kb_ketoanq1',
            name: 'Kế toán Quý 1 / 2026',
            type: 'KNOWLEDGE_BASE',
            allowedActions: ['READ', 'CREATE', 'DELETE', 'EXPORT'], // no UPDATE
            matrix: {
              READ:   { allowed: true,  origin: 'role' },
              CREATE: { allowed: false, origin: 'role' },
              DELETE: { allowed: false, origin: 'role' },
              EXPORT: { allowed: true,  origin: 'role' },
            },
            children: [
              {
                id: 'file_baocaoq1',
                name: 'Bao_cao_tai_chinh_Q1.xlsx',
                type: 'FILE',
                allowedActions: ['READ', 'DELETE', 'EXPORT'], // no UPDATE (inherited from parent KB)
                matrix: {
                  READ:   { allowed: true,  origin: 'role' },
                  DELETE: { allowed: false, origin: 'role' },
                  EXPORT: { allowed: true,  origin: 'role' },
                },
              },
            ],
          },
        ],
      },
      // ── Category: Nhân sự (tất cả tắt) ─────────────────────────────
      {
        id: 'cat_nhansu',
        name: 'Nhân sự',
        type: 'CATEGORY',
        allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
        matrix: {
          READ:   { allowed: false, origin: 'role' },
          CREATE: { allowed: false, origin: 'role' },
          UPDATE: { allowed: false, origin: 'role' },
          DELETE: { allowed: false, origin: 'role' },
          EXPORT: { allowed: false, origin: 'role' },
        },
        children: [
          {
            id: 'kb_hopdong',
            name: 'Hợp đồng Lao động',
            type: 'KNOWLEDGE_BASE',
            allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
            matrix: {
              READ:   { allowed: false, origin: 'role' },
              CREATE: { allowed: false, origin: 'role' },
              UPDATE: { allowed: false, origin: 'role' },
              DELETE: { allowed: false, origin: 'role' },
              EXPORT: { allowed: false, origin: 'role' },
            },
            children: [
              {
                id: 'file_hdld2026',
                name: 'Mau_HDLD_chinh_thuc_2026.docx',
                type: 'FILE',
                allowedActions: ['READ', 'UPDATE', 'DELETE', 'EXPORT'],
                matrix: {
                  READ:   { allowed: false, origin: 'role' },
                  UPDATE: { allowed: false, origin: 'role' },
                  DELETE: { allowed: false, origin: 'role' },
                  EXPORT: { allowed: false, origin: 'role' },
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────── MODULE 2
  // CHATBOT: no EXPORT, no IMPORT — những cột này = N/A cho toàn bộ module
  {
    id: 'mod_chatbot',
    name: 'CHATBOT - AI Assistant',
    type: 'MODULE',
    allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    matrix: {
      READ:   { allowed: true,  origin: 'role', indeterminate: true },
      CREATE: { allowed: true,  origin: 'role' },
      UPDATE: { allowed: false, origin: 'role', indeterminate: true },
      DELETE: { allowed: false, origin: 'role' },
    },
    children: [
      {
        id: 'cat_kichban',
        name: 'Kịch bản Chat',
        type: 'CATEGORY',
        allowedActions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        matrix: {
          READ:   { allowed: true,  origin: 'role' },
          CREATE: { allowed: true,  origin: 'role' },
          UPDATE: { allowed: false, origin: 'user' }, // 👤 user override: locked UPDATE
          DELETE: { allowed: false, origin: 'role' },
        },
        children: [
          {
            id: 'kb_bot_khach',
            name: 'Bot Hỗ trợ Khách hàng',
            type: 'KNOWLEDGE_BASE',
            allowedActions: ['READ', 'UPDATE', 'DELETE'], // no CREATE for this KB type
            matrix: {
              READ:   { allowed: true,  origin: 'role' },
              UPDATE: { allowed: false, origin: 'user' },
              DELETE: { allowed: false, origin: 'role' },
            },
          },
          {
            id: 'kb_bot_noidung',
            name: 'Bot Tư vấn Nội dung',
            type: 'KNOWLEDGE_BASE',
            allowedActions: ['READ', 'UPDATE', 'DELETE'],
            matrix: {
              READ:   { allowed: true,  origin: 'role' },
              UPDATE: { allowed: true,  origin: 'role' },
              DELETE: { allowed: false, origin: 'role' },
            },
          },
        ],
      },
    ],
  },
];
