(function () {
  var grid = document.getElementById('shop-grid');
  var tabsEl = document.getElementById('cat-tabs');
  var countEl = document.getElementById('shop-count');
  var searchEl = document.getElementById('shop-search');

  var state = { all: [], cat: 'all', q: '' };

  var TABS = [
    { id: 'all', label: '全部', test: function () { return true; } },
    { id: 'ou', label: '欧行', test: function (c) { return /欧行|LCDH/.test(c); } },
    { id: 'water', label: '水站', test: function (c) { return /水/.test(c); } },
    { id: 'nc', label: '非古', test: function (c) { return /非古/.test(c); } },
    { id: 'dc', label: '斗草', test: function (c) { return /斗草/.test(c); } },
    { id: 'maker', label: '厂商', test: function (c) { return /厂商/.test(c); } },
    { id: 'other', label: '配件 / 知识', test: function (c) { return /配件|知识/.test(c); } }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function iconSrc(img) { return img ? img.replace(/^icon\//, '/icons/') : ''; }

  fetch('/assets/data/sites.json')
    .then(function (r) { return r.json(); })
    .then(function (list) { state.all = list || []; renderTabs(); render(); })
    .catch(function () { grid.innerHTML = '<div class="dir-loading">站点数据暂不可用。</div>'; });

  function renderTabs() {
    tabsEl.innerHTML = TABS.map(function (t) {
      return '<button data-cat="' + t.id + '" class="' + (state.cat === t.id ? 'on' : '') + '">' + t.label + '</button>';
    }).join('');
    tabsEl.querySelectorAll('[data-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.cat = btn.getAttribute('data-cat'); renderTabs(); render(); });
    });
  }

  function card(s) {
    var icon = iconSrc(s.img);
    var logo = icon
      ? '<img class="sc-logo" src="' + esc(icon) + '" onerror="this.outerHTML=&quot;<div class=\'sc-logo sc-noimg\'>茄</div>&quot;"/>'
      : '<div class="sc-logo sc-noimg">茄</div>';
    return '<div class="shop-card">' +
        '<div class="sc-head">' + logo +
          '<div class="sc-title"><div class="sc-name">' + esc(s.name) + '</div>' +
            (s.rating != null ? '<div class="sc-rating">★ ' + s.rating + '</div>' : '') +
          '</div>' +
        '</div>' +
        (s.freight ? '<div class="sc-freight">' + esc(s.freight) + '</div>' : '') +
        (s.review ? '<div class="sc-review">' + esc(s.review) + '</div>' : '') +
        (s.url ? '<div class="sc-actions"><a class="sc-visit" href="' + esc(s.url) + '" target="_blank" rel="noopener">访问官网 &rarr;</a></div>' : '') +
      '</div>';
  }

  function render() {
    var tab = TABS.filter(function (t) { return t.id === state.cat; })[0] || TABS[0];
    var q = state.q.toLowerCase();
    var items = state.all.filter(function (s) {
      if (!tab.test(s.category || '')) return false;
      if (q) return (s.name || '').toLowerCase().indexOf(q) >= 0 || (s.review || '').toLowerCase().indexOf(q) >= 0;
      return true;
    });
    items.sort(function (a, b) { return (b.rating == null ? -1 : b.rating) - (a.rating == null ? -1 : a.rating); });
    countEl.textContent = '共 ' + items.length + ' 个站点';
    if (!items.length) { grid.innerHTML = '<div class="dir-loading">未找到符合条件的站点。</div>'; return; }
    grid.innerHTML = items.map(card).join('');
  }

  var t;
  searchEl.addEventListener('input', function () {
    clearTimeout(t); t = setTimeout(function () { state.q = searchEl.value.trim(); render(); }, 200);
  });
})();
