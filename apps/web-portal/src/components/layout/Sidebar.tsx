'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ScanLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { navConfig } from './nav-config';
import type { NavItem, NavSection } from './nav-config';
import { ocrApi } from '@/lib/ocr-api';

function SidebarChildItem({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 pl-9 pr-3 py-2 text-sm rounded-md mx-2 transition-colors ${
        isActive
          ? 'bg-white/15 text-white font-medium'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={15} className={isActive ? 'text-cyan-300' : 'text-slate-400'} />
      <span>{label}</span>
    </Link>
  );
}

function SidebarNavItem({ item }: { item: NavItem }) {
  const pathname = usePathname();

  const isChildActive = item.children?.some((c) => pathname === c.href) ?? false;
  const isDirectActive = item.href ? pathname === item.href : false;

  const [open, setOpen] = useState(isChildActive);

  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);

  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center gap-3 px-3 py-2 mx-2 rounded-md text-sm transition-colors ${
            isChildActive
              ? 'text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
          style={{ width: 'calc(100% - 16px)' }}
        >
          <Icon size={17} className={isChildActive ? 'text-cyan-300' : 'text-slate-400'} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <div className="mt-0.5 pb-1">
            {item.children.map((child) => (
              <SidebarChildItem key={child.href} {...child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-md text-sm transition-colors ${
        isDirectActive
          ? 'bg-white/15 text-white font-medium'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
      style={{ display: 'flex', marginLeft: '8px', marginRight: '8px' }}
    >
      <Icon size={17} className={isDirectActive ? 'text-cyan-300' : 'text-slate-400'} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const [schemaChildren, setSchemaChildren] = useState<{ label: string; href: string; icon: LucideIcon }[]>([]);

  useEffect(() => {
    ocrApi.getSchemas().then(list => {
      setSchemaChildren(
        list.map(s => ({ label: s.name, href: `/xu-ly/nhan-dang/${s.code}`, icon: ScanLine }))
      );
    }).catch(() => {});
  }, []);

  const dynamicNavConfig = useMemo<NavSection[]>(() => navConfig.map(section => ({
    ...section,
    items: section.items.map(item =>
      item.label === 'Nhận dạng OCR'
        ? { ...item, children: schemaChildren }
        : item
    ),
  })), [schemaChildren]);

  return (
    <aside className="flex flex-col h-screen w-64 bg-[#0d1f3c] border-r border-white/5 select-none">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        <div>
          <p className="text-white font-bold text-sm tracking-wide leading-tight">FOXAI – NATIVE</p>
          <p className="text-slate-400 text-[10px] tracking-widest uppercase">Your trust partner</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {dynamicNavConfig.map((section) => (
          <div key={section.section} className="mb-3">
            <p className="px-5 py-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold">
          NN
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">Nghĩa Nguyễn</p>
          <p className="text-slate-400 text-[11px] truncate">Quản trị viên</p>
        </div>
      </div>
    </aside>
  );
}
