const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database("users.db");

db.serialize(async () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  // إنشاء مستخدم افتراضي إذا لم يوجد
  const hashedPassword = await bcrypt.hash("1234", 10);

  db.run(`
    INSERT OR IGNORE INTO users (username, password)
    VALUES (?, ?)
  `, ["admin", hashedPassword]);
});

module.exports = db;

