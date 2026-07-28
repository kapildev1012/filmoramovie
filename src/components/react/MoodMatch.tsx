import { useEffect, useRef, useState } from 'react';

// Custom Add-on Features — AI mood-based browsing + "Time available" smart filter.
// Renders on every viewport: the base styles are mobile-first and progressively
// widen into a container-aligned two-column layout on tablet and desktop.
//
// Extra features layered on top of the base matcher:
//   • Per-pick "Save to watchlist" that shares the site-wide localStorage store.
//   • "Shuffle" to pull a fresh short list for the same mood + time.
//   • Last mood + time preference is remembered across visits.
//   • Rating badges, a picks counter, and lightweight toast feedback.

type Mood = 'light' | 'cozy' | 'thrilling' | 'cerebral' | 'uplifting' | 'surprise';

type Pick = {
  id: number;
  mediaType: 'movie';
  title: string;
  year: string;
  rating: number;
  overview: string;
  posterUrl: string | null;
  href: string;
  why: string;
};

type MoodResult = {
  headline: string;
  summary: string;
  source: 'nexos' | 'curated';
  picks: Pick[];
};

const MOODS: Array<{ value: Mood; label: string; icon: string }> = [
  { value: 'light', label: 'Something light', icon: '☀️' },
  { value: 'cozy', label: 'Cozy night', icon: '☕' },
  { value: 'thrilling', label: 'Keep me hooked', icon: '⚡' },
  { value: 'cerebral', label: 'Mind-bending', icon: '🌀' },
  { value: 'uplifting', label: 'Lift my mood', icon: '✨' },
  { value: 'surprise', label: 'Surprise me', icon: '🎲' },
];

const TIMES = [60, 90, 120, 180] as const;

// Shared with WatchlistButton.tsx — keep the key and entry shape in sync so a
// title saved from MoodMatch shows up everywhere the watchlist is read.
const WATCHLIST_KEY = 'filmora_watchlist';
const PREFS_KEY = 'filmora_mood_prefs';

interface WatchlistEntry {
  id: number;
  mediaType: string;
  title: string;
  posterPath: string | null;
  addedAt: string;
}

function readWatchlist(): WatchlistEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeWatchlist(entries: WatchlistEntry[]) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries));
    // Let any listening islands (rails, badges) refresh live.
    window.dispatchEvent(new CustomEvent('filmora:watchlist-updated'));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// The API returns a fully-qualified poster URL; the watchlist stores the raw
// TMDB path, so strip the image host to keep both representations compatible.
function posterPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\/image\.tmdb\.org\/t\/p\/w\d+/, '') || null;
}

