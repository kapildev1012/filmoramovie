// src/components/react/player/SubtitleLayer.tsx — our own cue renderer.
//
// WHY NOT NATIVE RENDERING
// The browser's built-in cue painting cannot be styled reliably across engines
// (::cue support is partial, positioning is opaque, and it does not know about
// our control bar). So tracks are held in `mode = 'hidden'`: the browser still
// parses the WebVTT and fires `cuechange` with frame-accurate timing — no drift,
// because the timing is still the browser's — and we paint the text.
//
// What this layer adds that native rendering does not:
// • `dir` per cue, resolved from the track's language, so Arabic and Hebrew lines
//   lay out right-to-left with correct punctuation placement.
// • A script-specific font stack (`fp-script-*`) so Devanagari, CJK, Cyrillic,
//   Arabic and Thai never fall back to a Latin-only face and render as boxes.
// • Size and backdrop from the viewer's persisted preference.
// • The whole block lifts above the control bar while the controls are visible,
//   instead of being covered by them.

import type { ActiveCue } from '../../../lib/player/types';
import type { SubtitleBackdrop, SubtitleSize } from '../../../lib/player/prefs';
import { scriptClass } from '../../../lib/player/languages';

interface SubtitleLayerProps {
  cues: ActiveCue[];
  size: SubtitleSize;
  backdrop: SubtitleBackdrop;
  /** Controls on screen — the cue block shifts up to clear the bar. */
  lifted: boolean;
}

export default function SubtitleLayer({ cues, size, backdrop, lifted }: SubtitleLayerProps) {
  if (cues.length === 0) return null;
  return (
    <div
      className={[
        'fp-cues',
        `fp-cues-${size}`,
        `fp-cues-bg-${backdrop}`,
        lifted ? 'is-lifted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // Subtitles are already spoken content; announcing them would flood a
      // screen reader, and assistive tech users have the audio.
      aria-hidden="true"
    >
      {cues.map((cue) => (
        <p
          key={cue.id}
          className={`fp-cue ${scriptClass(cue.lang)}`}
          lang={cue.lang !== 'und' ? cue.lang : undefined}
          dir={cue.dir}
        >
          {cue.lines.map((line, index) => (
            <span key={index} className="fp-cue-line">
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
