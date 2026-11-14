import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, type Location } from 'react-router-dom';

/**
 * Transisi pindah halaman dua tahap:
 *   1. "out" — halaman lama memudar keluar (EXIT_MS)
 *   2. "in"  — halaman baru dipasang dan memudar masuk (lihat CSS .page-in)
 *
 * Caranya: <Routes> dirender dengan `displayLocation` (bukan URL saat ini).
 * Begitu URL berubah, halaman lama tetap tampil selama tahap "out", baru
 * setelah itu displayLocation diganti ke URL baru.
 *
 * Yang dianimasikan hanya wrapper <PageTransition> di tiap halaman, jadi
 * sidebar di AppLayout tetap diam.
 */

const EXIT_MS = 140;

type Stage = 'in' | 'out';
const StageContext = createContext<{ stage: Stage; key: string }>({ stage: 'in', key: '' });

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Dipakai sekali di atas <Routes>; mengembalikan location yang harus dirender. */
export function usePageTransitionLocation(): { displayLocation: Location; stage: Stage } {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState<Stage>('in');
  const timer = useRef<number>();

  useEffect(() => {
    // Hanya query/hash yang berubah, atau navigasi ke halaman yang sama: langsung ganti tanpa animasi.
    // Juga menangani "pindah lalu cepat kembali" sebelum EXIT_MS: timer lama sudah
    // dibatalkan oleh cleanup, jadi stage harus dikembalikan ke "in" di sini,
    // kalau tidak halaman tertahan di opacity 0.
    if (location.pathname === displayLocation.pathname) {
      if (location !== displayLocation) setDisplayLocation(location);
      setStage('in');
      return;
    }
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setDisplayLocation(location);
      setStage('in');
      return;
    }
    setStage('out');
    timer.current = window.setTimeout(() => {
      setDisplayLocation(location);
      setStage('in');
      window.scrollTo(0, 0);
    }, EXIT_MS);
    return () => window.clearTimeout(timer.current);
    // displayLocation sengaja tidak jadi dependency: efek ini hanya bereaksi ke URL baru.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return { displayLocation, stage };
}

export function PageTransitionProvider({ stage, pathname, children }: { stage: Stage; pathname: string; children: React.ReactNode }) {
  return <StageContext.Provider value={{ stage, key: pathname }}>{children}</StageContext.Provider>;
}

/**
 * Wrapper animasi untuk satu halaman.
 *
 * Kelas animasi memakai fill-mode yang tidak menyisakan `transform` setelah
 * selesai. Transform yang tertinggal menjadikan wrapper ini containing block
 * untuk elemen `position: fixed` (modal, dialog, dropdown) dan posisinya jadi salah.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { stage, key } = useContext(StageContext);
  return (
    <div key={key} className={`page-transition page-${stage}`}>
      {children}
    </div>
  );
}
