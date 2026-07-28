// src/components/react/player/SourceBar.tsx — engine + server switcher.
//
// Filmora plays a title from more than one place, and the viewer must be able to
// see and change which one. Three parts:
//   1. Source: the full title (streaming servers) vs the official trailer
//      (YouTube). Rendered only when both actually exist.
//   2. Auto: hands selection back to the ranking after a manual override, so
//      "best available" is a place you can return to, not a one-way door.
//   3. Servers: every provider we know about, always all of them, because a
//      server-side probe runs from a datacenter IP that providers throttle — a
//      failed probe often means "could not check", not "will not play". The probe
//      result only shapes the ranking and the confirmation dot.
//
// The list arrives already ranked (see lib/player/serverRanking.ts). The first
// entry is what "Auto" plays and is badged as such; every entry carries a title
// attribute spelling out exactly what we know about it, so nobody has to guess
// what a green dot promises.
//
// RESPONSIVE
// Desktop / tablet: the servers sit inline in the bar with hover states.
// Phone (≤40rem, matched with matchMedia so the markup itself differs): one
// full-width trigger opens a bottom sheet of 44px rows — the same pattern
// Netflix and JioHotstar use for pickers on a phone, where a row of pills would
// be either unreadable or unhittable.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIcon, CloseIcon } from './Icons';
import type { EngineId } from '../../../lib/player/types';
import type { PlayerT } from '../../../lib/player/strings';

export interface ServerOption {
  id: string;
  name: string;
  verified: boolean;
  online: boolean;
  live?: boolean;
  /** "1080p" when the data model knows; null while quality is unavailable. */
  qualityLabel?: string | null;
  /** Measured probe round-trip, shown as a subtle hint on wide screens. */
  latencyMs?: number | null;
  /** True for servers that failed for this title in this session. */
  failed?: boolean;
}

interface SourceBarProps {
  /** Engines the caller can actually offer for this title. */
  available: EngineId[];
  engine: EngineId | null;
  onEngine: (engine: EngineId) => void;
  /** Ranked best-first. */
  servers: ServerOption[];
  activeServer: string | null;
  onServer: (id: string) => void;
  /** The id automatic selection would choose right now. */
  recommended?: string | null;
  /** False once the viewer has overridden the automatic pick. */
  isAuto?: boolean;
  /** Return to automatic selection. Omitted when there is nothing to return to. */
  onAuto?: () => void;
  checking: boolean;
  t: PlayerT;
}

/** Phone-sized viewport check. SSR-safe: false until the browser answers. */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    // Same 40rem boundary as --fp-bp-compact, expressed in px because
    // matchMedia has no access to the element's font size.
    const query = window.matchMedia('(max-width: 40rem)');
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return compact;
}

/** One line of plain English about what we know, used as the tooltip/aria text. */
function describe(server: ServerOption): string {
  if (server.failed) return `${server.name} — did not play for this title; press to try again`;
  if (server.live) return `${server.name} — playback confirmed in your browser`;
  if (server.verified) return `${server.name} — provider has this title`;
  if (server.online) return `${server.name} — provider is online`;
  return `${server.name} — not confirmed from our side; press to try it`;
}