export default function MoodMatch() {
  const [mood, setMood] = useState<Mood>('light');
  const [minutes, setMinutes] = useState<(typeof TIMES)[number]>(90);
  const [result, setResult] = useState<MoodResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [toast, setToast] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  // Desktop shows the full six-pick grid; narrower viewports show a focused
  // short list of three so the flowing mobile layout stays digestible.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Restore the visitor's last mood + time preference.
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (typeof raw.mood === 'string' && MOODS.some((m) => m.value === raw.mood)) {
          setMood(raw.mood as Mood);
        }
        if (typeof raw.minutes === 'number' && (TIMES as readonly number[]).includes(raw.minutes)) {
          setMinutes(raw.minutes as (typeof TIMES)[number]);
        }
      }
    } catch {
      /* first visit / unavailable storage */
    }
  }, []);

  // Persist preference whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ mood, minutes }));
    } catch {
      /* ignore */
    }
  }, [mood, minutes]);

  // Reflect which of the current picks are already on the watchlist.
  useEffect(() => {
    if (!result) {
      setSavedIds([]);
      return;
    }
    const wl = readWatchlist();
    setSavedIds(result.picks.filter((p) => wl.some((e) => e.id === p.id && e.mediaType === 'movie')).map((p) => p.id));
  }, [result]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function findMatches() {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, minutes }),
        signal: controller.signal,
      });
      const data = await response.json() as MoodResult & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to find a match right now.');
      setResult(data);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(requestError instanceof Error ? requestError.message : 'Unable to find a match right now.');
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function toggleSave(pick: Pick) {
    const wl = readWatchlist();
    const exists = wl.some((e) => e.id === pick.id && e.mediaType === 'movie');
    if (exists) {
      writeWatchlist(wl.filter((e) => !(e.id === pick.id && e.mediaType === 'movie')));
      setSavedIds((ids) => ids.filter((id) => id !== pick.id));
      setToast(`Removed “${pick.title}” from watchlist`);
    } else {
      const entry: WatchlistEntry = {
        id: pick.id,
        mediaType: 'movie',
        title: pick.title,
        posterPath: posterPathFromUrl(pick.posterUrl),
        addedAt: new Date().toISOString(),
      };
      writeWatchlist([...wl, entry]);
      setSavedIds((ids) => [...ids, pick.id]);
      setToast(`Saved “${pick.title}” to watchlist`);
    }
  }

  return (
    <section className="nxm-root" aria-labelledby="nxm-title">
      <div className="nxm-controls">
      <div className="nxm-heading">
        <p className="nxm-eyebrow">Custom Add-on Feature</p>
        <h2 id="nxm-title">What fits your mood?</h2>
        <p>Pick a vibe and your free time. NexS finds a short list from the live catalog.</p>
      </div>

      <fieldset className="nxm-fieldset">
        <legend>Choose your mood</legend>
        <div className="nxm-options nxm-options--moods">
          {MOODS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="nxm-choice"
              aria-pressed={mood === option.value}
              onClick={() => setMood(option.value)}
            >
              <span aria-hidden="true">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="nxm-fieldset">
        <legend>Time available</legend>
        <div className="nxm-options nxm-options--time">
          {TIMES.map((time) => (
            <button
              key={time}
              type="button"
              className="nxm-choice nxm-time"
              aria-pressed={minutes === time}
              onClick={() => setMinutes(time)}
            >
              {time < 120 ? `${time} min` : `${time / 60} hr`}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="nxm-submit" onClick={findMatches} disabled={loading}>
        {loading ? <span className="nxm-spinner" aria-hidden="true" /> : <span aria-hidden="true">✦</span>}
        {loading ? 'Finding your match…' : 'Find my mood match'}
      </button>

      <div className="nxm-status" aria-live="polite" aria-atomic="true">
        {error && <p className="nxm-error">{error}</p>}
      </div>
      </div>

      <div className="nxm-output">
      {result ? (
        <div className="nxm-results">
          {(() => {
            const visiblePicks = isDesktop ? result.picks : result.picks.slice(0, 3);
            return (
          <>
          <div className="nxm-result-heading">
            <div className="nxm-result-title">
              <h3>{result.headline}</h3>
              <p>{result.summary}</p>
              <p className="nxm-result-count">
                {visiblePicks.length} {visiblePicks.length === 1 ? 'pick' : 'picks'} for you
              </p>
            </div>
            <div className="nxm-result-actions">
              <span className="nxm-source">{result.source === 'nexos' ? 'NexS AI' : 'Smart curated'}</span>
              <button
                type="button"
                className="nxm-shuffle"
                onClick={findMatches}
                disabled={loading}
                aria-label="Shuffle for a fresh set of picks"
              >
                <span className={`nxm-shuffle-icon ${loading ? 'is-spinning' : ''}`} aria-hidden="true">⟳</span>
                Shuffle
              </button>
            </div>
          </div>

          <ul className="nxm-list">
            {visiblePicks.map((pick) => {
              const isSaved = savedIds.includes(pick.id);
              return (
                <li className="nxm-card" key={pick.id}>
                  <a className="nxm-card-link" href={pick.href} aria-label={`View ${pick.title}`} />
                  <div className="nxm-poster">
                    {pick.posterUrl ? (
                      <img src={pick.posterUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span aria-hidden="true">▶</span>
                    )}
                    {pick.rating > 0 && <span className="nxm-rating" aria-hidden="true">★ {pick.rating}</span>}
                  </div>
                  <div className="nxm-card-copy">
                    <div className="nxm-card-meta">
                      <h4>{pick.title}</h4>
                      {pick.year && <span>{pick.year}</span>}
                    </div>
                    <p>{pick.why}</p>
                    <div className="nxm-card-foot">
                      <span className="nxm-open">View details <span aria-hidden="true">→</span></span>
                      <button
                        type="button"
                        className="nxm-save"
                        aria-pressed={isSaved}
                        aria-label={isSaved ? `Remove ${pick.title} from watchlist` : `Save ${pick.title} to watchlist`}
                        onClick={() => toggleSave(pick)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        {isSaved ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
            );
          })()}
        </div>
      ) : (
        <div className={`nxm-placeholder ${loading ? 'is-loading' : ''}`} aria-hidden="true">
          <span className="nxm-placeholder-icon">✦</span>
          <p className="nxm-placeholder-title">
            {loading ? 'Curating your short list…' : 'Your mood matches will appear here'}
          </p>
          <p className="nxm-placeholder-sub">
            {loading
              ? 'Scanning the live catalog for the best fit.'
              : 'Pick a vibe and how much time you have, then hit “Find my mood match”.'}
          </p>
        </div>
      )}
      </div>

      <div className="nxm-toast-wrap" aria-live="polite" aria-atomic="true">
        {toast && <div className="nxm-toast" role="status">{toast}</div>}
      </div>

      <style>{`
          .nxm-root {
            width: 100%;
            padding: 1.5rem 1rem 1.75rem;
            color: var(--color-text);
            background: transparent;
          }
          .nxm-heading { margin-bottom: 1.25rem; }
          .nxm-eyebrow {
            margin: 0 0 0.35rem;
            color: var(--color-accent-from);
            font-size: 0.6875rem;
            font-weight: 750;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .nxm-heading h2 {
            margin: 0;
            font-size: clamp(1.35rem, 6vw, 1.75rem);
            line-height: 1.15;
            letter-spacing: -0.025em;
          }
          .nxm-heading > p:last-child {
            margin: 0.55rem 0 0;
            color: var(--color-text-2);
            font-size: 0.875rem;
            line-height: 1.55;
          }
          .nxm-fieldset {
            min-width: 0;
            margin: 0 0 1rem;
            padding: 0;
            border: 0;
          }
          .nxm-fieldset legend {
            margin-bottom: 0.625rem;
            color: var(--color-text-2);
            font-size: 0.75rem;
            font-weight: 650;
          }
          .nxm-options { display: grid; gap: 0.5rem; }
          .nxm-options--moods { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .nxm-options--time { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .nxm-choice {
            min-height: 46px;
            padding: 0.65rem 0.7rem;
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            gap: 0.45rem;
            border: 0;
            border-radius: 12px;
            background: color-mix(in srgb, var(--color-text) 6%, transparent);
            color: var(--color-text-2);
            font: inherit;
            font-size: 0.78rem;
            font-weight: 620;
            line-height: 1.2;
            text-align: left;
            cursor: pointer;
            touch-action: manipulation;
            transition: background 160ms ease, color 160ms ease, transform 160ms ease;
          }
          .nxm-choice[aria-pressed="true"] {
            color: #fff;
            background: linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to));
          }
          .nxm-choice:active { transform: scale(0.97); }
          .nxm-choice:focus-visible,
          .nxm-submit:focus-visible,
          .nxm-shuffle:focus-visible,
          .nxm-save:focus-visible,
          .nxm-card-link:focus-visible {
            outline: 3px solid color-mix(in srgb, var(--color-accent-from) 70%, white);
            outline-offset: 3px;
          }
          .nxm-time { justify-content: center; padding-inline: 0.35rem; text-align: center; }
          .nxm-submit {
            width: 100%;
            min-height: 50px;
            padding: 0.75rem 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.55rem;
            border: 0;
            border-radius: 999px;
            background: var(--color-text);
            color: var(--color-bg);
            font: inherit;
            font-size: 0.9rem;
            font-weight: 750;
            cursor: pointer;
            touch-action: manipulation;
          }
          .nxm-submit:disabled { opacity: 0.65; cursor: wait; }
          .nxm-spinner {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: conic-gradient(transparent 25%, currentColor);
            -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
            mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
            animation: nxm-spin 0.75s linear infinite;
          }
          @keyframes nxm-spin { to { transform: rotate(1turn); } }
          .nxm-status { min-height: 0; }
          .nxm-error {
            margin: 0.875rem 0 0;
            color: #ff8f8f;
            font-size: 0.8rem;
            line-height: 1.45;
          }
          .nxm-results {
            margin-top: 1.4rem;
            padding-top: 0.25rem;
          }
          .nxm-result-heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.875rem;
          }
          .nxm-result-title { min-width: 0; }
          .nxm-result-heading h3 {
            margin: 0;
            font-size: 1.05rem;
            line-height: 1.25;
          }
          .nxm-result-heading p {
            margin: 0.35rem 0 0;
            color: var(--color-text-2);
            font-size: 0.78rem;
            line-height: 1.45;
          }
          .nxm-result-count {
            color: var(--color-text-3) !important;
            font-size: 0.7rem !important;
            font-weight: 650;
          }
          .nxm-result-actions {
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.5rem;
          }
          .nxm-source {
            padding: 0.35rem 0.55rem;
            border-radius: 999px;
            background: color-mix(in srgb, var(--color-accent-from) 14%, transparent);
            color: color-mix(in srgb, var(--color-accent-from) 75%, white);
            font-size: 0.625rem;
            font-weight: 750;
            white-space: nowrap;
          }
          .nxm-shuffle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.4rem 0.7rem;
            border: 1px solid var(--color-border);
            border-radius: 999px;
            background: color-mix(in srgb, var(--color-text) 5%, transparent);
            color: var(--color-text-2);
            font: inherit;
            font-size: 0.7rem;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            touch-action: manipulation;
            transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
          }
          .nxm-shuffle:disabled { opacity: 0.6; cursor: wait; }
          .nxm-shuffle-icon { display: inline-block; font-size: 0.85rem; line-height: 1; }
          .nxm-shuffle-icon.is-spinning { animation: nxm-spin 0.75s linear infinite; }
          .nxm-list { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
          .nxm-card {
            position: relative;
            min-height: 116px;
            padding: 0.6rem;
            display: grid;
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 0.75rem;
            align-items: stretch;
            border: 0;
            border-radius: 14px;
            background: color-mix(in srgb, var(--color-text) 5%, transparent);
            color: inherit;
          }
          /* Stretched link overlay: keeps the whole card tappable while letting
             the Save button remain an independent, accessible control. */
          .nxm-card-link {
            position: absolute;
            inset: 0;
            z-index: 1;
            border-radius: inherit;
            text-decoration: none;
          }
          .nxm-poster {
            position: relative;
            min-height: 96px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: color-mix(in srgb, var(--color-text) 8%, transparent);
            color: var(--color-text-3);
          }
          .nxm-poster img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 300ms ease; }
          .nxm-rating {
            position: absolute;
            top: 0.3rem;
            left: 0.3rem;
            padding: 0.12rem 0.35rem;
            border-radius: 6px;
            background: color-mix(in srgb, #000 62%, transparent);
            color: #ffd66b;
            font-size: 0.62rem;
            font-weight: 750;
            line-height: 1.2;
            backdrop-filter: blur(3px);
          }
          .nxm-card-copy { position: relative; min-width: 0; display: flex; flex-direction: column; }
          .nxm-card-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
          .nxm-card-meta h4 {
            min-width: 0;
            margin: 0;
            overflow: hidden;
            color: var(--color-text);
            font-size: 0.9rem;
            line-height: 1.25;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .nxm-card-meta > span {
            flex: 0 0 auto;
            color: var(--color-text-3);
            font-size: 0.64rem;
            white-space: nowrap;
          }
          .nxm-card-copy > p {
            margin: 0.35rem 0 0;
            color: var(--color-text-2);
            font-size: 0.72rem;
            line-height: 1.4;
          }
          .nxm-card-foot {
            margin-top: auto;
            padding-top: 0.4rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
          }
          .nxm-open {
            color: var(--color-accent-from);
            font-size: 0.68rem;
            font-weight: 700;
            white-space: nowrap;
          }
          .nxm-save {
            position: relative;
            z-index: 2;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.32rem 0.55rem;
            border: 1px solid var(--color-border);
            border-radius: 999px;
            background: color-mix(in srgb, var(--color-bg) 55%, transparent);
            color: var(--color-text-2);
            font: inherit;
            font-size: 0.66rem;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            touch-action: manipulation;
            transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 120ms ease;
          }
          .nxm-save:active { transform: scale(0.94); }
          .nxm-save[aria-pressed="true"] {
            color: var(--color-accent-from);
            border-color: color-mix(in srgb, var(--color-accent-from) 45%, transparent);
            background: color-mix(in srgb, var(--color-accent-from) 16%, transparent);
          }

          /* Toast feedback for save / remove actions. */
          .nxm-toast-wrap {
            position: fixed;
            left: 50%;
            bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
            transform: translateX(-50%);
            z-index: 60;
            pointer-events: none;
          }
          .nxm-toast {
            padding: 0.6rem 1rem;
            border-radius: 999px;
            background: color-mix(in srgb, var(--color-text) 92%, transparent);
            color: var(--color-bg);
            font-size: 0.78rem;
            font-weight: 650;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            animation: nxm-toast-in 200ms ease;
          }
          @keyframes nxm-toast-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Placeholder is a desktop-only affordance for the right column;
             on mobile the results simply flow below the controls as before. */
          .nxm-placeholder { display: none; }

        /* ── Tablet (769–1023px): widen typography and grids, single column ── */
        @media (min-width: 769px) and (max-width: 1023px) {
          .nxm-root {
            max-width: 900px;
            margin: 0 auto;
            padding: 2.25rem 2rem 2.75rem;
          }
          .nxm-heading { margin-bottom: 1.5rem; }
          .nxm-heading h2 { font-size: clamp(1.6rem, 2.4vw, 2.125rem); }
          .nxm-heading > p:last-child { font-size: 0.9375rem; max-width: 46rem; }
          .nxm-fieldset legend { font-size: 0.8125rem; }
          .nxm-options { gap: 0.625rem; }
          .nxm-options--moods { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .nxm-options--time { grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: 32rem; }
          .nxm-choice {
            min-height: 52px;
            padding: 0.75rem 0.9rem;
            font-size: 0.875rem;
            border: 1px solid var(--color-border);
          }
          .nxm-choice:hover {
            background: color-mix(in srgb, var(--color-text) 10%, transparent);
            color: var(--color-text);
          }
          .nxm-choice[aria-pressed="true"]:hover { color: #fff; }
          .nxm-submit { width: auto; min-width: 16rem; font-size: 0.9375rem; }
          .nxm-list { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.875rem; }
          .nxm-card {
            min-height: 140px;
            padding: 0.75rem;
            grid-template-columns: 84px minmax(0, 1fr);
            gap: 1rem;
            border: 1px solid var(--color-border);
          }
          .nxm-poster { min-height: 118px; }
        }

        /* ── Desktop (≥1024px): one unified box, controls | results ──
           The box no longer holds a fixed 16:9 (or 16:5.4) ratio — its height
           is driven by the controls column, which is the tallest fixed content.
           Everything on the right stretches to fill it, so there is never a
           band of dead space at the bottom. ── */
        @media (min-width: 1024px) {
          .nxm-root {
            display: grid;
            grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
            gap: 1.25rem;
            align-items: stretch;
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.1rem 1.35rem;
            border: 1px solid var(--color-border);
            border-radius: 18px;
            overflow: hidden;
            background:
              radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, var(--color-accent-from) 12%, transparent), transparent 55%),
              color-mix(in srgb, var(--color-text) 4%, transparent);
            box-shadow: 0 24px 60px -40px color-mix(in srgb, var(--color-accent-from) 50%, transparent);
          }

          /* Left region: controls fill their column top to bottom, divider on
             the right. No inner scrolling — the box sizes to this content. */
          .nxm-controls {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            min-height: 0;
            padding-right: 0.9rem;
            border-right: 1px solid var(--color-border);
          }
          .nxm-output::-webkit-scrollbar { width: 8px; }
          .nxm-output::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: color-mix(in srgb, var(--color-text) 18%, transparent);
          }
          /* The eyebrow is the first thing to go in the shorter box. */
          .nxm-eyebrow { display: none; }
          .nxm-heading { margin-bottom: 0; }
          .nxm-heading h2 { font-size: 1.05rem; line-height: 1.2; }
          .nxm-heading > p:last-child {
            margin-top: 0.25rem;
            font-size: 0.72rem;
            line-height: 1.35;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .nxm-fieldset { margin-bottom: 0; }
          .nxm-fieldset legend { margin-bottom: 0.3rem; font-size: 0.6875rem; }
          .nxm-options { gap: 0.3rem; }
          /* 3 × 2 moods and a single row of times: the most compact grid that
             still keeps every label on one line. */
          .nxm-options--moods { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .nxm-options--time { grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: none; }
          .nxm-choice {
            min-height: 32px;
            padding: 0.3rem 0.4rem;
            gap: 0.25rem;
            border-radius: 9px;
            font-size: 0.66rem;
            line-height: 1.15;
            border: 1px solid var(--color-border);
          }
          .nxm-choice:hover {
            background: color-mix(in srgb, var(--color-text) 10%, transparent);
            color: var(--color-text);
            transform: translateY(-1px);
          }
          .nxm-choice[aria-pressed="true"]:hover { color: #fff; }
          .nxm-status { margin-top: 0; }
          .nxm-error { margin: 0.4rem 0 0; font-size: 0.7rem; }
          .nxm-submit {
            width: 100%;
            min-height: 36px;
            margin-top: auto;
            padding: 0.45rem 0.9rem;
            font-size: 0.78rem;
            transition: transform 160ms ease, box-shadow 160ms ease;
          }
          .nxm-submit:not(:disabled):hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 26px -12px color-mix(in srgb, var(--color-text) 60%, transparent);
          }

          /* Right region: a column that fills the box height, so the picks grid
             can stretch into whatever space the controls leave. */
          .nxm-output {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            padding-left: 0.15rem;
            overflow: hidden;
          }
          .nxm-results {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            margin-top: 0;
            padding-top: 0;
          }
          .nxm-result-heading {
            flex: 0 0 auto;
            position: static;
            padding-bottom: 0.45rem;
            margin-bottom: 0.5rem;
            border-bottom: 1px solid var(--color-border);
            background: none;
            backdrop-filter: none;
          }
          .nxm-result-heading h3 { font-size: 0.95rem; }
          .nxm-result-heading p { margin-top: 0.15rem; font-size: 0.7rem; }
          .nxm-result-actions { gap: 0.35rem; }
          .nxm-source { padding: 0.22rem 0.45rem; font-size: 0.6rem; }
          .nxm-shuffle { font-size: 0.66rem; padding: 0.28rem 0.55rem; }
          .nxm-shuffle:hover:not(:disabled) {
            background: color-mix(in srgb, var(--color-text) 10%, transparent);
            color: var(--color-text);
            border-color: var(--color-text-3);
          }
          /* 3 across x 2 rows for the six picks; 1fr rows make the cards
             absorb the leftover height instead of leaving a gap. */
          .nxm-list {
            flex: 1;
            min-height: 0;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-auto-rows: minmax(0, 1fr);
            gap: 0.5rem;
            padding-bottom: 0;
          }
          .nxm-card {
            min-height: 0;
            padding: 0.45rem;
            grid-template-columns: 54px minmax(0, 1fr);
            gap: 0.55rem;
            border-radius: 12px;
            border: 1px solid var(--color-border);
            transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 220ms ease;
          }
          .nxm-card:hover {
            transform: translateY(-3px);
            border-color: color-mix(in srgb, var(--color-accent-from) 45%, transparent);
            background: color-mix(in srgb, var(--color-text) 7%, transparent);
            box-shadow: 0 18px 40px -28px color-mix(in srgb, var(--color-accent-from) 60%, transparent);
          }
          .nxm-card:hover .nxm-poster img { transform: scale(1.06); }
          /* Poster fills the full card height (rows are 1fr), so no letterboxing. */
          .nxm-poster { min-height: 0; height: 100%; border-radius: 8px; }
          .nxm-rating { font-size: 0.55rem; padding: 0.1rem 0.26rem; }
          .nxm-card-meta h4 { font-size: 0.78rem; }
          .nxm-card-meta > span { font-size: 0.6rem; }
          /* Clamp the "why" copy so a card never outgrows the shorter box. */
          .nxm-card-copy > p {
            margin-top: 0.15rem;
            font-size: 0.68rem;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .nxm-card-foot { padding-top: 0.25rem; gap: 0.3rem; }
          .nxm-open { font-size: 0.63rem; }
          .nxm-save { font-size: 0.6rem; padding: 0.24rem 0.45rem; gap: 0.22rem; }
          .nxm-save svg { width: 12px; height: 12px; }
          .nxm-save:hover {
            color: var(--color-text);
            border-color: var(--color-text-3);
          }
          .nxm-save[aria-pressed="true"]:hover { color: var(--color-accent-from); }

          /* Toast anchors to the bottom-right on desktop, out of the way. */
          .nxm-toast-wrap {
            left: auto;
            right: 2rem;
            bottom: 2rem;
            transform: none;
          }

          /* Empty / loading affordance keeps the right column from looking bare */
          .nxm-placeholder {
            display: flex;
            flex: 1;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            min-height: 0;
            height: auto;
            padding: 1rem;
            text-align: center;
            border: 1px dashed var(--color-border);
            border-radius: 14px;
            background: color-mix(in srgb, var(--color-text) 2.5%, transparent);
            color: var(--color-text-3);
          }
          .nxm-placeholder-icon { font-size: 1.5rem; line-height: 1; color: var(--color-accent-from); opacity: 0.85; }
          .nxm-placeholder-title {
            margin: 0.3rem 0 0;
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--color-text-2);
          }
          .nxm-placeholder-sub {
            margin: 0;
            font-size: 0.75rem;
            line-height: 1.45;
            max-width: 22rem;
          }
          .nxm-placeholder.is-loading .nxm-placeholder-icon {
            animation: nxm-spin 1.2s linear infinite;
          }
        }

        /* ── Wide desktop (≥1440px): same compact box, slightly wider ── */
        @media (min-width: 1440px) {
          .nxm-root { max-width: 1320px; grid-template-columns: minmax(0, 330px) minmax(0, 1fr); }
          .nxm-heading h2 { font-size: 1.15rem; }
          .nxm-choice { min-height: 34px; font-size: 0.7rem; }
          .nxm-card { grid-template-columns: 60px minmax(0, 1fr); gap: 0.65rem; }
          .nxm-card-meta h4 { font-size: 0.82rem; }
          .nxm-card-copy > p { font-size: 0.7rem; }
        }

        @media (max-width: 380px) {
          .nxm-root { padding-inline: 0.875rem; }
          .nxm-choice { font-size: 0.72rem; }
          .nxm-options--time { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .nxm-card { grid-template-columns: 58px minmax(0, 1fr); gap: 0.625rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nxm-choice,
          .nxm-card,
          .nxm-save,
          .nxm-submit,
          .nxm-poster img { transition: none; }
          .nxm-card:hover { transform: none; }
          .nxm-card:hover .nxm-poster img { transform: none; }
          .nxm-spinner,
          .nxm-shuffle-icon.is-spinning,
          .nxm-placeholder.is-loading .nxm-placeholder-icon { animation-duration: 1.5s; }
          .nxm-toast { animation: none; }
        }
      `}</style>
    </section>
  );
}
