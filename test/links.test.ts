import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareIndexPaths, fileSlug, fileUrl, nodeLink, parseFigmaUrl } from '../src/links.ts';

const KEY = 'AbC123xyz';

test('parseFigmaUrl accepts www.figma.com and figma.com', () => {
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}/My-File`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://figma.com/design/${KEY}/My-File`), { key: KEY });
});

test('parseFigmaUrl accepts http as well as https', () => {
  assert.deepEqual(parseFigmaUrl(`http://www.figma.com/design/${KEY}/My-File`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`http://figma.com/file/${KEY}`), { key: KEY });
});

test('parseFigmaUrl accepts each path type: file, design, proto', () => {
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/file/${KEY}/My-File`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}/My-File`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/proto/${KEY}/My-File`), { key: KEY });
});

test('parseFigmaUrl accepts a URL with a file name segment and a query', () => {
  assert.deepEqual(
    parseFigmaUrl(`https://www.figma.com/design/${KEY}/My-File?node-id=1-2&t=abc-0`),
    { key: KEY },
  );
});

test('parseFigmaUrl accepts a query or hash directly after the key', () => {
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}?node-id=1-2`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}#section`), { key: KEY });
});

test('parseFigmaUrl accepts a key with no trailing slash or with a trailing slash', () => {
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/file/${KEY}`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/file/${KEY}/`), { key: KEY });
});

test('parseFigmaUrl trims surrounding whitespace', () => {
  assert.deepEqual(parseFigmaUrl(`  https://www.figma.com/design/${KEY}/My-File \n`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`\thttps://figma.com/design/${KEY}\t`), { key: KEY });
});

test('parseFigmaUrl returns the branch key for a branch URL', () => {
  assert.deepEqual(
    parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch/Br4nchKey/My-File?node-id=0-1`),
    { key: 'Br4nchKey' },
  );
  assert.deepEqual(parseFigmaUrl(`https://figma.com/file/${KEY}/branch/Br4nchKey`), { key: 'Br4nchKey' });
});

test('parseFigmaUrl keeps the file key when the file is named "branch" or the branch segment is empty', () => {
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch?node-id=1-2`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch/`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch?x=1`), { key: KEY });
});

test('parseFigmaUrl rejects a branch URL with an invalid branch key', () => {
  assert.equal(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch/x_y/n`), null);
  assert.equal(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch/x_y`), null);
  assert.equal(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch/abc-def/My-File`), null);
  assert.equal(parseFigmaUrl(`https://www.figma.com/design/${KEY}/branch/abc%20def?node-id=1-2`), null);
});

test('parseFigmaUrl matches the scheme and host case-insensitively and keeps the key case', () => {
  assert.deepEqual(parseFigmaUrl('HTTPS://FIGMA.com/design/abc'), { key: 'abc' });
  assert.deepEqual(parseFigmaUrl(`Https://WWW.Figma.Com/design/${KEY}/My-File`), { key: KEY });
  assert.deepEqual(parseFigmaUrl(`HTTP://www.FIGMA.COM/file/${KEY}/branch/Br4nchKey`), { key: 'Br4nchKey' });
});

test('parseFigmaUrl requires a lower-case path type', () => {
  assert.equal(parseFigmaUrl(`https://www.figma.com/DESIGN/${KEY}/My-File`), null);
  assert.equal(parseFigmaUrl(`https://www.figma.com/File/${KEY}`), null);
});

test('parseFigmaUrl rejects FigJam board URLs', () => {
  assert.equal(parseFigmaUrl(`https://www.figma.com/board/${KEY}/My-Board`), null);
});

test('parseFigmaUrl rejects Community URLs', () => {
  assert.equal(
    parseFigmaUrl('https://www.figma.com/community/plugin/1423324569458473026/multi-link-copy'),
    null,
  );
});

test('parseFigmaUrl rejects other hosts', () => {
  assert.equal(parseFigmaUrl(`https://example.com/design/${KEY}/My-File`), null);
  assert.equal(parseFigmaUrl(`https://notfigma.com/design/${KEY}/My-File`), null);
  assert.equal(parseFigmaUrl(`https://figma.com.example.com/design/${KEY}/My-File`), null);
});

test('parseFigmaUrl rejects empty and plain text input', () => {
  assert.equal(parseFigmaUrl(''), null);
  assert.equal(parseFigmaUrl('   '), null);
  assert.equal(parseFigmaUrl('my design file'), null);
});

test('parseFigmaUrl rejects a key followed by something other than /, ? or #', () => {
  assert.equal(parseFigmaUrl(`https://www.figma.com/design/${KEY}-copy/My-File`), null);
  assert.equal(parseFigmaUrl('https://www.figma.com/design/'), null);
});

