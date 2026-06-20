// Initialize SQLite DB from schema.sql and seed-data.json.
// Run: node --experimental-sqlite db/init-db.js [--reseed]
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'cigars.db');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const reseed = process.argv.includes('--reseed');
if (reseed) {
  // drop data tables (keep admins) so schema changes apply cleanly
  db.exec('DROP TABLE IF EXISTS listings; DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS brands;');
  console.log('dropped listings/products/brands (--reseed)');
}

db.exec(schema);
const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;

if (reseed || count === 0) {
  const insBrand = db.prepare('INSERT INTO brands (name_en, name_cn, image) VALUES (?, ?, ?)');
  const insProduct = db.prepare(
    `INSERT INTO products (brand_id, name_en, name_cn, dimension, image, is_annual_limited, is_regional_limited, limited_region)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insListing = db.prepare(
    `INSERT INTO listings (product_id, site, url, price_cny, price_foreign, currency, pack_count, shipping, note, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const brandIdByName = {};
  let nb = 0, np = 0, nl = 0;
  for (const b of seed.brands || []) {
    const r = insBrand.run(b.name_en, b.name_cn ?? null, b.image ?? null);
    brandIdByName[b.name_en] = Number(r.lastInsertRowid);
    nb++;
  }
  for (const p of seed.products || []) {
    const bid = p.brand ? brandIdByName[p.brand] ?? null : null;
    const r = insProduct.run(
      bid, p.name_en, p.name_cn ?? null, p.dimension ?? null, p.image ?? null,
      p.is_annual_limited ? 1 : 0, p.is_regional_limited ? 1 : 0, p.limited_region ?? null
    );
    const pid = Number(r.lastInsertRowid);
    np++;
    for (const l of p.listings || []) {
      insListing.run(pid, l.site, l.url ?? null, l.price_cny ?? null, l.price_foreign ?? null,
        l.currency ?? null, l.pack_count ?? null, l.shipping ?? null, l.note ?? null, l.updated_date ?? null);
      nl++;
    }
  }
  console.log(`seeded ${nb} brands, ${np} products, ${nl} listings -> ${DB_PATH}`);
} else {
  console.log(`DB already has ${count} products; use --reseed to rebuild. -> ${DB_PATH}`);
}

db.close();
