// src/lib/player/languages.ts — language tags → labels a native speaker reads.
//
// Requirement: every audio / subtitle track must be listed in its OWN script
// ("Français", "हिन्दी", "日本語"), not an English exonym.
//
// STRATEGY
// 1. Ask the platform: `Intl.DisplayNames` with the *track's own* locale as the
//    display locale returns the endonym (the name in that language) for every
//    tag the browser's ICU data knows. This covers far more languages, and more
//    correctly, than any table we could hand-maintain.
// 2. Fall back to a small table for engines that report odd tags and for
//    browsers without ICU data (Chrome on Android Go, some WebViews).
// 3. Last resort: the tag itself, uppercased, so a track is never nameless.
//
// Direction comes from `Intl.Locale.textInfo` when available, else a code list.
// Both results are memoised because menus re-render on every keystroke.

/** Endonyms for tags we must never fail on, even without ICU data. */
const FALLBACK_ENDONYM: Record<string, string> = {
  aa: 'Afaraf', ab: 'Аҧсуа', af: 'Afrikaans', am: 'አማርኛ', ar: 'العربية',
  as: 'অসমীয়া', az: 'Azərbaycan', ba: 'Башҡорт', be: 'Беларуская', bg: 'Български',
  bn: 'বাংলা', bo: 'བོད་སྐད་', bs: 'Bosanski', ca: 'Català', ceb: 'Cebuano',
  cs: 'Čeština', cy: 'Cymraeg', da: 'Dansk', de: 'Deutsch', el: 'Ελληνικά',
  en: 'English', eo: 'Esperanto', es: 'Español', et: 'Eesti', eu: 'Euskara',
  fa: 'فارسی', fi: 'Suomi', fil: 'Filipino', fo: 'Føroyskt', fr: 'Français',
  ga: 'Gaeilge', gl: 'Galego', gu: 'ગુજરાતી', ha: 'Hausa', he: 'עברית',
  hi: 'हिन्दी', hr: 'Hrvatski', hu: 'Magyar', hy: 'Հայերեն', id: 'Indonesia',
  ig: 'Igbo', is: 'Íslenska', it: 'Italiano', ja: '日本語', jv: 'Jawa',
  ka: 'ქართული', kk: 'Қазақ', km: 'ខ្មែរ', kn: 'ಕನ್ನಡ', ko: '한국어',
  ku: 'Kurdî', ky: 'Кыргызча', la: 'Latina', lo: 'ລາວ', lt: 'Lietuvių',
  lv: 'Latviešu', mi: 'Māori', mk: 'Македонски', ml: 'മലയാളം', mn: 'Монгол',
  mr: 'मराठी', ms: 'Melayu', mt: 'Malti', my: 'မြန်မာ', ne: 'नेपाली',
  nl: 'Nederlands', no: 'Norsk', or: 'ଓଡ଼ିଆ', pa: 'ਪੰਜਾਬੀ', pl: 'Polski',
  ps: 'پښتو', pt: 'Português', ro: 'Română', ru: 'Русский', sd: 'سنڌي',
  si: 'සිංහල', sk: 'Slovenčina', sl: 'Slovenščina', so: 'Soomaali', sq: 'Shqip',
  sr: 'Српски', sv: 'Svenska', sw: 'Kiswahili', ta: 'தமிழ்', te: 'తెలుగు',
  tg: 'Тоҷикӣ', th: 'ไทย', ti: 'ትግርኛ', tk: 'Türkmen', tl: 'Tagalog',
  tr: 'Türkçe', tt: 'Татар', ug: 'ئۇيغۇرچە', uk: 'Українська', ur: 'اردو',
  uz: 'Oʻzbek', vi: 'Tiếng Việt', yi: 'ייִדיש', yo: 'Yorùbá', zh: '中文',
  zu: 'isiZulu',
};

/** Regional variants worth spelling out — viewers do distinguish these. */
const FALLBACK_REGIONAL: Record<string, string> = {
  'pt-br': 'Português (Brasil)',
  'pt-pt': 'Português (Portugal)',
  'es-419': 'Español (Latinoamérica)',
  'es-mx': 'Español (México)',
  'es-es': 'Español (España)',
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文',
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'zh-hk': '繁體中文（香港）',
  'en-gb': 'English (UK)',
  'en-us': 'English (US)',
  'fr-ca': 'Français (Canada)',
};

/** Right-to-left languages, for browsers without `Intl.Locale.textInfo`. */
const RTL_CODES = new Set([
  'ar', 'arc', 'ckb', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'sd',
  'ug', 'ur', 'yi',
]);

const nameCache = new Map<string, string>();
const dirCache = new Map<string, 'ltr' | 'rtl'>();

/** Lowercase, normalise separators, drop empty/placeholder tags. */
function normalise(tag: string | null | undefined): string {
  const t = (tag ?? '').trim().replace(/_/g, '-').toLowerCase();
  // 'und' (undetermined) and 'mul' are real ISO values that mean "no idea".
  if (!t || t === 'und' || t === 'mul' || t === 'zxx') return '';
  return t;
}

