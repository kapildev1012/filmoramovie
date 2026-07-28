// src/components/react/player/TracksMenu.tsx — "Audio & Subtitles".
//
// Netflix's two-column panel, with the details that matter for a multi-language
// catalogue:
// • Every track is labelled in its OWN script via `nativeLanguageName` (ICU
//   endonym), with the manifest's own label kept as a secondary line when it adds
//   information ("Hindi 5.1", "Director's commentary").
// • Each row carries `lang` + `dir`, so an Arabic or Hebrew entry lays out
//   right-to-left *inside* an otherwise LTR menu, and gets a font stack that
//   contains its glyphs (`scriptClass`) instead of rendering tofu.
// • Empty is never silent: a source with one audio rendition says so, and a
//   title with no captions says so. An empty menu reads as a broken menu.
// • On the embed engine the tracks live inside the provider's own document and
//   cannot be enumerated at all, so instead of a fake list the panel explains
//   where the controls are and offers the server switcher as the real remedy.
// • Subtitle styling (size, backdrop) is only offered when we render the cues
//   ourselves — styling a track the provider paints is impossible.

import { CheckIcon } from './Icons';
import { nativeLanguageName, languageDirection, scriptClass } from '../../../lib/player/languages';
import type { AudioTrackInfo, TextTrackInfo } from '../../../lib/player/types';
import type { SubtitleBackdrop, SubtitleSize } from '../../../lib/player/prefs';
import type { PlayerT } from '../../../lib/player/strings';

interface TracksMenuProps {
  audioTracks: AudioTrackInfo[];
  textTracks: TextTrackInfo[];
  canSelectAudio: boolean;
  canSelectText: boolean;
  canStyleSubtitles: boolean;
  /** True for the third-party iframe engine — changes the empty-state copy. */
  managedExternally: boolean;
  subtitleSize: SubtitleSize;
  subtitleBackdrop: SubtitleBackdrop;
  onSelectAudio: (id: string) => void;
  onSelectText: (id: string | null) => void;
  onSubtitleSize: (size: SubtitleSize) => void;
  onSubtitleBackdrop: (backdrop: SubtitleBackdrop) => void;
  t: PlayerT;
}

/** One selectable row. `lang`/`dir` are set so the browser shapes text right. */
function TrackRow({
  label,
  sublabel,
  lang,
  active,
  onSelect,
}: {
  label: string;
  sublabel?: string;
  lang?: string;
  active: boolean;
  onSelect: () => void;
}) {
  const dir = lang ? languageDirection(lang) : 'ltr';
  return (
    <li>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        className={`fp-menu-row${active ? ' is-active' : ''}`}
        onClick={onSelect}
        lang={lang || undefined}
        dir={lang ? dir : undefined}
      >
        <span className="fp-menu-check" aria-hidden="true">
          {active && <CheckIcon size={16} />}
        </span>
        <span className={`fp-menu-label ${lang ? scriptClass(lang) : ''}`}>
          {label}
          {sublabel && <span className="fp-menu-sub">{sublabel}</span>}
        </span>
      </button>
    </li>
  );
}

export default function TracksMenu({
  audioTracks,
  textTracks,
  canSelectAudio,
  canSelectText,
  canStyleSubtitles,
  managedExternally,
  subtitleSize,
  subtitleBackdrop,
  onSelectAudio,
  onSelectText,
  onSubtitleSize,
  onSubtitleBackdrop,
  t,
}: TracksMenuProps) {
  const sizes: SubtitleSize[] = ['small', 'medium', 'large'];
  const backdrops: Array<{ id: SubtitleBackdrop; label: string }> = [
    { id: 'none', label: t('off') },
    { id: 'shadow', label: t('medium') },
    { id: 'box', label: t('large') },
  ];

  return (
    <div className="fp-tracks">
      <h3 className="fp-menu-title">{t('audioAndSubtitles')}</h3>

      {managedExternally ? (
        <p className="fp-menu-note">
          <strong>{t('tracksOnServer')}</strong>
          <span>{t('tracksOnServerHint')}</span>
        </p>
      ) : (
        <div className="fp-tracks-cols">
          {/* ── Audio ── */}
          <section className="fp-tracks-col" aria-labelledby="fp-audio-heading">
            <h4 className="fp-menu-subtitle" id="fp-audio-heading">
              {t('audio')}
            </h4>
            {canSelectAudio && audioTracks.length > 0 ? (
              <ul className="fp-menu-list" role="menu" aria-labelledby="fp-audio-heading">
                {audioTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    lang={track.lang}
                    label={nativeLanguageName(track.lang, track.label)}
                    // Only show the raw label when it says more than the language
                    // name already does (channel layout, commentary, etc.).
                    sublabel={
                      track.label && track.label !== nativeLanguageName(track.lang)
                        ? [track.label, track.channels === 6 ? '5.1' : null]
                            .filter(Boolean)
                            .join(' · ')
                        : track.channels === 6
                          ? '5.1'
                          : undefined
                    }
                    active={track.active}
                    onSelect={() => onSelectAudio(track.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="fp-menu-empty">{t('noAudioTracks')}</p>
            )}
          </section>

          {/* ── Subtitles ── */}
          <section className="fp-tracks-col" aria-labelledby="fp-subs-heading">
            <h4 className="fp-menu-subtitle" id="fp-subs-heading">
              {t('subtitles')}
            </h4>
            {canSelectText && textTracks.length > 0 ? (
              <ul className="fp-menu-list" role="menu" aria-labelledby="fp-subs-heading">
                <TrackRow
                  label={t('off')}
                  active={!textTracks.some((s) => s.active)}
                  onSelect={() => onSelectText(null)}
                />
                {textTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    lang={track.lang}
                    label={nativeLanguageName(track.lang, track.label)}
                    sublabel={
                      track.kind === 'captions'
                        ? 'CC'
                        : track.kind === 'forced'
                          ? 'Forced'
                          : undefined
                    }
                    active={track.active}
                    onSelect={() => onSelectText(track.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="fp-menu-empty">{t('noSubtitles')}</p>
            )}

            {/* Styling only exists where we paint the cues ourselves. */}
            {canStyleSubtitles && canSelectText && textTracks.length > 0 && (
              <div className="fp-menu-group">
                <p className="fp-menu-subtitle" id="fp-sub-size">
                  {t('subtitleSize')}
                </p>
                <div className="fp-segmented" role="group" aria-labelledby="fp-sub-size">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`fp-seg-btn${subtitleSize === size ? ' is-active' : ''}`}
                      aria-pressed={subtitleSize === size}
                      onClick={() => onSubtitleSize(size)}
                    >
                      {t(size)}
                    </button>
                  ))}
                </div>

                <p className="fp-menu-subtitle" id="fp-sub-bg">
                  {t('subtitleBackdrop')}
                </p>
                <div className="fp-segmented" role="group" aria-labelledby="fp-sub-bg">
                  {backdrops.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`fp-seg-btn${subtitleBackdrop === option.id ? ' is-active' : ''}`}
                      aria-pressed={subtitleBackdrop === option.id}
                      onClick={() => onSubtitleBackdrop(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
