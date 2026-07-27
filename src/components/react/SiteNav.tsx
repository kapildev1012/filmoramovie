"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Search, Bookmark, Sun, Moon, User, LogIn } from "lucide-react";
import { Component as TextRoll } from "../ui/animated-menu";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  user?: { name: string; avatar_url: string | null } | null;
  pathname?: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/",         label: "Home"      },
  { href: "/movies",   label: "Movies"    },
  { href: "/series",   label: "Series"    },
  { href: "/anime",    label: "Anime"     },
  { href: "/netflix",  label: "Netflix"   },
  { href: "/prime",    label: "Prime"     },
  { href: "/search",   label: "Search"    },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function getTheme(): string {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") ?? "dark";
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("filmora_theme", theme); } catch {}
}

// ── Film icon logo ──────────────────────────────────────────────────────────
function FilmoraLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="url(#snl)" />
      <rect x="7"  y="7"  width="4" height="18" rx="1.5" fill="rgba(255,255,255,0.9)" />
      <rect x="21" y="7"  width="4" height="18" rx="1.5" fill="rgba(255,255,255,0.9)" />
      <rect x="11" y="9"  width="10" height="3"  rx="1"   fill="rgba(255,255,255,0.7)" />
      <rect x="11" y="20" width="10" height="3"  rx="1"   fill="rgba(255,255,255,0.7)" />
      <defs>
        <linearGradient id="snl" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function SiteNav({ user, pathname = "/" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<string>("dark");
  const [watchlistCount, setWatchlistCount] = useState(0);

  // Sync pathname on client for Astro SPA transitions
  const [currentPath, setCurrentPath] = useState(pathname);

  useEffect(() => {
    setCurrentPath(window.location.pathname);
    // astro:page-load only fires once the new document has been fetched and
    // swapped, so highlighting the pill there left the navbar looking frozen for
    // the whole navigation. astro:before-preparation fires synchronously when the
    // navigation starts, so the highlight moves the instant the link is clicked
    // and page-load then just confirms it (and covers back/forward).
    const onStart = (e: Event) => {
      const to = (e as CustomEvent & { to?: URL }).to;
      if (to?.pathname) setCurrentPath(to.pathname);
    };
    const onDone = () => setCurrentPath(window.location.pathname);
    document.addEventListener('astro:before-preparation', onStart);
    document.addEventListener('astro:page-load', onDone);
    return () => {
      document.removeEventListener('astro:before-preparation', onStart);
      document.removeEventListener('astro:page-load', onDone);
    };
  }, []);

  // Scroll-shrink
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Theme sync
  useEffect(() => {
    setTheme(getTheme());
    const obs = new MutationObserver(() => setTheme(getTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Watchlist badge
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

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close on navigation (Astro page transitions)
  useEffect(() => {
    const handler = () => setIsOpen(false);
    document.addEventListener("astro:before-preparation", handler);
    return () => document.removeEventListener("astro:before-preparation", handler);
  }, []);

  const isDark = theme === "dark";
  const toggleTheme = useCallback(() => {
    const next = isDark ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }, [isDark]);

  // ── pill background adapts to theme ──────────────────────────
  const pillBg = isDark
    ? "rgba(5,8,17,0.82)"
    : "rgba(255,255,255,0.92)";
  const pillBorder = isDark
    ? "1px solid rgba(255,255,255,0.08)"
    : "1px solid rgba(0,0,0,0.09)";
  const pillShadow = isDark
    ? "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)"
    : "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)";
  const textColor = isDark ? "#fff" : "#18181b";
  const mutedColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const iconHoverBg = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";

  return (
    <>
      {/* ════════════════════════════════════════════════
          FLOATING PILL — shown on all screen sizes
      ════════════════════════════════════════════════ */}
      <motion.div
        style={{
          position: "fixed",
          top: scrolled ? "0.75rem" : "1.25rem",
          left: "50%",
          x: "-50%",
          zIndex: 100,
          width: "calc(100% - 2rem)",
          maxWidth: 1120,
        }}
        animate={{ top: scrolled ? "0.75rem" : "1.25rem" }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.4375rem 0.75rem 0.4375rem 0.875rem",
            background: pillBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: pillBorder,
            borderRadius: 9999,
            boxShadow: pillShadow,
            gap: "0.5rem",
          }}
        >
          {/* ── Logo ── */}
          <motion.a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              textDecoration: "none",
              flexShrink: 0,
            }}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            aria-label="Filmora Movie — home"
          >
            <FilmoraLogo size={26} />
            <span style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: textColor,
              letterSpacing: "-0.02em",
            }}>
              Filmora
            </span>
          </motion.a>

          {/* ── Desktop nav links ── */}
          <nav
            aria-label="Main navigation"
            style={{
              display: "none",
              alignItems: "center",
              gap: "0.125rem",
              flex: 1,
              minWidth: 0,
              justifyContent: "center",
            }}
            className="sitenav-links"
          >
            {NAV_LINKS.map((link, i) => {
              const active = isActive(link.href, currentPath);
              return (
                <motion.a
                  key={link.href}
                  href={link.href}
                  /* The global prefetch strategy is "hover" (astro.config.mjs),
                     which never fires on touch devices and only starts after an
                     80ms dwell on desktop. The nav pill is position:fixed, so it
                     is always in the viewport — "viewport" prefetches these seven
                     routes shortly after load, on every device, and the click
                     then swaps HTML that is already in cache. Deliberately scoped
                     to the navbar: viewport prefetch on the content rails is what
                     caused dozens of SSR requests while scrolling. */
                  data-astro-prefetch="viewport"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  whileHover={{ scale: 1.04 }}
                  style={{
                    display: "block",
                    padding: "0.375rem 0.625rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: active ? textColor : mutedColor,
                    textDecoration: "none",
                    borderRadius: 9999,
                    background: active
                      ? (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")
                      : "transparent",
                    transition: "background 0.15s ease, color 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = iconHoverBg;
                      (e.currentTarget as HTMLElement).style.color = textColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = mutedColor;
                    }
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </motion.a>
              );
            })}
          </nav>

          {/* ── Right actions ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>

            {/* Search */}
            <motion.a
              href="/search"
              aria-label="Search"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "50%",
                color: mutedColor,
                textDecoration: "none",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = iconHoverBg;
                (e.currentTarget as HTMLElement).style.color = textColor;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = mutedColor;
              }}
            >
              <Search size={17} strokeWidth={2.2} />
            </motion.a>

            {/* Watchlist */}
            <motion.a
              href="/watchlist"
              aria-label={`Watchlist${watchlistCount > 0 ? ` (${watchlistCount})` : ""}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "50%",
                color: mutedColor,
                textDecoration: "none",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = iconHoverBg;
                (e.currentTarget as HTMLElement).style.color = textColor;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = mutedColor;
              }}
            >
              <Bookmark size={17} strokeWidth={2} />
              {watchlistCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
                  borderRadius: 9999,
                  background: "linear-gradient(135deg,#6366f1,#a855f7)",
                  color: "#fff",
                  fontSize: "0.5rem",
                  fontWeight: 700,
                  lineHeight: "15px",
                  textAlign: "center",
                }}>
                  {watchlistCount > 99 ? "99+" : watchlistCount}
                </span>
              )}
            </motion.a>

            {/* Theme toggle */}
            <motion.button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: mutedColor,
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = iconHoverBg;
                (e.currentTarget as HTMLElement).style.color = textColor;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = mutedColor;
              }}
            >
              {isDark ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
            </motion.button>

            {/* Auth: avatar or Sign in CTA — desktop only */}
            {user ? (
              <motion.a
                href="/profile"
                aria-label="Your profile"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid rgba(99,102,241,0.5)",
                  textDecoration: "none",
                  flexShrink: 0,
                }}
                className="sitenav-avatar"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    width={32}
                    height={32}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg,#6366f1,#a855f7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </motion.a>
            ) : (
              <motion.a
                href="/login"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="sitenav-cta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.4375rem 1.125rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: isDark
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(0,0,0,0.88)",
                  borderRadius: 9999,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "background 0.18s ease",
                  border: isDark ? "1px solid rgba(255,255,255,0.15)" : "none",
                }}
              >
                Sign in ↗
              </motion.a>
            )}

            {/* Mobile hamburger — visible only on small screens */}
            <motion.button
              onClick={() => setIsOpen(true)}
              aria-label="Open menu"
              aria-expanded={isOpen}
              whileTap={{ scale: 0.9 }}
              className="sitenav-hamburger"
              style={{
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: iconHoverBg,
                border: "none",
                cursor: "pointer",
                color: textColor,
                marginLeft: "0.125rem",
              }}
            >
              <Menu size={20} strokeWidth={2.2} />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════
          MOBILE SLIDE-IN OVERLAY
      ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="mobile-overlay"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed",
              inset: 0,
              background: isDark ? "#08090f" : "#ffffff",
              zIndex: 9999,
              paddingTop: "5rem",
              paddingLeft: "1.5rem",
              paddingRight: "1.5rem",
              paddingBottom: "2rem",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Close button */}
            <motion.button
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
                border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: textColor,
              }}
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={2.2} />
            </motion.button>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                position: "absolute",
                top: "1.35rem",
                left: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <FilmoraLogo size={24} />
              <span style={{ fontSize: "1rem", fontWeight: 700, color: textColor, letterSpacing: "-0.02em" }}>
                Filmora
              </span>
            </motion.div>

            {/* Nav links — animated TextRoll slide-in menu */}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "1.5rem" }}>
              {NAV_LINKS.map((link, i) => {
                const active = isActive(link.href, currentPath);
                return (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ delay: i * 0.06 + 0.1 }}
                    style={{
                      overflow: "visible",
                      borderBottom: isDark
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(0,0,0,0.07)",
                    }}
                  >
                    <a
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      aria-current={active ? "page" : undefined}
                      style={{
                        display: "inline-block",
                        padding: "0.6rem 0.15rem",
                        textDecoration: "none",
                        color: active
                          ? "#a855f7"
                          : (isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)"),
                      }}
                    >
                      <TextRoll className="text-3xl font-extrabold uppercase tracking-[-0.03em]">
                        {link.label}
                      </TextRoll>
                    </a>
                  </motion.li>
                );
              })}
            </ul>

            {/* Bottom actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ delay: 0.55 }}
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {/* Sign in / profile */}
              {user ? (
                <a
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.875rem 1.25rem",
                    borderRadius: 9999,
                    background: "linear-gradient(135deg,#6366f1,#a855f7)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "1rem",
                    textDecoration: "none",
                    justifyContent: "center",
                  }}
                >
                  <User size={18} />
                  {user.name}
                </a>
              ) : (
                <a
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.875rem 1.25rem",
                    borderRadius: 9999,
                    background: isDark ? "#fff" : "#18181b",
                    color: isDark ? "#18181b" : "#fff",
                    fontWeight: 600,
                    fontSize: "1rem",
                    textDecoration: "none",
                    justifyContent: "center",
                  }}
                >
                  <LogIn size={18} />
                  Sign In
                </a>
              )}

              {/* Watchlist link */}
              <a
                href="/watchlist"
                onClick={() => setIsOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.875rem 1.25rem",
                  borderRadius: 9999,
                  background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.09)",
                  color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                  fontWeight: 600,
                  fontSize: "1rem",
                  textDecoration: "none",
                  justifyContent: "center",
                }}
              >
                <Bookmark size={18} />
                My Watchlist
                {watchlistCount > 0 && (
                  <span style={{
                    background: "linear-gradient(135deg,#6366f1,#a855f7)",
                    color: "#fff",
                    borderRadius: 9999,
                    padding: "0.1rem 0.45rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}>
                    {watchlistCount}
                  </span>
                )}
              </a>

              {/* Theme toggle */}
              <button
                onClick={() => { toggleTheme(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.875rem 1.25rem",
                  borderRadius: 9999,
                  background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.09)",
                  color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                  fontWeight: 600,
                  fontSize: "1rem",
                  cursor: "pointer",
                  justifyContent: "center",
                  width: "100%",
                  fontFamily: "inherit",
                }}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Responsive CSS — injected as a style tag ── */}
      <style>{`
        /* Show desktop links at ≥1024px (enough room for all 8 links) */
        @media (min-width: 1024px) {
          .sitenav-links     { display: flex !important; }
          .sitenav-hamburger { display: none !important; }
          .sitenav-cta       { display: inline-flex !important; }
          .sitenav-avatar    { display: inline-flex !important; }
        }
        /* Show hamburger below 1024px, hide inline links/CTA/avatar */
        @media (max-width: 1023px) {
          .sitenav-links     { display: none !important; }
          .sitenav-hamburger {
            display: flex !important;
            min-width: 44px !important;
            min-height: 44px !important;
            width: 40px !important;
            height: 40px !important;
          }
          .sitenav-cta    { display: none !important; }
          .sitenav-avatar { display: none !important; }
        }
        /* Pill: slightly tighter horizontal padding on very small screens */
        @media (max-width: 380px) {
          .sitenav-hamburger {
            width: 38px !important;
            min-width: 44px !important;
          }
        }
        /* Prevent tap highlight on nav elements */
        .sitenav-hamburger,
        .sitenav-cta,
        .sitenav-avatar {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </>
  );
}
