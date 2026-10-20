// Balanced justified rows, the layout proposed in openzim/mwoffliner#2694.
//
// Progressive enhancement: the markup is the CSS flex-rows layout
// (.layout-rows). This script only adds a whole-pixel width and image
// height to every tile, so each row, the last one included, is exactly
// full width. Without the script the flex rows stand on their own.
//
// Every tile carries its aspect ratio r = width / height (known at build
// time from the thumbnail). For a container width W, a gutter g between
// tiles and a target row height H:
//   1. clamp each r to [minRatio, maxRatio]; only clamped tiles crop
//   2. rows k = round(sum(r) * H / W)
//   3. split the tiles, in order, into k rows whose sums of r are as
//      equal as possible (linear partition, a small dynamic program)
//   4. a row of n tiles with ratio sum S is (W - (n - 1) g) / S tall, so
//      the tiles plus their gutters fill the width exactly
// Image loading plays no part, so nothing reflows when images arrive.
;(function () {
  // Splits ratios into k consecutive groups minimising the sum of
  // squared distances to the mean group sum. Returns the group sizes.
  function partition(ratios, k) {
    var n = ratios.length
    var prefix = [0]
    for (var i = 0; i < n; i++) prefix.push(prefix[i] + ratios[i])
    var mean = prefix[n] / k
    // cost[j][m]: best cost of the first m tiles in j rows; from[j][m]: split
    var cost = [[0]]
    var from = [[0]]
    for (var m = 1; m <= n; m++) cost[0][m] = Infinity
    for (var j = 1; j <= k; j++) {
      cost[j] = []
      from[j] = []
      for (m = 0; m <= n; m++) {
        cost[j][m] = Infinity
        for (var s = j - 1; s < m; s++) {
          var d = prefix[m] - prefix[s] - mean
          var c = cost[j - 1][s] + d * d
          if (c < cost[j][m]) {
            cost[j][m] = c
            from[j][m] = s
          }
        }
      }
    }
    var sizes = []
    for (j = k, m = n; j > 0; j--) {
      sizes.unshift(m - from[j][m])
      m = from[j][m]
    }
    return sizes
  }

  // Returns one {w, h} size per tile, in whole pixels, plus the row
  // index. Widths round cumulatively so a row sums to the width exactly.
  function justify(ratios, width, rowHeight, minRatio, maxRatio, gap) {
    gap = gap || 0
    var r = ratios.map(function (v) {
      return Math.min(maxRatio, Math.max(minRatio, v))
    })
    var total = r.reduce(function (a, b) { return a + b }, 0)
    var k = Math.max(1, Math.min(r.length, Math.round((total * rowHeight) / width)))
    var sizes = partition(r, k)
    var boxes = []
    var i = 0
    sizes.forEach(function (size, rowIndex) {
      var row = r.slice(i, i + size)
      var sum = row.reduce(function (a, b) { return a + b }, 0)
      var inner = width - (size - 1) * gap
      var h = Math.round(inner / sum)
      var x = 0
      row.forEach(function (ri, n) {
        var left = Math.round(x)
        x += (ri * inner) / sum
        var right = n === size - 1 ? inner : Math.round(x)
        boxes.push({ w: right - left, h: h, row: rowIndex })
      })
      i += size
    })
    return { boxes: boxes, rows: sizes.length }
  }

  // Drop-in shape: size the .item children of a flex-rows container.
  function layout(container, opts) {
    var cs = getComputedStyle(container)
    var width = Math.floor(container.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
    var gap = parseFloat(cs.columnGap) || 0
    var items = Array.prototype.slice.call(container.querySelectorAll('.item'))
    var ratios = items.map(function (el) { return parseFloat(el.getAttribute('data-ratio')) || 4 / 3 })
    var result = justify(ratios, width, opts.rowHeight, opts.minRatio, opts.maxRatio, gap)
    items.forEach(function (el, n) {
      el.style.setProperty('--w', result.boxes[n].w + 'px')
      el.style.setProperty('--h', result.boxes[n].h + 'px')
    })
    container.classList.add('is-justified')
  }

  function reset(container) {
    container.classList.remove('is-justified')
  }

  window.PocLayouts = window.PocLayouts || []
  window.PocLayouts.push({
    id: 'justified',
    label: 'Justified rows (proposed, JS)',
    css: 'layout-rows',
    js: true,
    apply: layout,
    reset: reset,
  })
  window.justifiedRows = { partition: partition, justify: justify, layout: layout }
})()
