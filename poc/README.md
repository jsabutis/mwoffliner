# Welcome page layouts: 100 tile test set

Proof of concept for [openzim/mwoffliner#2694](https://github.com/openzim/mwoffliner/issues/2694):
cover a rectangle with up to 100 thumbnails, each showing its article title.

Open `index.html` over HTTP (it loads `images.json` only for the "missing image" toggle).
Pick a layout, a title style and a width; the line under the controls reports the result.
The 100 tiles are static in the page, so with scripts off it shows exactly what a reader
without JavaScript gets.

## The test set

- `images/001.svg` to `images/100.svg`: each shows its number and ratio, with a dashed
  frame and corner marks. A missing edge or corner means that side was cropped.
- `images.json`: `file`, `width`, `height`, `ratio`, `title` for every tile, in page order.
- Mix: 50 near 4:3, 1:1 and 3:4; 22 at 3:2, 2:3, 16:9, 2:1 and 1:2; 11 at 3:1;
  11 at 1:3; 3 at 5:1; 3 at 1:5. Tile 1 is 1:5, tiles 41 and 42 are 3:1
  back to back, tile 100 is 5:1.
- Titles run from 3 to 64 characters.
- `node gen-images.mjs` rebuilds everything byte for byte (seeded shuffle), including
  the tiles in `index.html` and `nojs.html`.

## Layouts

| Layout | Script | What it does |
|---|---|---|
| Masonry (today, JS) | `layouts/current.js` | Today's page: Masonry on the real `masonry.min.js`, same column breakpoints. Nothing is cropped, so columns end at different heights and the black box shows. |
| CSS columns (today, no JS) | none | Today's `.nojs` fallback, `column-count` per breakpoint. Same black box. |
| Flex rows (proposed, no JS) | none | What every reader gets: CSS flex rows, each row one image height and full width, the last row left at natural height. |
| Justified rows (proposed, JS) | `layouts/justified.js` | The same markup, upgraded: every row is exactly full width, the last one included. |

The two proposed layouts share one markup and one stylesheet rule set (`.layout-rows`).
`justified.js` only sets a whole-pixel width and image height on each tile and adds
`is-justified`; take the script away and the flex rows stand on their own.
`nojs.html` is the same thing as a bare page with no controls.

The column breakpoints match `res/mobile_main_page.css`: 2 columns below 768px,
3 to 1023px, 4 to 2023px, 8 to 4047px, then 16. Here they are container queries, so
the width control works without resizing the window.

## Title styles

| Style | What it is | Contrast over a pure white image |
|---|---|---|
| Scrim (default) | Title over the image on a gradient that is clear at the top and 82% black where the text sits. | 13.6:1 (white on #2e2e2e) |
| Card | 8px gutter, 8px corner radius, title below the image on a dark label (#f2f2f2 on #1c1c1c). The label has a fixed two-line height so rows stay level. The gutter is part of the row maths, so justified rows stay exactly full width. | 15.2:1 |
| Bar (today) | White on 75% black, for comparison. | 10.4:1 (white on #404040) |

Every title is clamped to two lines. The tile without an image is white on #1f3347,
12.9:1. The gutter and radius only apply to the proposed rows: today's Masonry and
columns have no gutter to give, so there the card style is only the label.

## Justified rows, in short

Each tile carries `data-ratio` (width / height, known at build time). For width `W`,
gutter `g` and target row height `H` (0.75 x column width, so tiles stay the size
they are today):

1. Clamp each ratio to the chosen range (default 1:2 to 2:1).
2. Rows `k = round(sum of ratios x H / W)`.
3. Split the tiles, in order, into `k` rows with ratio sums as equal as possible
   (linear partition, a small dynamic program, instant for 100 tiles).
4. A row of `n` tiles with ratio sum `S` is `(W - (n - 1) g) / S` tall, so tiles
   plus gutters fill the width exactly.
5. Widths round to whole pixels cumulatively: no overlap, no hairline gap.
6. Recompute on resize. Image loading plays no part, so nothing reflows.

## Extreme ratios

- Within the clamp (1:2 to 2:1 by default) a tile is never cropped.
- Beyond it, the tile box takes the clamped ratio and the image uses
  `object-fit: cover`. A 3:1 image shows its middle two thirds, a 5:1 its middle 40%;
  so do 1:3 and 1:5. This crop is fixed per image and does not depend on where the
  tile lands.
- The clamp menu switches between 1:2, 1:3, 1:5 and no clamp, to see the trade-off.
  With no clamp, nothing crops, but a 1:5 tile is a narrow strip.
- A narrow tile breaks a long title word where the browser has no hyphenation point.

## Missing images

"Every 9th image missing" drops the image from every 9th tile. That tile takes a
4:3 ratio, a dark tint and a larger centred title (a plain label in the card style).

## Adding an algorithm

Add `layouts/<name>.js` and a `<script defer>` line in `index.html` before `poc.js`:

```js
window.PocLayouts = window.PocLayouts || []
window.PocLayouts.push({
  id: 'mine',
  label: 'My layout',
  css: 'layout-mine', // class set on #content
  js: true,
  // opts: { cols, rowHeight, minRatio, maxRatio }
  apply: function (container, opts) {},
  reset: function (container) {}, // optional, called before switching away
})
```

`apply` gets `#content`, whose `.item` children carry `data-ratio`. Set positions or
sizes inline, or leave `apply` out and style `.layout-mine` in CSS only.
Inline styles are cleared between runs.

## Checking a result

The line under the controls, also `window.pocMetrics()` in the console:

- `uncovered`: share of the rectangle not covered by a tile (the black box); the
  card style's gutters are not counted
- `overflowing tiles`: tiles past the right edge
- `cropped tiles` and `worst crop`: how much of the most cropped image is visible
- `tile heights`: smallest and largest tile

URL parameters keep a setup shareable:
`index.html?layout=justified&title=card&w=800&clamp=2&missing=1`.

`screenshots/` holds the justified rows in each title style, the flex rows, today's two
layouts and the page with scripts off, at 360, 768 and 1280px (Chromium).
