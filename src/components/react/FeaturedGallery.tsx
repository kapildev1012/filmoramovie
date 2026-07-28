'use client';

import {
  Component,
  useState,
  useEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
  type ReactNode,
} from 'react';

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
  'https://images.unsplash.com/photo-1741332966416-414d8a5b8887?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2fHx8ZW58MHx8fHx8',
  'https://images.unsplash.com/photo-1754769440490-2eb64d715775?q=80&w=1113&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1758640920659-0bb864175983?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzNHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1758367454070-731d3cc11774?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0MXx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1746023841657-e5cd7cc90d2c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0Nnx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1741715661559-6149723ea89a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1MHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1725878746053-407492aa4034?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1OHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1752588975168-d2d7965a6d64?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2M3x8fGVufDB8fHx8fA%3D%3D',
];

/**
 * WebGL textures must be fetched with CORS (three's loaders set
 * `crossOrigin = 'anonymous'`), but the very same URLs are also rendered as
 * plain `<img>` elsewhere on the page — CinematicGallery gets handed the exact
 * same list, and movie/series pages show the same backdrops in their hero. A
 * plain `<img>` response is cached *without* CORS, and whichever request lands
 * first wins the cache entry: when the plain `<img>` wins, three's request is
 * served the cached opaque response, fails the CORS check ("No
 * 'Access-Control-Allow-Origin' header is present" even though the CDN does
 * send it), and `useTexture` throws during render — which tore down the whole
 * island, so the section vanished from the page entirely.
 *
 * Adding a query parameter gives the texture request its own cache entry, so it
 * can never be served the poisoned non-CORS response. Both image hosts we use
 * (image.tmdb.org and images.unsplash.com) ignore unknown query params.
 */
function toTextureUrl(src: string): string {
  if (!/^https?:\/\//i.test(src)) return src;
  return src + (src.includes('?') ? '&' : '?') + 'fgtex=1';
}

/**
 * Load the candidate textures as CORS images up front and keep only the ones
 * that actually decode. `useTexture` suspends and then *throws* on a failed
 * load, so by the time the canvas mounts every URL it is given is known-good
 * and already warm in the HTTP cache.
 */
function useCorsReadyImages(sources: string[]): string[] | null {
  const key = sources.join('|');
  const [ready, setReady] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(null);

    const probe = (src: string) =>
      new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve(src);
        img.onerror = () => resolve(null);
        img.src = src;
      });

    Promise.all(sources.map(probe)).then((results) => {
      if (cancelled) return;
      setReady(results.filter((src): src is string => src !== null));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ready;
}

/**
 * A WebGL context can fail for reasons we do not control (blocklisted driver,
 * too many live contexts, a texture that 404s mid-flight). Without a boundary
 * React unmounts the island and the section disappears; with one the section
 * keeps its static fallback, exactly like the footer always being there.
 */
class GalleryBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[FeaturedGallery] WebGL gallery unavailable, using fallback', error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Zero-JavaScript, zero-WebGL backdrop. Rendered server-side and kept on screen
 * until (and unless) the 3D canvas takes over, so the section is never an empty
 * black band on any page or any device.
 */
function StaticStrip({ images }: { images: string[] }) {
  const strip = images.length ? images : DEMO_IMAGES;
  const doubled = [...strip, ...strip];

  return (
    <div className="fg-strip" aria-hidden="true">
      <div className="fg-strip-track">
        {doubled.map((src, i) => (
          <img key={`${src}-${i}`} src={src} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="fg-strip-veil" />
    </div>
  );
}

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
  const [webglFailed, setWebglFailed] = useState(false);

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

  // Plain URLs for the static strip (no CORS needed, shares the browser cache
  // with the rest of the page) and separate CORS-scoped URLs for the textures.
  const plainSources = useMemo(() => {
    const provided = (images ?? []).filter(Boolean).slice(0, 8);
    return provided.length ? provided : DEMO_IMAGES;
  }, [images]);

  const textureCandidates = useMemo(
    () => plainSources.map(toTextureUrl),
    [plainSources]
  );

  // Don't even probe the network until the section is on approach.
  const readyTextures = useCorsReadyImages(inView ? textureCandidates : []);
  const canUseWebgl = !webglFailed && inView && !!readyTextures && readyTextures.length > 0;

  const galleryImages = useMemo(
    () => (readyTextures ?? []).map((src, i) => ({ src, alt: `Gallery image ${i + 1}` })),
    [readyTextures]
  );

  return (
    <section
      ref={sectionRef}
      className="featured-gallery"
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
      <style>{FG_CSS}</style>

      {/* Always-present backdrop. Hidden (not unmounted) once WebGL is live so
          the handover is a cross-fade rather than a flash of black. */}
      <div
        className={canUseWebgl ? 'fg-static is-hidden' : 'fg-static'}
        style={{ position: 'absolute', inset: 0 }}
      >
        <StaticStrip images={plainSources} />
      </div>

      {/* 3D gallery fills the entire section — mounted on approach, not on load */}
      {canUseWebgl && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <GalleryBoundary onError={() => setWebglFailed(true)}>
            <Suspense fallback={null}>
              <InfiniteGallery
                images={galleryImages}
                speed={isMobile ? 0.9 : 1.2}
                zSpacing={3}
                // 12 planes in flight is a desktop budget; 6 keeps phones smooth.
                visibleCount={isMobile ? 6 : 12}
                falloff={isMobile ? { near: 0.8, far: 9 } : { near: 0.8, far: 14 }}
                className=""
                style={{ width: '100%', height: '100%' }}
              />
            </Suspense>
          </GalleryBoundary>
        </div>
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

const FG_CSS = `
.fg-static { transition: opacity 600ms ease; opacity: 1; }
.fg-static.is-hidden { opacity: 0; pointer-events: none; }
.fg-strip { position: absolute; inset: 0; overflow: hidden; }
.fg-strip-track {
  display: flex;
  gap: 1rem;
  height: 100%;
  align-items: center;
  padding: 0 1rem;
  width: max-content;
  animation: fg-drift 48s linear infinite;
}
.fg-strip-track img {
  height: 62%;
  width: auto;
  max-width: none;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 10px;
  opacity: 0.5;
  filter: saturate(0.85);
}
.fg-strip-veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 70%, #000 100%),
    linear-gradient(90deg, #000 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, #000 100%);
}
@keyframes fg-drift {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .fg-strip-track { animation: none; }
}
`;
