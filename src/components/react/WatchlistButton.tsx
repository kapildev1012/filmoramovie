import { useState, useEffect } from 'react';

interface Props {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  /** If provided, operations are server-persisted. If null, falls back to localStorage. */
  isAuthenticated?: boolean;
  /** Initial state (hydrated from server) */
  initialSaved?: boolean;
}

interface LocalWatchlistEntry {
  id: number;
  mediaType: string;
  title: string;
  posterPath: string | null;
  addedAt: string;
}

const STORAGE_KEY = 'filmora_watchlist';

function getLocalWatchlist(): LocalWatchlistEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalWatchlist(entries: LocalWatchlistEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export default function WatchlistButton({
  tmdbId,
  mediaType,
  title,
  posterPath,
  isAuthenticated = false,
  initialSaved = false,
}: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  // Hydrate from localStorage for unauthenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      const wl = getLocalWatchlist();
      setSaved(wl.some((e) => e.id === tmdbId && e.mediaType === mediaType));
    }
  }, [isAuthenticated, tmdbId, mediaType]);

  async function toggle() {
    if (loading) return;

    // Optimistic update
    const newSaved = !saved;
    setSaved(newSaved);
    setLoading(true);

    try {
      if (isAuthenticated) {
        // Server-persisted
        const method = newSaved ? 'POST' : 'DELETE';
        const res = await fetch('/api/watchlist', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId, mediaType, title, posterPath }),
        });
        if (!res.ok) {
          // Revert on error
          setSaved(!newSaved);
          console.error('Watchlist update failed');
        }
      } else {
        // localStorage fallback
        const wl = getLocalWatchlist();
        if (newSaved) {
          const entry: LocalWatchlistEntry = {
            id: tmdbId,
            mediaType,
            title,
            posterPath,
            addedAt: new Date().toISOString(),
          };
          saveLocalWatchlist([...wl, entry]);
        } else {
          saveLocalWatchlist(wl.filter((e) => !(e.id === tmdbId && e.mediaType === mediaType)));
        }
      }
    } catch {
      setSaved(!newSaved);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={`watchlist-btn ${saved ? 'watchlist-btn--saved' : ''}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
      title={
        !isAuthenticated
          ? 'Sign in to sync your watchlist across devices'
          : undefined
      }
    >
      {loading ? (
        <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : saved ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      )}
      <span>{saved ? 'Saved' : 'Watchlist'}</span>

      <style>{`
        .watchlist-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-text-2);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          font-family: inherit;
        }
        .watchlist-btn:hover:not(:disabled) {
          background: var(--color-surface-2);
          color: var(--color-text);
          border-color: var(--color-text-3);
        }
        .watchlist-btn--saved {
          background: var(--color-surface-2);
          color: var(--color-text);
          border-color: var(--color-text-3);
        }
        .watchlist-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </button>
  );
}
