// Proposed no-JS fallback. Pure CSS (see .layout-flex in poc.css): tiles
// grow by their ratio, so each row is full width at one height. The last
// row is left at natural height instead of being stretched. This entry
// only registers it in the switcher; nothing here runs on the tiles.
;(function () {
  window.PocLayouts = window.PocLayouts || []
  window.PocLayouts.push({
    id: 'flex',
    label: 'Flex rows (proposed, no JS)',
    js: false,
  })
})()
