'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function SelectDropdown({
  value, onChange, options, placeholder,
  size = 'md', disabled, className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  const sm = size === 'sm';

  function handleToggle() {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPanelStyle({
        position: 'fixed',
        top: r.bottom + 4,
        left: r.left,
        minWidth: Math.max(r.width, 160),
        zIndex: 9999,
      });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={[
          'flex items-center gap-2 border rounded-lg bg-surface transition-all w-full',
          sm ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          open
            ? 'border-primary-400 ring-2 ring-primary-500/30 text-content-primary'
            : 'border-default text-content-secondary hover:border-primary-300 hover:bg-subtle',
        ].join(' ')}
      >
        <span className="flex-1 text-left truncate">
          {selected
            ? selected.label
            : <span className="text-content-muted">{placeholder ?? '—'}</span>}
        </span>
        <ChevronDown
          size={sm ? 12 : 14}
          className={`shrink-0 transition-transform text-content-muted ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div ref={panelRef} style={panelStyle} className="bg-white border border-dark-200 rounded-xl shadow-lg overflow-hidden">
          <div className="py-1 max-h-60 overflow-y-auto">
            {placeholder !== undefined && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  !value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-content-muted hover:bg-dark-50',
                  sm ? 'text-xs' : 'text-sm',
                ].join(' ')}
              >
                <span className="flex-1">{placeholder}</span>
                {!value && <Check size={12} className="text-primary-600 shrink-0" />}
              </button>
            )}
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  value === opt.value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-dark-700 hover:bg-dark-50',
                  sm ? 'text-xs' : 'text-sm',
                ].join(' ')}
              >
                <span className="flex-1">{opt.label}</span>
                {value === opt.value && <Check size={12} className="text-primary-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
