'use client';

import { useState, useEffect, useRef, lazy, Suspense } from 'react';

/**
 * The WebGL gallery (three.js + @react-three/fiber + drei) is ~870 kB of
 * JavaScript — more than the rest of the site put together. It used to be a
 * static import, which meant every single page navigation paid for the whole
 * three.js bundle plus a fresh WebGL context before this island could render,
 * even on phones and even when the section sat far below the fold.
 *
 * It is now a dynamic import behind an IntersectionObserver: the section shell,
 * headline and hint below are plain server-rendered markup, and the canvas
 * chunk is only requested once the section is actually approaching the
 * viewport. Same gallery, same props, same visuals — just not on the critical
 * path of a navigation.
 */
const InfiniteGallery = lazy(() => import('../ui/3d-gallery-photography'));

interface Props {
  images?: string[];
}

// Unsplash sample images matching the demo
const DEMO_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1741332966416-414d8a5b8887?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2fHx8ZW58MHx8fHx8',
    alt: 'Image 1',
  },
  {
    src: 'https://images.unsplash.com/photo-1754769440490-2eb64d715775?q=80&w=1113&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 2',
  },
  {
    src: 'https://images.unsplash.com/photo-1758640920659-0bb864175983?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzNHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 3',
  },
  {
    src: 'https://plus.unsplash.com/premium_photo-1758367454070-731d3cc11774?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0MXx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 4',
  },
  {
    src: 'https://images.unsplash.com/photo-1746023841657-e5cd7cc90d2c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0Nnx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 5',
  },
  {
    src: 'https://images.unsplash.com/photo-1741715661559-6149723ea89a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1MHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 6',
  },
  {
    src: 'https://images.unsplash.com/photo-1725878746053-407492aa4034?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1OHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 7',
  },
  {
    src: 'https://images.unsplash.com/photo-1752588975168-d2d7965a6d64?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2M3x8fGVufDB8fHx8fA%3D%3D',
    alt: 'Image 8',
  },
];

/**
 * FeaturedGallery — cinematic 3D gallery section with centred headline.
 * Uses the Unsplash images from the demo as the default backdrop.
 * Prop `images` is optional; if omitted the demo images are used.
 */
export default function FeaturedGallery({ images }: Props) {
  // Phones get the gallery too, but not the desktop configuration: fewer
  // simultaneous planes, a shorter section and a tighter depth falloff — enough
  // to keep the effect while cutting the per-frame work on the GPU a phone
  // actually has.
  //
  // Resolved in an effect rather than during the first render because this
  // island is now server-rendered (it used to be client:only, which forced
  // Astro to reload the whole target page in a hidden iframe on every
  // view-transition navigation — see prepareForClientOnlyComponents in
  // astro/dist/transitions/router.js). `false` matches the desktop layout the
  // server emits; phones correct it on the first client tick, before the canvas
  // is ever mounted.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Only mount the WebGL canvas once the section is near the viewport. This is
  // what keeps three.js off the navigation critical path.
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      // Start loading a little before it scrolls in so the canvas is ready by
      // the time the section is actually on screen.
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Convert plain string URLs to the { src, alt } format the gallery expects.
  const galleryImages =
    images && images.length
      ? images.map((src, i) => ({ src, alt: `Gallery image ${i + 1}` }))
      : DEMO_IMAGES;

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        // Shorter on phones so the section does not eat a whole screen of scroll.
        height: isMobile ? 'clamp(260px, 52vh, 420px)' : 'clamp(320px, 65vw, 900px)',
        overflow: 'hidden',
        background: '#000',
      }}
      aria-label="Featured gallery"
    >
      {/* 3D gallery fills the entire section — mounted on approach, not on load */}
      {inView && (
        <Suspense fallback={null}>
          <InfiniteGallery
            images={galleryImages}
            speed={isMobile ? 0.9 : 1.2}
            zSpacing={3}
            // 12 planes in flight is a desktop budget; 6 keeps phones smooth.
            visibleCount={isMobile ? 6 : 12}
            falloff={isMobile ? { near: 0.8, far: 9 } : { near: 0.8, far: 14 }}
            className="h-full w-full rounded-lg overflow-hidden"
          />
        </Suspense>
      )}

      {/* Centred serif headline with mix-blend exclusion */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1rem',
          pointerEvents: 'none',
          mixBlendMode: 'exclusion',
          color: '#fff',
        }}
        aria-hidden="true"
      >
        <h2
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 'clamp(1.5rem, 6vw, 4.5rem)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          <em>I create;</em> therefore I am
        </h2>
      </div>

      {/* Bottom navigation hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          textTransform: 'uppercase',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: '#fff',
          pointerEvents: 'none',
          padding: '0 1rem',
        }}
      >
        <p style={{ margin: 0 }}>Swipe or scroll to navigate</p>
        <p style={{ margin: '0.15rem 0 0', opacity: 0.5 }}>
          Auto-play resumes after 3 seconds
        </p>
      </div>
    </section>
  );
}
