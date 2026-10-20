// What the welcome page does today (res/page_list_home.js and
// res/mobile_main_page.css): Masonry with JS, CSS columns without it.
// Column counts follow the same breakpoints as today. Neither crops,
// so the columns end at different heights and the black box shows.
;(function () {
  window.PocLayouts = window.PocLayouts || []
  var masonry = null
  window.PocLayouts.push({
    id: 'masonry',
    label: 'Masonry (today, JS)',
    css: 'layout-masonry',
    js: true,
    apply: function (container) {
      // Same call as page_list_home.js; transitions off so moves are instant.
      masonry = new window.Masonry(container, { itemSelector: '.item', transitionDuration: 0 })
    },
    reset: function () {
      if (masonry) masonry.destroy()
      masonry = null
    },
  })
  window.PocLayouts.push({
    id: 'columns',
    label: 'CSS columns (today, no JS)',
    css: 'layout-columns',
    js: false,
  })
})()
