# Multi-Link Copy

A Figma plugin that copies a link for each selected layer to your clipboard, one per line, in layer-panel order. Paste them into a spreadsheet or document.

Install it from the Figma Community: https://www.figma.com/community/plugin/1423324569458473026/multi-link-copy

## How to use

1. Run the plugin. The first time in a file, paste the file's link and click Continue. The plugin remembers it for that file.
2. Select one or more layers on the canvas.
3. Click Copy Links. The links are on your clipboard.

The gear icon opens settings, where you can see the saved file link and delete it.

## Development

1. Install [Node.js](https://nodejs.org/en/download/), then run `npm install`.
2. Run `npm run watch` to rebuild `code.js` on change.
3. In the Figma desktop app, choose Plugins → Development → Import plugin from manifest and pick `manifest.json`.
4. Run `npm test` for the unit tests.
