'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ScanLine, LogOut, Sun, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { navConfig } from './nav-config';
import type { NavItem, NavSection } from './nav-config';
import { ocrApi } from '@/lib/ocr-api';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/components/ThemeProvider';

function SidebarChildItem({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 pl-9 pr-3 py-2 text-sm rounded-md mx-2 transition-colors ${
        isActive
          ? 'bg-primary-500/10 text-primary-600 font-semibold'
          : 'text-content-secondary font-semibold hover:bg-subtle hover:text-content-primary'
      }`}
    >
      <Icon size={15} className={isActive ? 'text-primary-600' : 'text-content-muted'} />
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
              ? 'text-primary-600 font-semibold'
              : 'text-content-secondary font-semibold hover:bg-subtle hover:text-content-primary'
          }`}
          style={{ width: 'calc(100% - 16px)' }}
        >
          <Icon size={17} className={isChildActive ? 'text-primary-600' : 'text-content-muted'} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            size={14}
            className={`text-content-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
          ? 'bg-primary-500/10 text-primary-600 font-semibold'
          : 'text-content-secondary font-semibold hover:bg-subtle hover:text-content-primary'
      }`}
      style={{ display: 'flex', marginLeft: '8px', marginRight: '8px' }}
    >
      <Icon size={17} className={isDirectActive ? 'text-primary-600' : 'text-content-muted'} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const { user, logout, init } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [schemaChildren, setSchemaChildren] = useState<{ label: string; href: string; icon: LucideIcon }[]>([]);

  useEffect(() => { init(); }, [init]);

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
    <aside className="flex flex-col h-screen w-64 bg-sidebar border-r border-default select-none transition-colors duration-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-default">
        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        <div>
          <p className="text-content-primary font-bold text-sm tracking-wide leading-tight">FOXAI – NATIVE</p>
          <p className="text-content-muted text-[10px] tracking-widest uppercase font-medium">Your trust partner</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {dynamicNavConfig.map((section) => (
          <div key={section.section} className="mb-3">
            <p className="px-5 py-1.5 text-[10px] font-bold tracking-widest text-content-muted uppercase">
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
      <div className="border-t border-default px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-content-primary text-sm font-medium truncate">{user?.fullName ?? 'Người dùng'}</p>
          <p className="text-content-muted text-[11px] truncate font-medium">{user?.roles?.[0] ?? 'Chưa xác định'}</p>
        </div>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
          className="shrink-0 text-content-muted hover:text-primary-600 transition-colors p-1"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={async () => { await logout(); router.replace('/dang-nhap'); }}
          title="Đăng xuất"
          className="shrink-0 text-content-muted hover:text-danger-600 transition-colors p-1"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
