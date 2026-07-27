// src/components/react/player/Icons.tsx — inline SVG icons for the player.
//
// Inline (not lucide-react) for three reasons: the control bar renders on every
// frame of a drag, these ship as zero extra bytes over the island, and every
// glyph here is drawn on a 24px grid with a 2px stroke so the bar stays optically
// aligned at any size. All are `aria-hidden` — the button around them owns the
// label.

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  focusable: 'false' as const,
  className,
});

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function PlayIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}

export function ReplayIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/** ±10s skip. `direction` mirrors the arrow and moves the numeral. */
export function SkipIcon({
  size = 22,
  className,
  direction,
}: IconProps & { direction: 'forward' | 'back' }) {
  const flip = direction === 'back' ? 'scale(-1 1) translate(-24 0)' : undefined;
  return (
    <svg {...base(size, className)} {...stroke}>
      <g transform={flip}>
        <path d="M4 12a8 8 0 1 0 8-8H7" />
        <path d="M10 1.5 6.5 4 10 6.5" />
      </g>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </svg>
  );
}

export function VolumeIcon({ size = 22, className, level }: IconProps & { level: number }) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      {level === 0 ? (
        <>
          <path d="m22 9-6 6" />
          <path d="m16 9 6 6" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          {level > 0.55 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
        </>
      )}
    </svg>
  );
}

/** Closed-caption badge. Filled when captions are on. */
export function CaptionsIcon({ size = 22, className, active }: IconProps & { active?: boolean }) {
  return (
    <svg {...base(size, className)} fill="none">
      <rect
        x="2.5"
        y="4.5"
        width="19"
        height="15"
        rx="3"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9.5 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6"
        fill="none"
        stroke={active ? 'var(--fp-cc-glyph, #000)' : 'currentColor'}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AudioTrackIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" />
    </svg>
  );
}

export function SpeedIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M12 20a8 8 0 1 0-8-8" />
      <path d="m12 12 4-4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SettingsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 7.2l1.9 1.1M17.9 15.7l1.9 1.1M4.2 16.8l1.9-1.1M17.9 8.3l1.9-1.1" />
    </svg>
  );
}

export function MoreIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

export function FullscreenIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function ExitFullscreenIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function PipIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export function NextIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M6 5l9 7-9 7z" />
      <path d="M16.5 5H19v14h-2.5z" />
    </svg>
  );
}

export function PrevIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M18 5l-9 7 9 7z" />
      <path d="M5 5h2.5v14H5z" />
    </svg>
  );
}

export function EpisodesIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <rect x="3" y="4" width="8" height="6" rx="1.5" />
      <rect x="3" y="14" width="8" height="6" rx="1.5" />
      <path d="M14 6h7M14 10h5M14 16h7M14 20h5" />
    </svg>
  );
}

export function BrightnessIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function ZoomInIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

export function ZoomOutIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </svg>
  );
}

export function FitIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 9h8M8 15h8" />
    </svg>
  );
}

export function GestureIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M9 11V6a2 2 0 1 1 4 0v5" />
      <path d="M13 11V9a2 2 0 1 1 4 0v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-3l-1.5 1" />
    </svg>
  );
}

export function ReloadIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function CheckIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function WarningIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size, className)} {...stroke}>
      <path d="M12 4.5 2.8 20h18.4z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
