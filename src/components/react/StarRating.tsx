import { useState } from 'react';

interface Props {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  initialRating?: number;
  isAuthenticated?: boolean;
  onRated?: (rating: number) => void;
}

export default function StarRating({
  tmdbId,
  mediaType,
  initialRating = 0,
  isAuthenticated = false,
  onRated,
}: Props) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const displayed = hover || rating;

  async function handleRate(value: number) {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      setTimeout(() => setShowAuthPrompt(false), 3000);
      return;
    }

    if (loading) return;

    const newRating = value === rating ? 0 : value; // toggle off
    setRating(newRating);
    setLoading(true);

    try {
      const method = newRating === 0 ? 'DELETE' : 'POST';
      const res = await fetch('/api/rating', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId, mediaType, rating: newRating }),
      });
      if (!res.ok) {
        setRating(rating); // revert
      } else {
        onRated?.(newRating);
      }
    } catch {
      setRating(rating); // revert
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="star-rating" role="group" aria-label={`Rate this title. Current rating: ${rating} stars`}>
      <div className="stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star ${displayed >= star ? 'star--filled' : ''} ${loading ? 'star--loading' : ''}`}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHover(star)}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            aria-pressed={rating === star}
            disabled={loading}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={displayed >= star ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>

      {showAuthPrompt && (
        <p className="auth-prompt" role="alert">
          <a href="/login">Sign in</a> to rate titles.
        </p>
      )}

      {rating > 0 && (
        <span className="rating-label">
          {rating}/5
        </span>
      )}

      <style>{`
        .star-rating {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .stars {
          display: flex;
          gap: 0.125rem;
        }
        .star {
          background: none;
          border: none;
          padding: 0.125rem;
          cursor: pointer;
          color: var(--color-text-3);
          transition: color 0.1s ease, transform 0.1s ease;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
        }
        .star:hover:not(:disabled),
        .star--filled {
          color: var(--color-success);
        }
        .star:hover:not(:disabled) {
          transform: scale(1.15);
        }
        .star:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .star--loading {
          opacity: 0.6;
        }
        .auth-prompt {
          font-size: 0.8125rem;
          color: var(--color-text-3);
          margin: 0;
        }
        .auth-prompt a {
          color: var(--color-accent-from);
          text-decoration: none;
        }
        .auth-prompt a:hover {
          text-decoration: underline;
        }
        .rating-label {
          font-size: 0.8125rem;
          color: var(--color-success);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
