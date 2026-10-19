// Balanced justified rows, the layout proposed in openzim/mwoffliner#2694.
//
// Every tile carries its aspect ratio r = width / height (known at build
// time from the thumbnail). For a container width W and a target row
// height H:
//   1. clamp each r to [minRatio, maxRatio]; only clamped tiles crop
//   2. rows k = round(sum(r) * H / W)
//   3. split the tiles, in order, into k rows whose sums of r are as
//      equal as possible (linear partition, a small dynamic program)
//   4. a row with ratio sum S is W / S tall, so every row, the last one
//      included, is exactly full width and nothing else is cropped
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

  // Returns one {x, y, w, h} box per tile, in whole pixels, plus the
  // total height. Edges are rounded cumulatively so tiles never overlap
  // or leave a hairline gap.
  function justify(ratios, width, rowHeight, minRatio, maxRatio) {
    var r = ratios.map(function (v) {
      return Math.min(maxRatio, Math.max(minRatio, v))
    })
    var total = r.reduce(function (a, b) { return a + b }, 0)
    var k = Math.max(1, Math.min(r.length, Math.round((total * rowHeight) / width)))
    var sizes = partition(r, k)
    var boxes = []
    var y = 0
    var i = 0
    sizes.forEach(function (size) {
      var row = r.slice(i, i + size)
      var sum = row.reduce(function (a, b) { return a + b }, 0)
      var h = width / sum
      var top = Math.round(y)
      var bottom = Math.round(y + h)
      var x = 0
      row.forEach(function (ri, n) {
        var left = Math.round(x)
        x += ri * h
        var right = n === size - 1 ? width : Math.round(x)
        boxes.push({ x: left, y: top, w: right - left, h: bottom - top })
      })
      y += h
      i += size
    })
    return { boxes: boxes, height: Math.round(y) }
  }

  // Drop-in shape: lay out the .item children of a container.
  function layout(container, opts) {
    var items = Array.prototype.slice.call(container.querySelectorAll('.item'))
    var ratios = items.map(function (el) { return parseFloat(el.getAttribute('data-ratio')) || 4 / 3 })
    var result = justify(ratios, container.clientWidth, opts.rowHeight, opts.minRatio, opts.maxRatio)
    items.forEach(function (el, n) {
      var b = result.boxes[n]
      el.style.left = b.x + 'px'
      el.style.top = b.y + 'px'
      el.style.width = b.w + 'px'
      el.style.height = b.h + 'px'
    })
    container.style.height = result.height + 'px'
  }

  window.PocLayouts = window.PocLayouts || []
  window.PocLayouts.push({
    id: 'justified',
    label: 'Justified rows (proposed)',
    js: true,
    apply: function (container, opts) {
      layout(container, opts)
    },
  })
  window.justifiedRows = { partition: partition, justify: justify, layout: layout }
})()
