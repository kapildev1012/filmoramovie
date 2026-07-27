// src/components/react/player/SpeedMenu.tsx — playback speed.
//
// A radio group, not a stepper: viewers pick a rate, they do not increment one.
// `Normal` is labelled rather than "1x" because that is what the option means and
// it is what every translation in strings.ts renders.
// Keyboard: < and > step through the same list from anywhere on the stage.

import { CheckIcon } from './Icons';
import { RATES } from '../../../lib/player/prefs';
import type { PlayerT } from '../../../lib/player/strings';

interface SpeedMenuProps {
  rate: number;
  onSelect: (rate: number) => void;
  t: PlayerT;
}

export default function SpeedMenu({ rate, onSelect, t }: SpeedMenuProps) {
  return (
    <div className="fp-speed">
      <h3 className="fp-menu-title" id="fp-speed-heading">
        {t('speed')}
      </h3>
      <ul className="fp-menu-list" role="menu" aria-labelledby="fp-speed-heading">
        {RATES.map((value) => (
          <li key={value}>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={rate === value}
              className={`fp-menu-row${rate === value ? ' is-active' : ''}`}
              onClick={() => onSelect(value)}
            >
              <span className="fp-menu-check" aria-hidden="true">
                {rate === value && <CheckIcon size={16} />}
              </span>
              <span className="fp-menu-label">
                {value === 1 ? t('normal') : `${value}×`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
