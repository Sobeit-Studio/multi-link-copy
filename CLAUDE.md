# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Multi-Link Copy is a published Figma plugin (Community ID `1423324569458473026`, runs in Figma design and Dev Mode). The user selects frames or components, and the plugin copies one link per selected node to the clipboard, one per line, in layer-panel order (top layers first, nested layers included), ready to paste into a spreadsheet or document.

Listing: https://www.figma.com/community/plugin/1423324569458473026/multi-link-copy (published Version 3, October 3, 2024). The listing is JS-rendered and returns 403 to plain HTTP fetches; read it through a browser.

## Commands

```bash
npm install
npm run build      # tsc: code.ts -> code.js
npm run watch      # rebuild on change
npm run lint       # eslint, including @figma/figma-plugins rules
npm run lint:fix
```

There are no tests. `npm run lint` currently fails with one error (`no-inner-declarations` on `getAllNodes` in `code.ts`).

To run the plugin: Figma desktop app → Plugins → Development → Import plugin from manifest → pick `manifest.json`. Figma loads `code.js`, so build before testing. `code.js` is a gitignored build artifact; edit `code.ts` only.

The folder is not a git repository yet.

## Architecture

Two files, two runtimes, talking only through `postMessage`:

- `code.ts` runs in Figma's plugin sandbox. It has the `figma` API (selection, page tree, `figma.notify`) but no DOM and no clipboard.
- `ui.html` runs in an iframe. It has the DOM and clipboard but no access to the document. It is a single self-contained file (inline CSS and JS, no bundler).

Message protocol:

| Direction | `type` | Purpose |
| --- | --- | --- |
| UI → code | `submit-url` (`url`) | User pasted the file URL; code extracts `fileKey` from it |
| UI → code | `copy-links` | Build links for the current selection |
| code → UI | `show-enter-url`, `show-select-nodes`, `show-copy-links` | Switch the visible `.state` panel |
| code → UI | `copy-to-clipboard` (`text`) | UI writes the text to the clipboard via a temporary textarea and `document.execCommand('copy')` |

Flow: the UI opens on the "enter URL" panel → `submit-url` → code validates the URL with a regex, stores `fileKey` in a module variable, switches to the "select nodes" panel → `copy-links` → code flattens the whole current page depth-first, filters that list down to the selected nodes (this is what gives layer-panel order), builds the URLs and sends them back for copying.

Why the URL step exists: `figma.fileKey` is only available to private plugins (`enablePrivatePluginApi`) and Figma-owned resources, so a public Community plugin cannot learn the file key by itself. Checked against the Plugin API docs on 2026-11-20; the docs name no alternative for public plugins.

`manifest.json` declares `documentAccess: "dynamic-page"` (only the current page is loaded; cross-page node access must be async) and `networkAccess: none` (the listing advertises "No network access", so the UI cannot load remote assets).

## Figma platform facts (from developers.figma.com/docs/plugins, read 2026-11-20)

- Dev Mode: `figma.currentPage.selection` returns only one node, the document is read-only, and the iframe fills the Inspect panel (design for a 300px minimum width). So multi-link copy cannot work from selection alone in Dev Mode, although the manifest lists `dev`.
- Under `dynamic-page`, `figma.getNodeById` throws; use `getNodeByIdAsync`. Other pages need `page.loadAsync()` before reading `children`.
- Updates to an already-approved plugin publish immediately with no further review. Keep the manifest `id` unchanged. Users cannot roll back; republish an earlier build to revert. Release notes go in the listing's Version history.
- Dev loop: Plugins → Development → run the plugin; enable "Hot reload plugin" so a rebuild restarts it; Plugins → Development → Open Console (⌥⌘I) for logs.
- The docs give no guidance on clipboard access from the iframe and no unit-testing guidance. Plain `tsc` is a supported build; bundlers are optional.

## Things to know before editing

- `ui.html` is about 234 KB because the header image is an inline base64 JPEG on a single line (around line 57). Never read or print the whole file; use `cut -c1-400 ui.html` or read specific line ranges, and keep edits away from that line.
- `README.md` is cut off partway through the installation code block.
- `Cover.jpg`, `Icon.jpg` and `image.jpg` are the Community listing assets, not used by the code.

## Known issues

Reported by users on the listing:

- "Node IDs are butchered" and the URLs "look nothing like the URLs I copy separately". The plugin emits `https://www.figma.com/file/<fileKey>/?node-id=<encodeURIComponent(node.id)>`, so `1:2` becomes `1%3A2`. Figma's own links use the `/design/<fileKey>/<file-name>?node-id=1-2` form (colon replaced by a hyphen).
- "How do I select more than one?" The UI never explains multi-selection (Shift-click or drag-select on the canvas).

Found in the code:

- `validateFigmaURL` only accepts `https://www.figma.com/(file|proto|design)/<key>/`. It rejects URLs without `www.`, without a trailing slash after the key, and FigJam (`/board/`) URLs. For a branch URL it captures the main file key, not the branch key.
- The file key lives in a module variable, so the URL has to be pasted again on every run.
- The success toast ("Copied N link(s)") fires in `code.ts` before the UI has attempted the copy, so it shows even when `execCommand('copy')` fails.
- `show-copy-links` targets an element id (`copy-links-state`) that does not exist in `ui.html`; that state is never used.
- The initial `showUI('enter-url')` is posted before the iframe has loaded; it only appears to work because that panel is visible by default in the markup.
- Selection ordering walks every node on the page and does an `O(page nodes × selection)` comparison, which will be slow on large pages.
- `console.log` debugging statements are left throughout both files.
