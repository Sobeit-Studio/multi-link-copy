# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Multi-Link Copy is a Figma plugin (Community ID `1423324569458473026`). It runs in Figma design only. Dev Mode was removed from the manifest because Dev Mode reports only one selected layer, so multi-link copy cannot work there. The user selects layers, and the plugin copies one link per selected node to the clipboard, one per line, in layer-panel order (top layers first, nested layers included), ready to paste into a spreadsheet or document.

Listing: https://www.figma.com/community/plugin/1423324569458473026/multi-link-copy (the listing is JS-rendered and returns 403 to plain HTTP fetches; read it through a browser).

Repository: https://github.com/Sobeit-Studio/multi-link-copy

The published Community version is still Version 3 from October 3, 2024. This redesign is not published yet.

## Commands

```bash
npm install
npm run build      # typecheck with tsc (no emit), then bundle src/code.ts to code.js with esbuild
npm run watch      # esbuild rebuild on change (no typecheck)
npm run lint       # eslint on src, including @figma/figma-plugins rules
npm run lint:fix
npm test           # Node's built-in test runner on test/**/*.test.ts
node --test test/links.test.ts                                        # one test file
node --test --test-name-pattern "<name>" test/links.test.ts           # one test by name
```

Test output includes a `MODULE_TYPELESS_PACKAGE_JSON` warning. It is harmless.

To run the plugin: Figma desktop app → Plugins → Development → Import plugin from manifest → pick `manifest.json`. Figma loads `code.js`, so build before testing. `code.js` is a gitignored build artifact; edit the files in `src/` only.

## Architecture

- `src/code.ts` runs in Figma's plugin sandbox. It has the `figma` API but no DOM and no clipboard.
- `src/links.ts` holds the pure helpers: `parseFigmaUrl`, `fileSlug`, `fileUrl`, `nodeLink`, `compareIndexPaths`. It has no `figma` global. It is the only unit-tested code (`test/links.test.ts`).
- `ui.html` runs in an iframe. It has the DOM and clipboard but no access to the document. It has three screens, `add-url`, `copy` and `settings`, and only one is visible at a time.

The two runtimes talk only through `postMessage`.

| Direction | `type` | Fields | Purpose |
| --- | --- | --- | --- |
| UI → code | `ready` | | The UI has loaded. Code posts nothing before this. |
| UI → code | `save-url` | `url` | Parse the pasted URL, store the key, show `copy`. |
| UI → code | `copy` | | Build links for the current selection. |
| UI → code | `copy-result` | `ok`, `count` | Result of the clipboard write; code shows the toast. |
| UI → code | `open-settings` | | Show `settings`. |
| UI → code | `close-settings` | | Show `copy`. |
| UI → code | `delete-url` | | Clear the stored key and show `add-url`. |
| UI → code | `resize` | `screen`, `height` | Resize the window to the measured height. Code ignores it if `screen` is not the current screen. |
| code → UI | `show` | `screen`, optional `fileUrl` | Show a screen. `fileUrl` is sent for `settings`. |
| code → UI | `url-invalid` | | Show the invalid-URL error. |
| code → UI | `write-clipboard` | `text`, `count` | UI writes `text` to the clipboard with a temporary textarea and `document.execCommand('copy')`. |

Flow:

- On start, code opens the window on `copy` if a key is stored, otherwise on `add-url`. Once the UI sends `ready`, code sends `show` for the same screen.
- The file key is stored in document plugin data on `figma.root` under the key `file` as `{ key, name }`, where `name` is the file name at save time. After writing or clearing it the code calls `figma.commitUndo()`, so undo does not silently drop or restore the key. When loading, a stored name that differs from the current file name counts as no key. This re-asks for the URL after a file is duplicated or renamed.
- If `setPluginData` throws (view-only file), the key is kept in memory for the session instead. Delete clears only the in-memory key and attempts to clear the stored one.
- `copy` with an empty selection shows a notification and does nothing else. With no key it shows `add-url`.
- Links are ordered by sorting the selected nodes by index path. Figma's `children` runs back to front, so each index is counted from the end to make the top layer 0. Nothing walks the whole page.
- Code sends `write-clipboard`. The UI writes it and answers with `copy-result`. The "Copied N links" toast appears only when `ok` is true; otherwise an error toast appears.
- The UI measures the height of the visible screen and sends `resize` after each `show`, when the URL error appears or clears, and when the window width changes. Code keeps the width from `SCREEN_SIZE` and applies the reported height. `SCREEN_SIZE` holds only the initial sizes.
- The window opens at the bottom right of the viewport (`bottomRightPosition`, converted from screen pixels to canvas units by zoom).

Link format: `https://www.figma.com/design/<key>/<slug>?node-id=<id>`, with `:` in the node id replaced by `-` and the rest URI-encoded. `parseFigmaUrl` accepts `figma.com` with or without `www.`, path type `file`, `design` or `proto`, and uses the branch key for branch URLs.

Why the URL step exists: `figma.fileKey` is only available to private plugins (`enablePrivatePluginApi`) and Figma-owned resources, so a public Community plugin cannot learn the file key by itself. Checked against the Plugin API docs on 2026-11-20; the docs name no alternative for public plugins.

`manifest.json` declares `documentAccess: "dynamic-page"` (only the current page is loaded; cross-page node access must be async), `editorType: ["figma"]` and `networkAccess: none` (the listing advertises "No network access", so the UI cannot load remote assets).

## Figma platform facts (from developers.figma.com/docs/plugins, read 2026-11-20)

- Dev Mode: `figma.currentPage.selection` returns only one node, the document is read-only, and the iframe fills the Inspect panel.
- Under `dynamic-page`, `figma.getNodeById` throws; use `getNodeByIdAsync`. Other pages need `page.loadAsync()` before reading `children`.
- `showUI` `position` is in canvas space, the same space as node x/y. If the position is outside the viewport, Figma moves the window back inside it. The minimum window size is 70 x 0.
- Updates to an already-approved plugin publish immediately with no further review. Keep the manifest `id` unchanged. Users cannot roll back; republish an earlier build to revert. Release notes go in the listing's Version history.
- Dev loop: Plugins → Development → run the plugin; enable "Hot reload plugin" so a rebuild restarts it; Plugins → Development → Open Console (⌥⌘I) for logs.
- The docs give no guidance on clipboard access from the iframe and no unit-testing guidance.

## Things to know before editing

- All colours in `ui.html` are tokens in the `:root` block, with dark values under `.figma-dark`. No hex value may appear anywhere else in the file.
- The three icons are inlined SVGs from the design, with colour set to `currentColor`.
- `ui.html` must stay one self-contained file with no remote assets.
- `scratch/decisions.md` records the design decisions and why. It is local only (gitignored), so it may be missing on a fresh clone.
- `Cover.jpg`, `Icon.jpg` and `image.jpg` are the Community listing assets, not used by the code.

## Not yet verified in Figma

- Window placement at the bottom right, and what happens to it when the window resizes between screens.
- Dark mode rendering.
- That the clipboard write succeeds.
- That `setPluginData` throws in a view-only file.
- That Figma opens links whose name segment is percent-encoded non-ASCII.

## Known limits

- A renamed file asks for its URL again.
- In a view-only file that already has a stored key, Delete cannot remove it.
