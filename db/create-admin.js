// Create or reset an admin account (scrypt-hashed password).
// Usage: node --experimental-sqlite db/create-admin.js [username] [password]
// Defaults: admin / admin123  (CHANGE THIS in production!)
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'cigars.db');
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);`);

const username = process.argv[2] || process.env.ADMIN_USER || 'admin';
const password = process.argv[3] || process.env.ADMIN_PASS || 'admin123';

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');

const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
if (existing) {
  db.prepare('UPDATE admins SET salt = ?, hash = ? WHERE username = ?').run(salt, hash, username);
  console.log(`已更新管理员密码: ${username}`);
} else {
  db.prepare('INSERT INTO admins (username, salt, hash) VALUES (?, ?, ?)').run(username, salt, hash);
  console.log(`已创建管理员: ${username}`);
}
console.log(`登录密码: ${password}  (请尽快修改)`);
db.close();
