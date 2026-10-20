// Generates the 100 test images, images.json and the static nojs.html.
// Deterministic: running it again produces byte-identical files.
// Usage: node gen-images.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// [label, width, height, count]. Longest side is 600px, like a real thumbnail.
const MIX = [
  ['4:3', 600, 450, 18],
  ['1:1', 600, 600, 14],
  ['3:4', 450, 600, 18],
  ['3:2', 600, 400, 5],
  ['2:3', 400, 600, 5],
  ['16:9', 600, 338, 4],
  ['2:1', 600, 300, 4],
  ['1:2', 300, 600, 4],
  ['3:1', 600, 200, 11],
  ['1:3', 200, 600, 11],
  ['5:1', 600, 120, 3],
  ['1:5', 120, 600, 3],
]

// Real looking article titles, short to very long, to test captions.
const TITLES = [
  'Haiti', 'Port-au-Prince', 'Mount Everest', 'Photosynthesis', 'Amazon River',
  'List of tallest buildings and structures in the world', 'Jazz', 'Saturn',
  'Hydroelectricity', 'Leonardo da Vinci', 'Great Barrier Reef', 'Tea',
  'International Space Station', 'Eiffel Tower', 'Coral reef', 'Volcano',
  'History of the Kingdom of Hawaii during the nineteenth century', 'Baobab',
  'Sahara', 'Printing press', 'Honey bee', 'Antarctica', 'Banana', 'Lighthouse',
  'Citadelle Laferrière', 'Machu Picchu', 'Blue whale', 'Rainbow', 'Pyramid',
  'United Nations Educational, Scientific and Cultural Organization', 'Moon',
  'Bicycle', 'Tornado', 'Penguin', 'Chess', 'Rice', 'Mangrove', 'Aurora',
  'Steam engine', 'Coffee', 'Giraffe', 'Wind power', 'Glacier', 'Octopus',
  'Timeline of the far future', 'Violin', 'Cathedral of Our Lady of the Assumption',
  'Dinosaur', 'Silk Road', 'Hummingbird', 'Water cycle', 'Kite', 'Lion',
  'Great Wall of China', 'Telescope', 'Mango', 'Sea turtle', 'Hurricane Matthew',
  'Pacific Ocean', 'Cocoa bean', 'Bamboo', 'Archimedes', 'Flamenco', 'Tsunami',
  'Sugarcane', 'Rosetta Stone', 'Elephant', 'Cactus', 'Solar eclipse', 'Kayak',
  'List of World Heritage Sites in Latin America and the Caribbean', 'Owl',
  'Carnival', 'Waterfall', 'Mars', 'Orchid', 'Vaccine', 'Lake Titicaca', 'Drum',
  'Jellyfish', 'Pineapple', 'Taj Mahal', 'Desert', 'Fern', 'Radio', 'Shark',
  'Pierre-Dominique Toussaint Louverture', 'Avocado', 'Earthquake', 'Llama',
  'Milky Way', 'Sunflower', 'Rain forest', 'Lemur', 'Compass', 'Peacock',
  'Comparison of programming languages (basic instructions)', 'Iceberg', 'Fox',
  'Wright brothers',
]

// Small seeded PRNG (mulberry32) so the shuffle is the same everywhere.
function prng(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = prng(2694)
const shapes = []
for (const [label, w, h, n] of MIX) for (let i = 0; i < n; i++) shapes.push({ label, w, h })
for (let i = shapes.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[shapes[i], shapes[j]] = [shapes[j], shapes[i]]
}
// Worst cases on purpose: a 1:5 first, two 3:1 back to back, a 5:1 last.
// Take the picks out first, then insert in index order, so no insert
// shifts an earlier one.
const picks = [['1:5', 0], ['3:1', 40], ['3:1', 41], ['5:1', 99]].map(([label, index]) => {
  const [s] = shapes.splice(shapes.findIndex((t) => t.label === label), 1)
  return [s, index]
})
for (const [s, index] of picks) shapes.splice(index, 0, s)

// WCAG relative luminance, to keep the label at 7:1 or better on every tile.
function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255))
}
const INK = [17, 17, 17]
function tileColour(i) {
  const hue = Math.round((i * 137.508) % 360)
  for (let l = 70; l <= 95; l++) {
    const rgb = hslToRgb(hue, 65, l)
    const ratio = (luminance(rgb) + 0.05) / (luminance(INK) + 0.05)
    if (ratio >= 7.5) return { rgb, edge: hslToRgb(hue, 70, 30) }
  }
  throw new Error('no colour for ' + i)
}
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

