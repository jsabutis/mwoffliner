# Welcome page layouts: 100 tile test set

Proof of concept for [openzim/mwoffliner#2694](https://github.com/openzim/mwoffliner/issues/2694):
cover a rectangle with up to 100 thumbnails, each showing its article title.

Open `index.html` (it fetches `images.json`, so serve the folder over HTTP).
Pick a layout and a width; the line under the controls reports the result.

## The test set

- `images/001.svg` to `images/100.svg`: each shows its number and ratio, with a dashed
  frame and corner marks. A missing edge or corner means that side was cropped.
- `images.json`: `file`, `width`, `height`, `ratio`, `title` for every tile, in page order.
- Mix: 50 near 4:3, 1:1 and 3:4; 22 at 3:2, 2:3, 16:9, 2:1 and 1:2; 11 at 3:1;
  11 at 1:3; 3 at 5:1; 3 at 1:5. Tile 1 is 1:5, tiles 41 and 42 are 3:1
  back to back, tile 100 is 5:1.
- Titles run from 3 to 64 characters.
- `node gen-images.mjs` rebuilds everything byte for byte (seeded shuffle).

## Layouts

| Layout | Script | What it does |
|---|---|---|
| Masonry (today, JS) | `layouts/current.js` | Today's page: Masonry on the real `masonry.min.js`, same column breakpoints. Nothing is cropped, so columns end at different heights and the black box shows. |
| CSS columns (today, no JS) | none | Today's `.nojs` fallback, `column-count` per breakpoint. Same black box. |
| Justified rows (proposed) | `layouts/justified.js` | Balanced rows, see below. Every row is exactly full width, the last one included. |
| Flex rows (proposed, no JS) | none | Fallback without script: CSS flex rows, last row left at natural height. |

`nojs.html` is the flex fallback as a static page with no script at all.

The column breakpoints match `res/mobile_main_page.css`: 2 columns below 768px,
3 to 1023px, 4 to 2023px, 8 to 4047px, then 16. Here they are container queries, so
the width control works without resizing the window. There are no gutters, as today.

## Justified rows, in short

Each tile carries `data-ratio` (width / height, known at build time). For width `W` and
target row height `H` (0.75 × column width, so tiles stay the size they are today):

1. Clamp each ratio to the chosen range (default 1:3 to 3:1).
2. Rows `k = round(sum of ratios × H / W)`.
3. Split the tiles, in order, into `k` rows with ratio sums as equal as possible
   (linear partition, a small dynamic program, instant for 100 tiles).
4. A row with ratio sum `S` is `W / S` tall, so it fills the width exactly.
5. Edges round to whole pixels cumulatively: no overlap, no hairline gap.
6. Recompute on resize. Image loading plays no part, so nothing reflows.

## Extreme ratios

- Within the clamp (1:3 to 3:1 by default) a tile is never cropped.
- Beyond it, the tile box takes the clamped ratio and the image uses
  `object-fit: cover`. A 5:1 image shows its middle 60% (3/5); so does a 1:5.
  This crop is fixed per image and does not depend on where the tile lands.
- The clamp menu switches between 1:2, 1:3, 1:5 and no clamp, to see the trade-off.
  With no clamp, nothing crops, but a 1:5 tile is a narrow strip.
- A 1:3 or 1:5 tile is narrow, so long title words break onto two lines.

## Missing images

"Every 9th image missing" drops the image from every 9th tile. That tile takes a
4:3 ratio, a dark tint and a larger centred title.

## Adding an algorithm

Add `layouts/<name>.js` and a `<script defer>` line in `index.html` before `poc.js`:

```js
window.PocLayouts = window.PocLayouts || []
window.PocLayouts.push({
  id: 'mine', // also the CSS class: #content.layout-mine
  label: 'My layout',
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

- `uncovered`: share of the rectangle not covered by a tile (the black box)
- `overflowing tiles`: tiles past the right edge
- `cropped tiles` and `worst crop`: how much of the most cropped image is visible
- `tile heights`: smallest and largest tile

URL parameters keep a setup shareable:
`index.html?layout=justified&w=800&clamp=3&missing=1`.

`screenshots/` holds every layout at 360, 800 and 1280px (Chromium).
