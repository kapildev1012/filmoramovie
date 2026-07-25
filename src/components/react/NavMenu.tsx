"use client";
import React, { useState } from "react";
import { MenuItem, HoveredLink, ProductItem } from "./navbar-menu";

const PLATFORM_IMG = {
  netflix: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=240&q=80",
  prime:   "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=240&q=80",
  hotstar: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=240&q=80",
  appletv: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=240&q=80",
};

export default function NavMenu() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div
      onMouseLeave={() => setActive(null)}
      className="nav-menu-row"
      style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}
    >
      {/* Direct link — always full-reload to the default home page */}
      <a href="/" data-astro-reload className="nav-menu-trigger" style={{ color: "var(--color-text)" }}>
        Home
      </a>

      {/* Browse dropdown */}
      <MenuItem setActive={setActive} active={active} item="Browse">
        <div className="flex flex-col space-y-3 text-sm">
          <HoveredLink href="/movies">Movies</HoveredLink>
          <HoveredLink href="/series">Series</HoveredLink>
          <HoveredLink href="/anime">Anime</HoveredLink>
          <HoveredLink href="/movies?sort=popularity.desc">Trending</HoveredLink>
          <HoveredLink href="/movies?sort=vote_average.desc">Top Rated</HoveredLink>
        </div>
      </MenuItem>

      {/* Platforms dropdown (ProductItem grid) */}
      <MenuItem setActive={setActive} active={active} item="Platforms">
        <div className="grid grid-cols-2 gap-6 p-2">
          <ProductItem title="Netflix" href="/netflix" src={PLATFORM_IMG.netflix} description="Top 10 today & Originals" />
          <ProductItem title="Prime Video" href="/prime" src={PLATFORM_IMG.prime} description="Exclusives, movies & series" />
          <ProductItem title="Jio Hotstar" href="/hotstar" src={PLATFORM_IMG.hotstar} description="Movies, sports & regional hits" />
          <ProductItem title="Apple TV+" href="/appletv" src={PLATFORM_IMG.appletv} description="Award-winning originals" />
        </div>
      </MenuItem>

      {/* Genres dropdown */}
      <MenuItem setActive={setActive} active={active} item="Genres">
        <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
          <HoveredLink href="/movies?genres=28">Action</HoveredLink>
          <HoveredLink href="/movies?genres=35">Comedy</HoveredLink>
          <HoveredLink href="/movies?genres=18">Drama</HoveredLink>
          <HoveredLink href="/movies?genres=27">Horror</HoveredLink>
          <HoveredLink href="/movies?genres=878">Sci-Fi</HoveredLink>
          <HoveredLink href="/movies?genres=10749">Romance</HoveredLink>
        </div>
      </MenuItem>

      {/* Inline theme styles for hover states */}
      <style>{`
        .nav-menu-trigger {
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          letter-spacing: 0.01em;
          transition: opacity 0.2s ease;
          white-space: nowrap;
        }
        .nav-menu-trigger:hover { opacity: 0.7; }
        .nav-menu-link {
          text-decoration: none;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .nav-menu-link:hover { color: var(--color-text) !important; transform: translateX(2px); }
      `}</style>
    </div>
  );
}
