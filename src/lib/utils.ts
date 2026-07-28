// src/lib/utils.ts — shared helpers for React components

/**
 * cn — lightweight className combiner.
 * Filters out falsy values and joins the rest with a space.
 * (Drop-in for shadcn's `cn` for components that don't need tailwind-merge.)
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}
