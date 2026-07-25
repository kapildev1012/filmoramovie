'use client';

import InfiniteGallery from '../ui/3d-gallery-photography';

const SHOWCASE_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1741332966416-414d8a5b8887?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2fHx8ZW58MHx8fHx8',
    alt: 'Gallery image 1',
  },
  {
    src: 'https://images.unsplash.com/photo-1754769440490-2eb64d715775?q=80&w=1113&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 2',
  },
  {
    src: 'https://images.unsplash.com/photo-1758640920659-0bb864175983?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzNHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 3',
  },
  {
    src: 'https://plus.unsplash.com/premium_photo-1758367454070-731d3cc11774?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0MXx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 4',
  },
  {
    src: 'https://images.unsplash.com/photo-1746023841657-e5cd7cc90d2c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0Nnx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 5',
  },
  {
    src: 'https://images.unsplash.com/photo-1741715661559-6149723ea89a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1MHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 6',
  },
  {
    src: 'https://images.unsplash.com/photo-1725878746053-407492aa4034?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1OHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 7',
  },
  {
    src: 'https://images.unsplash.com/photo-1752588975168-d2d7965a6d64?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2M3x8fGVufDB8fHx8fA%3D%3D',
    alt: 'Gallery image 8',
  },
];

/**
 * GalleryShowcase — full-viewport 3D gallery section matching the original demo.
 * Fixed headline with mix-blend-exclusion sits above the scrolling gallery,
 * and a bottom hint shows navigation instructions.
 */
export default function GalleryShowcase() {
  return (
    <section
      style={{ position: 'relative', width: '100%', height: 'clamp(360px, 70svh, 100svh)', background: '#000' }}
      aria-label="Gallery showcase"
    >
      {/* Full-screen 3D gallery */}
      <InfiniteGallery
        images={SHOWCASE_IMAGES}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-full w-full rounded-lg overflow-hidden"
      />

      {/* Centred italic headline */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1.5rem',
          pointerEvents: 'none',
          mixBlendMode: 'exclusion',
          color: '#fff',
        }}
        aria-hidden="true"
      >
        <h2
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 'clamp(2rem, 7vw, 7rem)',
            fontWeight: 400,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: 0,
          }}
        >
          <span style={{ fontStyle: 'italic' }}>Shadway</span>
        </h2>
      </div>

      {/* Bottom hint */}
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
