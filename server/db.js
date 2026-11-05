import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const databaseFile = process.env.DATABASE_FILE || './data/kholasat.sqlite';
fs.mkdirSync(path.dirname(path.resolve(databaseFile)), { recursive: true });
export const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'ضيف', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT, youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL, handle TEXT, thumbnail TEXT, description TEXT,
  subscriber_count INTEGER DEFAULT 0, video_count INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0,
  uploads_playlist_id TEXT, category TEXT NOT NULL DEFAULT 'التعليم العام',
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_synced_at TEXT
);
CREATE TABLE IF NOT EXISTS user_channels (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'التعليم العام', followed INTEGER NOT NULL DEFAULT 1,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,channel_id)
);
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY, channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, thumbnail TEXT, published_at TEXT,
  duration_seconds INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'التعليم العام', usefulness TEXT DEFAULT 'متوسط',
  is_project INTEGER DEFAULT 0, difficulty TEXT DEFAULT 'مبتدئ', updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,video_id));
CREATE TABLE IF NOT EXISTS watch_later (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,video_id));
CREATE TABLE IF NOT EXISTS watch_history (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, watched_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,video_id));
CREATE TABLE IF NOT EXISTS watch_progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, seconds INTEGER NOT NULL DEFAULT 0, percent REAL NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,video_id));
CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS folder_items (folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, added_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(folder_id,video_id));
CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT REFERENCES videos(id) ON DELETE SET NULL, title TEXT NOT NULL, content TEXT NOT NULL, source_note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT DEFAULT '', video_id TEXT REFERENCES videos(id) ON DELETE CASCADE, read_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS user_settings (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, settings_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS api_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, operation TEXT NOT NULL, units INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

export function ensureUser(id, name = 'ضيف') {
  const safeId = String(id || '');
  if (!/^[0-9a-f-]{36}$/i.test(safeId)) throw new Error('معرّف المستخدم غير صالح');
  db.prepare('INSERT INTO users(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=CASE WHEN excluded.name<>\'ضيف\' AND excluded.name<>\'\' THEN excluded.name ELSE users.name END').run(safeId, String(name || 'ضيف').slice(0, 60));
  db.prepare('INSERT OR IGNORE INTO user_settings(user_id,settings_json) VALUES(?,?)').run(safeId, JSON.stringify(defaultSettings));
  return safeId;
}

export const defaultSettings = {
  sections: { latest: true, popular: true, projects: true, continue: true },
  playback: { saveProgress: true, showRelated: true },
  ai: { enabled: true, language: 'ar', detail: 'متوسط' },
  notifications: { enabled: true, newVideos: true },
  appearance: { theme: 'dark', compact: false },
  performance: { lazyImages: true, lowData: false }
};

export function logUsage(provider, operation, units, status) {
  db.prepare('INSERT INTO api_usage(provider,operation,units,status) VALUES(?,?,?,?)').run(provider, operation, units, status);
}

export function parseDuration(iso = '') {
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

export function cleanVideo(row) {
  return row ? { ...row, is_project: Boolean(row.is_project) } : null;
}

export function generateLocalId() { return randomUUID(); }
