# BUILD PROMPT — "FilmoraMovie" streaming discovery web app

You are a senior full-stack engineer. Build a premium, responsive movie/TV **discovery & streaming** web app called **FilmoraMovie**, matched to the spec below. It is a WEB APP (mobile + desktop browsers), dark-theme by default, SSR for SEO, powered by TMDB data.

## 1. Tech stack (use exactly)
- **Astro 7**, `output: 'server'` (SSR), with **React 19** islands via `@astrojs/react`.
- **Tailwind CSS v4** via `@tailwindcss/vite`, plus component-scoped `<style>` and two global stylesheets (`src/styles/global.css`, `src/styles/mobile.css`).
- **View Transitions**: Astro `<ClientRouter />`; enable `prefetch: { prefetchAll: true, defaultStrategy: 'viewport' }` so page-to-page navigation is <250ms.
- **Data**: The Movie Database (TMDB) REST API (v3, `api_key` query param). Read the key server-side only.
- **DB**: SQLite — `better-sqlite3` for Node/Vercel, or **Cloudflare D1** for Workers. Tables: users, sessions, profiles, watchlist, ratings, watch_progress, consent_log.
- **Auth**: Google OAuth via `arctic`; custom cookie sessions (`filmora_session`, HttpOnly, 30-day).
- **Deploy targets**: Vercel (`@astrojs/vercel` + better-sqlite3) or Cloudflare Workers (`@astrojs/cloudflare@^14` + D1). Secrets via `astro:env/server` (or `locals.runtime.env` on Workers).
- **Analytics**: GA4 (`gtag.js`) with `send_page_view:false` + manual `page_view` on `astro:page-load` (SPA-correct).
- **PWA**: `site.webmanifest` + icons; installable.

## 2. Design system (global; dark default)
- Color tokens on `:root` (dark) with `html[data-theme="light"]` overrides. Accent gradient `#4285F4 → #A142F4`. Surfaces near-black (`#000`/`#0a0a0a`/`#111`), text `#ededed`/`#888`/`#666`.
- Fonts: Netflix-like system stack (`"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui`). Type scale 12→64px; tight letter-spacing on headings.
- One **fixed continuous background wash** behind all sections (radial accent gradients) so the site reads as a single surface.
- Utilities: `.container` (max 1440px, responsive padding), `.btn/.btn-primary/.btn-secondary/.btn-ghost` (with ripple), `.input`, `.badge`, `.chip`, `.glass`/`.glass-dark`, `.scroll-rail`, `.skeleton` (shimmer), `.accent-text/.gradient-text`, `[data-reveal]` scroll-reveal via IntersectionObserver.
- Theme init + `nx_human_ok` anti-flash scripts run before paint; a fixed top **scroll-progress** bar; a **skip-to-main** link; `prefers-reduced-motion` and `prefers-contrast` support.

### CRITICAL mobile styling rules (≤768px only)
- All mobile layout/spacing lives in `@media (max-width: 768px)` (primary 320–480px). **Never modify desktop (≥1024px) or tablet (769–1023px) styles when doing mobile work.**
- **Seamless mobile**: no borders, dividers, hr's, card outlines, or box-shadows to separate sections — differentiate via typography hierarchy, spacing rhythm (8/12/16/24px), and subtle opacity/background shifts only.
- Min 44×44px tap targets; 16px+ form fields (no iOS zoom); safe-area insets; contrast maintained without borders.
- Existing breakpoints in use: 380, 400, 480, 600, 639/640, 767/768, 900, 1023/1024, 1280px. New feature CSS must use unique class prefixes and never edit shared/base selectors.

## 3. App shell (`src/layouts/Layout.astro`)
Head: SEO/OG/Twitter meta, canonical, favicons, `site.webmanifest`, TMDB preconnect, GA4, `<ClientRouter/>`, theme-init + human-verified inline scripts.
Body order: **HumanGate** (Cloudflare Turnstile "Are you human?" gate — home page only, shows on real refresh, removed on client navigation, session-remembered via `nx_human_ok`) → scroll-progress bar → skip link → **Nav** → cookie-banner slot → `<main>` slot → **CinematicFooter** → **BottomTabBar** (mobile-only) → **BackToTop** → scroll-progress/reveal scripts.

## 4. Data layer
- `src/lib/tmdb.ts`: typed TMDB client with `tmdbFetch` (api_key + language, cache TTL) and functions: trending (all/movie/tv), movie & tv details/credits/videos/watch-providers/recommendations, top_rated/now_playing/upcoming/popular/on_the_air, discover (by genre/network/company, runtime, votes), search (multi/movie/tv/person), genres, `getOfficialTrailerKey`, `getWatchProvidersForCountry` (default region IN), `buildHeroSlides` (enriched hero), `getHomePageData`, `getAnimePageData`, platform Top-10 (`getPlatformPageData`, `getAllPlatformTop10`) for providers Netflix(8)/Prime(119)/Disney(122)/Hotstar(392)/AppleTV(350). Image bases `https://image.tmdb.org/t/p/{w300,w342,w500,w780,w1280,original}`.
- `src/lib/db.ts`: users/sessions/profiles(≤5)/watchlist/ratings CRUD + `getSessionFromRequest`. `src/lib/oauth.ts`: Google via arctic. `src/lib/i18n.ts`: 9-locale translations. `src/lib/types.ts`: TMDB + app types. `src/lib/embed.ts`: streaming embed config (`EMBED_BASE`, `IMG_BASE`, `IMG_BASE_LG`, server-only key).

