// src/components/react/player/Popover.tsx — the shared menu surface.
//
// One primitive behind every player menu (tracks, speed, overflow) so they all
// behave identically:
//   • Escape closes and returns focus to the trigger.
//   • Tab is trapped inside while open — a menu floating over video must not let
//     focus wander to the page behind it.
//   • A pointerdown outside closes it, but a pointerdown *inside* never bubbles
//     to the stage (which would treat it as a tap-to-toggle-playback).
//   • Auto-hide of the control bar is suppressed while any menu is open; that is
//     handled in usePlayer via `menu !== null`.
//   • On narrow screens the CSS promotes the panel to a bottom sheet with
//     safe-area padding; no JS branch is needed.

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the panel. */
  label: string;
  /** Element that opened it — focus goes back here on close. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Extra class for placement variants (`fp-menu-end`, `fp-sheet`). */
  className?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Popover({
  open,
  onClose,
  label,
  triggerRef,
  className = '',
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    onClose();
    // Restore focus so keyboard users are not dropped at the top of the page.
    triggerRef.current?.focus();
  }, [onClose, triggerRef]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    // `preventScroll` keeps the page from jumping when the panel is tall.
    first?.focus({ preventScroll: true });
  }, [open]);

  // Outside pointerdown closes. Registered on the document in the capture phase
  // so it still fires when the stage stops propagation of its own pointer events.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target as Node;
      if (panel.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={`fp-menu ${className}`}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
          return;
        }
        if (event.key !== 'Tab') return;
        const panel = panelRef.current;
        if (!panel) return;
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      // Keep menu interaction from reaching the stage's tap-to-play handler.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
