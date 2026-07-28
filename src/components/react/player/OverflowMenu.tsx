// src/components/react/player/OverflowMenu.tsx — the "More" panel.
//
// WHY THIS EXISTS
// Below the `md` breakpoint the control bar cannot hold every affordance at a
// 44px touch target without wrapping into two rows, so the secondary group
// *reflows into here* rather than shrinking: playback speed, episode navigation,
// image adjustments, picture-in-picture, gesture toggle, reload, and the
// keyboard-shortcut reference. On wide screens speed, episode nav and PiP are
// inline in the bar, and this panel omits them instead of duplicating them
// (PlayerShell decides, via its `compact` branch, which ones to hand over).
//
// Everything is rendered from capabilities, so the panel never shows a row that
// cannot act on the current engine.

import {
  BrightnessIcon,
  CheckIcon,
  FitIcon,
  GestureIcon,
  NextIcon,
  PipIcon,
  PrevIcon,
  ReloadIcon,
  SpeedIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './Icons';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, RATES, ZOOM_MAX, ZOOM_MIN } from '../../../lib/player/prefs';
import type { QualityLevel } from '../../../lib/player/types';
import type { PlayerT } from '../../../lib/player/strings';

interface OverflowMenuProps {
  brightness: number;
  zoom: number;
  gestures: boolean;
  autoplayNext: boolean;
  showAutoplayNext: boolean;
  canPip: boolean;
  /**
   * Playback speed, present only when the bar could not keep its own speed
   * button (compact widths). Passing `null` means the inline button is visible
   * and this panel must not duplicate it.
   */
  speed?: { rate: number; onRate: (rate: number) => void } | null;
  /**
   * Episode navigation, same rule: only supplied when the prev/next buttons
   * were dropped from the bar for want of room.
   */
  episodeNav?: {
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
  } | null;
  /**
   * Video quality. Present only when the engine can actually enumerate
   * renditions (first-party HLS). The third-party iframe engine cannot — the
   * renditions are chosen inside a cross-origin document — so `null` here means
   * "render the honest explanation instead of a menu that cannot act".
   */
  quality?: {
    levels: QualityLevel[];
    /** True while ABR is choosing; false when a rendition is pinned. */
    auto: boolean;
    onSelect: (id: string | null) => void;
  } | null;
  /** True for the embed engine, where quality is not ours to set. */
  qualityManagedExternally?: boolean;
  onBrightness: (value: number) => void;
  onZoom: (value: number) => void;
  onToggleGestures: () => void;
  onToggleAutoplayNext: () => void;
  onPip: () => void;
  onReload: () => void;
  t: PlayerT;
}

