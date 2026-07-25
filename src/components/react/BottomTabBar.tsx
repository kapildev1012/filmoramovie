"use client";

/**
 * BottomTabBar — JioHotstar-style fixed bottom navigation.
 * Only visible on mobile (≤767px) — hidden via CSS at 768px+.
 * Renders 5 tabs: Home · Movies · Search · Watchlist · Profile
 * Active tab derived from current pathname.
 */

import { useEffect, useState } from "react";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  iconActive: React.ReactNode;
  match: (path: string) => boolean;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconHome = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const IconMovies = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {filled ? (
      <path d="M2 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h20a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2zm4 3l2 3H6V6zm4 0l2 3h-2l-2-3h2zm4 0l2 3h-2l-2-3h2zm4 0v3h-2l-2-3h4z" />
    ) : (
      <>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5" />
      </>
    )}
  </svg>
);

const IconSearch = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" fill={filled ? "currentColor" : "none"} />
    <path d="m21 21-4.35-4.35" strokeWidth={2.2} />
  </svg>
);

const IconWatchlist = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const IconProfile = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { href: "/",         label: "Home",    icon: <IconHome />,      iconActive: <IconHome filled />,      match: (p) => p === "/" },
  { href: "/movies",   label: "Movies",  icon: <IconMovies />,    iconActive: <IconMovies filled />,    match: (p) => p.startsWith("/movies") || p.startsWith("/series") || p.startsWith("/anime") },
  { href: "/search",   label: "Search",  icon: <IconSearch />,    iconActive: <IconSearch filled />,    match: (p) => p.startsWith("/search") },
  { href: "/watchlist",label: "My List", icon: <IconWatchlist />, iconActive: <IconWatchlist filled />, match: (p) => p.startsWith("/watchlist") },
  { href: "/profile",  label: "Profile", icon: <IconProfile />,   iconActive: <IconProfile filled />,   match: (p) => p.startsWith("/profile") || p.startsWith("/login") },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BottomTabBar() {
  const [pathname, setPathname] = useState("/");
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    setPathname(window.location.pathname);
    const handler = () => setPathname(window.location.pathname);
    document.addEventListener("astro:page-load", handler);
    return () => document.removeEventListener("astro:page-load", handler);
  }, []);

  useEffect(() => {
    function readWL() {
      try {
        const wl = JSON.parse(localStorage.getItem("filmora_watchlist") || "[]");
        setWatchlistCount(Array.isArray(wl) ? wl.length : 0);
      } catch { setWatchlistCount(0); }
    }
    readWL();
    window.addEventListener("storage", readWL);
    return () => window.removeEventListener("storage", readWL);
  }, []);

  return (
    <>
      <nav className="btb-root" aria-label="Bottom tab navigation" role="navigation">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`btb-tab${active ? " btb-tab--active" : ""}`}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              {/* Active pill background */}
              {active && <span className="btb-pill-bg" aria-hidden="true" />}

              <span className="btb-icon">
                {tab.href === "/watchlist" && watchlistCount > 0 && (
                  <span className="btb-badge" aria-label={`${watchlistCount} items`}>
                    {watchlistCount > 99 ? "99+" : watchlistCount}
                  </span>
                )}
                {active ? tab.iconActive : tab.icon}
              </span>
              <span className="btb-label">{tab.label}</span>
            </a>
          );
        })}
      </nav>

      <style>{`
        /* ── Root bar — only shown on mobile ── */
        .btb-root {
          display: none; /* hidden by default; mobile.css enables it at ≤767px */
        }

        @media (max-width: 767px) {
          .btb-root {
            display: flex;
            position: fixed;
            bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
            left: 50%;
            transform: translateX(-50%);
            width: calc(100% - 2rem);
            max-width: 440px;
            height: 60px;
            padding: 0 0.5rem;
            background: rgba(5, 8, 17, 0.82);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 9999px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04);
            z-index: 110;
            align-items: center;
            justify-content: space-around;
          }

          html[data-theme="light"] .btb-root {
            background: rgba(255, 255, 255, 0.92);
            border-color: rgba(0, 0, 0, 0.09);
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
          }

          /* ── Each tab ── */
          .btb-tab {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            flex: 1;
            min-width: 44px;
            min-height: 44px;
            padding: 0 4px;
            text-decoration: none;
            color: rgba(255, 255, 255, 0.4);
            transition: color 0.2s ease, transform 0.18s cubic-bezier(0.16,1,0.3,1);
            -webkit-tap-highlight-color: transparent;
          }
          .btb-tab:active { transform: scale(0.88); }

          html[data-theme="light"] .btb-tab { color: rgba(0, 0, 0, 0.38); }

          /* Active state */
          .btb-tab--active { color: #fff; }
          html[data-theme="light"] .btb-tab--active { color: #18181b; }

          /* Active pill highlight behind icon */
          .btb-pill-bg {
            position: absolute;
            top: 6px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(99,102,241,0.22), rgba(168,85,247,0.18));
            border: 1px solid rgba(99,102,241,0.3);
            pointer-events: none;
            animation: btb-pop 0.28s cubic-bezier(0.16,1,0.3,1) both;
          }
          html[data-theme="light"] .btb-pill-bg {
            background: linear-gradient(135deg, rgba(99,102,241,0.14), rgba(168,85,247,0.12));
            border-color: rgba(99,102,241,0.25);
          }
          @keyframes btb-pop {
            from { transform: translateX(-50%) scale(0.6); opacity: 0; }
            to   { transform: translateX(-50%) scale(1);   opacity: 1; }
          }

          /* Icon container */
          .btb-icon {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            z-index: 1;
          }

          /* Watchlist badge */
          .btb-badge {
            position: absolute;
            top: -6px;
            right: -9px;
            min-width: 16px;
            height: 16px;
            padding: 0 3px;
            border-radius: 9999px;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            color: #fff;
            font-size: 0.5625rem;
            font-weight: 700;
            line-height: 16px;
            text-align: center;
            z-index: 2;
          }

          /* Label */
          .btb-label {
            font-size: 0.625rem;
            font-weight: 600;
            letter-spacing: 0.01em;
            line-height: 1;
            white-space: nowrap;
            z-index: 1;
          }
        }

        /* Very small screens */
        @media (max-width: 380px) {
          .btb-label { font-size: 0.5625rem; }
          .btb-icon  { width: 22px; height: 22px; }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .btb-tab { transition: color 0s; }
          .btb-pill-bg { animation: none; }
        }
      `}</style>
    </>
  );
}
