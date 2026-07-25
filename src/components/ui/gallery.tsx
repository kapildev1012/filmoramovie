"use client";

// gallery.tsx — draggable, fanned "stack" of cast photos.
// Adapted from the shadcn PhotoGallery for this Astro + React codebase:
//  • uses a plain <img> instead of next/image
//  • relative import for cn (no "@" path alias configured here)
//  • sized/positioned for MOBILE (rendered ≤767px only)
//  • fed real cast data via the `photos` prop

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

type Direction = "left" | "right";

export interface GalleryPhoto {
  src: string;
  alt: string;
  name?: string;
}

const PHOTO_SIZE = 132; // px
const STEP = 52; // horizontal offset between photos
const Y_OFFSETS = [12, 28, 4, 24, 14];

function getRandomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function CastGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 250);
    return () => clearTimeout(t);
  }, []);

  const items = photos.slice(0, 5);
  const n = items.length;
  if (n === 0) return null;

  const positioned = items.map((photo, i) => {
    const offset = (i - (n - 1) / 2) * STEP;
    return {
      ...photo,
      order: i,
      x: `${offset}px`,
      y: `${Y_OFFSETS[i % Y_OFFSETS.length]}px`,
      z: 50 - Math.round(Math.abs(i - (n - 1) / 2) * 10), // center on top
      dir: (offset <= 0 ? "left" : "right") as Direction,
    };
  });

  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.05 },
    },
  };

  const photoVariants = {
    hidden: () => ({ x: 0, y: 0, scale: 1 }),
    visible: (custom: { x: string; y: string; order: number }) => ({
      x: custom.x,
      y: custom.y,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 70,
        damping: 12,
        mass: 1,
        delay: custom.order * 0.12,
      },
    }),
  };

  return (
    <div className="cg-root">
      <p className="cg-hint">Drag the photos to explore the cast</p>
      <div className="cg-stage">
        <motion.div
          className="cg-fan"
          variants={containerVariants}
          initial="hidden"
          animate={isLoaded ? "visible" : "hidden"}
        >
          <div className="cg-anchor" style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}>
            {/* reversed so center (highest z) renders last / on top */}
            {[...positioned].reverse().map((p) => (
              <motion.div
                key={p.order}
                className="cg-slot"
                style={{ zIndex: p.z }}
                variants={photoVariants}
                custom={{ x: p.x, y: p.y, order: p.order }}
              >
                <Photo src={p.src} alt={p.alt} name={p.name} direction={p.dir} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <style>{`
        .cg-root { position: relative; padding: 0.25rem 0 0.5rem; }
        .cg-hint {
          text-align: center;
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-3, #71717a);
          margin: 0 0 1.5rem;
        }
        .cg-stage {
          position: relative;
          height: 210px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cg-fan { position: relative; display: flex; justify-content: center; }
        .cg-anchor { position: relative; }
        .cg-slot { position: absolute; left: 0; top: 0; }

        .cg-photo { position: relative; cursor: grab; -webkit-tap-highlight-color: transparent; }
        .cg-photo:active { cursor: grabbing; }
        .cg-photo-inner {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 18px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06);
          background: var(--color-surface-2, #27272a);
        }
        .cg-img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .cg-name {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          padding: 1rem 0.5rem 0.45rem;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #fff;
          text-align: center;
          line-height: 1.2;
          background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}

function Photo({
  src,
  alt,
  name,
  direction,
  className,
}: {
  src: string;
  alt: string;
  name?: string;
  direction: Direction;
  className?: string;
}) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setRotation(getRandomInRange(1, 4) * (direction === "left" ? -1 : 1));
  }, [direction]);

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      whileTap={{ scale: 1.15, zIndex: 9999 }}
      whileHover={{ scale: 1.08, rotateZ: 2 * (direction === "left" ? -1 : 1), zIndex: 9999 }}
      whileDrag={{ scale: 1.1, zIndex: 9999 }}
      initial={{ rotate: 0 }}
      animate={{ rotate: rotation }}
      style={{
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        WebkitUserSelect: "none",
        userSelect: "none",
        touchAction: "none",
      }}
      className={cn("cg-photo", className)}
      draggable={false}
      tabIndex={0}
    >
      <div className="cg-photo-inner">
        <img className="cg-img" src={src} alt={alt} draggable={false} />
        {name && <span className="cg-name">{name}</span>}
      </div>
    </motion.div>
  );
}

export default CastGallery;
