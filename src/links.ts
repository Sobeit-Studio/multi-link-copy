// Pure helpers for parsing Figma file URLs and building node links.
// No `figma` global here, so Node's test runner can import this file directly.

// Scheme and host, matched case-insensitively: figma.com or www.figma.com.
const FIGMA_ORIGIN = /^https?:\/\/(?:www\.)?figma\.com(?=\/)/i;

// Path, case-sensitive: type file/design/proto, then the key, optionally
// followed by /branch/<segment>. The key must end the string or be followed by
// "/", "?" or "#"; the branch segment runs up to the next of those.
const FIGMA_FILE_PATH = /^\/(?:file|design|proto)\/([A-Za-z0-9]+)(?:\/branch\/([^/?#]*))?(?:[/?#]|$)/;

const KEY = /^[A-Za-z0-9]+$/;

export function parseFigmaUrl(url: string): { key: string } | null {
  const trimmed = url.trim();
  const origin = FIGMA_ORIGIN.exec(trimmed);
  if (!origin) return null;
  const match = FIGMA_FILE_PATH.exec(trimmed.slice(origin[0].length));
  if (!match) return null;
  const branch = match[2];
  // An empty branch segment keeps the main key; an invalid one is rejected.
  if (!branch) return { key: match[1] };
  return KEY.test(branch) ? { key: branch } : null;
}

// Runs of ASCII characters other than letters and digits become "-".
// Non-ASCII characters (code units 0x80 and up) are kept, then percent-encoded.
export function fileSlug(name: string): string {
  const slug = name.replace(/[^A-Za-z0-9\u0080-\uFFFF]+/g, '-').replace(/^-+|-+$/g, '');
  return encodeURIComponent(slug || 'Untitled');
}

export function fileUrl(key: string, fileName: string): string {
  return `https://www.figma.com/design/${key}/${fileSlug(fileName)}`;
}

export function nodeLink(key: string, fileName: string, nodeId: string): string {
  const id = encodeURIComponent(nodeId.replace(/:/g, '-'));
  return `${fileUrl(key, fileName)}?node-id=${id}`;
}

// Lexicographic order; when one path is a prefix of the other, the shorter
// (the parent) sorts first.
export function compareIndexPaths(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}
