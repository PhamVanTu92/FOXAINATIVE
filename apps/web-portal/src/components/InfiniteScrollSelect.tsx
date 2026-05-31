'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Loader2 } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Label của giá trị đang chọn — dùng khi giá trị chưa có trong danh sách đã load */
  selectedLabel?: string;
  /** Hàm load options — trả về { items, hasMore }. Nên wrap bằng useCallback ở parent. */
  loadOptions: (search: string, page: number) => Promise<{ items: SelectOption[]; hasMore: boolean }>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const PAGE_SIZE = 10;

export function InfiniteScrollSelect({
  value,
  onChange,
  selectedLabel,
  loadOptions,
  placeholder = 'Chọn...',
  className = '',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadOptionsRef = useRef(loadOptions);
  loadOptionsRef.current = loadOptions;

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      minWidth: 220,
      zIndex: 9999,
    });
  }, []);

  // Debounce search input 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load page 1 khi mở hoặc khi search thay đổi
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setOptions([]);
    setPage(1);
    setHasMore(false);
    loadOptionsRef.current(debouncedSearch, 1).then(({ items, hasMore: more }) => {
      if (cancelled) return;
      setOptions(items);
      setHasMore(more);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, debouncedSearch]);

  // Cập nhật vị trí dropdown khi mở, khi scroll / resize
  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [open, updateDropdownPosition]);

  // Load thêm khi cuộn gần đáy
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      const nextPage = page + 1;
      setLoadingMore(true);
      loadOptionsRef.current(debouncedSearch, nextPage).then(({ items, hasMore: more }) => {
        setOptions(prev => {
          const existingIds = new Set(prev.map(o => o.value));
          return [...prev, ...items.filter(i => !existingIds.has(i.value))];
        });
        setPage(nextPage);
        setHasMore(more);
      }).finally(() => setLoadingMore(false));
    }
  }, [loadingMore, hasMore, page, debouncedSearch]);

  // Đóng khi click ngoài (cả trigger lẫn dropdown portal)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !containerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus ô search khi mở
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const displayLabel = options.find(o => o.value === value)?.label ?? selectedLabel ?? value;

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  };

  const dropdownContent = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white border border-dark-200 rounded-lg shadow-lg overflow-hidden"
    >
      {/* Search */}
      <div className="p-2 border-b border-dark-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-dark-200 rounded-md
              focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* List */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ maxHeight: `${PAGE_SIZE * 38}px` }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-7 gap-2 text-dark-400 text-sm">
            <Loader2 size={14} className="animate-spin" /> Đang tải...
          </div>
        ) : options.length === 0 ? (
          <div className="py-7 text-center text-sm text-dark-400">Không tìm thấy kết quả</div>
        ) : (
          <>
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left
                  hover:bg-primary-50 transition-colors
                  ${opt.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-dark-700'}`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check size={13} className="text-primary-600 shrink-0" />}
              </button>
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-3 gap-1.5 text-dark-400 text-xs border-t border-dark-100">
                <Loader2 size={12} className="animate-spin" /> Đang tải thêm...
              </div>
            )}
            {!hasMore && options.length >= PAGE_SIZE && (
              <p className="py-2 text-center text-xs text-dark-300 border-t border-dark-100">
                Đã hiển thị tất cả {options.length} kết quả
              </p>
            )}
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-lg bg-white transition-colors focus:outline-none
          ${open ? 'border-primary-500 ring-2 ring-primary-500' : 'border-dark-200 hover:border-dark-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`truncate ${value ? 'text-dark-800' : 'text-dark-400'}`}>
          {value ? displayLabel : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-dark-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Render dropdown qua portal để tránh bị khuất bởi overflow-hidden của parent */}
      {typeof document !== 'undefined' && dropdownContent
        ? createPortal(dropdownContent, document.body)
        : null}
    </div>
  );
}
