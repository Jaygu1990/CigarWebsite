(function () {
  var state = { products: [], brands: [], selected: null, listings: [] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(url, opts) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts)).then(function (r) {
      if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('unauthorized'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || '请求失败'); return d; });
    });
  }
  function brandName(b) { return (b.name_cn ? b.name_cn + ' ' : '') + b.name_en; }

  // ---- auth gate ----
  api('/api/me').then(function (u) {
    document.getElementById('who').textContent = u.username;
    loadBrands();
    loadProducts();
  }).catch(function () {});

  document.getElementById('logout').addEventListener('click', function () {
    api('/api/logout', { method: 'POST' }).then(function () { location.href = '/admin/login.html'; });
  });

  // ---- tabs ----
  document.querySelectorAll('.tabbtn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tabbtn').forEach(function (b) { b.classList.toggle('bg-white/15', b === btn); b.classList.toggle('hover:bg-white/10', b !== btn); });
      document.getElementById('tab-products').classList.toggle('hidden', tab !== 'products');
      document.getElementById('tab-brands').classList.toggle('hidden', tab !== 'brands');
    });
  });

  // ============ BRANDS ============
  function loadBrands() {
    return api('/api/brands').then(function (list) {
      state.brands = list;
      document.getElementById('bcount').textContent = '(' + list.length + ')';
      renderBrands();
    });
  }
  function renderBrands() {
    var box = document.getElementById('brands');
    if (!state.brands.length) { box.innerHTML = '<div class="text-gray-400 text-sm py-6 text-center">暂无品牌</div>'; return; }
    box.innerHTML = state.brands.map(function (b) {
      return '<div class="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">' +
        (b.image ? '<img src="' + esc(b.image) + '" class="w-12 h-12 object-contain rounded bg-gray-50 border flex-shrink-0"/>' : '<div class="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">无图</div>') +
        '<div class="min-w-0 flex-1"><div class="font-medium text-gray-900 truncate">' + esc(b.name_en) + '</div>' +
        '<div class="text-sm text-gray-500 truncate">' + esc(b.name_cn || '') + ' · ' + b.products + ' 个产品</div></div>' +
        '<div class="flex items-center gap-1 flex-shrink-0">' +
          '<button data-bedit="' + b.id + '" class="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">编辑</button>' +
          '<button data-bdel="' + b.id + '" class="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600">删除</button>' +
        '</div></div>';
    }).join('');
    box.querySelectorAll('[data-bedit]').forEach(function (x) { x.addEventListener('click', function () { editBrand(Number(x.getAttribute('data-bedit'))); }); });
    box.querySelectorAll('[data-bdel]').forEach(function (x) { x.addEventListener('click', function () { delBrand(Number(x.getAttribute('data-bdel'))); }); });
  }
  document.getElementById('add-brand').addEventListener('click', function () {
    openModal('新增品牌', field('name_en', '英文名 *', '') + field('name_cn', '中文名', '') + imageField('image', '品牌图片', ''), function (d) {
      api('/api/admin/brands', { method: 'POST', body: JSON.stringify(d) }).then(function () { closeModal(); loadBrands(); }).catch(alertErr);
    });
  });
  function editBrand(id) {
    var b = state.brands.find(function (x) { return x.id === id; });
    openModal('编辑品牌', field('name_en', '英文名 *', b.name_en) + field('name_cn', '中文名', b.name_cn) + imageField('image', '品牌图片', b.image), function (d) {
      api('/api/admin/brands/' + id, { method: 'PUT', body: JSON.stringify(d) }).then(function () { closeModal(); loadBrands(); loadProducts(); }).catch(alertErr);
    });
  }
  function delBrand(id) {
    if (!confirm('删除该品牌？（旗下产品的品牌将置空）')) return;
    api('/api/admin/brands/' + id, { method: 'DELETE' }).then(function () { loadBrands(); loadProducts(); }).catch(alertErr);
  }

  // ============ PRODUCTS ============
  function loadProducts() {
    var q = document.getElementById('psearch').value.trim();
    return api('/api/products' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (list) {
      state.products = list;
      document.getElementById('pcount').textContent = '(' + list.length + ')';
      renderProducts();
    });
  }
  function badges(p) {
    var out = '';
    if (p.is_annual_limited) out += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">年度限量</span>';
    if (p.is_regional_limited) out += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">地区限量' + (p.limited_region ? '·' + esc(p.limited_region) : '') + '</span>';
    return out ? '<div class="flex flex-wrap gap-1 mt-1">' + out + '</div>' : '';
  }
  function renderProducts() {
    var box = document.getElementById('products');
    if (!state.products.length) { box.innerHTML = '<div class="text-gray-400 text-sm py-6 text-center">暂无产品</div>'; return; }
    box.innerHTML = state.products.map(function (p) {
      var active = state.selected && state.selected.id === p.id;
      var brand = (p.brand_cn || p.brand_en) ? (esc(p.brand_cn || '') + ' ' + esc(p.brand_en || '')).trim() : '<span class="text-gray-300">未分配品牌</span>';
      return '<div class="bg-white border rounded-lg p-3 cursor-pointer ' + (active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:shadow') + '" data-id="' + p.id + '">' +
        '<div class="flex items-start gap-3">' +
          (p.image ? '<img src="' + esc(p.image) + '" class="w-12 h-12 object-contain rounded bg-gray-50 border flex-shrink-0"/>' : '<div class="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-[10px] flex-shrink-0">无图</div>') +
          '<div class="min-w-0 flex-1"><div class="font-medium text-gray-900 truncate">' + esc(p.name_en) + '</div>' +
          '<div class="text-sm text-gray-500 truncate">' + esc(p.name_cn || '') + (p.dimension ? ' · ' + esc(p.dimension) : '') + '</div>' +
          '<div class="text-xs text-gray-400 truncate">' + brand + '</div>' + badges(p) + '</div>' +
          '<div class="flex items-center gap-1 flex-shrink-0">' +
            '<button data-edit="' + p.id + '" class="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">编辑</button>' +
            '<button data-del="' + p.id + '" class="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600">删除</button>' +
          '</div>' +
        '</div></div>';
    }).join('');
    box.querySelectorAll('[data-id]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-edit],[data-del]')) return;
        selectProduct(Number(el.getAttribute('data-id')));
      });
    });
    box.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { editProduct(Number(b.getAttribute('data-edit'))); }); });
    box.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { delProduct(Number(b.getAttribute('data-del'))); }); });
  }
  document.getElementById('psearch').addEventListener('input', function () { clearTimeout(window._t); window._t = setTimeout(loadProducts, 200); });

  function productFields(p) {
    p = p || {};
    var brandOpts = state.brands.map(function (b) { return { id: b.id, name: brandName(b) }; });
    return selectField('brand_id', '品牌', p.brand_id, brandOpts) +
      field('name_en', '英文名 *', p.name_en) +
      field('name_cn', '中文名', p.name_cn) +
      field('dimension', '规格 (如 50 x 124mm)', p.dimension) +
      imageField('image', '产品图片', p.image) +
      checkboxField('is_annual_limited', '年度限量', p.is_annual_limited) +
      checkboxField('is_regional_limited', '地区限量', p.is_regional_limited) +
      field('limited_region', '限量地区 (如 亚太 / 西班牙)', p.limited_region);
  }
  document.getElementById('add-product').addEventListener('click', function () {
    openModal('新增产品', productFields({}), function (d) {
      normalizeProduct(d);
      api('/api/admin/products', { method: 'POST', body: JSON.stringify(d) }).then(function () { closeModal(); loadProducts(); }).catch(alertErr);
    });
  });
  function editProduct(id) {
    var p = state.products.find(function (x) { return x.id === id; });
    openModal('编辑产品', productFields(p), function (d) {
      normalizeProduct(d);
      api('/api/admin/products/' + id, { method: 'PUT', body: JSON.stringify(d) }).then(function () { closeModal(); loadProducts(); if (state.selected && state.selected.id === id) selectProduct(id); }).catch(alertErr);
    });
  }
  function normalizeProduct(d) {
    d.brand_id = d.brand_id ? Number(d.brand_id) : null;
    d.is_annual_limited = d.is_annual_limited ? 1 : 0;
    d.is_regional_limited = d.is_regional_limited ? 1 : 0;
  }
  function delProduct(id) {
    if (!confirm('删除该产品及其所有报价？')) return;
    api('/api/admin/products/' + id, { method: 'DELETE' }).then(function () {
      if (state.selected && state.selected.id === id) { state.selected = null; document.getElementById('ltitle').textContent = '报价'; document.getElementById('add-listing').classList.add('hidden'); document.getElementById('listings').innerHTML = '<div class="text-gray-400 text-sm py-10 text-center">← 请选择左侧产品</div>'; }
      loadProducts();
    }).catch(alertErr);
  }

  // ============ LISTINGS ============
  function selectProduct(id) {
    api('/api/products/' + id).then(function (p) {
      state.selected = p; state.listings = p.listings || [];
      document.getElementById('ltitle').textContent = '报价 · ' + p.name_en;
      document.getElementById('add-listing').classList.remove('hidden');
      renderProducts(); renderListings();
    });
  }
  function renderListings() {
    var box = document.getElementById('listings');
    if (!state.listings.length) { box.innerHTML = '<div class="text-gray-400 text-sm py-10 text-center">该产品暂无报价，点「+ 新增报价」添加</div>'; return; }
    box.innerHTML = state.listings.map(function (l) {
      return '<div class="bg-white border border-gray-200 rounded-lg p-3">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div class="min-w-0"><div class="font-medium text-gray-900">' + esc(l.site) + '</div>' +
          (l.note ? '<div class="text-xs text-gray-400">' + esc(l.note) + '</div>' : '') + '</div>' +
          '<div class="text-right flex-shrink-0"><div class="text-red-600 font-semibold">' + (l.price_cny != null ? '¥' + l.price_cny : '—') + '</div></div>' +
        '</div>' +
        '<div class="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2 text-xs text-gray-600">' +
          (l.price_foreign != null ? '<div>外币：' + esc(l.price_foreign + ' ' + (l.currency || '')) + '</div>' : '') +
          (l.pack_count ? '<div>' + l.pack_count + ' 只装</div>' : '') +
          (l.shipping ? '<div>运费：' + esc(l.shipping) + '</div>' : '') +
          (l.updated_date ? '<div>更新：' + esc(l.updated_date) + '</div>' : '') +
        '</div>' +
        (l.url ? '<div class="text-xs text-blue-600 truncate mt-1">' + esc(l.url) + '</div>' : '') +
        '<div class="flex justify-end gap-1 mt-2">' +
          '<button data-ledit="' + l.id + '" class="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">编辑</button>' +
          '<button data-ldel="' + l.id + '" class="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600">删除</button>' +
        '</div></div>';
    }).join('');
    box.querySelectorAll('[data-ledit]').forEach(function (b) { b.addEventListener('click', function () { editListing(Number(b.getAttribute('data-ledit'))); }); });
    box.querySelectorAll('[data-ldel]').forEach(function (b) { b.addEventListener('click', function () { delListing(Number(b.getAttribute('data-ldel'))); }); });
  }
  var L = function (d) { return field('site', '站点 *', d.site) + field('url', '链接', d.url) + field('price_cny', '人民币价格', d.price_cny, 'number') + field('price_foreign', '外币价格', d.price_foreign, 'number') + field('currency', '币种 (EUR/CHF/USD)', d.currency) + field('pack_count', '多少只装', d.pack_count, 'number') + field('shipping', '运费', d.shipping) + field('note', '备注', d.note) + field('updated_date', '更新日期 (YYYY-MM-DD)', d.updated_date); };
  document.getElementById('add-listing').addEventListener('click', function () {
    if (!state.selected) return;
    openModal('新增报价 · ' + state.selected.name_en, L({}), function (d) {
      d.product_id = state.selected.id; numerize(d, ['price_cny', 'price_foreign', 'pack_count']);
      api('/api/admin/listings', { method: 'POST', body: JSON.stringify(d) }).then(function () { closeModal(); selectProduct(state.selected.id); }).catch(alertErr);
    });
  });
  function editListing(id) {
    var l = state.listings.find(function (x) { return x.id === id; });
    openModal('编辑报价', L(l), function (d) {
      numerize(d, ['price_cny', 'price_foreign', 'pack_count']);
      api('/api/admin/listings/' + id, { method: 'PUT', body: JSON.stringify(d) }).then(function () { closeModal(); selectProduct(state.selected.id); }).catch(alertErr);
    });
  }
  function delListing(id) {
    if (!confirm('删除该报价？')) return;
    api('/api/admin/listings/' + id, { method: 'DELETE' }).then(function () { selectProduct(state.selected.id); }).catch(alertErr);
  }

  // ============ MODAL + FIELDS ============
  var modal = document.getElementById('modal'), mForm = document.getElementById('m-form'), mTitle = document.getElementById('m-title');
  document.getElementById('m-close').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  function closeModal() { modal.classList.add('hidden'); modal.classList.remove('flex'); mForm.innerHTML = ''; }
  var inputCls = 'border-input flex h-9 w-full rounded-md border bg-white px-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
  function field(name, label, val, type) {
    return '<div><label class="block text-sm text-gray-600 mb-1">' + label + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '" class="' + inputCls + '" style="font-size:14px"/></div>';
  }
  function selectField(name, label, val, opts) {
    return '<div><label class="block text-sm text-gray-600 mb-1">' + label + '</label>' +
      '<select name="' + name + '" class="' + inputCls + '" style="font-size:14px">' +
      '<option value="">— 无 —</option>' +
      opts.map(function (o) { return '<option value="' + o.id + '"' + (String(o.id) === String(val) ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') +
      '</select></div>';
  }
  function checkboxField(name, label, checked) {
    return '<label class="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">' +
      '<input type="checkbox" name="' + name + '" value="1"' + (checked ? ' checked' : '') + ' class="w-4 h-4"/>' + label + '</label>';
  }
  function imageField(name, label, val) {
    return '<div><label class="block text-sm text-gray-600 mb-1">' + label + '</label>' +
      '<input type="hidden" name="' + name + '" value="' + esc(val || '') + '"/>' +
      '<div class="flex items-center gap-3">' +
        '<img data-preview="' + name + '" src="' + esc(val || '') + '" class="w-14 h-14 object-contain rounded border bg-gray-50 ' + (val ? '' : 'hidden') + '"/>' +
        '<input type="file" accept="image/*" data-upload="' + name + '" class="text-xs"/>' +
      '</div>' +
      '<div data-upmsg="' + name + '" class="text-xs text-gray-400 mt-1"></div></div>';
  }
  function wireUploads() {
    mForm.querySelectorAll('[data-upload]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var name = inp.getAttribute('data-upload');
        var file = inp.files && inp.files[0]; if (!file) return;
        var msg = mForm.querySelector('[data-upmsg="' + name + '"]');
        msg.textContent = '上传中…'; msg.className = 'text-xs text-gray-400 mt-1';
        var reader = new FileReader();
        reader.onload = function () {
          api('/api/admin/upload', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) }).then(function (r) {
            mForm.querySelector('input[type=hidden][name="' + name + '"]').value = r.path;
            var img = mForm.querySelector('[data-preview="' + name + '"]'); img.src = r.path; img.classList.remove('hidden');
            msg.textContent = '已上传'; msg.className = 'text-xs text-green-600 mt-1';
          }).catch(function (e) { msg.textContent = e.message || '上传失败'; msg.className = 'text-xs text-red-600 mt-1'; });
        };
        reader.readAsDataURL(file);
      });
    });
  }
  function openModal(title, fieldsHtml, onSubmit) {
    mTitle.textContent = title; mForm.innerHTML = fieldsHtml +
      '<div class="flex justify-end gap-2 pt-2"><button type="button" id="m-cancel" class="px-3 py-1.5 rounded-md border text-sm">取消</button>' +
      '<button type="submit" class="px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm">保存</button></div>';
    modal.classList.remove('hidden'); modal.classList.add('flex');
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    wireUploads();
    mForm.onsubmit = function (e) {
      e.preventDefault();
      var data = {}; new FormData(mForm).forEach(function (v, k) { data[k] = v === '' ? null : v; });
      onSubmit(data);
    };
  }
  function numerize(d, keys) { keys.forEach(function (k) { if (d[k] != null && d[k] !== '') d[k] = Number(d[k]); }); return d; }
  function alertErr(e) { alert(e.message || '操作失败'); }
})();
