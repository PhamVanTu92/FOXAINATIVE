'use client';

import { useCallback, useEffect, useState } from 'react';
import { ocrApi } from '@/lib/ocr-api';
import type { DocStats, SchemaStats } from '@/lib/ocr-api';
import { knowledgeBasesApi } from '@/lib/knowledge-api';
import type { KbGlobalStats, KnowledgeBase } from '@/lib/knowledge-api';
import { chatbotApi } from '@/lib/chatbot-api';
import type { ChatbotItem } from '@/lib/chatbot-api';
import { usersApi, rolesApi, orgsApi } from '@/lib/users-api';
import type { OrgNode } from '@/lib/users-api';

function countOrgNodes(nodes: OrgNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countOrgNodes(n.children ?? []), 0);
}

export interface DashboardState {
  ocrStats: DocStats | null;
  schemaStats: SchemaStats | null;
  kbStats: KbGlobalStats | null;
  kbList: KnowledgeBase[];
  chatbots: ChatbotItem[];
  userTotal: number;
  userActive: number;
  roleCount: number;
  orgCount: number;
  loading: boolean;
  lastRefresh: Date;
}

const EMPTY: DashboardState = {
  ocrStats: null, schemaStats: null, kbStats: null,
  kbList: [], chatbots: [],
  userTotal: 0, userActive: 0, roleCount: 0, orgCount: 0,
  loading: true, lastRefresh: new Date(),
};

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(EMPTY);

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    const [ocrS, schemaS, kbS, kbL, bots, usrAll, usrActive, roles, orgTree] =
      await Promise.allSettled([
        ocrApi.getStats(),
        ocrApi.getSchemaStats(),
        knowledgeBasesApi.stats(),
        knowledgeBasesApi.list({ pageSize: 6 }),
        chatbotApi.list(),
        usersApi.list({ pageSize: 1 }),
        usersApi.list({ pageSize: 1, status: 'ACTIVE' }),
        rolesApi.list(100),
        orgsApi.tree(),
      ]);

    setState({
      ocrStats:    ocrS.status    === 'fulfilled' ? ocrS.value    : null,
      schemaStats: schemaS.status === 'fulfilled' ? schemaS.value : null,
      kbStats:     kbS.status     === 'fulfilled' ? kbS.value     : null,
      kbList:      kbL.status     === 'fulfilled' ? kbL.value.items : [],
      chatbots:    bots.status    === 'fulfilled' ? bots.value    : [],
      userTotal:   usrAll.status  === 'fulfilled' ? Number(usrAll.value.page.totalItems) : 0,
      userActive:  usrActive.status === 'fulfilled' ? Number(usrActive.value.page.totalItems) : 0,
      roleCount:   roles.status   === 'fulfilled' ? roles.value.items.length : 0,
      orgCount:    orgTree.status === 'fulfilled' ? countOrgNodes(orgTree.value.nodes) : 0,
      loading: false,
      lastRefresh: new Date(),
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, refresh: load };
}