## 5. Routes / pages (build all)
- `/` **Home**: HeroCarousel (alternating Top-10 movies/series w/ trailer-preview vibe) → rails: Continue Watching, Trending, Top-10 Netflix, Latest Movies, Top-10 Prime, Latest TV, Top-10 Hotstar, Top-10 AppleTV, Top Rated, Popular, Coming Soon → **MoodMatch** (mobile) → FeaturedGallery (3D) → GalleryShowcase → Testimonials → bento "Why Filmora" feature cards → FAQ (with FAQPage JSON-LD). Graceful "live catalog unavailable" notice on TMDB failure.
- `/movies`, `/series`, `/anime`: browse/discover pages with **FilterPanel** (genre/sort/year/rating), hero, poster grid, pagination.
- `/movie/[id]`, `/series/[id]`: SSR detail — backdrop hero, title/meta/overview, actions (Play, **WatchlistButton**, **StarRating**, Share, Download), trailer (YouTube embed), **3D CastGallery** (desktop; sized `clamp(360px,70svh,100svh)`) / fan CastGallery (mobile), watch providers (JustWatch via TMDB), season/episode selector (series), facts, "More Like This" rail.
- `/netflix`, `/prime`, `/disney`, `/hotstar`, `/appletv`: platform hubs (brand header, Top-10, popular rails).
- `/search`: query + **SearchBar** autocomplete, tabbed results (movies/series/people).
- `/watchlist`, `/profile`, `/login`: auth-gated user pages (login shows **AuthShowcase**; profile manages up-to-5 profiles, kids flag, watchlist counts).
- `/about`, `/contact`, `/privacy`, `/terms`, `/404`, `/500`, `/sitemap.xml`.

## 6. API routes (`src/pages/api`)
- `GET /api/search?q=` — TMDB multi-search proxy (server key).
- `GET|POST|DELETE /api/watchlist`, `POST|DELETE /api/rating` — auth + default-profile, D1/SQLite.
- `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/signout` — OAuth + sessions.
- `POST /api/mood` — **Custom Add-on Feature (AI Mood Match)**: allow-listed mood + time (60/90/120/180 min), rate-limited, pulls runtime-filtered TMDB candidates, asks an LLM (nexos.ai gateway, server-only key) to pick 3 with reasons, validates returned IDs against candidates, graceful curated fallback. Never trust AI-invented IDs; never expose the key.

## 7. Components
Astro: Nav, Footer/CinematicFooter, PosterCard (hover overlay: play/❤/info; static on mobile), MovieRail, Top10Rail (giant rank numerals, auto-rotating), StreamingHubs, RailSkeleton, HumanGate.
React islands: HeroCarousel, SearchBar, FilterPanel, WatchlistButton (localStorage + API sync), StarRating, ContinueWatchingRail (localStorage), BottomTabBar (mobile pill nav w/ badges), MobileNavFX/SiteNav/NavMenu, CookieConsent (GDPR levels), BackToTop, LoadingScreen, MoodMatch (mobile-only, returns null >768px), FeaturedGallery + GalleryShowcase + 3D InfiniteGallery (react-three-fiber), Testimonials, AuthShowcase, StreamingHero, parallax-floating.

## 8. Custom Add-on Features (label them as such in code)
AI mood browsing ("surprise me / something light / binge tonight"), "Time available" smart filter, plus stubs/plans for: social watch parties (synced playback + chat), interactive trivia/X-ray during playback, community playlists, creator/director spotlight pages.

## 9. Non-functional
- Accessibility: screen-reader labels, keyboard focus rings, `aria-live` for async, 44px targets, contrast without borders.
- Performance: lazy images, code-split islands (`client:idle/visible/only`), virtualize long rows, viewport prefetch.
- SEO: SSR, canonical/OG, FAQ + sitemap; graceful degradation when TMDB is down.
- Security: all API keys server-side (never in client bundles or committed to git); `.env` gitignored with a placeholder `.env.example`; validate external/API input; sign nothing to the client.

## 10. Delivery order
Design-system + tokens → app shell/layout → TMDB data layer + DB schema → home → detail pages → browse/search → platform hubs → auth/profile/watchlist → custom add-ons last. Verify: build passes, mobile 320–480px is seamless (no lines), and desktop/tablet remain visually unchanged by mobile work.

**Honest limitation:** a web app can't do true native offline downloads or full OS-level casting — approximate downloads with service-worker caching of previously streamed content, and note the tradeoff.
