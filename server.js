// Static file server + SQLite-backed API + admin auth for the cigar site.
// Run: node --experimental-sqlite server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, 'site');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'cigars.db');
const PORT = process.env.PORT || 8099;
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8h

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
bootstrapDb();

// Ensure tables exist, seed demo data on first run, and guarantee an admin account.
function bootstrapDb() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    db.exec(schema);
  } catch (e) { console.error('schema init failed:', e.message); }

  try {
    const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
    if (count === 0) {
      const seedPath = path.join(__dirname, 'db', 'seed-data.json');
      if (fs.existsSync(seedPath)) {
        const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        const insBrand = db.prepare('INSERT INTO brands (name_en, name_cn, image) VALUES (?, ?, ?)');
        const insProduct = db.prepare('INSERT INTO products (brand_id, name_en, name_cn, dimension, image, is_annual_limited, is_regional_limited, limited_region) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const insListing = db.prepare('INSERT INTO listings (product_id, site, url, price_cny, price_foreign, currency, pack_count, shipping, note, updated_date) VALUES (?,?,?,?,?,?,?,?,?,?)');
        const brandId = {};
        (seed.brands || []).forEach((b) => { brandId[b.name_en] = Number(insBrand.run(b.name_en, b.name_cn ?? null, b.image ?? null).lastInsertRowid); });
        (seed.products || []).forEach((p) => {
          const pid = Number(insProduct.run(p.brand ? brandId[p.brand] ?? null : null, p.name_en, p.name_cn ?? null, p.dimension ?? null, p.image ?? null, p.is_annual_limited ? 1 : 0, p.is_regional_limited ? 1 : 0, p.limited_region ?? null).lastInsertRowid);
          (p.listings || []).forEach((l) => insListing.run(pid, l.site, l.url ?? null, l.price_cny ?? null, l.price_foreign ?? null, l.currency ?? null, l.pack_count ?? null, l.shipping ?? null, l.note ?? null, l.updated_date ?? null));
        });
        console.log('seeded demo products on first run');
      }
    }
  } catch (e) { console.error('seed failed:', e.message); }

  try {
    const user = process.env.ADMIN_USER || 'admin';
    const pass = process.env.ADMIN_PASS || 'admin123';
    const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(user);
    if (!existing) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
      db.prepare('INSERT INTO admins (username, salt, hash) VALUES (?, ?, ?)').run(user, salt, hash);
      console.log('created admin account:', user);
    }
  } catch (e) { console.error('admin init failed:', e.message); }
}

