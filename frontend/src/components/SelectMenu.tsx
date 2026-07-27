import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  /** Titik warna kecil di kiri label, dipakai filter board. */
  swatch?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Ditampilkan kalau value tidak ada di daftar opsi. */
  placeholder?: string;
  ariaLabel?: string;
  /** 'inline' = versi ringkas seukuran pill, untuk dipakai di dalam sel tabel. */
  variant?: 'default' | 'inline';
  disabled?: boolean;
}

/** Posisi panel dalam koordinat viewport (panel dirender fixed di <body>). */
interface PanelPos {
  left: number;
  minWidth: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

const GAP = 6;
const MIN_PANEL_SPACE = 180;

/**
 * Dropdown pengganti <select>. Daftar opsi <select> bawaan dirender oleh OS
 * sehingga tidak bisa diikutkan tema gelap aplikasi — komponen ini merender
 * daftarnya sendiri supaya tampilannya konsisten di semua platform.
 *
 * Panelnya dirender lewat portal ke <body> dengan position: fixed. Kalau
 * dirender di tempat (absolute), panel ikut terpotong begitu komponennya
 * dipakai di dalam container ber-overflow — misalnya tabel Master Kanban.
 */
export default function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Pilih…',
  ariaLabel,
  variant = 'default',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Tutup saat klik di luar. Panel ada di portal, jadi harus dicek terpisah —
  // kalau tidak, klik pada opsi terhitung "di luar" dan menu keburu tertutup
  // sebelum handler klik opsinya sempat jalan.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Posisi panel dihitung sekali saat dibuka, jadi tutup begitu halaman
  // di-scroll atau di-resize daripada membiarkan panel melayang salah tempat.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return; // scroll di dalam panel
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Jaga opsi aktif tetap terlihat saat dinavigasi lewat keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    // Buka ke atas hanya kalau ruang di bawah sempit dan atasnya lebih lega.
    const above = spaceBelow < MIN_PANEL_SPACE && spaceAbove > spaceBelow;

    setPos({
      left: rect.left,
      minWidth: Math.max(rect.width, 160),
      maxHeight: Math.min(280, Math.max(120, above ? spaceAbove : spaceBelow)),
      ...(above ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    });
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  /**
   * Sengaja pakai mousedown, bukan click: saat satu menu terbuka lalu user
   * menekan trigger menu lain, handler "klik di luar" milik menu lama juga
   * jalan di mousedown. Kalau menu baru menunggu event click, hasilnya menu
   * lama tertutup tapi menu baru tidak terbuka — user harus klik dua kali.
   */
  const onTriggerMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || disabled) return;
    if (open) setOpen(false);
    else openMenu();
  };

  const pick = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(activeIndex);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div
      className={`selectmenu selectmenu-${variant}${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="selectmenu-trigger"
        ref={triggerRef}
        onMouseDown={onTriggerMouseDown}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
      >
        {selected?.swatch && <span className="selectmenu-swatch" style={{ background: selected.swatch }} />}
        <span className="selectmenu-value">{selected ? selected.label : placeholder}</span>
        <svg className="selectmenu-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          className="selectmenu-panel"
          role="listbox"
          ref={listRef}
          aria-label={ariaLabel}
          style={{
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            minWidth: pos.minWidth,
            maxHeight: pos.maxHeight,
          }}
        >
          {options.map((option, i) => (
            <div
              key={option.value}
              id={optionId(i)}
              role="option"
              aria-selected={option.value === value}
              data-active={i === activeIndex}
              className={
                'selectmenu-option' +
                (option.value === value ? ' is-selected' : '') +
                (i === activeIndex ? ' is-active' : '')
              }
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => pick(i)}
            >
              {option.swatch !== undefined && (
                <span className="selectmenu-swatch" style={{ background: option.swatch || 'transparent' }} />
              )}
              <span className="selectmenu-option-label">{option.label}</span>
              {option.value === value && (
                <svg className="selectmenu-check" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
