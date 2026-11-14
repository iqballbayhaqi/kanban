/** Pilihan warna untuk list (status). Sama dengan palet label card supaya serasi. */
export const LIST_COLORS = [
  { color: '#61bd4f', name: 'Hijau' },
  { color: '#f2d600', name: 'Kuning' },
  { color: '#ff9f1a', name: 'Oranye' },
  { color: '#eb5a46', name: 'Merah' },
  { color: '#c377e0', name: 'Ungu' },
  { color: '#0079bf', name: 'Biru' },
  { color: '#00c2e0', name: 'Biru muda' },
  { color: '#51e898', name: 'Lime' },
  { color: '#ff78cb', name: 'Pink' },
  { color: '#838c91', name: 'Abu-abu' },
];

/**
 * Pilih teks terang atau gelap untuk di atas background `hex`, mana yang
 * kontrasnya lebih tinggi (rumus luminans WCAG).
 */
export function textToneFor(hex: string): 'light' | 'dark' {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const vsWhite = 1.05 / (L + 0.05);
  const vsBlack = (L + 0.05) / 0.05;
  return vsWhite > vsBlack ? 'light' : 'dark';
}

/** Campur `hex` ke arah `target` (#ffffff / #000000) sebanyak `amount` (0..1). */
function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (target - v) * amount).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * Style + class untuk kotak list berwarna (gradient). Kosong kalau tanpa warna.
 * Arah gradient dipilih supaya kontras teks tidak pernah lebih buruk dari warna
 * dasarnya: teks gelap → dari lebih terang ke warna dasar; teks terang → dari
 * warna dasar ke lebih gelap.
 */
export function listColorProps(color?: string | null): { className: string; style: { background?: string } } {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return { className: '', style: {} };
  const tone = textToneFor(color);
  const [from, to] = tone === 'dark'
    ? [mix(color, 255, 0.45), color]
    : [color, mix(color, 0, 0.35)];
  return {
    className: ` has-color list-text-${tone}`,
    style: { background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` },
  };
}
