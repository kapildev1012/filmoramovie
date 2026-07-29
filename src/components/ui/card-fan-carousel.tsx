import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export interface CardItem {
  imgUrl: string;
  alt?: string;
  subtitle?: string;
  linkUrl?: string;
}

interface CardFanCarouselProps {
  cards: CardItem[];
}

const MAX_VISIBLE = 7;
const HALF = 3;
const FAN_POSITIONS = [
  { rot: -21, scale: 0.776, x: -30, y: 7.3, zIndex: 1 },
  { rot: -14, scale: 0.85, x: -22, y: 4, zIndex: 2 },
  { rot: -7, scale: 0.935, x: -11, y: 1.3, zIndex: 3 },
  { rot: 0, scale: 1, x: 0, y: 0, zIndex: 10 },
  { rot: 7, scale: 0.935, x: 11, y: 1.3, zIndex: 3 },
  { rot: 14, scale: 0.85, x: 22, y: 4, zIndex: 2 },
  { rot: 21, scale: 0.776, x: 30, y: 7.3, zIndex: 1 },
] as const;

function responsiveMultiplier(width: number): number {
  if (width < 400) return 0.25;
  if (width < 480) return 0.29;
  if (width < 640) return 0.38;
  if (width < 768) return 0.5;
  if (width < 1024) return 0.72;
  if (width < 1280) return 0.88;
  return 1;
}

function heightMultiplier(width: number): number {
  const ideal = width < 480 ? 340 : width < 768 ? 430 : width < 1024 ? 520 : 600;
  return Math.min(1, (window.innerHeight * 0.68) / ideal);
}

function slotConfig(total: number, slot: number) {
  if (total >= MAX_VISIBLE) return FAN_POSITIONS[slot]!;
  const center = (total - 1) / 2;
  const distance = center > 0 ? (slot - center) / center : 0;
  const absolute = Math.abs(distance);
  return {
    rot: distance * 21,
    scale: 1 - 0.224 * absolute * absolute,
    x: distance * 30,
    y: absolute * absolute * 7.3,
    zIndex: 10 - Math.round(Math.abs(slot - center)),
  };
}

