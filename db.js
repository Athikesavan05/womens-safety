/**
 * SafeHer – Secure SQLite Database Layer
 * Provides persistent SQLite storage with prepared statements,
 * foreign keys, indexes, and full async Promise support.
 */

'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Promise helpers for clean async/await
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Initialize Database Schema
async function initDatabase() {
  await run('PRAGMA foreign_keys = ON;');
  await run('PRAGMA journal_mode = WAL;');

  // Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      city TEXT,
      avatar_url TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'SafeHer Protected User',
      reset_token TEXT,
      reset_token_expiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
  `);

  // Index for fast lookups
  await run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);`);

  // Emergency Contacts Table
  await run(`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      priority INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safety Reports / SOS Table
  await run(`
    CREATE TABLE IF NOT EXISTS safety_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      address TEXT,
      description TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  console.log('[SafeHer DB] SQLite database schema initialized successfully at:', DB_PATH);
}

// User Data Access Object (DAO)
const UserDAO = {
  async create({ fullName, email, phone, city, avatarUrl, passwordHash, role }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');

    const result = await run(
      `INSERT INTO users (full_name, email, phone, city, avatar_url, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName.trim(),
        cleanEmail,
        cleanPhone,
        city ? city.trim() : null,
        avatarUrl || null,
        passwordHash,
        role || 'SafeHer Protected User'
      ]
    );

    return this.findById(result.lastID);
  },

  async findById(id) {
    return get(
      `SELECT id, full_name, email, phone, city, avatar_url, role, created_at, last_login 
       FROM users WHERE id = ?`,
      [id]
    );
  },

  async findByEmail(email) {
    if (!email) return null;
    return get(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`,
      [email.trim()]
    );
  },

  async findByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    return get(
      `SELECT * FROM users WHERE phone = ? OR phone LIKE ?`,
      [cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
  },

  async findByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();

    // If identifier contains @, look up by email
    if (clean.includes('@')) {
      return this.findByEmail(clean);
    }

    // Otherwise, try phone lookup
    const userByPhone = await this.findByPhone(clean);
    if (userByPhone) return userByPhone;

    // As a fallback, check if username matches email or full name
    return get(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`,
      [clean]
    );
  },

  async updateLastLogin(id) {
    return run(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  },

  async updateProfile(id, { fullName, phone, city, avatarUrl }) {
    const fields = [];
    const values = [];

    if (fullName !== undefined) {
      fields.push('full_name = ?');
      values.push(fullName.trim());
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone.replace(/[\s\-\(\)\+]/g, ''));
    }
    if (city !== undefined) {
      fields.push('city = ?');
      values.push(city ? city.trim() : null);
    }
    if (avatarUrl !== undefined) {
      fields.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async updatePassword(id, passwordHash) {
    return run(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?`,
      [passwordHash, id]
    );
  },

  async setResetToken(email, token, expiryMinutes = 30) {
    const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    return run(
      `UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE LOWER(email) = LOWER(?)`,
      [token, expiry, email.trim()]
    );
  },

  async findByResetToken(token) {
    if (!token) return null;
    return get(
      `SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > datetime('now')`,
      [token]
    );
  },

  async count() {
    const row = await get(`SELECT COUNT(*) as count FROM users`);
    return row ? row.count : 0;
  }
};

// Emergency Contacts DAO
const ContactsDAO = {
  async getByUserId(userId) {
    return all(
      `SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY priority ASC, created_at DESC`,
      [userId]
    );
  },

  async add(userId, { name, relation, phone, email, priority = 1 }) {
    const result = await run(
      `INSERT INTO emergency_contacts (user_id, name, relation, phone, email, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name.trim(), relation.trim(), phone.trim(), email ? email.trim() : null, priority]
    );
    return get(`SELECT * FROM emergency_contacts WHERE id = ?`, [result.lastID]);
  },

  async remove(userId, contactId) {
    return run(
      `DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?`,
      [contactId, userId]
    );
  }
};

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
  UserDAO,
  ContactsDAO
};