export default function SourceBar({
  available,
  engine,
  onEngine,
  servers,
  activeServer,
  onServer,
  recommended = null,
  isAuto = true,
  onAuto,
  checking,
  t,
}: SourceBarProps) {
  const compact = useCompactViewport();
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const showEngines = available.length > 1;
  const showServers = engine === 'embed' && servers.length > 0;

  const close = useCallback(() => {
    setSheetOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape closes the sheet, and the handler is removed when it is shut so it
  // never competes with the page's own Escape handling.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen, close]);

  if (!showEngines && !showServers) return null;

  const active = servers.find((s) => s.id === activeServer) ?? null;
  const pick = (id: string) => {
    onServer(id);
    setSheetOpen(false);
  };

  return (
    <div
      className="fp-sourcebar"
      // ISOLATION: the switcher lives outside the stage, so it does its own
      // containment — a server pill must not also reach a page-level click
      // delegate sitting above it in the DOM.
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {showEngines && (
        <div className="fp-source-group" role="group" aria-label={t('fullTitle')}>
          {available.map((id) => (
            <button
              key={id}
              type="button"
              className={`fp-pill${engine === id ? ' is-active' : ''}`}
              aria-pressed={engine === id}
              onClick={() => onEngine(id)}
            >
              {id === 'youtube' ? t('trailer') : t('fullTitle')}
            </button>
          ))}
        </div>
      )}

      {showServers && (
        <div className="fp-source-group" role="group" aria-label={t('servers')}>
          <span className="fp-source-label">
            {t('servers')}
            {checking && <span className="fp-source-checking" aria-hidden="true" />}
          </span>

          {/* Auto: present only when a manual override is in force, so the bar
              does not carry a control that currently does nothing. */}
          {onAuto && !isAuto && (
            <button
              type="button"
              className="fp-pill fp-pill-auto"
              onClick={onAuto}
              title={t('autoBestHint')}
            >
              {t('auto')}
            </button>
          )}

          {compact ? (
            <>
              <button
                ref={triggerRef}
                type="button"
                className="fp-pill fp-server-trigger is-active"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen((open) => !open)}
              >
                {active && (active.verified || active.live) && (
                  <span className="fp-pill-dot" aria-hidden="true" />
                )}
                <span className="fp-server-trigger-name">{active?.name ?? t('server')}</span>
                {active?.qualityLabel && (
                  <span className="fp-quality-badge">{active.qualityLabel}</span>
                )}
                {isAuto && <span className="fp-server-trigger-auto">{t('auto')}</span>}
              </button>

              {sheetOpen && (
                <>
                  <button
                    type="button"
                    className="fp-sheet-backdrop"
                    aria-label={t('close')}
                    onClick={close}
                  />
                  <div className="fp-server-sheet" role="dialog" aria-label={t('chooseServer')}>
                    <div className="fp-server-sheet-head">
                      <h3 className="fp-menu-title">{t('chooseServer')}</h3>
                      <button
                        type="button"
                        className="fp-btn fp-btn-sm"
                        onClick={close}
                        aria-label={t('close')}
                      >
                        <CloseIcon size={18} />
                      </button>
                    </div>
                    <ul className="fp-server-list" role="menu">
                      {servers.map((server) => (
                        <li key={server.id}>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={activeServer === server.id}
                            className={`fp-server-row${activeServer === server.id ? ' is-active' : ''}${server.failed ? ' is-failed' : ''}`}
                            onClick={() => pick(server.id)}
                          >
                            <span className="fp-menu-check" aria-hidden="true">
                              {activeServer === server.id && <CheckIcon size={16} />}
                            </span>
                            <span className="fp-server-row-text">
                              <span className="fp-server-row-name">
                                {server.name}
                                {(server.verified || server.live) && (
                                  <span className="fp-pill-dot" aria-hidden="true" />
                                )}
                              </span>
                              <span className="fp-server-row-meta">{describe(server)}</span>
                            </span>
                            {server.qualityLabel && (
                              <span className="fp-quality-badge">{server.qualityLabel}</span>
                            )}
                            {recommended === server.id && (
                              <span className="fp-quality-badge is-best">{t('bestQuality')}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          ) : (
            servers.map((server) => (
              <button
                key={server.id}
                type="button"
                className={`fp-pill${activeServer === server.id ? ' is-active' : ''}${server.failed ? ' is-failed' : ''}`}
                aria-pressed={activeServer === server.id}
                onClick={() => onServer(server.id)}
                title={
                  recommended === server.id
                    ? `${describe(server)} · ${t('bestQuality')}`
                    : describe(server)
                }
              >
                {(server.verified || server.live) && (
                  <span className="fp-pill-dot" aria-hidden="true" />
                )}
                {server.name}
                {server.qualityLabel && (
                  <span className="fp-quality-badge">{server.qualityLabel}</span>
                )}
                {recommended === server.id && isAuto && (
                  <span className="fp-quality-badge is-best">{t('bestQuality')}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
