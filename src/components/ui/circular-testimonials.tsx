// src/components/ui/circular-testimonials.tsx — 3D stacked card carousel.
//
// Three cards are visible at once: the active one flat and centred, its two
// neighbours pushed out sideways, lifted, scaled down and rotated on Y so the
// group reads as a shallow fan in perspective. Everything else is faded out.
//
// PORTED, NOT COPIED. Three changes from the upstream snippet, each forced by
// this codebase:
//   1. `react-icons` is not a dependency here and `lucide-react` is, so the
//      arrows are lucide's. One less package for two glyphs.
//   2. `<style jsx>` is a Next.js/styled-jsx feature. This is Astro + Vite, so
//      it is a plain `<style>` element — the same pattern the other components
//      in this folder use (gallery.tsx, pagination.tsx, card-fan-carousel.tsx).
//   3. The upstream class names (`.name`, `.quote`, `.image-container`) are
//      global once the styled-jsx scoping is gone and would collide with
//      player.css. They are namespaced `ct-` and nested under `.ct-root`.
//
// `calculateGap` and `getStackStyle` are exported because the player's mobile
// episode carousel (react/player/EpisodeCircle.tsx) is the same mechanic with
// different content, and the motion should stay identical between the two.

'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Testimonial {
  quote: string;
  name: string;
  designation: string;
  src: string;
}

interface Colors {
  name?: string;
  designation?: string;
  testimony?: string;
  arrowBackground?: string;
  arrowForeground?: string;
  arrowHoverBackground?: string;
}

interface FontSizes {
  name?: string;
  designation?: string;
  quote?: string;
}

interface CircularTestimonialsProps {
  testimonials: Testimonial[];
  autoplay?: boolean;
  colors?: Colors;
  fontSizes?: FontSizes;
}

/** How far the two flanking cards sit from the centre, in px. Grows with the
    container so a wide desktop fans wider than a phone instead of leaving the
    neighbours stacked on top of the middle card. */
export function calculateGap(width: number) {
  const minWidth = 1024;
  const maxWidth = 1456;
  const minGap = 60;
  const maxGap = 86;
  if (width <= minWidth) return minGap;
  if (width >= maxWidth) return Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
  return minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth));
}

/**
 * Transform for card `index` given the active one. Only the active card and its
 * two immediate neighbours are visible; the rest are transparent and
 * click-through so a 24-item season does not stack 21 invisible hit targets over
 * the artwork.
 */
export function getStackStyle(
  index: number,
  activeIndex: number,
  total: number,
  containerWidth: number,
): React.CSSProperties {
  const gap = calculateGap(containerWidth);
  const maxStickUp = gap * 0.8;
  const transition = 'all 0.8s cubic-bezier(.4,2,.3,1)';
  const isActive = index === activeIndex;
  const isLeft = (activeIndex - 1 + total) % total === index;
  const isRight = (activeIndex + 1) % total === index;

  if (isActive) {
    return {
      zIndex: 3,
      opacity: 1,
      pointerEvents: 'auto',
      transform: 'translateX(0px) translateY(0px) scale(1) rotateY(0deg)',
      transition,
    };
  }
  if (isLeft) {
    return {
      zIndex: 2,
      opacity: 1,
      pointerEvents: 'auto',
      transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`,
      transition,
    };
  }
  if (isRight) {
    return {
      zIndex: 2,
      opacity: 1,
      pointerEvents: 'auto',
      transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`,
      transition,
    };
  }
  return { zIndex: 1, opacity: 0, pointerEvents: 'none', transition };
}