test('fileSlug replaces spaces with hyphens', () => {
  assert.equal(fileSlug('My Design File'), 'My-Design-File');
});

test('fileSlug collapses runs of punctuation into one hyphen', () => {
  assert.equal(fileSlug('Website / Mobile (v2.1)'), 'Website-Mobile-v2-1');
  assert.equal(fileSlug('A & B'), 'A-B');
});

test('fileSlug strips leading and trailing symbols', () => {
  assert.equal(fileSlug('  -- Hello World! -- '), 'Hello-World');
  assert.equal(fileSlug('[Draft] Home'), 'Draft-Home');
});

test('fileSlug returns Untitled for an all-symbol or empty name', () => {
  assert.equal(fileSlug('***'), 'Untitled');
  assert.equal(fileSlug(' / - '), 'Untitled');
  assert.equal(fileSlug(''), 'Untitled');
});

test('fileSlug keeps non-ASCII characters, percent-encoded', () => {
  assert.equal(fileSlug('Café ☕ Über'), 'Caf%C3%A9-%E2%98%95-%C3%9Cber');
  assert.equal(fileSlug('日本語'), '%E6%97%A5%E6%9C%AC%E8%AA%9E');
  assert.equal(fileSlug('日本語'), encodeURIComponent('日本語'));
});

test('fileSlug keeps characters outside the BMP and still collapses ASCII symbols around them', () => {
  assert.equal(fileSlug('🎨 Design / System!'), '%F0%9F%8E%A8-Design-System');
  assert.equal(fileSlug('  (Über)  '), '%C3%9Cber');
});

test('nodeLink replaces ":" with "-" in a plain node id', () => {
  assert.equal(
    nodeLink(KEY, 'My Design File', '1:2'),
    `https://www.figma.com/design/${KEY}/My-Design-File?node-id=1-2`,
  );
});

test('nodeLink encodes an instance sublayer id', () => {
  assert.equal(
    nodeLink(KEY, 'My Design File', 'I1:2;3:4'),
    `https://www.figma.com/design/${KEY}/My-Design-File?node-id=I1-2%3B3-4`,
  );
});

test('nodeLink uses Untitled for an all-symbol file name', () => {
  assert.equal(nodeLink(KEY, '!!!', '10:20'), `https://www.figma.com/design/${KEY}/Untitled?node-id=10-20`);
});

test('fileUrl builds the design URL with the file slug', () => {
  assert.equal(fileUrl(KEY, 'Website / Mobile'), `https://www.figma.com/design/${KEY}/Website-Mobile`);
  assert.equal(fileUrl(KEY, ''), `https://www.figma.com/design/${KEY}/Untitled`);
});

test('fileUrl and nodeLink percent-encode a non-ASCII file name', () => {
  assert.equal(fileUrl(KEY, 'Café'), `https://www.figma.com/design/${KEY}/Caf%C3%A9`);
  assert.equal(
    nodeLink(KEY, '日本語 v2', '1:2'),
    `https://www.figma.com/design/${KEY}/%E6%97%A5%E6%9C%AC%E8%AA%9E-v2?node-id=1-2`,
  );
});

test('compareIndexPaths orders siblings by index', () => {
  assert.ok(compareIndexPaths([0, 1], [0, 2]) < 0);
  assert.ok(compareIndexPaths([0, 2], [0, 1]) > 0);
  assert.ok(compareIndexPaths([0], [1]) < 0);
});

test('compareIndexPaths orders a nested node by its ancestor, not its depth', () => {
  // [0, 5, 3] lives inside the first top-level layer, so it comes before [1].
  assert.ok(compareIndexPaths([0, 5, 3], [1]) < 0);
  assert.ok(compareIndexPaths([1], [0, 5, 3]) > 0);
  assert.ok(compareIndexPaths([2, 0], [1, 9]) > 0);
});

test('compareIndexPaths puts a parent before its children', () => {
  assert.ok(compareIndexPaths([0, 1], [0, 1, 0]) < 0);
  assert.ok(compareIndexPaths([0, 1, 0], [0, 1]) > 0);
  assert.ok(compareIndexPaths([], [0]) < 0);
});

test('compareIndexPaths returns 0 for equal paths', () => {
  assert.equal(compareIndexPaths([0, 1, 2], [0, 1, 2]), 0);
  assert.equal(compareIndexPaths([], []), 0);
});

test('compareIndexPaths sorts a mixed list into layer-panel order', () => {
  const paths = [[1], [0, 1, 0], [0], [0, 0], [0, 1], [2, 0]];
  assert.deepEqual([...paths].sort(compareIndexPaths), [[0], [0, 0], [0, 1], [0, 1, 0], [1], [2, 0]]);
});
