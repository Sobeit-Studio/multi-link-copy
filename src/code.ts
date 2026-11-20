import { compareIndexPaths, fileUrl, nodeLink, parseFigmaUrl } from './links';

type Screen = 'add-url' | 'copy' | 'settings';

// Window width and initial height per screen. The UI then reports its
// measured height with a `resize` message.
const SCREEN_SIZE: Record<Screen, { width: number; height: number }> = {
  'add-url': { width: 375, height: 100 },
  copy: { width: 216, height: 72 },
  settings: { width: 375, height: 145 },
};

const WINDOW_MARGIN = 16;
const STORAGE_KEY = 'file';

// --- Saved file key ---------------------------------------------------------

// Holds the key for this session only when the document cannot be written
// (view-only access), so the plugin still works there.
let sessionKey: string | null = null;

function loadFile(): string | null {
  if (sessionKey !== null) return sessionKey;
  const raw = figma.root.getPluginData(STORAGE_KEY);
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { key, name } = data as Record<string, unknown>;
  if (typeof key !== 'string' || !key || typeof name !== 'string') return null;
  // A different name means the file was duplicated or renamed: ask again.
  if (name !== figma.root.name) return null;
  return key;
}

function saveFile(key: string): void {
  try {
    figma.root.setPluginData(STORAGE_KEY, JSON.stringify({ key, name: figma.root.name }));
    sessionKey = null;
  } catch {
    sessionKey = key;
  }
}

function clearFile(): void {
  sessionKey = null;
  try {
    figma.root.setPluginData(STORAGE_KEY, '');
  } catch {
    // View-only: nothing was stored in the document.
  }
}

// --- Window -----------------------------------------------------------------

// `position` is in canvas space (the same space as node x/y) and
// `viewport.bounds` is the visible canvas area in that space, so the window
// size and margin are converted from screen pixels to canvas units by zoom.
function bottomRightPosition(width: number, height: number): { x: number; y: number } {
  const { bounds, zoom } = figma.viewport;
  return {
    x: bounds.x + bounds.width - (width + WINDOW_MARGIN) / zoom,
    y: bounds.y + bounds.height - (height + WINDOW_MARGIN) / zoom,
  };
}

const openScreen: Screen = loadFile() ? 'copy' : 'add-url';
const openSize = SCREEN_SIZE[openScreen];
let currentScreen: Screen = openScreen;
let uiReady = false;

figma.showUI(__html__, {
  title: 'Multi-link copy',
  themeColors: true,
  width: openSize.width,
  height: openSize.height,
  position: bottomRightPosition(openSize.width, openSize.height),
});

type CodeMessage =
  | { type: 'show'; screen: Screen; fileUrl?: string }
  | { type: 'url-invalid' }
  | { type: 'write-clipboard'; text: string; count: number };

// Nothing is posted before the UI has sent `ready`.
function post(message: CodeMessage): void {
  if (!uiReady) return;
  figma.ui.postMessage(message);
}

function show(screen: Screen, settingsUrl?: string): void {
  currentScreen = screen;
  const { width, height } = SCREEN_SIZE[screen];
  figma.ui.resize(width, height);
  post(settingsUrl === undefined ? { type: 'show', screen } : { type: 'show', screen, fileUrl: settingsUrl });
}

// --- Copy -------------------------------------------------------------------

// Position of a node in the layers panel as a path of indexes from the page
// down. `children` runs back to front (index 0 is the bottom of the panel), so
// each index is counted from the end to make the top layer 0.
function layerPath(node: SceneNode): number[] {
  const path: number[] = [];
  let child: SceneNode = node;
  let parent = node.parent;
  while (parent) {
    const siblings = parent.children;
    path.push(siblings.length - 1 - siblings.indexOf(child));
    if (parent.type === 'PAGE' || parent.type === 'DOCUMENT') break;
    child = parent;
    parent = child.parent;
  }
  return path.reverse();
}

function copyLinks(): void {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Select at least one layer.');
    return;
  }
  const key = loadFile();
  if (!key) {
    show('add-url');
    return;
  }
  const fileName = figma.root.name;
  const links = selection
    .map((node) => ({ node, path: layerPath(node) }))
    .sort((a, b) => compareIndexPaths(a.path, b.path))
    .map(({ node }) => nodeLink(key, fileName, node.id));
  post({ type: 'write-clipboard', text: links.join('\n'), count: links.length });
}

// --- Messages from the UI ---------------------------------------------------

figma.ui.onmessage = (msg: unknown) => {
  if (typeof msg !== 'object' || msg === null) return;
  const message = msg as Record<string, unknown>;

  switch (message.type) {
    case 'ready':
      uiReady = true;
      show(loadFile() ? 'copy' : 'add-url');
      break;

    case 'save-url': {
      const parsed = typeof message.url === 'string' ? parseFigmaUrl(message.url) : null;
      if (!parsed) {
        post({ type: 'url-invalid' });
        break;
      }
      saveFile(parsed.key);
      show('copy');
      break;
    }

    case 'copy':
      copyLinks();
      break;

    case 'copy-result':
      if (message.ok === true) {
        const count = message.count;
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
          figma.notify('Copied links');
        } else {
          figma.notify(count === 1 ? 'Copied 1 link' : `Copied ${count} links`);
        }
      } else {
        figma.notify('Could not copy the links. Try again.', { error: true });
      }
      break;

    case 'open-settings': {
      const key = loadFile();
      // No key should not happen here; fall back to asking for the URL.
      if (key) show('settings', fileUrl(key, figma.root.name));
      else show('add-url');
      break;
    }

    case 'close-settings':
      show('copy');
      break;

    case 'delete-url':
      clearFile();
      show('add-url');
      break;

    case 'resize': {
      const height = message.height;
      if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
        figma.ui.resize(SCREEN_SIZE[currentScreen].width, Math.ceil(height));
      }
      break;
    }
  }
};
