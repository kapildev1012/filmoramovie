// src/components/react/player/SourceBar.tsx — engine + server switcher.
//
// Filmora plays a title from more than one place, and the viewer must be able to
// see and change which one. Two rows:
//   1. Source: the full title (streaming servers) vs the official trailer
//      (YouTube). Rendered only when both actually exist.
//   2. Servers: every provider we know about, always all of them, because a
//      server-side probe runs from a datacenter IP that providers throttle — a
//      failed probe often means "could not check", not "will not play". The probe
//      result only sets the order and the confirmation dot.
//
// The dot has three meanings and a title that spells each one out, so nobody has
// to guess what a green dot promises.

import type { EngineId } from '../../../lib/player/types';
import type { PlayerT } from '../../../lib/player/strings';

export interface ServerOption {
  id: string;
  name: string;
  verified: boolean;
  online: boolean;
  live?: boolean;
}

interface SourceBarProps {
  /** Engines the caller can actually offer for this title. */
  available: EngineId[];
  engine: EngineId | null;
  onEngine: (engine: EngineId) => void;
  servers: ServerOption[];
  activeServer: string | null;
  onServer: (id: string) => void;
  checking: boolean;
  t: PlayerT;
}

export default function SourceBar({
  available,
  engine,
  onEngine,
  servers,
  activeServer,
  onServer,
  checking,
  t,
}: SourceBarProps) {
  const showEngines = available.length > 1;
  const showServers = engine === 'embed' && servers.length > 0;
  if (!showEngines && !showServers) return null;

  return (
    <div className="fp-sourcebar">
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
          {servers.map((server) => (
            <button
              key={server.id}
              type="button"
              className={`fp-pill${activeServer === server.id ? ' is-active' : ''}`}
              aria-pressed={activeServer === server.id}
              onClick={() => onServer(server.id)}
              title={
                server.live
                  ? `${server.name} — playback confirmed in your browser`
                  : server.verified
                    ? `${server.name} — provider has this title`
                    : server.online
                      ? `${server.name} — provider is online`
                      : `${server.name} — not confirmed from our side; press to try it`
              }
            >
              {(server.verified || server.live) && (
                <span className="fp-pill-dot" aria-hidden="true" />
              )}
              {server.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
