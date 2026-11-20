/**
 * Control characters and bidi formatting marks can visually spoof names and amounts
 * (e.g. U+202E flips the text after it). They're stripped wherever user text is saved
 * AND when a backup is imported, using this one rule, so a backup made by the app
 * always restores. ZWJ (U+200D) is kept: emoji sequences need it.
 *
 * Stripped: C0 controls U+0000–U+001F, DEL U+007F, ALM U+061C, LRM/RLM U+200E–U+200F,
 * embeddings/overrides U+202A–U+202E, isolates U+2066–U+2069.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const UNSAFE_CHARS = /[\u0000-\u001F\u007F؜‎‏‪-‮⁦-⁩]/g;

/** Removes control and bidi formatting characters. */
export function stripUnsafeChars(s: string): string {
  return s.replace(UNSAFE_CHARS, '');
}

/** How names (categories, wallets) are stored: cleaned, trimmed, single spaces. */
export function normalizeName(s: string): string {
  return stripUnsafeChars(s).trim().replace(/\s+/g, ' ');
}
