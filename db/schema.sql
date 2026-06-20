-- 数据库0：品牌
CREATE TABLE IF NOT EXISTS brands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en    TEXT NOT NULL,           -- 品牌英文名
  name_cn    TEXT,                     -- 品牌中文名
  image      TEXT,                     -- 品牌图片 (路径/URL)
  created_at TEXT DEFAULT (datetime('now'))
);

-- 数据库1：产品
CREATE TABLE IF NOT EXISTS products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id            INTEGER REFERENCES brands(id) ON DELETE SET NULL,  -- 所属品牌
  name_en             TEXT NOT NULL,   -- 英文名
  name_cn             TEXT,            -- 中文名
  dimension           TEXT,            -- 规格 (环径 x 长度)
  image               TEXT,            -- 产品图片 (路径/URL)
  is_annual_limited   INTEGER DEFAULT 0,  -- 是否年度限量 (0/1)
  is_regional_limited INTEGER DEFAULT 0,  -- 是否地区限量 (0/1)
  limited_region      TEXT,            -- 限量的地区
  created_at          TEXT DEFAULT (datetime('now'))
);

-- 数据库2：某产品在各站点的价格/链接
CREATE TABLE IF NOT EXISTS listings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,     -- 关联 products.id
  site          TEXT NOT NULL,        -- 站点名
  url           TEXT,                 -- 该产品在此站点的链接
  price_cny     REAL,                 -- 人民币价格
  price_foreign REAL,                 -- 外币价格
  currency      TEXT,                 -- 外币币种 (EUR/CHF/USD/GBP...)
  pack_count    INTEGER,              -- 多少只装
  shipping      TEXT,                 -- 运费
  note          TEXT,                 -- 备注
  updated_date  TEXT,                 -- 更新日期 (YYYY-MM-DD)
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listings_product ON listings(product_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_en);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

-- 后台管理员
CREATE TABLE IF NOT EXISTS admins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
