'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown,
  Layers, Folder, BookOpen, FileText,
  Link2, Info, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';
import {
  ALL_ACTIONS, MOCK_RESOURCE_PERMISSIONS,
  type ActionId, type MatrixCell, type NodeType, type PermOrigin, type ResourcePermNode,
} from '../mock/resourcePermissions.mock';

// ─── Internal types ───────────────────────────────────────────────────────────
type PermMatrix = Map<string, Partial<Record<ActionId, MatrixCell>>>;

interface FlatRow {
  node: ResourcePermNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

// ─── Tree helpers ──────────────────────────────────────────────────────────────
function getAllNodeIds(nodes: ResourcePermNode[]): string[] {
  const ids: string[] = [];
  function walk(n: ResourcePermNode) {
    ids.push(n.id);
    n.children?.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

function buildMatrix(nodes: ResourcePermNode[]): PermMatrix {
  const map = new Map<string, Partial<Record<ActionId, MatrixCell>>>();
  function walk(n: ResourcePermNode) {
    map.set(n.id, JSON.parse(JSON.stringify(n.matrix)));
    n.children?.forEach(walk);
  }
  nodes.forEach(walk);
  return map;
}

function flattenTree(nodes: ResourcePermNode[], expanded: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  function walk(node: ResourcePermNode, depth: number) {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isExpanded = expanded.has(node.id);
    rows.push({ node, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) node.children!.forEach(c => walk(c, depth + 1));
  }
  nodes.forEach(n => walk(n, 0));
  return rows;
}

// ─── Per-node visual config ────────────────────────────────────────────────────
const NODE_CONFIG: Record<NodeType, {
  Icon: React.ElementType;
  iconCls: string;
  textCls: string;
  rowCls: string;
}> = {
  MODULE: {
    Icon: Layers,
    iconCls: 'text-violet-500',
    textCls: 'text-xs font-bold uppercase tracking-widest text-dark-700',
    rowCls: 'bg-dark-100/70 border-b-2 border-dark-200',
  },
  CATEGORY: {
    Icon: Folder,
    iconCls: 'text-warning-500',
    textCls: 'text-sm font-semibold text-dark-700',
    rowCls: 'bg-warning-50/20 border-b border-warning-200/50 hover:bg-warning-50/40',
  },
  KNOWLEDGE_BASE: {
    Icon: BookOpen,
    iconCls: 'text-primary-500',
    textCls: 'text-sm font-medium text-dark-600',
    rowCls: 'bg-surface border-b border-strong hover:bg-subtle/50',
  },
  FILE: {
    Icon: FileText,
    iconCls: 'text-dark-350',
    textCls: 'text-xs font-normal text-dark-500 italic',
    rowCls: 'bg-surface border-b border-strong hover:bg-subtle/30',
  },
};

// ─── Individual permission cell ────────────────────────────────────────────────
function PermCell({
  cell,
  isNA,
  onToggle,
}: {
  cell: MatrixCell | undefined;
  isNA: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = cell?.indeterminate ?? false;
  }, [cell?.indeterminate]);

  if (isNA) {
    return (
      <span className="text-xs font-medium text-dark-300 select-none tracking-wide">—</span>
    );
  }

  if (!cell) return null;

  const isRole = cell.origin === 'role';
  const tooltip = isRole
    ? `Quyền từ vai trò — ${cell.allowed ? 'đang bật' : 'đang tắt'}. Click để ghi đè.`
    : `Ghi đè cá nhân — ${cell.allowed ? 'đang bật' : 'đang tắt'}`;

  return (
    <span className="relative inline-flex items-center justify-center" title={tooltip}>
      <input
        ref={ref}
        type="checkbox"
        checked={cell.allowed}
        onChange={onToggle}
        className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
      />
      {isRole && (
        <span className="pointer-events-none absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-teal-500 flex items-center justify-center shadow">
          <Link2 size={6} className="text-white" />
        </span>
      )}
    </span>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────
export function ResourcePermMatrixView() {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(getAllNodeIds(MOCK_RESOURCE_PERMISSIONS)),
  );
  const [matrix, setMatrix] = useState<PermMatrix>(
    () => buildMatrix(MOCK_RESOURCE_PERMISSIONS),
  );

  const rows = flattenTree(MOCK_RESOURCE_PERMISSIONS, expanded);
  const allIds = getAllNodeIds(MOCK_RESOURCE_PERMISSIONS);
  const isAllExpanded = allIds.every(id => expanded.has(id));

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCell(nodeId: string, actionId: ActionId) {
    setMatrix(prev => {
      const next = new Map(prev);
      const nodeMatrix = { ...(prev.get(nodeId) ?? {}) };
      const cell = nodeMatrix[actionId];
      if (!cell) return prev;
      nodeMatrix[actionId] = {
        allowed: !cell.allowed,
        origin: 'user' as PermOrigin, // first edit → user override
        indeterminate: false,
      };
      next.set(nodeId, nodeMatrix);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full bg-subtle">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-surface border-b border-default shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-dark-800">
            Phân quyền tài nguyên (Danh mục → Bộ tri thức → Tệp tin)
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning-100 text-warning-700 font-medium border border-warning-300">
            Mock · Prototype
          </span>
        </div>
        <button
          onClick={() => setExpanded(isAllExpanded ? new Set() : new Set(allIds))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-default text-dark-500 rounded-lg hover:bg-subtle transition-colors"
        >
          {isAllExpanded
            ? <><ChevronsDownUp size={12} /> Thu gọn tất cả</>
            : <><ChevronsUpDown size={12} /> Mở rộng tất cả</>}
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ minWidth: 680 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary-600 text-white">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                style={{ minWidth: 280 }}>
                Bộ tri thức / Tệp tin
              </th>
              {ALL_ACTIONS.map(a => (
                <th key={a.id}
                  className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ minWidth: 68 }}>
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ node, depth, hasChildren, isExpanded }) => {
              const { Icon, iconCls, textCls, rowCls } = NODE_CONFIG[node.type];
              const nodeMatrix = matrix.get(node.id) ?? {};
              const isModuleSeparator = node.type === 'MODULE';

              return (
                <tr key={node.id} className={`transition-colors ${rowCls} ${isModuleSeparator ? 'mt-2' : ''}`}>

                  {/* ── Name cell ─────────────────────────────── */}
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5"
                      style={{ paddingLeft: `${depth * 18}px` }}>
                      {hasChildren ? (
                        <button
                          onClick={() => toggleExpand(node.id)}
                          className="p-0.5 text-dark-400 hover:text-dark-700 rounded transition-colors shrink-0"
                        >
                          {isExpanded
                            ? <ChevronDown size={13} />
                            : <ChevronRight size={13} />}
                        </button>
                      ) : (
                        <span className="w-5 shrink-0" />
                      )}
                      <Icon size={14} className={`shrink-0 ${iconCls}`} />
                      <span className={`truncate max-w-[200px] ${textCls}`} title={node.name}>
                        {node.name}
                      </span>
                    </div>
                  </td>

                  {/* ── Action cells ──────────────────────────── */}
                  {ALL_ACTIONS.map(action => {
                    const isNA = !node.allowedActions.includes(action.id);
                    const cell = nodeMatrix[action.id];
                    const isRoleOn = !isNA && cell?.origin === 'role' && cell.allowed;
                    const isUserOn = !isNA && cell?.origin === 'user' && cell?.allowed;

                    return (
                      <td key={action.id}
                        className={`px-2 py-2.5 text-center transition-colors ${
                          isNA        ? 'bg-dark-100/60' :
                          isRoleOn    ? 'bg-primary-50/70' :
                          isUserOn    ? 'bg-teal-50/70' :
                          ''
                        }`}
                      >
                        <PermCell
                          cell={cell}
                          isNA={isNA}
                          onToggle={() => { if (!isNA) toggleCell(node.id, action.id); }}
                        />
                      </td>
                    );
                  })}

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className="flex items-center gap-5 px-5 py-2.5 bg-surface border-t border-default shrink-0 flex-wrap">
        <span className="text-xs font-medium text-dark-500 shrink-0">Chú thích:</span>

        {/* Role on */}
        <span className="flex items-center gap-1.5 text-xs text-dark-500">
          <span className="relative w-4 h-4 shrink-0 inline-flex items-center justify-center">
            <input type="checkbox" defaultChecked readOnly
              className="w-4 h-4 rounded accent-primary-600 pointer-events-none" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-teal-500 flex items-center justify-center shadow">
              <Link2 size={6} className="text-white" />
            </span>
          </span>
          <span className="bg-primary-50/70 px-1.5 py-0.5 rounded">Vai trò cấp — bật</span>
        </span>

        {/* Role off */}
        <span className="flex items-center gap-1.5 text-xs text-dark-500">
          <span className="relative w-4 h-4 shrink-0 inline-flex items-center justify-center">
            <input type="checkbox" defaultChecked={false} readOnly
              className="w-4 h-4 rounded accent-primary-600 pointer-events-none" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-teal-500 flex items-center justify-center shadow">
              <Link2 size={6} className="text-white" />
            </span>
          </span>
          Vai trò cấp — tắt
        </span>

        {/* User override on */}
        <span className="flex items-center gap-1.5 text-xs text-dark-500">
          <input type="checkbox" defaultChecked readOnly
            className="w-4 h-4 rounded accent-primary-600 pointer-events-none" />
          <span className="bg-teal-50/70 px-1.5 py-0.5 rounded">Ghi đè cá nhân — bật</span>
        </span>

        {/* User override off */}
        <span className="flex items-center gap-1.5 text-xs text-dark-500">
          <input type="checkbox" defaultChecked={false} readOnly
            className="w-4 h-4 rounded accent-primary-600 pointer-events-none" />
          Ghi đè cá nhân — tắt
        </span>

        {/* N/A */}
        <span className="flex items-center gap-1.5 text-xs text-dark-500">
          <span className="w-8 h-5 rounded bg-dark-100/60 inline-flex items-center justify-center text-dark-300 text-xs font-medium">—</span>
          Không áp dụng
        </span>

        <span className="flex-1" />
        <span className="flex items-center gap-1 text-xs text-dark-400 italic shrink-0">
          <Info size={11} />
          Click ô để bật / tắt — tự động chuyển thành ghi đè cá nhân
        </span>
      </div>
    </div>
  );
}
