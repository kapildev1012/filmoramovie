import { useState, useEffect, useRef } from 'react';

type ConsentLevel = 'all' | 'essential' | null;

const CONSENT_KEY = 'filmora_consent';
const PREFS_KEY = 'filmora_consent_prefs';

interface ConsentPrefs {
  essential: boolean;
  preferences: boolean;
  analytics: boolean;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<ConsentPrefs>({
    essential: true, // always on
    preferences: false,
    analytics: false,
  });

  useEffect(() => {
    const existing = localStorage.getItem(CONSENT_KEY);
    if (!existing) {
      // Small delay so it doesn't flash immediately
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  /**
   * RESERVE THE BANNER'S OWN HEIGHT.
   *
   * The banner is `position: fixed; bottom: 0` at z-index 200, so it paints over
   * whatever the bottom of the viewport happens to be showing. On a phone it is
   * not a slim strip but a stacked card (see mobile.css: column layout, full-width
   * buttons, optional "customize" panel) — 200px or more. Anything a viewer
   * scrolls to the bottom edge is therefore not just hidden but UNTAPPABLE, and
   * the page offers no way to scroll it clear because the document ends there.
   *
   * That is how the player's server picker became unusable on mobile: it sits
   * directly under the video, the viewer scrolls down to it, and it lands in the
   * band the banner owns. Taps went to the banner.
   *
   * Publishing the measured height lets the document grow by exactly that much,
   * so every element can be scrolled into free space. Measured rather than
   * hard-coded because the height changes with locale wrapping and with the
   * customize panel opening. Cleared on unmount so a dismissed banner leaves no
   * dead space behind.
   */
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.classList.remove('has-consent-bar');
      root.style.removeProperty('--consent-bar-h');
    };
    if (!visible) {
      clear();
      return;
    }
    const bar = barRef.current;
    if (!bar) return;
    const publish = () => {
      // Reserve the whole band the banner owns: its own height PLUS its offset
      // from the bottom edge, because on mobile it is lifted clear of the bottom
      // tab bar (mobile.css) and the safe-area inset. One measurement covers
      // banner, lift and inset with nothing hard-coded.
      //
      // Deliberately `offsetHeight` + computed `bottom` rather than
      // getBoundingClientRect(): the banner enters with a `translateY(100%)`
      // slide, and a rect read mid-animation reports it still off-screen, which
      // would publish a band far too small and leave the content trapped again.
      // Layout values are transform-independent, so the number is right on the
      // first frame.
      const bottom = parseFloat(getComputedStyle(bar).bottom) || 0;
      const band = Math.max(0, Math.ceil(bar.offsetHeight + bottom));
      root.classList.add('has-consent-bar');
      root.style.setProperty('--consent-bar-h', `${band}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(bar);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      clear();
    };
  }, [visible, showCustomize]);

  function saveConsent(level: ConsentLevel, customPrefs?: ConsentPrefs) {
    const finalPrefs: ConsentPrefs = customPrefs ?? {
      essential: true,
      preferences: level === 'all',
      analytics: level === 'all',
    };
    localStorage.setItem(CONSENT_KEY, level ?? 'essential');
    localStorage.setItem(PREFS_KEY, JSON.stringify(finalPrefs));
    setVisible(false);

    // Dispatch event so other code can respond (e.g. load analytics)
    window.dispatchEvent(new CustomEvent('filmora:consent', { detail: finalPrefs }));
  }

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      aria-describedby="cookie-desc"
      className="cookie-banner"
    >
      <div className="cookie-content">
        {!showCustomize ? (
          <>
            <div className="cookie-text">
              <p id="cookie-desc" className="cookie-desc">
                <strong>We use cookies</strong> to keep your session active and remember your preferences. We don't track you for ads — only the cookies listed in our{' '}
                <a href="/privacy" className="cookie-link">Privacy Policy</a> are used:
              </p>
              <ul className="cookie-list">
                <li><strong>Essential</strong> — session cookie (auth), security token. Cannot be disabled.</li>
                <li><strong>Preferences</strong> — remembers your last active profile.</li>
                <li><strong>Analytics</strong> — anonymous page view counts (opt-in only).</li>
              </ul>
            </div>

            <div className="cookie-actions">
              <button
                className="btn btn-primary"
                onClick={() => saveConsent('all')}
              >
                Accept all
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => saveConsent('essential')}
              >
                Essential only
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowCustomize(true)}
              >
                Customize
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="cookie-customize-title">Customize cookie preferences</h3>
            <div className="cookie-toggles">
              <ToggleRow
                label="Essential cookies"
                description="Required for authentication and security. Always enabled."
                checked={true}
                disabled
                onChange={() => {}}
              />
              <ToggleRow
                label="Preference cookies"
                description="Remembers your last active profile and UI preferences."
                checked={prefs.preferences}
                onChange={(v) => setPrefs((p) => ({ ...p, preferences: v }))}
              />
              <ToggleRow
                label="Analytics cookies"
                description="Anonymous page view data to help us understand what content is popular."
                checked={prefs.analytics}
                onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
              />
            </div>
            <div className="cookie-actions">
              <button
                className="btn btn-primary"
                onClick={() => saveConsent('essential', prefs)}
              >
                Save preferences
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowCustomize(false)}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .cookie-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: var(--z-banner);
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          padding: 1.25rem 0;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.4);
          animation: slideUp 0.25s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .cookie-content {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        @media (min-width: 768px) {
          .cookie-content {
            flex-direction: row;
            align-items: center;
            padding: 0 2.5rem;
          }
        }
        @media (min-width: 1280px) {
          .cookie-content { padding: 0 4rem; }
        }
        .cookie-text {
          flex: 1;
        }
        .cookie-desc {
          font-size: 0.875rem;
          color: var(--color-text-2);
          margin: 0 0 0.5rem;
          line-height: 1.5;
        }
        .cookie-desc strong { color: var(--color-text); }
        .cookie-list {
          font-size: 0.8125rem;
          color: var(--color-text-3);
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }
        .cookie-list strong { color: var(--color-text-2); }
        .cookie-link {
          color: var(--color-accent-from);
          text-decoration: none;
        }
        .cookie-link:hover { text-decoration: underline; }
        .cookie-actions {
          display: flex;
          gap: 0.625rem;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .cookie-customize-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 1rem;
        }
        .cookie-toggles {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
          flex: 1;
        }
        /* Toggle row */
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }
        .toggle-row-info {}
        .toggle-row-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }
        .toggle-row-desc {
          font-size: 0.75rem;
          color: var(--color-text-3);
          margin-top: 0.125rem;
        }
        .toggle {
          position: relative;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }
        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }
        .toggle-track {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          background: var(--color-border);
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .toggle input:checked + .toggle-track {
          background: linear-gradient(90deg, var(--color-accent-from), var(--color-accent-to));
        }
        .toggle input:disabled + .toggle-track {
          background: var(--color-surface-2);
          cursor: not-allowed;
        }
        .toggle-track::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s ease;
        }
        .toggle input:checked + .toggle-track::after {
          transform: translateX(16px);
        }
      `}</style>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="toggle-row">
      <div className="toggle-row-info">
        <div className="toggle-row-label">{label}</div>
        <div className="toggle-row-desc">{description}</div>
      </div>
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
        />
        <span className="toggle-track" />
      </label>
    </div>
  );
}
