'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ScanLine, LogOut, Sun, Moon, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { navConfig } from './nav-config';
import type { NavItem, NavSection } from './nav-config';
import { ocrApi } from '@/lib/ocr-api';
import { chatbotApi } from '@/lib/chatbot-api';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/components/ThemeProvider';

// Icon color per section — vivid on dark sidebar background
const SECTION_ICON_COLOR: Record<string, string> = {
  'TỔNG QUAN': 'text-sky-500',
  'CẤU HÌNH HỆ THỐNG': 'text-orange-500',
  'TRI THỨC AI': 'text-violet-500',
  'XỬ LÝ TÀI LIỆU': 'text-teal-500',
  'CHATBOT AI THÔNG MINH': 'text-violet-500',
};

function SidebarChildItem({
  href, label, icon: Icon, iconColor,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 pl-9 pr-3 py-2 text-sm rounded-md mx-2 transition-colors ${
        isActive
          ? 'bg-white/15 text-white font-semibold'
          : 'text-white/70 font-medium hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={15} className={isActive ? 'text-white' : iconColor} />
      <span>{label}</span>
    </Link>
  );
}

function SidebarNavItem({ item, iconColor }: { item: NavItem; iconColor: string }) {
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
              ? 'text-white font-semibold'
              : 'text-white/70 font-medium hover:bg-white/10 hover:text-white'
          }`}
          style={{ width: 'calc(100% - 16px)' }}
        >
          <Icon size={17} className={isChildActive ? 'text-white' : iconColor} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            size={14}
            className={`text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <div className="mt-0.5 pb-1">
            {item.children.map((child) => (
              <SidebarChildItem key={child.href} {...child} iconColor={iconColor} />
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
          ? 'bg-white/15 text-white font-semibold'
          : 'text-white/70 font-medium hover:bg-white/10 hover:text-white'
      }`}
      style={{ display: 'flex', marginLeft: '8px', marginRight: '8px' }}
    >
      <Icon size={17} className={isDirectActive ? 'text-white' : iconColor} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const { user, logout, init } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [schemaChildren, setSchemaChildren] = useState<{ label: string; href: string; icon: LucideIcon }[]>([]);
  const [chatbotItems, setChatbotItems] = useState<NavItem[]>([]);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const loadSchemas = () => {
      ocrApi.getSchemas().then(list => {
        setSchemaChildren(
          list
            .filter(s => s.isActive)
            .map(s => ({ label: s.name, href: `/xu-ly/nhan-dang/${s.code}`, icon: ScanLine }))
        );
      }).catch(() => {});
    };
    loadSchemas();
    window.addEventListener('schemas:updated', loadSchemas);
    return () => window.removeEventListener('schemas:updated', loadSchemas);
  }, []);

  useEffect(() => {
    if (!user) {
      setChatbotItems([]);
      return;
    }
    const loadChatbots = () => {
      chatbotApi.list().then(list => {
        setChatbotItems(
          list.map(b => ({ label: b.name, href: `/chatbot/${b.id}`, icon: MessageSquare })),
        );
      }).catch(() => setChatbotItems([]));
    };
    loadChatbots();
    window.addEventListener('chatbots:updated', loadChatbots);
    return () => window.removeEventListener('chatbots:updated', loadChatbots);
  }, [user]);

  const dynamicNavConfig = useMemo<NavSection[]>(() => navConfig.map(section => {
    if (section.section === 'CHATBOT AI THÔNG MINH') {
      return { ...section, items: chatbotItems };
    }
    return {
      ...section,
      items: section.items.map(item =>
        item.label === 'Nhận dạng OCR'
          ? { ...item, children: schemaChildren }
          : item,
      ),
    };
  }), [schemaChildren, chatbotItems]);

  return (
    <aside className="flex flex-col h-screen w-64 bg-sidebar border-r border-white/10 select-none transition-colors duration-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center
          text-white font-bold text-sm shadow-md shrink-0">
          F
        </div>
        <div>
          <p className="text-white font-bold text-sm tracking-wide leading-tight">FOXAI – NATIVE</p>
          <p className="text-white/40 text-[10px] tracking-widest uppercase font-medium">Your trust partner</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {dynamicNavConfig.map((section) => (
          <div key={section.section} className="mb-3">
            <p className={`px-5 py-1.5 text-[10px] font-bold tracking-widest uppercase
              ${SECTION_ICON_COLOR[section.section] ?? 'text-white/40'}`}>
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  iconColor={SECTION_ICON_COLOR[section.section] ?? 'text-white/60'}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center
          text-white text-xs font-bold shrink-0">
          {user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate">{user?.fullName ?? 'Người dùng'}</p>
          <p className="text-white/50 text-[11px] truncate font-medium">{user?.roles?.[0] ?? 'Chưa xác định'}</p>
        </div>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
          className="shrink-0 text-white/50 hover:text-white transition-colors p-1"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={async () => { await logout(); router.replace('/dang-nhap'); }}
          title="Đăng xuất"
          className="shrink-0 text-white/50 hover:text-danger-400 transition-colors p-1"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
