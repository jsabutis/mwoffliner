// Proposed layout as every reader without script sees it: CSS flex rows
// (.layout-rows in poc.css). Tiles grow by their clamped ratio, so each
// row shares one image height and is full width; the last row is left at
// natural height. This entry only registers the switcher item; nothing
// here touches the tiles. justified.js upgrades the same markup.
;(function () {
  window.PocLayouts = window.PocLayouts || []
  window.PocLayouts.push({
    id: 'flex',
    label: 'Flex rows (proposed, no JS)',
    css: 'layout-rows',
    js: false,
  })
})()
