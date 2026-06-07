import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;       // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
  placeholder?: string;
}

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseLocal(iso: string) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}

export default function DatePicker({ value, onChange, placeholder = 'Set due date' }: Props) {
  const today = new Date(); today.setHours(0,0,0,0);

  const selected = value ? parseLocal(value) : null;

  const [open, setOpen] = useState(false);
  const [popupClosing, setPopupClosing] = useState(false);
  const [viewYear, setViewYear] = useState(() => selected ? selected.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selected ? selected.getMonth() : today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  const closePicker = () => {
    setPopupClosing(true);
    setTimeout(() => { setOpen(false); setPopupClosing(false); }, 100);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPopupClosing(true);
        setTimeout(() => { setOpen(false); setPopupClosing(false); }, 100);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = parseLocal(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build 6×7 grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: Date; cur: boolean }[] = [];
  for (let i = firstDow - 1; i >= 0; i--)
    cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrev - i), cur: false });
  for (let i = 1; i <= daysInMonth; i++)
    cells.push({ date: new Date(viewYear, viewMonth, i), cur: true });
  let next = 1;
  while (cells.length < 42)
    cells.push({ date: new Date(viewYear, viewMonth + 1, next++), cur: false });

  const pick = (d: Date) => { onChange(toISO(d)); closePicker(); };
  const clear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(''); closePicker(); };

  const displayLabel = selected
    ? selected.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const triggerStatus = selected
    ? (selected < today ? 'overdue' : selected.getTime() === today.getTime() ? 'today' : 'normal')
    : 'normal';

  return (
    <div className="dp" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        className={`dp-trigger dp-trigger-${triggerStatus} ${open ? 'dp-open' : ''}`}
        onClick={() => open ? closePicker() : setOpen(true)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.5 0a.5.5 0 01.5.5V1h8V.5a.5.5 0 011 0V1h.5A1.5 1.5 0 0115 2.5v11A1.5 1.5 0 0113.5 15h-11A1.5 1.5 0 011 13.5v-11A1.5 1.5 0 012.5 1H3V.5a.5.5 0 01.5-.5zM2 4v9.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V4H2z"/>
        </svg>
        <span className="dp-label">{displayLabel || placeholder}</span>
        {value && (
          <span className="dp-clear-x" onClick={clear} title="Clear">✕</span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div className={`dp-popup${popupClosing ? ' dp-closing' : ''}`}>
          {/* Month nav */}
          <div className="dp-nav">
            <button className="dp-nav-btn" onClick={prevMonth} title="Previous month">‹</button>
            <div className="dp-month-label">
              <span>{MONTHS[viewMonth]}</span>
              <span className="dp-year">{viewYear}</span>
            </div>
            <button className="dp-nav-btn" onClick={nextMonth} title="Next month">›</button>
          </div>

          {/* Day headers */}
          <div className="dp-dow">
            {DAY_LABELS.map(d => <span key={d}>{d}</span>)}
          </div>

          {/* Day grid */}
          <div className="dp-grid">
            {cells.map(({ date, cur }, i) => {
              const isToday = date.getTime() === today.getTime();
              const isSel   = selected && date.getTime() === selected.getTime();
              const isPast  = date < today && !isSel;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(date)}
                  className={[
                    'dp-day',
                    !cur   ? 'dp-other'   : '',
                    isToday && !isSel ? 'dp-today'   : '',
                    isSel  ? 'dp-sel'     : '',
                    isPast ? 'dp-past'    : '',
                  ].filter(Boolean).join(' ')}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="dp-footer">
            <button
              type="button"
              className="dp-footer-btn"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                pick(today);
              }}
            >
              Today
            </button>
            {value && (
              <button type="button" className="dp-footer-btn dp-footer-danger" onClick={clear}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