/** Primary subtag, e.g. 'pt-BR' → 'pt'. */
export function baseLanguage(tag: string | null | undefined): string {
  return normalise(tag).split('-')[0] ?? '';
}

/**
 * Display name for a language tag, in that language's own script.
 * `fallbackLabel` (usually the manifest's own label) wins over "Unknown".
 */
export function nativeLanguageName(
  tag: string | null | undefined,
  fallbackLabel?: string | null
): string {
  const t = normalise(tag);
  if (!t) return fallbackLabel?.trim() || 'Unknown';

  const cached = nameCache.get(t);
  if (cached) return cached;

  let name = '';

  // 1. Platform ICU data, asked in the track's own language → endonym.
  try {
    const DisplayNames = (
      Intl as typeof Intl & {
        DisplayNames?: new (
          locales: string | string[],
          options: { type: string; fallback?: string }
        ) => { of(code: string): string | undefined };
      }
    ).DisplayNames;
    if (DisplayNames) {
      const resolved = new DisplayNames([t, 'en'], { type: 'language', fallback: 'none' }).of(t);
      // ICU sometimes echoes the tag back; that is not a name.
      if (resolved && resolved.toLowerCase() !== t) name = resolved;
    }
  } catch {
    /* unsupported tag or no ICU data — fall through to the table */
  }

  // 2. Hand-maintained fallbacks (regional first, it is more specific).
  if (!name) name = FALLBACK_REGIONAL[t] ?? '';
  if (!name) name = FALLBACK_ENDONYM[baseLanguage(t)] ?? '';

  // 3. Never nameless.
  if (!name) name = fallbackLabel?.trim() || t.toUpperCase();

  // Capitalise the first letter for scripts that have case (ICU returns
  // lowercase endonyms for e.g. 'fr' → 'français' in some versions).
  name = name.charAt(0).toLocaleUpperCase(t) + name.slice(1);

  nameCache.set(t, name);
  return name;
}

/** Text direction for a language tag. */
export function languageDirection(tag: string | null | undefined): 'ltr' | 'rtl' {
  const t = normalise(tag);
  if (!t) return 'ltr';
  const cached = dirCache.get(t);
  if (cached) return cached;

  let dir: 'ltr' | 'rtl' = 'ltr';
  try {
    // `Intl.Locale.textInfo` is a newer addition than the bundled lib types
    // describe, so the instance is narrowed through `unknown` rather than
    // relying on the ambient declaration.
    const LocaleCtor = (Intl as { Locale?: new (tag: string) => unknown }).Locale;
    if (LocaleCtor) {
      const info = (new LocaleCtor(t) as { textInfo?: { direction?: string } }).textInfo;
      if (info?.direction === 'rtl') dir = 'rtl';
    }
  } catch {
    /* invalid tag — use the code list */
  }
  if (dir === 'ltr' && RTL_CODES.has(baseLanguage(t))) dir = 'rtl';

  dirCache.set(t, dir);
  return dir;
}

/**
 * Script family of a tag, used to attach a font stack that actually contains
 * the glyphs. Without this, Devanagari/CJK/Arabic subtitles fall back to a Latin
 * font and render as tofu boxes on Windows and older Android.
 */
export type ScriptFamily = 'latin' | 'devanagari' | 'arabic' | 'hebrew' | 'cjk' | 'cyrillic' | 'thai' | 'indic' | 'other';

const SCRIPT_BY_LANGUAGE: Record<string, ScriptFamily> = {
  hi: 'devanagari', mr: 'devanagari', ne: 'devanagari', sa: 'devanagari', kok: 'devanagari',
  ar: 'arabic', fa: 'arabic', ur: 'arabic', ps: 'arabic', sd: 'arabic', ug: 'arabic', ku: 'arabic',
  he: 'hebrew', yi: 'hebrew',
  ja: 'cjk', ko: 'cjk', zh: 'cjk', yue: 'cjk',
  ru: 'cyrillic', uk: 'cyrillic', bg: 'cyrillic', sr: 'cyrillic', mk: 'cyrillic',
  be: 'cyrillic', kk: 'cyrillic', ky: 'cyrillic', mn: 'cyrillic', tt: 'cyrillic', tg: 'cyrillic',
  th: 'thai', lo: 'thai',
  bn: 'indic', ta: 'indic', te: 'indic', kn: 'indic', ml: 'indic', gu: 'indic',
  pa: 'indic', or: 'indic', si: 'indic', as: 'indic', am: 'indic', ti: 'indic',
  km: 'indic', my: 'indic', bo: 'indic',
};

export function scriptFamily(tag: string | null | undefined): ScriptFamily {
  const base = baseLanguage(tag);
  if (!base) return 'other';
  return SCRIPT_BY_LANGUAGE[base] ?? 'latin';
}

/**
 * CSS class that carries the right font stack (defined in styles/player.css).
 * Applied to both the menu row and the rendered cue.
 */
export function scriptClass(tag: string | null | undefined): string {
  return `fp-script-${scriptFamily(tag)}`;
}