export default function CardFanCarousel({ cards }: CardFanCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  const entered = useRef(false);
  const directionRef = useRef<'left' | 'right' | null>(null);
  const previousVisible = useRef<Set<number>>(new Set());
  const total = cards.length;
  const paginated = total > MAX_VISIBLE;
  const [centerIndex, setCenterIndex] = useState(paginated ? HALF : Math.floor(total / 2));

  const visibleMap = useCallback((center: number) => {
    const map = new Map<number, number>();
    if (!paginated) {
      cards.forEach((_, index) => map.set(index, index));
      return map;
    }
    for (let slot = 0; slot < MAX_VISIBLE; slot += 1) {
      map.set(((center + slot - HALF) % total + total) % total, slot);
    }
    return map;
  }, [cards, paginated, total]);

  const cycle = useCallback((direction: 'left' | 'right') => {
    if (!paginated || animating.current) return;
    animating.current = true;
    directionRef.current = direction;
    setCenterIndex((current) => direction === 'right'
      ? (current + 1) % total
      : (current - 1 + total) % total);
  }, [paginated, total]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || total === 0) return;
    const elements = Array.from(container.querySelectorAll<HTMLElement>('.fan-card'));
    const currentVisible = visibleMap(centerIndex);
    const oldVisible = previousVisible.current;
    const firstMount = !entered.current;
    const direction = directionRef.current;
    const multiplier = responsiveMultiplier(window.innerWidth);
    const vertical = heightMultiplier(window.innerWidth);
    const slots = paginated ? MAX_VISIBLE : total;
    const config = (slot: number) => slotConfig(slots, slot);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (firstMount) animating.current = true;
    let finished = 0;
    const done = () => {
      finished += 1;
      if (finished >= currentVisible.size) {
        animating.current = false;
        entered.current = true;
      }
    };

    elements.forEach((element, cardIndex) => {
      const slot = currentVisible.get(cardIndex);
      const wasVisible = oldVisible.has(cardIndex);
      if (slot === undefined) {
        if (wasVisible && !reduceMotion) {
          gsap.to(element, {
            x: `${direction === 'right' ? -40 : 40}rem`,
            rotation: direction === 'right' ? -30 : 30,
            scale: 0.5,
            opacity: 0,
            zIndex: 0,
            duration: 0.38,
            ease: 'power2.in',
          });
        } else {
          gsap.set(element, { opacity: 0, scale: 0.4, zIndex: 0 });
        }
        return;
      }

      const base = config(slot);
      const target = {
        x: `${base.x * multiplier}rem`,
        y: `${base.y * vertical}rem`,
        rotation: base.rot,
        scale: base.scale,
        opacity: 1,
        zIndex: base.zIndex,
      };
      if (reduceMotion) {
        gsap.set(element, target);
        done();
      } else if (firstMount) {
        gsap.set(element, { x: 0, y: `${10 * vertical}rem`, rotation: 0, scale: 0.55, opacity: 0 });
        gsap.to(element, {
          ...target,
          duration: 1.05,
          delay: 0.12 + slot * 0.055,
          ease: 'elastic.out(1.05,.78)',
          onComplete: done,
        });
      } else if (!wasVisible) {
        gsap.set(element, {
          x: `${direction === 'right' ? 38 : -38}rem`,
          y: `${base.y * vertical}rem`,
          rotation: direction === 'right' ? 28 : -28,
          scale: 0.5,
          opacity: 0,
        });
        gsap.to(element, { ...target, duration: 0.56, ease: 'power2.out', onComplete: done });
      } else {
        gsap.to(element, { ...target, duration: 0.48, ease: 'power2.out', onComplete: done });
      }
    });

    previousVisible.current = new Set(currentVisible.keys());

    const entries = elements
      .map((element, index) => ({ element, slot: currentVisible.get(index) }))
      .filter((entry): entry is { element: HTMLElement; slot: number } => entry.slot !== undefined)
      .sort((a, b) => a.slot - b.slot);
    const centerSlot = (entries.length - 1) / 2;
    let activeSlot: number | null = null;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;

    const updateHover = (hovered: number | null) => {
      if (reduceMotion) return;
      const mult = responsiveMultiplier(window.innerWidth);
      const yMult = heightMultiplier(window.innerWidth);
      entries.forEach(({ element, slot }) => {
        const base = config(slot);
        const distance = hovered === null ? 0 : Math.abs(slot - hovered);
        let x = base.x * mult;
        let y = base.y * yMult;
        let rotation = base.rot;
        let scale = base.scale;

        if (hovered !== null && slot === hovered) {
          y -= 2.4 * yMult;
          scale *= 1.075;
        } else if (hovered !== null) {
          const push = 7 * (1 - Math.min(1, Math.abs(slot - centerSlot) / Math.max(centerSlot, 1)));
          x += (slot < hovered ? -push : push) * mult;
          rotation += (slot < hovered ? -1 : 1) * (3 / (distance + 1));
        }

        gsap.to(element, {
          x: `${x}rem`, y: `${y}rem`, rotation, scale,
          duration: 0.45, delay: distance * 0.018,
          ease: 'elastic.out(1,.78)', overwrite: 'auto',
        });
        gsap.set(element, { zIndex: hovered === slot ? 20 : base.zIndex });
      });
    };

    const listeners = entries.map(({ element, slot }) => {
      const enter = () => {
        if (animating.current) return;
        if (leaveTimer) clearTimeout(leaveTimer);
        activeSlot = slot;
        updateHover(slot);
      };
      element.addEventListener('mouseenter', enter);
      return { element, enter };
    });
    const leave = () => {
      if (animating.current) return;
      leaveTimer = setTimeout(() => {
        activeSlot = null;
        updateHover(null);
      }, 45);
    };
    const resize = () => {
      if (!animating.current) updateHover(activeSlot);
    };
    container.addEventListener('mouseleave', leave);
    window.addEventListener('resize', resize);

    return () => {
      listeners.forEach(({ element, enter }) => element.removeEventListener('mouseenter', enter));
      container.removeEventListener('mouseleave', leave);
      window.removeEventListener('resize', resize);
      if (leaveTimer) clearTimeout(leaveTimer);
      gsap.killTweensOf(elements);
    };
  }, [centerIndex, paginated, total, visibleMap]);

  if (total === 0) return null;

  return (
    <div className="fan-carousel" aria-label="Cast carousel">
      <div ref={containerRef} className="fan-stage">
        {cards.map((card, index) => {
          const content = (
            <>
              <img src={card.imgUrl} alt={card.alt ?? `Cast member ${index + 1}`} loading="lazy" />
              <span className="fan-card-scrim" aria-hidden="true" />
              {(card.alt || card.subtitle) && (
                <span className="fan-card-copy">
                  {card.alt && <b>{card.alt}</b>}
                  {card.subtitle && <small>{card.subtitle}</small>}
                </span>
              )}
            </>
          );
          return card.linkUrl ? (
            <a key={`${card.imgUrl}-${index}`} className="fan-card" href={card.linkUrl} aria-label={card.alt}>{content}</a>
          ) : (
            <div key={`${card.imgUrl}-${index}`} className="fan-card">{content}</div>
          );
        })}
      </div>

      {paginated && (
        <div className="fan-controls">
          <button type="button" onClick={() => cycle('left')} aria-label="Previous cast member">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="fan-dots" aria-hidden="true">
            {cards.map((_, index) => <span key={index} className={index === centerIndex ? 'is-active' : ''} />)}
          </div>
          <button type="button" onClick={() => cycle('right')} aria-label="Next cast member">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <style>{`
        .fan-carousel { width: 100%; padding: 0.5rem 0 1rem; overflow: hidden; }
        .fan-stage {
          position: relative; display: flex; align-items: flex-start; justify-content: center;
          width: 100%; height: clamp(18rem, 40vw, 36rem); max-width: 80rem; margin-inline: auto;
        }
        .fan-card {
          position: absolute; display: block; width: clamp(8rem, 15vw, 12rem);
          aspect-ratio: 2 / 3; overflow: hidden; border-radius: clamp(0.75rem, 1.4vw, 1.125rem);
          background: var(--color-surface-2); color: #fff; opacity: 0;
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 50px rgba(0,0,0,0.42); transform-origin: center bottom;
          text-decoration: none; will-change: transform, opacity;
        }
        .fan-card img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: cover; }
        .fan-card-scrim { position: absolute; inset: 42% 0 0; background: linear-gradient(to top, rgba(0,0,0,0.92), transparent); }
        .fan-card-copy { position: absolute; z-index: 2; inset: auto 0 0; display: flex; flex-direction: column; gap: 0.15rem; padding: 1rem 0.7rem 0.75rem; text-align: center; }
        .fan-card-copy b { overflow: hidden; font-size: 0.8125rem; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
        .fan-card-copy small { overflow: hidden; color: rgba(255,255,255,0.68); font-size: 0.65rem; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
        .fan-controls { position: relative; z-index: 30; display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: -1rem; }
        .fan-controls button {
          position: relative; display: grid; place-items: center; width: 3rem; height: 3rem; padding: 0;
          border: 1px solid color-mix(in srgb, var(--color-text) 13%, transparent); border-radius: 999px;
          background: color-mix(in srgb, var(--color-text) 6%, transparent); color: var(--color-text-2);
          -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); cursor: pointer;
          box-shadow: 0 4px 20px rgba(0,0,0,0.18); transition: color 180ms ease, border-color 180ms ease, transform 180ms ease;
        }
        .fan-controls button:hover { color: var(--color-text); border-color: color-mix(in srgb, var(--color-text) 30%, transparent); transform: scale(1.06); }
        .fan-controls button:focus-visible { outline: 2px solid var(--color-accent-from); outline-offset: 3px; }
        .fan-controls svg { width: 1.15rem; height: 1.15rem; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
        .fan-dots { display: flex; align-items: center; justify-content: center; gap: 0.4rem; max-width: min(48vw, 18rem); flex-wrap: wrap; }
        .fan-dots span { width: 0.38rem; height: 0.38rem; border-radius: 50%; background: color-mix(in srgb, var(--color-text) 18%, transparent); transition: transform 250ms ease, background 250ms ease; }
        .fan-dots span.is-active { background: var(--color-text); transform: scale(1.45); }
        @media (max-width: 639px) {
          .fan-carousel { width: calc(100% + 2rem); margin-inline: -1rem; }
          .fan-stage { height: 18.5rem; }
          .fan-card { width: 8rem; border-radius: 0.8rem; }
          .fan-card-copy { padding: 0.8rem 0.45rem 0.55rem; }
          .fan-card-copy b { font-size: 0.7rem; }
          .fan-card-copy small { font-size: 0.58rem; }
          .fan-controls { margin-top: -0.25rem; gap: 0.7rem; }
          .fan-controls button { width: 2.75rem; height: 2.75rem; }
          .fan-dots { max-width: 44vw; gap: 0.3rem; }
          .fan-dots span { width: 0.32rem; height: 0.32rem; }
        }
      `}</style>
    </div>
  );
}
