(function () {
  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var searchEl = document.getElementById('search');
  var overlay = document.getElementById('overlay');
  var sheet = document.getElementById('sheet');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function cny(n) {
    if (n == null) return '—';
    return '¥' + Number(n).toLocaleString('zh-CN');
  }
  function badges(p) {
    var out = '';
    if (p.is_annual_limited) out += '<span class="badge badge-annual">年度限量</span>';
    if (p.is_regional_limited) out += '<span class="badge badge-region">地区限量' + (p.limited_region ? '·' + esc(p.limited_region) : '') + '</span>';
    return out;
  }
  function thumb(p) {
    var src = p.image || p.brand_image;
    if (src) return '<img src="' + esc(src) + '" class="pv-thumb"/>';
    return '<div class="pv-thumb pv-thumb-empty">茄</div>';
  }

  // bottom nav
  document.querySelectorAll('[data-nav]').forEach(function (b) {
    b.addEventListener('click', function () {
      var d = b.getAttribute('data-nav');
      if (d && d !== '#') location.href = d;
    });
  });

  function renderList(items) {
    countEl.textContent = '共 ' + items.length + ' 款产品';
    if (!items.length) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
    emptyEl.classList.add('hidden');
    listEl.innerHTML = items.map(function (p) {
      var price = p.min_cny != null
        ? '<div class="pv-price"><div class="amt">' + cny(p.min_cny) + '</div><div class="sites">' + p.sites + ' 个站点</div></div>'
        : '<div class="pv-price"><div class="none">暂无报价</div></div>';
      var brandLine = (p.brand_cn || p.brand_en) ? '<div class="pv-brand">' + esc(p.brand_cn || '') + ' ' + esc(p.brand_en || '') + '</div>' : '';
      var bd = badges(p);
      return (
        '<div class="pv-card" data-id="' + p.id + '">' +
          thumb(p) +
          '<div class="pv-info">' +
            '<div class="pv-name">' + esc(p.name_en) + '</div>' +
            '<div class="pv-sub">' + esc(p.name_cn || '') + (p.dimension ? ' · ' + esc(p.dimension) : '') + '</div>' +
            brandLine +
            (bd ? '<div class="pv-badges">' + bd + '</div>' : '') +
          '</div>' +
          price +
        '</div>'
      );
    }).join('');
    listEl.querySelectorAll('[data-id]').forEach(function (el) {
      el.addEventListener('click', function () { openDetail(el.getAttribute('data-id')); });
    });
  }

  function load(q) {
    fetch('/api/products' + (q ? '?q=' + encodeURIComponent(q) : ''))
      .then(function (r) { return r.json(); })
      .then(renderList)
      .catch(function (e) { listEl.innerHTML = '<div class="text-red-500 text-sm">加载失败: ' + esc(e.message) + '</div>'; });
  }

  function openDetail(id) {
    fetch('/api/products/' + id).then(function (r) { return r.json(); }).then(function (p) {
      document.getElementById('d-name').textContent = (p.name_en || '') + (p.name_cn ? '  ' + p.name_cn : '');
      var brand = (p.brand_cn || p.brand_en) ? ((p.brand_cn || '') + ' ' + (p.brand_en || '')).trim() : '';
      document.getElementById('d-dim').textContent = [brand, p.dimension].filter(Boolean).join(' · ');
      document.getElementById('d-badges').innerHTML = badges(p);
      var dimg = document.getElementById('d-img');
      var isrc = p.image || p.brand_image;
      if (isrc) { dimg.src = isrc; dimg.classList.remove('hidden'); } else { dimg.classList.add('hidden'); }
      var box = document.getElementById('d-listings');
      if (!p.listings || !p.listings.length) {
        box.innerHTML = '<div class="dir-loading">暂无站点报价</div>';
      } else {
        box.innerHTML = p.listings.map(function (l, i) {
          var perStick = (l.price_cny != null && l.pack_count) ? cny(Math.round(l.price_cny / l.pack_count)) + '/支' : '';
          var foreign = (l.price_foreign != null) ? (l.price_foreign + ' ' + (l.currency || '')) : '';
          var best = i === 0 && l.price_cny != null ? '<span class="pv-l-tag">最低</span>' : '';
          return (
            '<div class="pv-listing">' +
              '<div class="pv-l-head">' +
                '<div class="min-w-0">' +
                  '<div><span class="pv-l-site">' + esc(l.site) + '</span>' + best + '</div>' +
                  (l.note ? '<div class="pv-l-note">' + esc(l.note) + '</div>' : '') +
                '</div>' +
                '<div>' +
                  '<div class="pv-l-amt">' + cny(l.price_cny) + '</div>' +
                  (perStick ? '<div class="pv-l-per">' + perStick + '</div>' : '') +
                '</div>' +
              '</div>' +
              '<div class="pv-l-meta">' +
                (foreign ? '<div>外币价：<b>' + esc(foreign) + '</b></div>' : '') +
                (l.pack_count ? '<div>规格：<b>' + l.pack_count + ' 只装</b></div>' : '') +
                (l.shipping ? '<div>运费：<b>' + esc(l.shipping) + '</b></div>' : '') +
                (l.updated_date ? '<div>更新：<b>' + esc(l.updated_date) + '</b></div>' : '') +
              '</div>' +
              (l.url ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" class="pv-l-link">访问站点 →</a>' : '') +
            '</div>'
          );
        }).join('');
      }
      overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto';
      sheet.style.transform = 'translateY(0)';
    });
  }

  function closeDetail() {
    overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none';
    sheet.style.transform = 'translateY(100%)';
  }
  overlay.addEventListener('click', closeDetail);
  document.getElementById('d-close').addEventListener('click', closeDetail);

  var t;
  searchEl.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () { load(searchEl.value.trim()); }, 200);
  });

  var initial = new URLSearchParams(location.search).get('q') || '';
  if (initial) searchEl.value = initial;
  load(initial.trim());
})();