const sessions = new Map(); // token -> { username, expires }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJSON(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(JSON.stringify(obj));
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { resolve(null); } });
  });
}
function currentUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s || s.expires < Date.now()) { if (s) sessions.delete(sid); return null; }
  return s.username;
}
function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(h, 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- API ----------
async function handleApi(req, res, urlPath, query) {
  const method = req.method;

  // ----- auth -----
  if (urlPath === '/api/login' && method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.username || !body.password) return sendJSON(res, 400, { error: '缺少用户名或密码' });
    const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(body.username);
    if (!row || !verifyPassword(body.password, row.salt, row.hash)) return sendJSON(res, 401, { error: '用户名或密码错误' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username: row.username, expires: Date.now() + SESSION_TTL });
    const cookie = `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`;
    return sendJSON(res, 200, { ok: true, username: row.username }, { 'Set-Cookie': cookie });
  }
  if (urlPath === '/api/logout' && method === 'POST') {
    const sid = parseCookies(req).sid; if (sid) sessions.delete(sid);
    return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
  }
  if (urlPath === '/api/me' && method === 'GET') {
    const u = currentUser(req);
    return u ? sendJSON(res, 200, { username: u }) : sendJSON(res, 401, { error: '未登录' });
  }

  // ----- public read -----
  if (urlPath === '/api/products' && method === 'GET') {
    const q = (query.get('q') || '').trim().toLowerCase();
    const brandId = query.get('brand_id');
    let products = db.prepare(
      `SELECT p.*, b.name_en AS brand_en, b.name_cn AS brand_cn, b.image AS brand_image
       FROM products p LEFT JOIN brands b ON p.brand_id = b.id
       ORDER BY p.name_en COLLATE NOCASE`
    ).all();
    if (brandId) products = products.filter((p) => String(p.brand_id) === String(brandId));
    if (q) products = products.filter((p) =>
      (p.name_en || '').toLowerCase().includes(q) || (p.name_cn || '').toLowerCase().includes(q) ||
      (p.brand_en || '').toLowerCase().includes(q) || (p.brand_cn || '').toLowerCase().includes(q));
    const cheap = db.prepare('SELECT MIN(price_cny) AS min_cny, COUNT(*) AS sites FROM listings WHERE product_id = ? AND price_cny IS NOT NULL');
    return sendJSON(res, 200, products.map((p) => Object.assign({}, p, cheap.get(p.id))));
  }
  const pm = urlPath.match(/^\/api\/products\/(\d+)$/);
  if (pm && method === 'GET') {
    const id = Number(pm[1]);
    const product = db.prepare(
      `SELECT p.*, b.name_en AS brand_en, b.name_cn AS brand_cn, b.image AS brand_image
       FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = ?`
    ).get(id);
    if (!product) return sendJSON(res, 404, { error: 'not found' });
    const listings = db.prepare('SELECT * FROM listings WHERE product_id = ? ORDER BY (price_cny IS NULL), price_cny ASC').all(id);
    return sendJSON(res, 200, Object.assign({}, product, { listings }));
  }

  // brands (public read)
  if (urlPath === '/api/brands' && method === 'GET') {
    const brands = db.prepare('SELECT * FROM brands ORDER BY name_en COLLATE NOCASE').all();
    const cnt = db.prepare('SELECT COUNT(*) AS c FROM products WHERE brand_id = ?');
    return sendJSON(res, 200, brands.map((b) => Object.assign({}, b, { products: cnt.get(b.id).c })));
  }

  // ----- admin write (auth required) -----
  if (urlPath.startsWith('/api/admin/')) {
    if (!currentUser(req)) return sendJSON(res, 401, { error: '未登录' });

    // image upload (base64 dataURL -> file)
    if (urlPath === '/api/admin/upload' && method === 'POST') {
      const b = await readBody(req);
      if (!b || !b.dataUrl) return sendJSON(res, 400, { error: '缺少图片数据' });
      const m = String(b.dataUrl).match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
      if (!m) return sendJSON(res, 400, { error: '仅支持 png/jpg/gif/webp 图片' });
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 5 * 1024 * 1024) return sendJSON(res, 400, { error: '图片不能超过 5MB' });
      const dir = path.join(ROOT, 'uploads');
      fs.mkdirSync(dir, { recursive: true });
      const name = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(dir, name), buf);
      return sendJSON(res, 200, { ok: true, path: '/uploads/' + name });
    }

    // brands
    if (urlPath === '/api/admin/brands' && method === 'POST') {
      const b = await readBody(req); if (!b || !b.name_en) return sendJSON(res, 400, { error: 'name_en 必填' });
      const r = db.prepare('INSERT INTO brands (name_en, name_cn, image) VALUES (?, ?, ?)').run(b.name_en, b.name_cn ?? null, b.image ?? null);
      return sendJSON(res, 200, { ok: true, id: Number(r.lastInsertRowid) });
    }
    const bm = urlPath.match(/^\/api\/admin\/brands\/(\d+)$/);
    if (bm && method === 'PUT') {
      const b = await readBody(req); const id = Number(bm[1]);
      db.prepare('UPDATE brands SET name_en=?, name_cn=?, image=? WHERE id=?').run(b.name_en, b.name_cn ?? null, b.image ?? null, id);
      return sendJSON(res, 200, { ok: true });
    }
    if (bm && method === 'DELETE') {
      db.prepare('DELETE FROM brands WHERE id=?').run(Number(bm[1]));
      return sendJSON(res, 200, { ok: true });
    }

    // products
    if (urlPath === '/api/admin/products' && method === 'POST') {
      const b = await readBody(req); if (!b || !b.name_en) return sendJSON(res, 400, { error: 'name_en 必填' });
      const r = db.prepare(
        `INSERT INTO products (brand_id, name_en, name_cn, dimension, image, is_annual_limited, is_regional_limited, limited_region)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(b.brand_id ?? null, b.name_en, b.name_cn ?? null, b.dimension ?? null, b.image ?? null,
        b.is_annual_limited ? 1 : 0, b.is_regional_limited ? 1 : 0, b.limited_region ?? null);
      return sendJSON(res, 200, { ok: true, id: Number(r.lastInsertRowid) });
    }
    const am = urlPath.match(/^\/api\/admin\/products\/(\d+)$/);
    if (am && method === 'PUT') {
      const b = await readBody(req); const id = Number(am[1]);
      db.prepare(
        `UPDATE products SET brand_id=?, name_en=?, name_cn=?, dimension=?, image=?, is_annual_limited=?, is_regional_limited=?, limited_region=? WHERE id=?`
      ).run(b.brand_id ?? null, b.name_en, b.name_cn ?? null, b.dimension ?? null, b.image ?? null,
        b.is_annual_limited ? 1 : 0, b.is_regional_limited ? 1 : 0, b.limited_region ?? null, id);
      return sendJSON(res, 200, { ok: true });
    }
    if (am && method === 'DELETE') {
      db.prepare('DELETE FROM products WHERE id=?').run(Number(am[1]));
      return sendJSON(res, 200, { ok: true });
    }

    // listings
    if (urlPath === '/api/admin/listings' && method === 'POST') {
      const b = await readBody(req); if (!b || !b.product_id || !b.site) return sendJSON(res, 400, { error: 'product_id 和 site 必填' });
      const r = db.prepare(`INSERT INTO listings (product_id, site, url, price_cny, price_foreign, currency, pack_count, shipping, note, updated_date)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(b.product_id, b.site, b.url ?? null, b.price_cny ?? null, b.price_foreign ?? null, b.currency ?? null, b.pack_count ?? null, b.shipping ?? null, b.note ?? null, b.updated_date ?? null);
      return sendJSON(res, 200, { ok: true, id: Number(r.lastInsertRowid) });
    }
    const lm = urlPath.match(/^\/api\/admin\/listings\/(\d+)$/);
    if (lm && method === 'PUT') {
      const b = await readBody(req); const id = Number(lm[1]);
      db.prepare(`UPDATE listings SET site=?, url=?, price_cny=?, price_foreign=?, currency=?, pack_count=?, shipping=?, note=?, updated_date=? WHERE id=?`)
        .run(b.site, b.url ?? null, b.price_cny ?? null, b.price_foreign ?? null, b.currency ?? null, b.pack_count ?? null, b.shipping ?? null, b.note ?? null, b.updated_date ?? null, id);
      return sendJSON(res, 200, { ok: true });
    }
    if (lm && method === 'DELETE') {
      db.prepare('DELETE FROM listings WHERE id=?').run(Number(lm[1]));
      return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 404, { error: 'unknown admin endpoint' });
  }

  return sendJSON(res, 404, { error: 'unknown endpoint' });
}

// ---------- static ----------
function handleStatic(req, res, urlPath) {
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  if (urlPath === '/admin' || urlPath === '/admin/') urlPath = '/admin/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const urlPath = decodeURIComponent(u.pathname);
    if (urlPath.startsWith('/api/')) return handleApi(req, res, urlPath, u.searchParams).catch(() => sendJSON(res, 500, { error: 'server error' }));
    return handleStatic(req, res, urlPath);
  } catch (e) { res.writeHead(500); res.end('Error'); }
});

server.listen(PORT, () => {
  console.log(`秒茄 clone running at http://localhost:${PORT}`);
  console.log(`  - 首页:   http://localhost:${PORT}/`);
  console.log(`  - 海淘:   http://localhost:${PORT}/shop.html`);
  console.log(`  - 产品库: http://localhost:${PORT}/products.html`);
  console.log(`  - 后台:   http://localhost:${PORT}/admin/`);
});