// The frame and corner ticks make any crop visible: a missing edge was cut.
// They use a dark tint of the tile colour, never black, so they cannot be
// mistaken for the black page background.
function svg(i, { label, w, h }, bg, edge) {
  const m = Math.min(w, h)
  const stroke = Math.max(4, Math.round(m * 0.04))
  const inset = stroke / 2
  const tick = Math.round(m * 0.18)
  const big = Math.round(m * 0.3)
  const small = Math.round(m * 0.16)
  const cx = w / 2
  const cy = h / 2
  const corners = [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ]
    .map(([x, y, dx, dy]) => `M${x + dx * tick} ${y}H${x}V${y + dy * tick}`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>
<rect x="${inset}" y="${inset}" width="${w - stroke}" height="${h - stroke}" fill="none" stroke="${edge}" stroke-width="${stroke}" stroke-dasharray="${stroke * 3} ${stroke * 2}"/>
<path d="${corners}" fill="none" stroke="${edge}" stroke-width="${stroke * 3}"/>
<g font-family="Helvetica, Arial, sans-serif" font-weight="700" fill="#111" text-anchor="middle">
<text x="${cx}" y="${cy - small * 0.2}" font-size="${big}">${i + 1}</text>
<text x="${cx}" y="${cy + small * 1.1}" font-size="${small}">${label}</text>
</g>
</svg>
`
}

mkdirSync(join(here, 'images'), { recursive: true })
const manifest = shapes.map((s, i) => {
  const file = `images/${String(i + 1).padStart(3, '0')}.svg`
  const { rgb, edge } = tileColour(i)
  writeFileSync(join(here, file), svg(i, s, hex(rgb), hex(edge)))
  return { file, width: s.w, height: s.h, ratio: s.label, title: TITLES[i] }
})
writeFileSync(join(here, 'images.json'), JSON.stringify(manifest, null, 2) + '\n')

// The tiles, as makePageImageTile writes them plus data-ratio. They go
// into index.html (so the page needs no script to show the flex rows)
// and into nojs.html, a bare page with no controls at all.
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const tiles = manifest
  .map((m, i) => {
    const r = (m.width / m.height).toFixed(4)
    return (
      `<a class="item" href="#tile-${i + 1}" data-ratio="${r}" style="--r:${r}"><figure>` +
      `<img loading="lazy" src="${m.file}" width="${m.width}" height="${m.height}" alt="">` +
      `<figcaption>${esc(m.title)}</figcaption></figure></a>`
    )
  })
  .join('\n')
const indexPath = join(here, 'index.html')
const index = readFileSync(indexPath, 'utf8')
writeFileSync(indexPath, index.replace(/<!-- tiles -->[\s\S]*<!-- \/tiles -->/, `<!-- tiles -->\n${tiles}\n<!-- /tiles -->`))
writeFileSync(
  join(here, 'nojs.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>No-JS fallback, 100 tiles</title>
<link rel="stylesheet" href="poc.css">
</head>
<body class="bare">
<div class="frame"><div id="content" class="layout-rows" data-title="scrim">
${tiles}
</div></div>
</body>
</html>
`,
)
console.log(`wrote ${manifest.length} images, images.json, index.html tiles, nojs.html`)
