"use client";

import React, { useEffect, useRef, useState } from "react";
import { FullScreenScrollFX } from "../ui/full-screen-scroll-fx";

interface NavLink {
  href: string;
  label: string;
  tag: string;
  active?: boolean;
}

interface Props {
  links: NavLink[];
  userName?: string | null;
}

// Cinematic background images per nav section (cycling through these)
const BG_IMAGES = [
  "https://images.pexels.com/photos/3289156/pexels-photo-3289156.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/163790/pexels-photo-163790.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/9817/pexels-photo-9817.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/939807/pexels-photo-939807.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1591373/pexels-photo-1591373.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg?auto=compress&cs=tinysrgb&w=1200",
];

export default function MobileNavFX({ links, userName }: Props) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Build sections from nav links
  const sections = links.map((link, i) => ({
    id: link.href,
    background: BG_IMAGES[i % BG_IMAGES.length],
    leftLabel: <span className="mnfx-side-label">{String(i + 1).padStart(2, "0")}</span>,
    title: (
      <a
        href={link.href}
        className={`mnfx-title-link ${link.active ? "mnfx-title-link--active" : ""}`}
        onClick={() => setOpen(false)}
      >
        {link.label}
      </a>
    ),
    rightLabel: <span className="mnfx-side-label">{link.tag}</span>,
  }));

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="mnfx-bar" role="banner" aria-label="Mobile header">
        <a href="/" className="mnfx-logo" aria-label="Filmora Movie">
          <span className="mnfx-logo-text">Filmora</span>
        </a>

        <button
          className="mnfx-hamburger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mnfx-overlay"
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Fullscreen overlay ── */}
      <div
        id="mnfx-overlay"
        ref={overlayRef}
        className={`mnfx-overlay ${open ? "mnfx-overlay--open" : ""}`}
        aria-hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Close button */}
        <button
          className="mnfx-close"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* FullScreenScrollFX fills the entire overlay */}
        {open && (
          <FullScreenScrollFX
            sections={sections}
            header={<><div>Filmora</div><div>Navigate</div></>}
            footer={userName ? <div>{userName}</div> : <div></div>}
            showProgress
            durations={{ change: 0.6, snap: 600 }}
            bgTransition="fade"
            parallaxAmount={3}
            colors={{
              text: "rgba(245,245,245,0.95)",
              overlay: "rgba(0,0,0,0.45)",
              pageBg: "#000",
              stageBg: "#000",
            }}
            style={{ height: "100%", position: "absolute", inset: 0 }}
            ariaLabel="Mobile navigation menu"
          />
        )}
      </div>

      <style>{`
        /* ── Top bar (mobile only) ── */
        .mnfx-bar {
          display: none;
          align-items: center;
          justify-content: space-between;
          padding: 0 1rem;
          height: 56px;
          background: var(--color-bg, #0a0a0c);
          border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.08));
          position: sticky;
          top: 0;
          z-index: 100;
        }
        @media (max-width: 768px) {
          .mnfx-bar { display: flex; }
        }

        .mnfx-logo { text-decoration: none; }
        .mnfx-logo-text {
          font-size: 1.125rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--color-text, #fff);
        }

        .mnfx-hamburger {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text, #fff);
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Overlay ── */
        .mnfx-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #000;
          overflow: hidden;
          /* hidden by default */
          opacity: 0;
          pointer-events: none;
          transform: translateY(100%);
          transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mnfx-overlay--open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        /* ── Close button ── */
        .mnfx-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #fff;
          transition: background 0.2s ease;
        }
        .mnfx-close:hover { background: rgba(255,255,255,0.2); }

        /* ── Side labels & title links ── */
        .mnfx-side-label {
          font-size: clamp(0.75rem, 1.8vw, 1rem);
          font-weight: 700;
          letter-spacing: 0.08em;
          color: rgba(245,245,245,0.7);
          text-transform: uppercase;
        }

        .mnfx-title-link {
          color: rgba(245,245,245,0.95);
          text-decoration: none;
          font-weight: 900;
          font-size: clamp(2.5rem, 10vw, 6rem);
          letter-spacing: -0.03em;
          transition: opacity 0.2s ease;
          display: block;
        }
        .mnfx-title-link:hover { opacity: 0.8; }
        .mnfx-title-link--active {
          background: linear-gradient(135deg, #fff 0%, rgba(245,245,245,0.6) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Override FullScreenScrollFX to fill overlay fully */
        .mnfx-overlay .fx {
          height: 100%;
          overflow-y: auto;
        }
        .mnfx-overlay .fx-fixed-section {
          height: 100%;
        }
        .mnfx-overlay .fx-fixed {
          height: 100%;
        }
        .mnfx-overlay .fx-scroll {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        /* Hide the "fin" end section in nav context */
        .mnfx-overlay .fx-end { display: none; }
      `}</style>
    </>
  );
}
