"use client";

import { Pagination as ArkPagination } from "@ark-ui/react/pagination";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface PaginationProps {
  /** Total number of pages (1-based). */
  totalPages: number;
  /** Current page (1-based). */
  page: number;
  /** How many page numbers to show either side of the current page. */
  siblingCount?: number;
  /** Path the links point at, e.g. "/movies". */
  basePath: string;
  /**
   * Current query string (e.g. `?sort=popularity.desc&genres=28`). The `page`
   * param is rewritten so every existing filter is preserved when paging.
   */
  search?: string;
  /** Extra class on the root <nav>. */
  className?: string;
}

/** Build the href for a target page, preserving all other query params. */
function hrefForPage(basePath: string, search: string | undefined, target: number): string {
  const params = new URLSearchParams(search ?? "");
  params.set("page", String(target));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Ark UI pagination, themed with the site's CSS tokens so it tracks the
 * light/dark `data-theme` toggle (the project themes via `html[data-theme]`,
 * not Tailwind's `dark:` variant, so token-based colours are used instead of
 * the demo's hard-coded gray/blue utilities).
 *
 * The listing pages are server-rendered and fetch a fresh page of results per
 * navigation, so paging is driven by the URL: Ark reports the requested page
 * via `onPageChange` and we navigate to the matching, filter-preserving URL.
 */
export function Pagination({
  totalPages,
  page,
  siblingCount = 1,
  basePath,
  search,
  className,
}: PaginationProps) {
  if (!totalPages || totalPages <= 1) return null;

  const goToPage = (target: number) => {
    const clamped = Math.min(Math.max(target, 1), totalPages);
    if (clamped === page) return;
    window.location.assign(hrefForPage(basePath, search, clamped));
  };

  return (
    <ArkPagination.Root
      // One page == one "item" so Ark's page list maps 1:1 onto our pages.
      count={totalPages}
      pageSize={1}
      defaultPage={page}
      siblingCount={siblingCount}
      onPageChange={(details) => goToPage(details.page)}
      className={`fp-pgn ${className ?? ""}`.trim()}
      aria-label="Pagination"
    >
      <ArkPagination.FirstTrigger className="fp-pgn-edge fp-pgn-edge--jump" aria-label="First page">
        <ChevronsLeft className="fp-pgn-ic" aria-hidden="true" />
      </ArkPagination.FirstTrigger>

      <ArkPagination.PrevTrigger className="fp-pgn-edge" aria-label="Previous page">
        <ChevronLeft className="fp-pgn-ic" aria-hidden="true" />
        <span className="fp-pgn-edge-label">Prev</span>
      </ArkPagination.PrevTrigger>

      <ArkPagination.Context>
        {(pagination) =>
          pagination.pages.map((p, index) =>
            p.type === "page" ? (
              <ArkPagination.Item
                key={index}
                {...p}
                className="fp-pgn-item"
                aria-label={`Page ${p.value}`}
              >
                {p.value}
              </ArkPagination.Item>
            ) : (
              <ArkPagination.Ellipsis
                key={index}
                index={index}
                className="fp-pgn-ellipsis"
                aria-hidden="true"
              >
                &#8230;
              </ArkPagination.Ellipsis>
            )
          )
        }
      </ArkPagination.Context>

      <ArkPagination.NextTrigger className="fp-pgn-edge" aria-label="Next page">
        <span className="fp-pgn-edge-label">Next</span>
        <ChevronRight className="fp-pgn-ic" aria-hidden="true" />
      </ArkPagination.NextTrigger>

      <ArkPagination.LastTrigger className="fp-pgn-edge fp-pgn-edge--jump" aria-label="Last page">
        <ChevronsRight className="fp-pgn-ic" aria-hidden="true" />
      </ArkPagination.LastTrigger>

      <style>{`
        .fp-pgn {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-top: 3rem;
        }
        .fp-pgn-edge,
        .fp-pgn-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          min-width: 40px;
          height: 40px;
          padding: 0 0.625rem;
          border: 1px solid transparent;
          border-radius: var(--radius-md, 10px);
          background: transparent;
          color: var(--color-text-2);
          font-family: inherit;
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 500;
          line-height: 1;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .fp-pgn-edge { color: var(--color-text-3); }
        .fp-pgn-edge-label { font-weight: 600; }

        .fp-pgn-edge:hover:not(:disabled):not([data-disabled]),
        .fp-pgn-item:hover:not([data-selected]) {
          color: var(--color-text);
          background: var(--color-surface-2);
          border-color: var(--color-border);
        }

        .fp-pgn-item[data-selected] {
          background: linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to));
          color: #fff;
          border-color: transparent;
          cursor: default;
          pointer-events: none;
        }

        .fp-pgn-edge:disabled,
        .fp-pgn-edge[data-disabled] {
          opacity: 0.45;
          cursor: not-allowed;
          pointer-events: none;
        }

        .fp-pgn-ellipsis {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 40px;
          color: var(--color-text-3);
          user-select: none;
        }

        .fp-pgn-ic { width: 16px; height: 16px; flex-shrink: 0; }

        .fp-pgn :focus-visible {
          outline: 2px solid var(--color-accent-from);
          outline-offset: 2px;
          border-radius: 8px;
        }

        /* Mobile: keep the whole control on a SINGLE line. The First/Last jump
           chevrons are dropped (the numbered items already reach every page),
           the Prev/Next word labels collapse, and everything is tightened so it
           fits across a phone. flex-wrap is disabled so it can never spill onto
           a second row; if a very high page count still overflows a tiny screen
           the row scrolls horizontally instead of wrapping. */
        @media (max-width: 767px) {
          .fp-pgn {
            gap: 0.25rem;
            margin-top: 2rem;
            flex-wrap: nowrap;
            max-width: 100%;
            overflow-x: auto;
            scrollbar-width: none;              /* Firefox */
            -webkit-overflow-scrolling: touch;
          }
          .fp-pgn::-webkit-scrollbar { display: none; } /* WebKit */
          .fp-pgn-edge,
          .fp-pgn-item {
            flex: 0 0 auto;
            min-width: 36px;
            height: 38px;
            padding: 0 0.4375rem;
            font-size: 0.8125rem;
          }
          .fp-pgn-edge-label { display: none; }
          .fp-pgn-edge--jump { display: none; }   /* First/Last redundant on phones */
          .fp-pgn-ellipsis { flex: 0 0 auto; min-width: 20px; height: 38px; }
        }
      `}</style>
    </ArkPagination.Root>
  );
}

export default Pagination;
