// src/components/react/player/usePlatform.ts — the one place that decides which
// EXPERIENCE the viewer gets.
//
// WHY A SINGLE HOOK
// Before this, "which platform am I on" was answered in three unrelated places:
// PlayerShell's ResizeObserver (compact/regular/wide), SourceBar's own
// `useCompactViewport`, and a scatter of `@media (pointer: coarse)` rules in the
// CSS. Those answer "how much room is there / can this pointer hover" — genuine
// responsive questions. They do NOT answer "should this be the immersive native
// app or the lean-back web page", which is a product decision that has to be made
// once and threaded through, so mobile and desktop can be two purpose-built
// experiences instead of one layout stretched.
//
// BOUNDARY
// 47.99rem (≈768px) is deliberate: it is the exact width at which the detail
// pages already switch — below it they hide the Trailer / Cast / Details sections
// (`detail-hide-mobile`) and present a content-first page, above it they surround
// the player with metadata. Reusing that line keeps the player's "mobile app vs
// web" split in step with the page it lives in, rather than inventing a second,
// conflicting breakpoint.
//
// SSR
// Defaults to 'desktop' so the server render and the first client render agree
// (no hydration mismatch); the browser refines it immediately after mount. The
// immersive takeover only ever engages AFTER the viewer presses Play — long past
// hydration — so a phone never flashes the desktop layout on the way in.

import { useEffect, useState } from 'react';

export type Platform = 'mobile' | 'desktop';

/** Matches the detail page's own mobile boundary. Kept in px-equivalent rem so
 *  it tracks the root font size the same way the CSS breakpoints do. */
const MOBILE_QUERY = '(max-width: 47.99rem)';

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setPlatform(query.matches ? 'mobile' : 'desktop');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return platform;
}