export const CircularTestimonials = ({
  testimonials,
  autoplay = true,
  colors = {},
  fontSizes = {},
}: CircularTestimonialsProps) => {
  const colorName = colors.name ?? '#000';
  const colorDesignation = colors.designation ?? '#6b7280';
  const colorTestimony = colors.testimony ?? '#4b5563';
  const colorArrowBg = colors.arrowBackground ?? '#141414';
  const colorArrowFg = colors.arrowForeground ?? '#f1f1f7';
  const colorArrowHoverBg = colors.arrowHoverBackground ?? '#00a6fb';
  const fontSizeName = fontSizes.name ?? '1.5rem';
  const fontSizeDesignation = fontSizes.designation ?? '0.925rem';
  const fontSizeQuote = fontSizes.quote ?? '1.125rem';

  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  // Not `NodeJS.Timeout`: this builds for Cloudflare Workers, where the Node
  // global types are not in scope. The DOM/worker `setInterval` returns number.
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const testimonialsLength = useMemo(() => testimonials.length, [testimonials]);
  const activeTestimonial = useMemo(
    () => testimonials[activeIndex],
    [activeIndex, testimonials],
  );

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonialsLength);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonialsLength) % testimonialsLength);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  // Responsive gap: measure the track, not the window, so the fan is correct
  // inside a narrow column on a wide screen.
  useEffect(() => {
    function handleResize() {
      if (imageContainerRef.current) {
        setContainerWidth(imageContainerRef.current.offsetWidth);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (autoplay) {
      autoplayIntervalRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % testimonialsLength);
      }, 5000);
    }
    return () => {
      if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
    };
  }, [autoplay, testimonialsLength]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handlePrev, handleNext]);

  const quoteVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  if (testimonialsLength === 0 || !activeTestimonial) return null;

  return (
    <div className="ct-root">
      <div className="ct-grid">
        <div className="ct-images" ref={imageContainerRef}>
          {testimonials.map((testimonial, index) => (
            <img
              key={testimonial.src}
              src={testimonial.src}
              alt={testimonial.name}
              className="ct-image"
              data-index={index}
              style={getStackStyle(index, activeIndex, testimonialsLength, containerWidth)}
            />
          ))}
        </div>

        <div className="ct-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={quoteVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <h3 className="ct-name" style={{ color: colorName, fontSize: fontSizeName }}>
                {activeTestimonial.name}
              </h3>
              <p
                className="ct-designation"
                style={{ color: colorDesignation, fontSize: fontSizeDesignation }}
              >
                {activeTestimonial.designation}
              </p>
              <motion.p
                className="ct-quote"
                style={{ color: colorTestimony, fontSize: fontSizeQuote }}
              >
                {activeTestimonial.quote.split(' ').map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ filter: 'blur(10px)', opacity: 0, y: 5 }}
                    animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut', delay: 0.025 * i }}
                    style={{ display: 'inline-block' }}
                  >
                    {word}&nbsp;
                  </motion.span>
                ))}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          <div className="ct-arrows">
            <button
              type="button"
              className="ct-arrow"
              onClick={handlePrev}
              style={{ backgroundColor: hoverPrev ? colorArrowHoverBg : colorArrowBg }}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              aria-label="Previous testimonial"
            >
              <ArrowLeft size={28} color={colorArrowFg} />
            </button>
            <button
              type="button"
              className="ct-arrow"
              onClick={handleNext}
              style={{ backgroundColor: hoverNext ? colorArrowHoverBg : colorArrowBg }}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              aria-label="Next testimonial"
            >
              <ArrowRight size={28} color={colorArrowFg} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .ct-root { width: 100%; max-width: 56rem; padding: 2rem; }
        .ct-root .ct-grid { display: grid; gap: 5rem; }
        .ct-root .ct-images {
          position: relative; width: 100%; height: 24rem; perspective: 1000px;
        }
        .ct-root .ct-image {
          position: absolute; width: 100%; height: 100%; object-fit: cover;
          border-radius: 1.5rem; box-shadow: 0 10px 30px rgb(0 0 0 / 0.2);
        }
        .ct-root .ct-content {
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .ct-root .ct-name { font-weight: 700; margin-bottom: 0.25rem; }
        .ct-root .ct-designation { margin-bottom: 2rem; }
        .ct-root .ct-quote { line-height: 1.75; }
        .ct-root .ct-arrows { display: flex; gap: 1.5rem; padding-top: 3rem; }
        .ct-root .ct-arrow {
          width: 2.7rem; height: 2.7rem; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; cursor: pointer;
          transition: background-color 0.3s; border: none;
        }
        @media (min-width: 768px) {
          .ct-root .ct-grid { grid-template-columns: 1fr 1fr; }
          .ct-root .ct-arrows { padding-top: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ct-root .ct-image { transition: none !important; }
        }
      `}</style>
    </div>
  );
};

export default CircularTestimonials;
