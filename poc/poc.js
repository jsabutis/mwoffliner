// PoC harness: the 100 tiles are static in index.html (so the page works
// with no script at all), this runs the chosen layout at the chosen width
// and reports what is uncovered or cropped. Layouts register themselves
// in window.PocLayouts (see layouts/).
;(function () {
  var CLAMPS = {
    2: [1 / 2, 2],
    3: [1 / 3, 3],
    5: [1 / 5, 5],
    off: [0.01, 100],
  }
  var TITLES = ['scrim', 'card', 'bar']
  var params = new URLSearchParams(location.search)
  var state = {
    layout: params.get('layout') || 'justified',
    title: TITLES.indexOf(params.get('title')) >= 0 ? params.get('title') : 'scrim',
    w: params.get('w') || 'fill',
    clamp: params.get('clamp') in CLAMPS ? params.get('clamp') : '2',
    missing: params.get('missing') === '1',
  }
  var manifest = []
  var active = null
  var lastWidth = 0
  var frame = document.querySelector('.frame')
  var content = document.getElementById('content')

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  }

  // The static tiles carry everything: file, size and title.
  function readTiles() {
    return Array.prototype.map.call(content.querySelectorAll('.item'), function (el) {
      var img = el.querySelector('img')
      return {
        file: img.getAttribute('src'),
        width: +img.getAttribute('width'),
        height: +img.getAttribute('height'),
        title: el.querySelector('figcaption').textContent,
      }
    })
  }

  // Same markup as makePageImageTile, plus the ratio for the layouts.
  function buildTiles() {
    content.innerHTML = manifest
      .map(function (m, i) {
        var missing = state.missing && i % 9 === 4
        var r = missing ? 4 / 3 : m.width / m.height
        var img = missing ? '' : '<img loading="lazy" src="' + m.file + '" width="' + m.width + '" height="' + m.height + '" alt="">'
        return (
          '<a class="item' + (missing ? ' noimg' : '') + '" href="#tile-' + (i + 1) + '" data-ratio="' + r.toFixed(4) + '" style="--r:' + r.toFixed(4) + '">' +
          '<figure>' + img + '<figcaption>' + esc(m.title) + '</figcaption></figure></a>'
        )
      })
      .join('\n')
  }

  function render() {
    if (active && active.reset) active.reset(content)
    active = window.PocLayouts.filter(function (l) { return l.id === state.layout })[0] || window.PocLayouts[0]
    content.className = active.css
    content.setAttribute('data-title', state.title)
    content.removeAttribute('style')
    Array.prototype.forEach.call(content.children, function (el) {
      el.style.cssText = '--r:' + el.getAttribute('data-ratio')
    })
    var clamp = CLAMPS[state.clamp] || CLAMPS[2]
    frame.style.setProperty('--rmin', clamp[0])
    frame.style.setProperty('--rmax', clamp[1])
    lastWidth = content.clientWidth
    document.getElementById('width-value').textContent = lastWidth + ' px'
    if (active.apply) {
      var cols = parseInt(getComputedStyle(content).getPropertyValue('--cols'), 10) || 4
      active.apply(content, {
        cols: cols,
        rowHeight: (0.75 * lastWidth) / cols, // same tile size as the columns today
        minRatio: clamp[0],
        maxRatio: clamp[1],
      })
    }
    showMetrics()
  }

  // Geometry check, shared by every layout. Also used by the Playwright run.
  // Gutters chosen by the title style (card) are not counted as uncovered.
  function metrics() {
    var cs = getComputedStyle(content)
    var rect = content.getBoundingClientRect()
    var c = {
      left: rect.left + parseFloat(cs.paddingLeft),
      right: rect.right - parseFloat(cs.paddingRight),
      top: rect.top + parseFloat(cs.paddingTop),
      bottom: rect.bottom - parseFloat(cs.paddingBottom),
    }
    c.width = c.right - c.left
    c.height = c.bottom - c.top
    var gap = parseFloat(cs.columnGap) || 0
    var covered = 0
    var overflow = 0
    var cropped = 0
    var worst = { visible: 1, tile: null }
    var minH = Infinity
    var maxH = 0
    var rows = {}
    Array.prototype.forEach.call(content.children, function (el, i) {
      var r = el.getBoundingClientRect()
      var w = Math.max(0, Math.min(r.right, c.right) - Math.max(r.left, c.left))
      var h = Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top))
      covered += w * h
      if (r.right > c.right + 0.5 || r.left < c.left - 0.5) overflow++
      minH = Math.min(minH, r.height)
      maxH = Math.max(maxH, r.height)
      var key = Math.round(r.top - c.top)
      rows[key] = rows[key] || { n: 0, h: 0 }
      rows[key].n++
      rows[key].h = Math.max(rows[key].h, r.height)
      var img = el.querySelector('img')
      if (img && getComputedStyle(img).objectFit === 'cover') {
        var natural = manifest[i].width / manifest[i].height
        var box = img.clientWidth / img.clientHeight
        var visible = Math.min(natural, box) / Math.max(natural, box)
        if (visible < 0.98) cropped++
        if (visible < worst.visible) worst = { visible: visible, tile: i + 1, ratio: ratioLabel(manifest[i]) }
      }
    })
    var rowList = Object.keys(rows).map(function (k) { return rows[k] })
    var gutters = 0
    if (gap && !cs.columnCount.match(/^\d/)) {
      rowList.forEach(function (row) { gutters += (row.n - 1) * gap * row.h })
      gutters += (rowList.length - 1) * gap * c.width
    }
    var area = c.width * c.height
    return {
      width: Math.round(c.width),
      height: Math.round(c.height),
      uncoveredPct: area ? Math.max(0, +(100 - (100 * (covered + gutters)) / area).toFixed(2)) : 0,
      overflowTiles: overflow,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      croppedTiles: cropped,
      worstVisiblePct: Math.round(worst.visible * 100),
      worstTile: worst.tile,
      worstRatio: worst.ratio || null,
      tileHeights: [Math.round(minH), Math.round(maxH)],
      rows: rowList.length,
    }
  }

  function ratioLabel(m) {
    var r = m.width / m.height
    var known = { 0.2: '1:5', 0.3333: '1:3', 0.5: '1:2', 0.5625: '9:16', 0.6667: '2:3', 0.75: '3:4', 1: '1:1', 1.3333: '4:3', 1.5: '3:2', 1.7778: '16:9', 2: '2:1', 3: '3:1', 5: '5:1' }
    var key = Object.keys(known).filter(function (k) { return Math.abs(k - r) < 0.01 })[0]
    return key ? known[key] : r.toFixed(2)
  }

  function showMetrics() {
    var m = metrics()
    var bad = function (cond, text) { return cond ? '<b class="bad">' + text + '</b>' : text }
    document.getElementById('metrics').innerHTML = [
      m.width + ' x ' + m.height + ' px',
      bad(m.uncoveredPct > 0.5, 'uncovered ' + m.uncoveredPct + '%'),
      bad(m.overflowTiles > 0, 'overflowing tiles ' + m.overflowTiles),
      'cropped tiles ' + m.croppedTiles,
      'worst crop ' + (m.worstTile ? m.worstVisiblePct + '% visible (#' + m.worstTile + ', ' + m.worstRatio + ')' : 'none'),
      'tile heights ' + m.tileHeights[0] + ' to ' + m.tileHeights[1] + ' px',
    ].join(' | ')
  }

  function applyWidth() {
    frame.style.width = state.w === 'fill' ? '' : state.w + 'px'
    var range = document.getElementById('width-range')
    range.value = state.w === 'fill' ? Math.round(frame.parentNode.clientWidth) : state.w
  }

  function saveState() {
    var q = new URLSearchParams()
    q.set('layout', state.layout)
    q.set('title', state.title)
    q.set('w', state.w)
    q.set('clamp', state.clamp)
    if (state.missing) q.set('missing', '1')
    history.replaceState(null, '', '?' + q.toString())
  }

  function set(next) {
    var rebuild = 'missing' in next && next.missing !== state.missing
    Object.keys(next).forEach(function (k) { state[k] = next[k] })
    if (rebuild) buildTiles()
    applyWidth()
    syncControls()
    render()
    saveState()
    return metrics()
  }

  function syncControls() {
    var radio = document.querySelector('input[name="layout"][value="' + state.layout + '"]')
    if (radio) radio.checked = true
    var tr = document.querySelector('input[name="title"][value="' + state.title + '"]')
    if (tr) tr.checked = true
    var wr = document.querySelector('input[name="width"][value="' + state.w + '"]')
    Array.prototype.forEach.call(document.querySelectorAll('input[name="width"]'), function (el) { el.checked = el === wr })
    document.getElementById('clamp').value = state.clamp
    document.getElementById('missing').checked = state.missing
  }

  function buildControls() {
    document.getElementById('layouts').insertAdjacentHTML(
      'beforeend',
      window.PocLayouts.map(function (l) {
        return '<input type="radio" name="layout" id="l-' + l.id + '" value="' + l.id + '"><label for="l-' + l.id + '">' + l.label + '</label>'
      }).join(''),
    )
    document.addEventListener('change', function (e) {
      var t = e.target
      if (t.name === 'layout') set({ layout: t.value })
      if (t.name === 'title') set({ title: t.value })
      if (t.name === 'width') set({ w: t.value })
      if (t.id === 'clamp') set({ clamp: t.value })
      if (t.id === 'missing') set({ missing: t.checked })
    })
    document.getElementById('width-range').addEventListener('input', function (e) {
      set({ w: e.target.value })
    })
  }

  // Recompute when the frame width changes (window resize in fill mode).
  var pending = 0
  new ResizeObserver(function () {
    if (content.clientWidth === lastWidth) return
    cancelAnimationFrame(pending)
    pending = requestAnimationFrame(render)
  }).observe(frame)

  manifest = readTiles()
  buildControls()
  if (state.missing) buildTiles()
  set({})
  window.pocSet = set
  window.pocMetrics = metrics
  document.documentElement.setAttribute('data-ready', '1')
})()
