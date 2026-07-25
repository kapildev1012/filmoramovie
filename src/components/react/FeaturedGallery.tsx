'use client';

import InfiniteGallery from '../ui/3d-gallery-photography';

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
  // Convert plain string URLs to the { src, alt } format the gallery expects.
  const galleryImages =
    images && images.length
      ? images.map((src, i) => ({ src, alt: `Gallery image ${i + 1}` }))
      : DEMO_IMAGES;

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(320px, 65vw, 900px)',
        overflow: 'hidden',
        background: '#000',
      }}
      aria-label="Featured gallery"
    >
      {/* 3D gallery fills the entire section */}
      <InfiniteGallery
        images={galleryImages}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-full w-full rounded-lg overflow-hidden"
      />

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
