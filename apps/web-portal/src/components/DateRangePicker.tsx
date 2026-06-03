'use client';
import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  from: string; // "YYYY-MM-DD" or ""
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmtDisplay(s: string) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateRangePicker({ from, to, onChange, className = '' }: Props) {
  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoverISO, setHoverISO] = useState('');
  const [phase, setPhase] = useState<'from' | 'to'>('from');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openCalendar() {
    if (isOpen) { setIsOpen(false); return; }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const PANEL_W = 292;
      const spaceRight = window.innerWidth - r.left;
      const left = spaceRight >= PANEL_W ? r.left : Math.max(8, r.right - PANEL_W);
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= 360 ? r.bottom + 6 : r.top - 360 - 6;
      setPanelStyle({ position: 'fixed', top, left, zIndex: 9999 });
    }
    if (from) {
      const [y, m] = from.split('-').map(Number);
      setViewYear(y); setViewMonth(m - 1);
    }
    setPhase(from && !to ? 'to' : 'from');
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  function handleDayClick(day: number) {
    const iso = toISO(viewYear, viewMonth, day);
    if (phase === 'from') {
      onChange(iso, '');
      setPhase('to');
    } else {
      if (iso < from) { onChange(iso, ''); setPhase('to'); }
      else { onChange(from, iso); setPhase('from'); setIsOpen(false); }
    }
  }

  // effective range including hover preview
  function getRange(): [string, string] {
    if (phase === 'to' && from && hoverISO) {
      return hoverISO >= from ? [from, hoverISO] : [hoverISO, from];
    }
    return [from, to];
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const grid = buildGrid(viewYear, viewMonth);
  const [effFrom, effTo] = getRange();
  const hasRange = effFrom !== effTo;

  function getDayCls(day: number) {
    const iso = toISO(viewYear, viewMonth, day);
    const isFrom = iso === effFrom && effFrom !== '';
    const isTo = iso === effTo && effTo !== '';
    const inRange = hasRange && effFrom && effTo && iso > effFrom && iso < effTo;
    const isToday = iso === todayISO;

    const btnCls = [
      'relative z-10 flex items-center justify-center w-8 h-8 text-sm cursor-pointer select-none transition-colors',
      isFrom || isTo
        ? 'bg-primary-600 text-white rounded-full font-semibold shadow-sm'
        : isToday
          ? 'text-primary-600 font-semibold hover:bg-primary-50 rounded-full'
          : 'text-dark-700 hover:bg-dark-100 rounded-full',
    ].join(' ');

    // background strip for range
    let bgCls = '';
    if (hasRange && effFrom && effTo) {
      if (isFrom) bgCls = 'bg-primary-100 rounded-l-full';
      else if (isTo) bgCls = 'bg-primary-100 rounded-r-full';
      else if (inRange) bgCls = 'bg-primary-100';
    }

    return { btnCls, bgCls };
  }

  const hasValue = from || to;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openCalendar}
        className={[
          'flex items-center gap-1.5 border rounded-lg bg-surface text-sm transition-all px-3 py-2',
          isOpen
            ? 'border-primary-400 ring-2 ring-primary-500/30'
            : 'border-default hover:border-primary-300 hover:bg-subtle',
        ].join(' ')}
      >
        <CalendarDays size={14} className="shrink-0 text-content-muted" />
        <span className={from ? 'text-content-primary' : 'text-content-muted'}>
          {from ? fmtDisplay(from) : 'Từ ngày'}
        </span>
        <span className="text-content-muted text-xs mx-0.5">—</span>
        <span className={to ? 'text-content-primary' : 'text-content-muted'}>
          {to ? fmtDisplay(to) : 'Đến ngày'}
        </span>
        {hasValue && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange('', ''); setPhase('from'); }}
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-content-muted hover:text-danger-500 hover:bg-danger-50 transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </button>

      {isOpen && (
        <div ref={panelRef} style={panelStyle} className="bg-white border border-dark-200 rounded-2xl shadow-xl w-[292px] overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-100">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-dark-100 text-dark-500 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-dark-800">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-dark-100 text-dark-500 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="flex items-center justify-center h-7 text-[11px] font-semibold text-dark-400 uppercase tracking-wide">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div
            className="grid grid-cols-7 px-3 pb-2"
            onMouseLeave={() => setHoverISO('')}
          >
            {grid.map((day, i) => {
              if (!day) return <div key={i} className="h-8" />;
              const { btnCls, bgCls } = getDayCls(day);
              return (
                <div key={i} className={`relative flex items-center justify-center h-8 ${bgCls}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoverISO(toISO(viewYear, viewMonth, day))}
                    onClick={() => handleDayClick(day)}
                    className={btnCls}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-dark-50 border-t border-dark-100">
            <button
              type="button"
              onClick={() => { onChange('', ''); setPhase('from'); }}
              className="text-xs text-danger-500 hover:text-danger-700 font-medium transition-colors"
            >
              Xóa
            </button>
            <span className="text-[11px] text-content-muted italic">
              {phase === 'from' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (phase === 'from') {
                  onChange(todayISO, to || '');
                  setPhase('to');
                } else {
                  onChange(from || todayISO, todayISO);
                  setIsOpen(false);
                }
              }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
