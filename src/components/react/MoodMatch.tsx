import { useEffect, useRef, useState } from 'react';

// Custom Add-on Features — AI mood-based browsing + "Time available" smart filter.
// This island returns null outside mobile viewports; all visual rules are also
// scoped to max-width: 768px so existing tablet/desktop UI remains untouched.

type Mood = 'light' | 'cozy' | 'thrilling' | 'cerebral' | 'uplifting' | 'surprise';

type MoodResult = {
  headline: string;
  summary: string;
  source: 'nexos' | 'curated';
  picks: Array<{
    id: number;
    mediaType: 'movie';
    title: string;
    year: string;
    rating: number;
    overview: string;
    posterUrl: string | null;
    href: string;
    why: string;
  }>;
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

export default function MoodMatch() {
  const [isMobile, setIsMobile] = useState(false);
  const [mood, setMood] = useState<Mood>('light');
  const [minutes, setMinutes] = useState<(typeof TIMES)[number]>(90);
  const [result, setResult] = useState<MoodResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => () => activeRequest.current?.abort(), []);

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

  if (!isMobile) return null;

  return (
    <section className="nxm-root" aria-labelledby="nxm-title">
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

      {result && (
        <div className="nxm-results">
          <div className="nxm-result-heading">
            <div>
              <h3>{result.headline}</h3>
              <p>{result.summary}</p>
            </div>
            <span className="nxm-source">{result.source === 'nexos' ? 'NexS AI' : 'Smart curated'}</span>
          </div>

          <div className="nxm-list" role="list">
            {result.picks.map((pick) => (
              <a className="nxm-card" href={pick.href} key={pick.id} role="listitem" aria-label={`View ${pick.title}`}>
                <div className="nxm-poster">
                  {pick.posterUrl ? (
                    <img src={pick.posterUrl} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span aria-hidden="true">▶</span>
                  )}
                </div>
                <div className="nxm-card-copy">
                  <div className="nxm-card-meta">
                    <h4>{pick.title}</h4>
                    <span>{pick.year}{pick.rating > 0 ? ` · ★ ${pick.rating}` : ''}</span>
                  </div>
                  <p>{pick.why}</p>
                  <span className="nxm-open">View details <span aria-hidden="true">→</span></span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
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
          .nxm-card:focus-visible {
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
          .nxm-source {
            flex: 0 0 auto;
            padding: 0.35rem 0.55rem;
            border-radius: 999px;
            background: color-mix(in srgb, var(--color-accent-from) 14%, transparent);
            color: color-mix(in srgb, var(--color-accent-from) 75%, white);
            font-size: 0.625rem;
            font-weight: 750;
            white-space: nowrap;
          }
          .nxm-list { display: grid; gap: 0.6rem; }
          .nxm-card {
            min-height: 112px;
            padding: 0.6rem;
            display: grid;
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 0.75rem;
            align-items: stretch;
            border: 0;
            border-radius: 14px;
            background: color-mix(in srgb, var(--color-text) 5%, transparent);
            color: inherit;
            text-decoration: none;
          }
          .nxm-poster {
            min-height: 96px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: color-mix(in srgb, var(--color-text) 8%, transparent);
            color: var(--color-text-3);
          }
          .nxm-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .nxm-card-copy { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
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
          .nxm-open {
            margin-top: 0.35rem;
            color: var(--color-accent-from);
            font-size: 0.68rem;
            font-weight: 700;
          }
        }

        @media (max-width: 380px) {
          .nxm-root { padding-inline: 0.875rem; }
          .nxm-choice { font-size: 0.72rem; }
          .nxm-options--time { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .nxm-card { grid-template-columns: 58px minmax(0, 1fr); gap: 0.625rem; }
        }

        @media (max-width: 768px) and (prefers-reduced-motion: reduce) {
          .nxm-choice { transition: none; }
          .nxm-spinner { animation-duration: 1.5s; }
        }
      `}</style>
    </section>
  );
}
