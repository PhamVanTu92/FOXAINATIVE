'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ScanLine, LogOut, Sun, Moon, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { navConfig } from './nav-config';
import type { NavItem, NavSection } from './nav-config';
import { ocrApi } from '@/lib/ocr-api';
import { chatbotApi } from '@/lib/chatbot-api';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/components/ThemeProvider';

const SECTION_ICON_COLOR: Record<string, string> = {
  'TỔNG QUAN':            'text-sky-500',
  'CẤU HÌNH HỆ THỐNG':   'text-orange-500',
  'TRI THỨC AI':          'text-violet-500',
  'XỬ LÝ TÀI LIỆU':      'text-teal-500',
  'CHATBOT AI THÔNG MINH':'text-violet-500',
};

function SidebarChildItem({
  href, label, icon: Icon, iconColor, collapsed,
}: {
  href: string; label: string; icon: LucideIcon; iconColor: string; collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  if (collapsed) {
    return (
      <Link href={href} title={label}
        className={`flex justify-center items-center py-2 mx-1 rounded-lg transition-all ${
          isActive ? 'bg-white/[0.12] text-white' : 'opacity-70 hover:bg-white/10 hover:opacity-100'
        }`}>
        <Icon size={18} className={isActive ? 'text-white' : iconColor} />
      </Link>
    );
  }
  return (
    <Link href={href}
      className={`flex items-center gap-3 pl-10 pr-3 py-2 text-[14px] rounded-lg mx-2 transition-all ${
        isActive
          ? 'bg-white/[0.12] text-white font-semibold'
          : 'opacity-70 font-medium hover:bg-white/10 hover:opacity-100'
      }`}>
      <Icon size={15} className={isActive ? 'text-white' : iconColor} />
      <span>{label}</span>
    </Link>
  );
}

function SidebarNavItem({ item, iconColor, collapsed }: { item: NavItem; iconColor: string; collapsed: boolean }) {
  const pathname = usePathname();
  const isChildActive = item.children?.some((c) => pathname === c.href) ?? false;
  const isDirectActive = item.href ? pathname === item.href : false;
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => { if (isChildActive) setOpen(true); }, [isChildActive]);

  const Icon = item.icon;

  if (item.children) {
    if (collapsed) {
      return (
        <div>
          <button title={item.label}
            className={`w-full flex justify-center items-center py-2 mx-1 rounded-lg transition-all ${
              isChildActive ? 'text-white' : 'opacity-70 hover:bg-white/10 hover:opacity-100'
            }`}
            style={{ width: 'calc(100% - 8px)' }}
            onClick={() => setOpen(o => !o)}>
            <Icon size={18} className={iconColor} />
          </button>
          <div className={`grid transition-all duration-200 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="pb-1">
                {item.children.map(child => (
                  <SidebarChildItem key={child.href} {...child} iconColor={iconColor} collapsed={collapsed} />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div>
        <button onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-[14px] transition-all duration-150 ${
            isChildActive
              ? 'text-white font-semibold'
              : 'opacity-70 font-medium hover:bg-white/10 hover:opacity-100'
          }`}
          style={{ width: 'calc(100% - 16px)' }}>
          <Icon size={17} className={iconColor} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown size={13}
            className={`text-white/30 transition-transform duration-250 ease-in-out ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className={`grid transition-all duration-200 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="mt-0.5 pb-1">
              {item.children.map(child => (
                <SidebarChildItem key={child.href} {...child} iconColor={iconColor} collapsed={collapsed} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <Link href={item.href!} title={item.label}
        className={`flex justify-center items-center py-2 mx-1 rounded-lg transition-all ${
          isDirectActive
            ? 'bg-white/[0.12] text-white'
            : 'opacity-70 hover:bg-white/10 hover:opacity-100'
        }`}
        style={{ display: 'flex', marginLeft: '4px', marginRight: '4px' }}>
        <Icon size={18} className={isDirectActive ? 'text-white' : iconColor} />
      </Link>
    );
  }

  return (
    <Link href={item.href!}
      className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-[14px] transition-all ${
        isDirectActive
          ? 'bg-white/[0.12] text-white font-semibold'
          : 'opacity-70 font-medium hover:bg-white/10 hover:opacity-100'
      }`}
      style={{ display: 'flex', marginLeft: '8px', marginRight: '8px' }}>
      <Icon size={17} className={isDirectActive ? 'text-white' : iconColor} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const { user, logout, init } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [schemaChildren, setSchemaChildren] = useState<{ label: string; href: string; icon: LucideIcon }[]>([]);
  const [chatbotItems, setChatbotItems] = useState<NavItem[]>([]);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const load = () => {
      ocrApi.getSchemas().then(list => {
        setSchemaChildren(list.filter(s => s.isActive).map(s => ({
          label: s.name, href: `/xu-ly/nhan-dang/${s.code}`, icon: ScanLine,
        })));
      }).catch(() => {});
    };
    load();
    window.addEventListener('schemas:updated', load);
    return () => window.removeEventListener('schemas:updated', load);
  }, []);

  useEffect(() => {
    if (!user) { setChatbotItems([]); return; }
    const load = () => {
      chatbotApi.list().then(list => {
        setChatbotItems(list.map(b => ({ label: b.name, href: `/chatbot/${b.id}`, icon: MessageSquare })));
      }).catch(() => setChatbotItems([]));
    };
    load();
    window.addEventListener('chatbots:updated', load);
    return () => window.removeEventListener('chatbots:updated', load);
  }, [user]);

  const dynamicNavConfig = useMemo<NavSection[]>(() => navConfig.map(section => {
    if (section.section === 'CHATBOT AI THÔNG MINH') return { ...section, items: chatbotItems };
    return {
      ...section,
      items: section.items.map(item =>
        item.label === 'Nhận dạng OCR' ? { ...item, children: schemaChildren } : item,
      ),
    };
  }), [schemaChildren, chatbotItems]);

  return (
    <aside className={`app-sidebar relative flex flex-col h-screen border-r border-white/[0.08]
      select-none text-white transition-all duration-300 ease-in-out
      ${collapsed ? 'w-[68px]' : 'w-[288px]'}`}>

      {/* Toggle button on right edge */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        className="absolute -right-3 top-[22px] z-20 w-6 h-6 rounded-full
          bg-surface border border-default shadow-sm
          flex items-center justify-center
          text-content-secondary hover:text-primary-600 hover:shadow-md
          transition-all duration-200"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* Logo */}
      <div className={`flex items-center border-b border-white/[0.07] transition-all duration-300
        ${collapsed ? 'justify-center px-3 py-[18px]' : 'gap-3 px-5 py-[18px]'}`}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)', boxShadow: '0 4px 14px rgba(79,70,229,0.45)' }}
        >
          F
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-[15px] tracking-wide leading-tight truncate">FOXAI – NATIVE</p>
            <p className="text-white/35 text-[10px] tracking-[0.12em] uppercase font-medium mt-0.5">Your trust partner</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {dynamicNavConfig.map((section) => (
          <div key={section.section} className="mb-1">
            {!collapsed && (
              <p className={`px-5 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.14em] uppercase
                ${SECTION_ICON_COLOR[section.section] ?? 'text-white/25'}`}>
                {section.section}
              </p>
            )}
            {collapsed && <div className="mt-2 mb-1 mx-3 border-t border-white/[0.08]" />}
            <div className="space-y-px">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  iconColor={SECTION_ICON_COLOR[section.section] ?? 'text-white/50'}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={`border-t border-white/[0.07] px-3 py-3 flex items-center transition-all duration-300
        ${collapsed ? 'justify-center flex-col gap-2' : 'gap-2.5'}`}
        style={{ background: 'rgba(0,0,0,0.22)' }}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)' }}
        >
          {user?.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-white/90 text-[13px] font-semibold truncate leading-tight">{user?.fullName ?? 'Người dùng'}</p>
            <p className="text-white/35 text-[10px] truncate font-medium mt-0.5">{user?.roles?.[0] ?? 'Chưa xác định'}</p>
          </div>
        )}
        <div className={`flex ${collapsed ? 'flex-col' : ''} gap-1 shrink-0`}>
          <button onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
            className="text-white/35 hover:text-white/80 transition-colors p-1.5 rounded-lg hover:bg-white/[0.08]">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={async () => { await logout(); router.replace('/dang-nhap'); }}
            title="Đăng xuất"
            className="text-white/35 hover:text-danger-400 transition-colors p-1.5 rounded-lg hover:bg-white/[0.08]">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
