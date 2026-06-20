(function () {
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var alphaEl = document.getElementById('alpha');
  var gridEl = document.getElementById('dir-grid');
  var footEl = document.querySelector('.dir-foot');

  var state = { all: [], origin: 'cuba', letter: null, groups: {} };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function letterOf(name) {
    var c = (name || '').trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
  }
  function isCuban(b) { return String(b.origin || '').toLowerCase() === 'cuba'; }

  fetch('/assets/data/brands.json')
    .then(function (r) { return r.json(); })
    .then(function (list) { state.all = list || []; rebuild(); })
    .catch(function () {
      gridEl.innerHTML = '<div class="dir-loading">目录暂不可用。</div>';
    });

  function rebuild() {
    var pool = state.origin === 'cuba'
      ? state.all.filter(isCuban)
      : state.all.filter(function (b) { return !isCuban(b); });
    var groups = {};
    pool.forEach(function (b) { var L = letterOf(b.name); (groups[L] = groups[L] || []).push(b); });
    Object.keys(groups).forEach(function (L) {
      groups[L].sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    });
    state.groups = groups;
    // keep current letter only if it still has brands
    if (state.letter && !(groups[state.letter] && groups[state.letter].length)) state.letter = null;
    renderToggle();
    renderAlpha();
    renderGrid();
  }

  function renderToggle() {
    var host = document.getElementById('dir-toggle');
    if (!host) return;
    host.innerHTML =
      '<button data-origin="cuba" class="' + (state.origin === 'cuba' ? 'on' : '') + '">古巴</button>' +
      '<button data-origin="noncuba" class="' + (state.origin === 'noncuba' ? 'on' : '') + '">非古巴</button>';
    host.querySelectorAll('[data-origin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var o = btn.getAttribute('data-origin');
        if (o === state.origin) return;
        state.origin = o; state.letter = null; rebuild();
      });
    });
  }

  function renderAlpha() {
    alphaEl.innerHTML =
      '<a class="alpha-all' + (state.letter === null ? ' active' : '') + '" data-letter="">全部</a>' +
      LETTERS.map(function (L) {
        var has = state.groups[L] && state.groups[L].length;
        if (!has) return '<a class="empty">' + L + '</a>';
        return '<a class="has' + (state.letter === L ? ' active' : '') + '" data-letter="' + L + '">' + L + '</a>';
      }).join('');
    alphaEl.querySelectorAll('[data-letter]').forEach(function (a) {
      a.addEventListener('click', function () {
        var L = a.getAttribute('data-letter');
        state.letter = L === '' ? null : (state.letter === L ? null : L);
        renderAlpha(); renderGrid();
      });
    });
  }

  function brandItem(b) {
    var href = '/products.html?q=' + encodeURIComponent(b.name || '');
    var meta = (b.name_cn ? esc(b.name_cn) + ' &middot; ' : '') + (b.cigar_count || 0) + ' 款';
    return '<div class="dir-item"><a href="' + href + '">' +
             '<span class="dir-name">' + esc(b.name) + '</span>' +
             '<span class="dir-line"></span>' +
             '<span class="dir-arrow">&rarr;</span></a>' +
             '<span class="dir-host">' + meta + '</span></div>';
  }

  function renderGrid() {
    var present = LETTERS.filter(function (L) { return state.groups[L] && state.groups[L].length; });
    if (!present.length) {
      gridEl.innerHTML = '<div class="dir-loading">未找到品牌。</div>';
      footEl && (footEl.style.display = 'none');
      return;
    }
    footEl && (footEl.style.display = '');

    // single-letter (filtered) view
    if (state.letter) {
      var items = state.groups[state.letter].map(brandItem).join('');
      gridEl.classList.add('single');
      gridEl.innerHTML =
        '<div class="dir-single-letter">' + state.letter + '</div>' +
        '<div class="dir-single-items">' + items + '</div>';
      return;
    }

    // full A-Z view: one column per letter
    gridEl.classList.remove('single');
    gridEl.innerHTML = present.map(function (L) {
      return '<div class="dir-col" id="dir-' + L + '">' +
               '<div class="dir-letter">' + L + '</div>' +
               '<div class="dir-items">' + state.groups[L].map(brandItem).join('') + '</div>' +
             '</div>';
    }).join('');
  }
})();
