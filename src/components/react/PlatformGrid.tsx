'use client';

interface Platform {
  href: string;
  label: string;
  bg: string;
  glow: string;
  logo: React.ReactNode;
}

const PLATFORMS: Platform[] = [
  {
    href: '/netflix',
    label: 'Netflix',
    bg: 'linear-gradient(135deg,#b1060f 0%,#e50914 55%,#7a0409 100%)',
    glow: 'rgba(229,9,20,0.5)',
    logo: (
      <svg viewBox="0 0 150 34" width="118" height="28" aria-label="Netflix" xmlns="http://www.w3.org/2000/svg">
        <text x="75" y="26" textAnchor="middle" fontFamily="'Arial Narrow','Helvetica Neue',Arial,sans-serif" fontSize="27" fontWeight="900" fill="#fff" letterSpacing="1.5">NETFLIX</text>
      </svg>
    ),
  },
  {
    href: '/prime',
    label: 'Prime Video',
    bg: 'linear-gradient(135deg,#013b5c 0%,#00a8e0 70%,#0071a8 100%)',
    glow: 'rgba(0,168,224,0.45)',
    logo: (
      <svg viewBox="0 0 150 50" width="118" height="38" aria-label="Prime Video" xmlns="http://www.w3.org/2000/svg">
        <text x="75" y="22" textAnchor="middle" fontFamily="'Helvetica Neue',Arial,sans-serif" fontSize="21" fontWeight="800" fill="#fff" letterSpacing="-0.5">prime</text>
        <text x="75" y="38" textAnchor="middle" fontFamily="'Helvetica Neue',Arial,sans-serif" fontSize="10" fontWeight="500" fill="#fff" letterSpacing="4">VIDEO</text>
        <path d="M52 43 Q75 52 98 43" stroke="#1fb6ff" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
        <path d="M95 39.5 L99 43 L95 46.5" stroke="#1fb6ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    href: '/hotstar',
    label: 'JioHotstar',
    bg: 'linear-gradient(135deg,#0f1b3d 0%,#1a3070 60%,#0b1532 100%)',
    glow: 'rgba(255,210,76,0.35)',
    logo: (
      <svg viewBox="0 0 170 40" width="128" height="30" aria-label="JioHotstar" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 4 l3.4 7 7.6.9 -5.6 5.2 1.5 7.5L17 20.7l-6.9 3.9 1.5-7.5-5.6-5.2 7.6-.9z" fill="#ffd24c"/>
        <text x="38" y="28" fontFamily="'Helvetica Neue',Arial,sans-serif" fontSize="20" fontWeight="800" fill="#fff" letterSpacing="-0.5">JioHotstar</text>
      </svg>
    ),
  },
  {
    href: '/appletv',
    label: 'Apple TV+',
    bg: 'linear-gradient(135deg,#1c1c1e 0%,#000 55%,#111 100%)',
    glow: 'rgba(255,255,255,0.2)',
    logo: (
      <svg viewBox="0 0 130 40" width="110" height="30" aria-label="Apple TV+" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.05 27.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35-4.88-5.03-4.16-12.69 1.38-12.97 1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM17.03 14.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#fff"/>
        <text x="38" y="30" fontFamily="'Helvetica Neue',Arial,sans-serif" fontSize="22" fontWeight="600" fill="#fff" letterSpacing="0.5">tv</text>
        <text x="62" y="30" fontFamily="'Helvetica Neue',Arial,sans-serif" fontSize="23" fontWeight="800" fill="#fff">+</text>
      </svg>
    ),
  },
];

// Triple the list so the vertical loop is seamless (animate by exactly one set).
const LOOP = [...PLATFORMS, ...PLATFORMS, ...PLATFORMS];

/**
 * PlatformGrid — a glass panel whose tiles continuously auto-scroll in an
 * infinite 3D-perspective loop (echoing the InfiniteGallery's auto-scroll +
 * depth fade), while every tile stays a real, clickable link. Hover to pause.
 */
export default function PlatformGrid() {
  return (
    <div className="pg-panel">
      <div className="pg-viewport">
        <div className="pg-track">
          {LOOP.map((p, i) => (
            <a
              key={i}
              href={p.href}
              className="pg-tile"
              aria-label={p.label}
              style={{ background: p.bg, ['--glow' as any]: p.glow }}
            >
              <span className="pg-sheen" aria-hidden="true" />
              <span className="pg-badge">TOP 10</span>
              <span className="pg-logo">{p.logo}</span>
            </a>
          ))}
        </div>
      </div>

      <a href="/movies" className="pg-foot">
        Explore all titles
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
      </a>

      <style>{`
        .pg-panel {
          width: clamp(300px, 26vw, 380px);
          background: linear-gradient(160deg, rgba(18,18,24,0.72), rgba(8,8,12,0.68));
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 22px;
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          box-shadow: 0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        /* Hide the 3D panel on mobile — too narrow */
        @media (max-width: 767px) {
          .pg-panel { display: none !important; }
        }
        .pg-head { padding: 0 2px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .pg-title {
          display: block; font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.5);
        }
        .pg-sub { display: block; font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 3px; }

        /* ── Auto-scrolling 3D viewport ── */
        .pg-viewport {
          position: relative;
          height: 300px;
          overflow: hidden;
          perspective: 900px;
          /* depth fade at top & bottom — echoes the gallery's fade in/out */
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%);
        }
        .pg-track {
          display: flex;
          flex-direction: column;
          gap: 10px;
          transform: rotateX(6deg);
          transform-style: preserve-3d;
          animation: pg-scroll 14s linear infinite;
          will-change: transform;
        }
        .pg-viewport:hover .pg-track,
        .pg-viewport:focus-within .pg-track { animation-play-state: paused; }

        @keyframes pg-scroll {
          from { transform: rotateX(6deg) translateY(0); }
          to   { transform: rotateX(6deg) translateY(-33.333%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pg-track { animation: none; }
          .pg-viewport { -webkit-mask-image: none; mask-image: none; }
        }

        .pg-tile {
          position: relative;
          flex-shrink: 0;
          height: 88px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
          text-decoration: none;
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease;
        }
        .pg-tile:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 16px 40px var(--glow); }
        .pg-sheen {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 60%);
        }
        .pg-badge {
          position: absolute; top: 8px; right: 8px;
          font-size: 7.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
          color: #fff; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.22);
          padding: 2px 6px; border-radius: 9999px;
        }
        .pg-logo { position: relative; z-index: 1; display: flex; }

        .pg-foot {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.72);
          text-decoration: none;
          padding: 9px; border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.2s ease, color 0.2s ease;
        }
        .pg-foot:hover { background: rgba(255,255,255,0.1); color: #fff; }
      `}</style>
    </div>
  );
}
