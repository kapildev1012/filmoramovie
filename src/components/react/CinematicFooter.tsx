"use client";

import { Heart, Film } from "lucide-react";

// ─── Navigation data ──────────────────────────────────────────────────────────

const navigation = {
  sections: [
    {
      id: "browse",
      name: "Browse",
      items: [
        { name: "Movies", href: "/movies" },
        { name: "Series", href: "/series" },
        { name: "Anime", href: "/anime" },
        { name: "Trending", href: "/movies?sort=popularity.desc" },
      ],
    },
    {
      id: "platforms",
      name: "Platforms",
      items: [
        { name: "Netflix", href: "/netflix" },
        { name: "Prime Video", href: "/prime" },
        { name: "Apple TV+", href: "/appletv" },
        { name: "Hotstar", href: "/hotstar" },
      ],
    },
    {
      id: "genres",
      name: "Genres",
      items: [
        { name: "Action", href: "/movies?genres=28" },
        { name: "Comedy", href: "/movies?genres=35" },
        { name: "Drama", href: "/movies?genres=18" },
        { name: "Horror", href: "/movies?genres=27" },
        { name: "Sci-Fi", href: "/movies?genres=878" },
      ],
    },
    {
      id: "account",
      name: "Your Account",
      items: [
        { name: "Watchlist", href: "/watchlist" },
        { name: "Profile", href: "/profile" },
        { name: "Search", href: "/search" },
        { name: "Sign In", href: "/login" },
      ],
    },
    {
      id: "top-rated",
      name: "Top Rated",
      items: [
        { name: "Top Movies", href: "/movies?sort=vote_average.desc" },
        { name: "Top Series", href: "/series?sort=vote_average.desc" },
        { name: "Marvel", href: "/movies?genres=878&q=marvel" },
        { name: "Coming Soon", href: "/movies?sort=release_date.desc" },
      ],
    },
    {
      id: "company",
      name: "Company",
      items: [
        { name: "About Us", href: "/about" },
        { name: "Contact", href: "/contact" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms", href: "/terms" },
      ],
    },
  ],
};

// ─── Main Footer ──────────────────────────────────────────────────────────────

export function CinematicFooter() {
  return (
    <footer className="cf-root">
      {/* ── Brand + tagline ── */}
      <div className="cf-brand-row">
        <a href="/" aria-label="Filmora Movie home" className="cf-brand-logo">
          <Film className="cf-film-icon" strokeWidth={1.5} />
        </a>
        <p className="cf-tagline">
          Filmora Movie is a discovery and tracking platform for movies, series, and anime.
          We do not host, upload, or stream any video content. Metadata provided by{" "}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="cf-tmdb-link">
            TMDB
          </a>
          .
        </p>
      </div>

      {/* ── Divider ── */}
      <div className="cf-divider" />

      {/* ── Link grid ── */}
      <div className="cf-links-wrap">
        <div className="cf-links-grid">
          {navigation.sections.map((section) => (
            <div key={section.id} className="cf-col">
              <p className="cf-col-title">{section.name}</p>
              <ul role="list" className="cf-col-list">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <a href={item.href} className="cf-col-link">{item.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="cf-divider" />

      {/* ── Copyright ── */}
      <div className="cf-copyright">
        <span>© {new Date().getFullYear()} Filmora Movie. Made with</span>
        <Heart className="cf-heart" fill="currentColor" strokeWidth={0} />
        <span>for movie lovers.</span>
      </div>

      <style>{`
        /* ── Root ── */
        .cf-root {
          width: 100%;
          position: relative;
          padding-top: 2.5rem;
          /* Footer melts up out of the page instead of starting at a line */
          background: linear-gradient(to bottom,
            transparent,
            color-mix(in srgb, var(--color-surface) 55%, transparent) 60%,
            color-mix(in srgb, var(--color-surface) 78%, transparent));
        }

        /* ── Brand row ── */
        .cf-brand-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          max-width: 56rem;
          margin: 0 auto;
          padding: 2rem 1.5rem 0;
          flex-wrap: wrap;
        }
        .cf-brand-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          text-decoration: none;
        }
        .cf-film-icon {
          width: 2rem;
          height: 2rem;
          color: #dc2626;
        }
        .cf-tagline {
          font-size: 0.75rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.4);
          margin: 0;
          max-width: 48rem;
        }
        html[data-theme="light"] .cf-tagline { color: rgba(0,0,0,0.45); }
        .cf-tmdb-link {
          color: rgba(255,255,255,0.6);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }
        .cf-tmdb-link:hover { color: #fff; }
        html[data-theme="light"] .cf-tmdb-link { color: rgba(0,0,0,0.55); }
        html[data-theme="light"] .cf-tmdb-link:hover { color: #18181b; }

        /* ── Divider ── soft edge-faded seam, not a hard line ── */
        .cf-divider {
          max-width: 56rem;
          margin: 1.25rem auto 0;
          height: 1px;
          background: linear-gradient(to right,
            transparent,
            rgba(255,255,255,0.06) 20%,
            rgba(255,255,255,0.06) 80%,
            transparent);
        }
        html[data-theme="light"] .cf-divider {
          background: linear-gradient(to right,
            transparent,
            rgba(0,0,0,0.06) 20%,
            rgba(0,0,0,0.06) 80%,
            transparent);
        }

        /* ── Links grid ── */
        .cf-links-wrap {
          max-width: 56rem;
          margin: 0 auto;
          padding: 1.75rem 1.5rem;
        }
        .cf-links-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem 1rem;
        }
        @media (min-width: 480px) {
          .cf-links-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 640px) {
          .cf-links-grid { grid-template-columns: repeat(6, 1fr); }
        }
        .cf-col-title {
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin: 0 0 0.625rem;
        }
        html[data-theme="light"] .cf-col-title { color: rgba(0,0,0,0.35); }
        .cf-col-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .cf-col-link {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          transition: color 0.15s;
          display: block;
          padding: 0.125rem 0;
        }
        .cf-col-link:hover { color: #fff; }
        html[data-theme="light"] .cf-col-link { color: rgba(0,0,0,0.5); }
        html[data-theme="light"] .cf-col-link:hover { color: #18181b; }

        /* ── Copyright ── */
        .cf-copyright {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          flex-wrap: wrap;
          padding: 1.25rem 1rem 2rem;
          font-size: 0.6875rem;
          color: rgba(255,255,255,0.3);
          text-align: center;
        }
        html[data-theme="light"] .cf-copyright { color: rgba(0,0,0,0.35); }
        .cf-heart {
          width: 11px;
          height: 11px;
          color: #dc2626;
          flex-shrink: 0;
          animation: cf-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;
        }
        @keyframes cf-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }

        /* ── Mobile spacing ── */
        @media (max-width: 600px) {
          .cf-brand-row { padding: 1.5rem 1rem 0; gap: 0.75rem; }
          .cf-links-wrap { padding: 1.25rem 1rem; }
        }
      `}</style>
    </footer>
  );
}

export default CinematicFooter;
