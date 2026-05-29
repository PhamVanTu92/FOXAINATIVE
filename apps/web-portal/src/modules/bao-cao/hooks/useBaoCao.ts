'use client';

import { useCallback, useEffect, useState } from 'react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocStats, SchemaStats } from '@/lib/ocr-api';
import { knowledgeBasesApi } from '@/lib/knowledge-api';
import type { KbGlobalStats, KnowledgeBase } from '@/lib/knowledge-api';
import { chatbotApi, PURPOSE_LABELS } from '@/lib/chatbot-api';
import type { ChatbotItem } from '@/lib/chatbot-api';
import { usersApi, rolesApi, orgsApi } from '@/lib/users-api';
import type { OrgNode, UserItem } from '@/lib/users-api';
import { fetchAllPages } from '@/lib/fetch-all-pages';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BarEntry { label: string; value: number; color: string }

export interface BaoCaoState {
  // OCR
  ocrStats: DocStats | null;
  schemaStats: SchemaStats | null;
  docTypeBreakdown: BarEntry[];
  // KB
  kbStats: KbGlobalStats | null;
  kbList: KnowledgeBase[];
  totalPdfFiles: number;
  // Chatbot
  chatbots: ChatbotItem[];
  botPurposeBreakdown: BarEntry[];
  // System
  userTotal: number;
  userActive: number;
  roleCount: number;
  userDeptBreakdown: BarEntry[];
  // Meta
  loading: boolean;
  lastRefresh: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<string, string> = {
  INVOICE:           'bg-teal-500',
  RECEIPT:           'bg-cyan-500',
  CONTRACT:          'bg-blue-500',
  STATEMENT:         'bg-sky-500',
  MINUTES:           'bg-amber-500',
  WAREHOUSE_RECEIPT: 'bg-violet-500',
  OTHERS:            'bg-gray-400',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE:           'Hóa đơn',
  RECEIPT:           'Hóa đơn bán lẻ',
  CONTRACT:          'Hợp đồng',
  STATEMENT:         'Bảng kê',
  MINUTES:           'Biên bản',
  WAREHOUSE_RECEIPT: 'Phiếu nhập kho',
  OTHERS:            'Khác',
};

const PURPOSE_COLORS: Record<string, string> = {
  customer_care: 'bg-cyan-500',
  sales:         'bg-blue-500',
  tech_support:  'bg-violet-500',
  other:         'bg-teal-500',
};

const DEPT_COLORS = [
  'bg-orange-400', 'bg-red-500', 'bg-teal-500',
  'bg-violet-500', 'bg-green-500', 'bg-amber-400',
  'bg-sky-500', 'bg-rose-500', 'bg-indigo-500',
];

function flattenOrg(nodes: OrgNode[], map: Record<string, string> = {}) {
  for (const n of nodes) {
    map[n.id] = n.name;
    if (n.children?.length) flattenOrg(n.children, map);
  }
  return map;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const EMPTY: BaoCaoState = {
  ocrStats: null, schemaStats: null, docTypeBreakdown: [],
  kbStats: null, kbList: [], totalPdfFiles: 0,
  chatbots: [], botPurposeBreakdown: [],
  userTotal: 0, userActive: 0, roleCount: 0, userDeptBreakdown: [],
  loading: true, lastRefresh: new Date(),
};

export function useBaoCao() {
  const [state, setState] = useState<BaoCaoState>(EMPTY);

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    // Fetch song song: stats nhanh + 3 paginated endpoints lấy toàn bộ dữ liệu
    const [ocrS, schemaS, kbS, bots, usrsActiveR, rolesR, orgR, allDocs, allKbs, allUsers] =
      await Promise.allSettled([
        ocrApi.getStats(),
        ocrApi.getSchemaStats(),
        knowledgeBasesApi.stats(),
        chatbotApi.list(),
        usersApi.list({ pageSize: 1, status: 'ACTIVE' }),
        rolesApi.list(100),
        orgsApi.tree(),
        // --- Paginated: fetch tất cả trang ---
        fetchAllPages(
          (page, pageSize) => ocrApi.getDocuments({ pageSize: String(pageSize), page: String(page) })
            .then(r => ({ items: r.items, totalPages: r.totalPages })),
        ),
        fetchAllPages(
          (page, pageSize) => knowledgeBasesApi.list({ page, pageSize })
            .then(r => ({ items: r.items, totalPages: Math.ceil(r.total / pageSize) })),
        ),
        fetchAllPages(
          (page, pageSize) => usersApi.list({ page, pageSize })
            .then(r => ({ items: r.items, totalPages: r.page.totalPages })),
        ),
      ]);

    // Doc type breakdown
    const docTypeMap: Record<string, number> = {};
    if (allDocs.status === 'fulfilled') {
      for (const doc of allDocs.value) {
        const t = doc.schema?.type ?? 'OTHERS';
        docTypeMap[t] = (docTypeMap[t] ?? 0) + 1;
      }
    }
    const docTypeBreakdown: BarEntry[] = Object.entries(docTypeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({
        label: DOC_TYPE_LABELS[type] ?? type,
        value,
        color: DOC_TYPE_COLORS[type] ?? 'bg-gray-400',
      }));

    // Bot purpose breakdown
    const botList = bots.status === 'fulfilled' ? bots.value : [];
    const purposeMap: Record<string, number> = {};
    for (const bot of botList) {
      const p = bot.purpose ?? 'other';
      purposeMap[p] = (purposeMap[p] ?? 0) + 1;
    }
    const botPurposeBreakdown: BarEntry[] = Object.entries(purposeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([purpose, value]) => ({
        label: PURPOSE_LABELS[purpose as keyof typeof PURPOSE_LABELS] ?? purpose,
        value,
        color: PURPOSE_COLORS[purpose] ?? 'bg-gray-400',
      }));

    // User dept breakdown
    const orgNameMap = orgR.status === 'fulfilled'
      ? flattenOrg(orgR.value.nodes)
      : {};
    const usersList: UserItem[] = allUsers.status === 'fulfilled' ? allUsers.value : [];
    const deptMap: Record<string, number> = {};
    for (const u of usersList) {
      const deptName: string =
        (u.organizationId && orgNameMap[u.organizationId]) || 'Chưa phân công';
      deptMap[deptName] = (deptMap[deptName] ?? 0) + 1;
    }
    const userDeptBreakdown: BarEntry[] = Object.entries(deptMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label, value,
        color: DEPT_COLORS[i % DEPT_COLORS.length] ?? 'bg-gray-400',
      }));

    // Total PDF files from KB list
    const kbItems = allKbs.status === 'fulfilled' ? allKbs.value : [];
    const totalPdfFiles = kbItems.reduce((s, kb) => s + (kb.fileCounts?.pdf ?? 0), 0);

    setState({
      ocrStats:    ocrS.status    === 'fulfilled' ? ocrS.value    : null,
      schemaStats: schemaS.status === 'fulfilled' ? schemaS.value : null,
      docTypeBreakdown,
      kbStats:     kbS.status     === 'fulfilled' ? kbS.value     : null,
      kbList:      kbItems,
      totalPdfFiles,
      chatbots:    botList,
      botPurposeBreakdown,
      userTotal:   allUsers.status === 'fulfilled' ? allUsers.value.length : 0,
      userActive:  usrsActiveR.status === 'fulfilled' ? Number(usrsActiveR.value.page.totalItems) : 0,
      roleCount:   rolesR.status  === 'fulfilled' ? rolesR.value.items.length : 0,
      userDeptBreakdown,
      loading: false,
      lastRefresh: new Date(),
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, refresh: load };
}
