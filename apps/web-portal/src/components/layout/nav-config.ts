import {
  LayoutDashboard, BarChart2, Bell,
  Settings, Shield, Users, Network,
  ScanText, FileText, Bot, MessageSquare,
  Brain, CheckCircle, Settings2,
  Upload, Link2, Wand2,
  ScanLine, FolderOpen,
  Calculator, Headphones,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavChild {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const navConfig: NavSection[] = [
  {
    section: 'TỔNG QUAN',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Báo cáo & Thống kê', href: '/bao-cao', icon: BarChart2 },
      { label: 'Thông báo', href: '/thong-bao', icon: Bell },
    ],
  },
  {
    section: 'CẤU HÌNH HỆ THỐNG',
    items: [
      {
        label: 'Cấu hình hệ thống',
        icon: Settings,
        children: [
          { label: 'Cấu hình vai trò', href: '/he-thong/vai-tro', icon: Shield },
          { label: 'Cấu hình người dùng', href: '/he-thong/nguoi-dung', icon: Users },
          { label: 'Cơ cấu tổ chức', href: '/he-thong/to-chuc', icon: Network },
        ],
      },
      {
        label: 'Cấu hình OCR',
        icon: ScanText,
        children: [
          { label: 'Thiết lập Chứng từ OCR', href: '/he-thong/ocr', icon: FileText },
        ],
      },
      {
        label: 'Cấu hình chatbot AI',
        icon: Bot,
        children: [
          { label: 'Thiết lập bot hội thoại', href: '/he-thong/chatbot', icon: MessageSquare },
        ],
      },
    ],
  },
  {
    section: 'TRI THỨC AI',
    items: [
      { label: 'Quản lý tri thức', href: '/tri-thuc', icon: Brain },
      { label: 'Kiểm duyệt & Phê duyệt', href: '/tri-thuc/kiem-duyet', icon: CheckCircle },
      {
        label: 'Cấu hình đầu vào tri thức',
        icon: Settings2,
        children: [
          { label: 'Upload tài liệu', href: '/tri-thuc/upload', icon: Upload },
          { label: 'Kết nối dữ liệu tự động', href: '/tri-thuc/ket-noi', icon: Link2 },
          { label: 'OCR & Chuẩn hóa nội dung', href: '/tri-thuc/ocr-chuan-hoa', icon: Wand2 },
        ],
      },
    ],
  },
  {
    section: 'XỬ LÝ TÀI LIỆU',
    items: [
      {
        label: 'Nhận dạng OCR',
        icon: ScanLine,
        children: [],
      },
      { label: 'Quản lý Chứng từ', href: '/xu-ly/chung-tu', icon: FolderOpen },
    ],
  },
  {
    section: 'CHATBOT AI THÔNG MINH',
    items: [
      { label: 'Bot Kế toán Nội bộ', href: '/chatbot/ke-toan', icon: Calculator },
      { label: 'Bot CSKH - Kinh doanh', href: '/chatbot/cskh', icon: Headphones },
    ],
  },
];