export default function OverflowMenu({
  brightness,
  zoom,
  gestures,
  autoplayNext,
  showAutoplayNext,
  canPip,
  speed = null,
  episodeNav = null,
  quality = null,
  qualityManagedExternally = false,
  onBrightness,
  onZoom,
  onToggleGestures,
  onToggleAutoplayNext,
  onPip,
  onReload,
  t,
}: OverflowMenuProps) {
  return (
    <div className="fp-overflow">
      <h3 className="fp-menu-title">{t('settings')}</h3>

      {/* Speed reflowed out of the bar. Rendered as a segmented control rather
          than a nested submenu: one tap instead of two, which matters most on
          the small screens that are the only reason this row exists. */}
      {speed && (
        <div className="fp-menu-group">
          <p className="fp-menu-subtitle" id="fp-of-speed">
            <span className="fp-menu-slider-icon" aria-hidden="true">
              <SpeedIcon size={18} />
            </span>
            {t('speed')}
          </p>
          <div className="fp-segmented fp-segmented-wrap" role="group" aria-labelledby="fp-of-speed">
            {RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                className={`fp-seg-btn${speed.rate === rate ? ' is-active' : ''}`}
                aria-pressed={speed.rate === rate}
                onClick={() => speed.onRate(rate)}
              >
                {rate === 1 ? t('normal') : `${rate}×`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Episode navigation reflowed out of the bar (series, compact widths). */}
      {episodeNav && (
        <div className="fp-menu-group">
          <div className="fp-menu-row-static">
            <span className="fp-menu-slider-text">{t('episodes')}</span>
            <span className="fp-menu-stepper">
              <button
                type="button"
                className="fp-btn fp-btn-sm"
                onClick={episodeNav.onPrev}
                disabled={!episodeNav.hasPrev}
                aria-label={t('prevEpisode')}
                title={t('prevEpisode')}
              >
                <PrevIcon size={18} />
              </button>
              <button
                type="button"
                className="fp-btn fp-btn-sm"
                onClick={episodeNav.onNext}
                disabled={!episodeNav.hasNext}
                aria-label={t('nextEpisode')}
                title={t('nextEpisode')}
              >
                <NextIcon size={18} />
              </button>
            </span>
          </div>
        </div>
      )}

      {/* ── Video quality ──
          Highest is the default (the html5 adapter pins the top rendition on
          load), and this is where a viewer on a slow line lowers it. Rendered at
          EVERY width — mobile and desktop reach it through the same "More" sheet,
          so neither platform has quality control the other lacks.

          On the embed engine there is nothing to list: the provider's own player
          picks the rendition inside a cross-origin document. We say so rather
          than drawing a menu that cannot act. */}
      {quality && quality.levels.length > 0 && (
        <div className="fp-menu-group">
          <p className="fp-menu-subtitle" id="fp-of-quality">
            {t('quality')}
          </p>
          <ul className="fp-menu-list" role="menu" aria-labelledby="fp-of-quality">
            <li>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={quality.auto}
                className={`fp-menu-row${quality.auto ? ' is-active' : ''}`}
                onClick={() => quality.onSelect(null)}
              >
                <span className="fp-menu-check" aria-hidden="true">
                  {quality.auto && <CheckIcon size={16} />}
                </span>
                <span className="fp-menu-label">{t('auto')}</span>
              </button>
            </li>
            {quality.levels.map((level) => (
              <li key={level.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={level.active}
                  className={`fp-menu-row${level.active ? ' is-active' : ''}`}
                  onClick={() => quality.onSelect(level.id)}
                >
                  <span className="fp-menu-check" aria-hidden="true">
                    {level.active && <CheckIcon size={16} />}
                  </span>
                  <span className="fp-menu-label">{level.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {qualityManagedExternally && (
        <div className="fp-menu-group">
          <p className="fp-menu-subtitle">{t('quality')}</p>
          <p className="fp-menu-note">
            <span>{t('qualityOnServerHint')}</span>
          </p>
        </div>
      )}

      {/* Brightness is a CSS filter on our own stage, so it works on every
          engine — including the third-party iframe, where nothing else does. */}
      <div className="fp-menu-group">
        <label className="fp-menu-slider">
          <span className="fp-menu-slider-icon" aria-hidden="true">
            <BrightnessIcon size={18} />
          </span>
          <span className="fp-menu-slider-text">{t('brightness')}</span>
          <input
            type="range"
            className="fp-range"
            min={BRIGHTNESS_MIN * 100}
            max={BRIGHTNESS_MAX * 100}
            step={1}
            value={Math.round(brightness * 100)}
            onChange={(event) => onBrightness(Number(event.target.value) / 100)}
            onKeyDown={(event) => {
              if (event.key.startsWith('Arrow')) event.stopPropagation();
            }}
          />
          <output className="fp-menu-slider-value">{Math.round(brightness * 100)}%</output>
        </label>
      </div>

      {/* Zoom crops the pillar/letter-boxing some sources bake in. */}
      <div className="fp-menu-group">
        <div className="fp-menu-row-static">
          <span className="fp-menu-slider-text">
            {t('zoomIn')} / {t('zoomOut')}
          </span>
          <span className="fp-menu-stepper">
            <button
              type="button"
              className="fp-btn fp-btn-sm"
              onClick={() => onZoom(zoom - 0.1)}
              disabled={zoom <= ZOOM_MIN}
              aria-label={t('zoomOut')}
            >
              <ZoomOutIcon size={18} />
            </button>
            <span className="fp-menu-stepper-value">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="fp-btn fp-btn-sm"
              onClick={() => onZoom(zoom + 0.1)}
              disabled={zoom >= ZOOM_MAX}
              aria-label={t('zoomIn')}
            >
              <ZoomInIcon size={18} />
            </button>
          </span>
        </div>
      </div>

      <ul className="fp-menu-list" role="menu">
        <li>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={gestures}
            className={`fp-menu-row${gestures ? ' is-active' : ''}`}
            onClick={onToggleGestures}
          >
            <span className="fp-menu-check" aria-hidden="true">
              <GestureIcon size={18} />
            </span>
            <span className="fp-menu-label">
              {t('gestures')}
              <span className="fp-menu-sub">{gestures ? 'On' : 'Off'}</span>
            </span>
          </button>
        </li>

        {showAutoplayNext && (
          <li>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={autoplayNext}
              className={`fp-menu-row${autoplayNext ? ' is-active' : ''}`}
              onClick={onToggleAutoplayNext}
            >
              <span className="fp-menu-check" aria-hidden="true">
                <FitIcon size={18} />
              </span>
              <span className="fp-menu-label">
                {t('nextEpisode')}
                <span className="fp-menu-sub">{autoplayNext ? 'Auto' : 'Manual'}</span>
              </span>
            </button>
          </li>
        )}

        {canPip && (
          <li>
            <button type="button" role="menuitem" className="fp-menu-row" onClick={onPip}>
              <span className="fp-menu-check" aria-hidden="true">
                <PipIcon size={18} />
              </span>
              <span className="fp-menu-label">{t('pip')}</span>
            </button>
          </li>
        )}

        <li>
          <button type="button" role="menuitem" className="fp-menu-row" onClick={onReload}>
            <span className="fp-menu-check" aria-hidden="true">
              <ReloadIcon size={18} />
            </span>
            <span className="fp-menu-label">{t('reload')}</span>
          </button>
        </li>
      </ul>

      {/* Shortcut reference, hidden from touch-only devices where it is noise. */}
      <dl className="fp-shortcuts" aria-label={t('shortcuts')}>
        <div>
          <dt>Space / K</dt>
          <dd>{t('play')} · {t('pause')}</dd>
        </div>
        <div>
          <dt>← →</dt>
          <dd>{t('back10')} · {t('forward10')}</dd>
        </div>
        <div>
          <dt>↑ ↓</dt>
          <dd>{t('volume')}</dd>
        </div>
        <div>
          <dt>F</dt>
          <dd>{t('fullscreen')}</dd>
        </div>
        <div>
          <dt>M</dt>
          <dd>{t('mute')}</dd>
        </div>
        <div>
          <dt>C</dt>
          <dd>{t('subtitles')}</dd>
        </div>
        <div>
          <dt>&lt; &gt;</dt>
          <dd>{t('speed')}</dd>
        </div>
        <div>
          <dt>0–9</dt>
          <dd>{t('seek')}</dd>
        </div>
      </dl>
    </div>
  );
}
