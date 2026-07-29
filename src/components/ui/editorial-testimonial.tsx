import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type EditorialVariant = 'testimonials' | 'features';

interface EditorialItem {
  id: number;
  quote: string;
  author: string;
  role: string;
  company: string;
  image: string;
}

const testimonialItems: EditorialItem[] = [
  {
    id: 1,
    quote: "Finally, one place shows what is trending across every major platform. Movie night takes minutes to plan instead of an hour.",
    author: 'Briana Patton',
    role: 'Binge-watcher',
    company: 'FilmoraMovies member',
    image: 'https://randomuser.me/api/portraits/women/1.jpg',
  },
  {
    id: 2,
    quote: 'The HD playback feels instant and search actually finds what I want. I discovered three new series in my first week.',
    author: 'Bilal Ahmed',
    role: 'Film enthusiast',
    company: 'Weekly viewer',
    image: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
  {
    id: 3,
    quote: 'Clean, fast, and uncluttered on both my phone and television. Multi-language subtitles make world cinema much easier to enjoy.',
    author: 'Saman Malik',
    role: 'World cinema fan',
    company: 'Mobile streamer',
    image: 'https://randomuser.me/api/portraits/women/3.jpg',
  },
  {
    id: 4,
    quote: 'The watchlist, daily Top 10 rails, and continue-watching row make this the first site I open whenever I have a free evening.',
    author: 'Hassan Ali',
    role: 'Daily viewer',
    company: 'FilmoraMovies member',
    image: 'https://randomuser.me/api/portraits/men/9.jpg',
  },
];

const featureItems: EditorialItem[] = [
  {
    id: 1,
    quote: 'High-speed dedicated servers keep video playback fast and responsive, with automatic fallback when a source is unavailable — even during busy viewing hours.',
    author: '0ms Buffering',
    role: 'The Ultimate Free Streaming Destination',
    company: 'Fast playback',
    image: 'https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=900&auto=format&fit=crop&q=75',
  },
  {
    id: 2,
    quote: 'Thousands of titles are organized for effortless browsing across action, drama, comedy, horror, animation, romance, science fiction, and more.',
    author: 'Every Genre',
    role: 'A Diverse Entertainment Library',
    company: 'Movies and series',
    image: 'https://images.unsplash.com/photo-1574267432553-4b462808152a?w=900&auto=format&fit=crop&q=75',
  },
  {
    id: 3,
    quote: 'Entire seasons are ready on demand, with episode navigation and seamless continuation that make long-form stories easy to binge from start to finale.',
    author: 'Binge-Watch',
    role: 'Trending TV Shows',
    company: 'Complete seasons',
    image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=900&auto=format&fit=crop&q=75',
  },
  {
    id: 4,
    quote: 'Enjoy HD and select 4K playback across desktop, laptop, mobile, tablet, and smart-TV browsers, with multi-language subtitle support when sources provide it.',
    author: 'Watch Anywhere',
    role: 'Everything You Need to Stream',
    company: 'Cross-device viewing',
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=900&auto=format&fit=crop&q=75',
  },
];

interface Props {
  variant?: EditorialVariant;
}

export default function TestimonialsEditorial({ variant = 'testimonials' }: Props) {
  const items = variant === 'features' ? featureItems : testimonialItems;
  const [active, setActive] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const swapTimer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
  }, []);

  const handleChange = useCallback((index: number) => {
    if (index === active || isTransitioning) return;
    setIsTransitioning(true);
    swapTimer.current = window.setTimeout(() => {
      setActive(index);
      settleTimer.current = window.setTimeout(() => setIsTransitioning(false), 50);
    }, 260);
  }, [active, isTransitioning]);

  const handlePrev = () => handleChange(active === 0 ? items.length - 1 : active - 1);
  const handleNext = () => handleChange(active === items.length - 1 ? 0 : active + 1);
  const current = items[active]!;
  const prefix = variant === 'features' ? 'Feature' : 'Testimonial';

  return (
    <section className="editorial" aria-label={`${prefix} carousel`}>
      <div className="editorial-main">
        <span className="editorial-index" aria-hidden="true">
          {String(active + 1).padStart(2, '0')}
        </span>

        <div className="editorial-copy">
          <blockquote className={`editorial-quote${isTransitioning ? ' is-leaving' : ''}`}>
            “{current.quote}”
          </blockquote>

          <div className={`editorial-person${isTransitioning ? ' is-leaving' : ''}`}>
            <div className="editorial-avatar-wrap">
              <img
                src={current.image}
                alt=""
                width="64"
                height="64"
                loading="lazy"
                className="editorial-avatar"
              />
            </div>
            <div className="editorial-byline">
              <p className="editorial-author">{current.author}</p>
              <p className="editorial-role">
                {current.role}<span aria-hidden="true"> / </span><b>{current.company}</b>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="editorial-nav">
        <div className="editorial-progress">
          <div className="editorial-lines" role="group" aria-label={`Choose ${prefix.toLowerCase()}`}>
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleChange(itemIndex)}
                className={itemIndex === active ? 'is-active' : ''}
                aria-label={`${prefix} ${itemIndex + 1}: ${item.author}`}
                aria-current={itemIndex === active ? 'true' : undefined}
              >
                <span />
              </button>
            ))}
          </div>
          <span className="editorial-count">
            {String(active + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
        </div>

        <div className="editorial-arrows">
          <button type="button" onClick={handlePrev} aria-label={`Previous ${prefix.toLowerCase()}`}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={handleNext} aria-label={`Next ${prefix.toLowerCase()}`}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <style>{`
        .editorial {
          width: min(100%, 62rem);
          margin-inline: auto;
          padding: clamp(1.5rem, 5vw, 4rem) clamp(0.25rem, 3vw, 1.5rem);
          color: var(--color-text);
        }
        .editorial-main {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          gap: clamp(1rem, 4vw, 3rem);
        }
        .editorial-index {
          min-width: 1.25em;
          color: color-mix(in srgb, var(--color-text) 12%, transparent);
          font-size: clamp(4rem, 10vw, 7.5rem);
          font-weight: 300;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.07em;
          line-height: 0.88;
          user-select: none;
          transition: color 350ms ease;
        }
        .editorial-copy { min-width: 0; padding-top: clamp(0.25rem, 1.8vw, 1.5rem); }
        .editorial-quote {
          min-height: 4.5em;
          margin: 0;
          color: var(--color-text);
          font-size: clamp(1.35rem, 3.1vw, 2.15rem);
          font-weight: 300;
          line-height: 1.48;
          letter-spacing: -0.025em;
          text-wrap: balance;
          transition: opacity 260ms ease, transform 260ms ease;
        }
        .editorial-quote.is-leaving { opacity: 0; transform: translateX(1rem); }
        .editorial-person {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: clamp(1.5rem, 4vw, 2.5rem);
          transition: opacity 220ms ease 60ms;
        }
        .editorial-person.is-leaving { opacity: 0; transition-delay: 0ms; }
        .editorial-avatar-wrap {
          width: 3.5rem;
          height: 3.5rem;
          flex: 0 0 auto;
          overflow: hidden;
          border-radius: 999px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-text) 10%, transparent);
          transition: box-shadow 300ms ease;
        }
        .editorial-person:hover .editorial-avatar-wrap {
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-text) 30%, transparent);
        }
        .editorial-avatar {
          width: 100%; height: 100%; display: block; object-fit: cover;
          filter: grayscale(1); transition: filter 450ms ease, transform 450ms ease;
        }
        .editorial-person:hover .editorial-avatar { filter: grayscale(0); transform: scale(1.05); }
        .editorial-author { margin: 0; color: var(--color-text); font-size: 1rem; font-weight: 650; }
        .editorial-role { margin: 0.2rem 0 0; color: var(--color-text-3); font-size: 0.8125rem; line-height: 1.45; }
        .editorial-role span { margin-inline: 0.4rem; opacity: 0.45; }
        .editorial-role b { color: var(--color-text-2); font-weight: 500; }
        .editorial-nav {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          margin-top: clamp(2rem, 6vw, 4rem);
        }
        .editorial-progress, .editorial-lines, .editorial-arrows { display: flex; align-items: center; }
        .editorial-progress { gap: clamp(0.75rem, 3vw, 1.5rem); min-width: 0; }
        .editorial-lines { gap: 0.35rem; }
        .editorial-lines button {
          display: grid; place-items: center; min-width: 2rem; min-height: 2.75rem;
          padding: 0; border: 0; background: transparent; cursor: pointer;
        }
        .editorial-lines button span {
          display: block; width: 1.5rem; height: 2px; border-radius: 999px;
          background: color-mix(in srgb, var(--color-text) 20%, transparent);
          transition: width 400ms ease, background 300ms ease;
        }
        .editorial-lines button:hover span { width: 2rem; background: color-mix(in srgb, var(--color-text) 45%, transparent); }
        .editorial-lines button.is-active span { width: 3rem; background: var(--color-text); }
        .editorial-count {
          color: var(--color-text-3); font-size: 0.6875rem;
          font-variant-numeric: tabular-nums; letter-spacing: 0.13em; white-space: nowrap;
        }
        .editorial-arrows { gap: 0.25rem; }
        .editorial-arrows button {
          display: grid; place-items: center; width: 2.75rem; height: 2.75rem;
          padding: 0; border: 0; border-radius: 999px; background: transparent;
          color: var(--color-text-3); cursor: pointer;
          transition: color 180ms ease, background 180ms ease, transform 180ms ease;
        }
        .editorial-arrows button:hover { color: var(--color-text); background: color-mix(in srgb, var(--color-text) 7%, transparent); transform: scale(1.05); }
        .editorial-arrows svg { width: 1.25rem; height: 1.25rem; }
        .editorial-lines button:focus-visible, .editorial-arrows button:focus-visible {
          outline: 2px solid var(--color-accent-from); outline-offset: 2px;
        }
        @media (max-width: 639px) {
          .editorial { padding: 1.25rem 0 2rem; }
          .editorial-main { grid-template-columns: 1fr; gap: 0.75rem; }
          .editorial-index { min-width: 0; font-size: 3.75rem; line-height: 1; }
          .editorial-copy { padding-top: 0; }
          .editorial-quote { min-height: 7.2em; font-size: clamp(1.2rem, 5.8vw, 1.55rem); line-height: 1.5; text-wrap: pretty; }
          .editorial-person { margin-top: 1.25rem; align-items: flex-start; }
          .editorial-avatar-wrap { width: 3rem; height: 3rem; }
          .editorial-role span { display: none; }
          .editorial-role b { display: block; margin-top: 0.1rem; }
          .editorial-nav { margin-top: 1.5rem; align-items: flex-end; }
          .editorial-progress { flex-direction: column; align-items: flex-start; gap: 0.15rem; }
          .editorial-lines { gap: 0.1rem; }
          .editorial-lines button { min-width: 1.6rem; min-height: 2.25rem; }
          .editorial-lines button span { width: 1.1rem; }
          .editorial-lines button.is-active span { width: 2.2rem; }
          .editorial-count { padding-left: 0.15rem; }
          .editorial-arrows button { width: 2.75rem; height: 2.75rem; background: color-mix(in srgb, var(--color-text) 5%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .editorial *, .editorial *::before, .editorial *::after { transition-duration: 0.01ms !important; }
        }
      `}</style>
    </section>
  );
}
