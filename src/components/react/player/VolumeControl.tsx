// src/components/react/player/VolumeControl.tsx — mute button + level slider.
//
// Desktop: the slider is collapsed to zero width and expands on hover/focus of
// the group, so the bar stays uncluttered but the control is one motion away.
// Touch: there is no hover, so the expansion is triggered by tapping the speaker
// icon (which also toggles mute on a second tap) — see `expanded` below.
//
// The slider is a real <input type="range">: it gets native keyboard support,
// native touch dragging, and screen readers already know how to announce it.
// Arrow keys inside it are stopped from bubbling so the stage's global ±5%
// handler does not double-apply.
//
// `relay` mode (third-party iframe): the level cannot be verified, only sent.
// The control still renders — it does work on providers that listen — but it
// carries a title explaining the uncertainty instead of pretending.

import { useCallback, useRef, useState } from 'react';
import { VolumeIcon } from './Icons';
import type { PlayerT } from '../../../lib/player/strings';

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  mode: 'native' | 'relay';
  onVolume: (value: number) => void;
  onToggleMute: () => void;
  t: PlayerT;
}

export default function VolumeControl({
  volume,
  muted,
  mode,
  onVolume,
  onToggleMute,
  t,
}: VolumeControlProps) {
  const [expanded, setExpanded] = useState(false);
  const touchedRef = useRef(false);
  const effective = muted ? 0 : volume;

  const onIconActivate = useCallback(() => {
    // First tap on a touch device reveals the slider; further taps mute.
    if (touchedRef.current && !expanded) {
      setExpanded(true);
      return;
    }
    onToggleMute();
  }, [expanded, onToggleMute]);

  return (
    <div
      className={`fp-volume${expanded ? ' is-expanded' : ''}`}
      onPointerDown={(event) => {
        touchedRef.current = event.pointerType === 'touch';
      }}
    >
      <button
        type="button"
        className="fp-btn"
        onClick={onIconActivate}
        aria-label={muted ? t('unmute') : t('mute')}
        aria-pressed={muted}
        title={
          mode === 'relay'
            ? `${muted ? t('unmute') : t('mute')} (M) — ${t('tracksOnServer')}`
            : `${muted ? t('unmute') : t('mute')} (M)`
        }
      >
        <VolumeIcon level={effective} />
      </button>
      <div className="fp-volume-slider-wrap">
        <input
          type="range"
          className="fp-range fp-volume-slider"
          min={0}
          max={1}
          step={0.01}
          value={effective}
          aria-label={t('volume')}
          aria-valuetext={`${Math.round(effective * 100)}%`}
          onChange={(event) => onVolume(Number(event.target.value))}
          onKeyDown={(event) => {
            // The range input already moves by `step`; let it, but keep the
            // event away from the stage's global volume shortcut.
            if (event.key.startsWith('Arrow')) event.stopPropagation();
          }}
        />
      </div>
    </div>
  );
}
