import { useState, useEffect, useRef, useCallback } from 'react';
import { KineticTypographyLoader } from '../ui/loading-animation';

const MAX_DURATION  = 3400;
const FADE_DURATION = 700;
const SESSION_KEY   = 'filmora_intro_shown';

export default function LoadingScreen() {
  const [phase, setPhase] = useState<'init' | 'visible' | 'exiting' | 'done'>('init');
  const [count, setCount] = useState(0);
  const reduceMotion      = useRef(false);

  const finish = useCallback(() => {
    setPhase(p => p === 'done' ? p : 'exiting');
    document.body.style.overflow = '';
    window.setTimeout(() => setPhase('done'), FADE_DURATION);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
  }, []);

  useEffect(() => {
    reduceMotion.current =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem(SESSION_KEY) === '1'; } catch {}

    if (alreadyShown) {
      setPhase('done');
      document.body.style.overflow = '';
      return;
    }

    setPhase('visible');
    document.body.style.overflow = 'hidden';

    const elapsed   = typeof performance !== 'undefined' ? performance.now() : 0;
    const remaining = Math.max(0, MAX_DURATION - FADE_DURATION - elapsed);
    const cap = window.setTimeout(finish, remaining);
    return () => window.clearTimeout(cap);
  }, [finish]);

  // Counter 0 → 100
  useEffect(() => {
    if (phase !== 'visible') return;
    const duration = MAX_DURATION - FADE_DURATION;
    const start    = performance.now();
    let raf = 0;
    const tick = () => {
      const t     = Math.min((performance.now() - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setCount(Math.round(eased * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (phase === 'done') return null;

  const exiting = phase === 'exiting';
  const rm      = reduceMotion.current;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a0a',
        // Neoleaf-style: whole screen slides up on exit
        transform: exiting && !rm ? 'translateY(-100%)' : 'translateY(0)',
        transition: exiting ? `transform ${FADE_DURATION}ms cubic-bezier(0.76,0,0.24,1)` : 'none',
        willChange: 'transform',
        pointerEvents: exiting ? 'none' : 'all',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        overflow: 'hidden',
      }}
      aria-label="Loading Filmora"
      role="status"
    >
      {/* Centre — kinetic typography loader */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <KineticTypographyLoader />
      </div>

      {/* Bottom-left: loading... X% (neoleaf signature) */}
      <div style={{
        position: 'absolute',
        bottom: '2.5rem', left: '2.5rem',
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        fontSize: 'clamp(1rem, 2vw, 1.5rem)',
        fontWeight: 400,
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: '-0.01em',
      }}>
        <span>loading...</span>
        <span style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          minWidth: '2.5em',
        }}>{count}%</span>
      </div>

      {/* Bottom-right corner label */}
      <div style={{
        position: 'absolute',
        bottom: '2.5rem', right: '2.5rem',
        fontFamily: 'monospace',
        fontSize: '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.25)',
      }}>
        Filmora Movie
      </div>

      {/* Thin progress line along the very bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0,
        height: '2px',
        width: `${count}%`,
        background: '#fff',
        transition: 'width 0.08s linear',
      }} />
    </div>
  );
}
