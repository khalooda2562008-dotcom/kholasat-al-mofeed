CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'ضيف',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'layers',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  youtube_channel_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '',
  subscriber_count BIGINT NOT NULL DEFAULT 0,
  video_count BIGINT NOT NULL DEFAULT 0,
  view_count BIGINT NOT NULL DEFAULT 0,
  uploads_playlist_id TEXT NOT NULL DEFAULT '',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_channels (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  is_following BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  youtube_video_id TEXT NOT NULL UNIQUE,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  view_count BIGINT NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  usefulness TEXT NOT NULL DEFAULT 'متوسط',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'folder',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, title)
);
CREATE TABLE IF NOT EXISTS folder_items (
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(folder_id, video_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, video_id)
);
CREATE TABLE IF NOT EXISTS watch_later (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, video_id)
);
CREATE TABLE IF NOT EXISTS watch_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  percent REAL NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, video_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS summaries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  basis TEXT NOT NULL DEFAULT 'metadata',
  model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'محادثة جديدة',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_channels_user ON user_channels(user_id, is_following);
CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_date ON watch_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider_date ON api_usage_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_title_search ON videos USING GIN (to_tsvector('simple', title || ' ' || description));

INSERT INTO categories(slug, name, description, icon) VALUES
('programming','البرمجة','تعلم البرمجة وبناء البرامج والتطبيقات','code'),
('web-development','تطوير الويب','بناء مواقع وتطبيقات الويب','globe'),
('frontend','Frontend','واجهات المستخدم وتجربة الاستخدام','monitor'),
('backend','Backend','الخوادم وواجهات API وقواعد البيانات','server'),
('python','Python','تعلم Python وتطبيقاتها','terminal'),
('databases','قواعد البيانات','تصميم وإدارة قواعد البيانات','database'),
('ai','الذكاء الاصطناعي','الذكاء الاصطناعي وتعلم الآلة','brain'),
('cybersecurity','الأمن السيبراني','حماية الأنظمة والشبكات','shield'),
('design','التصميم','التصميم الجرافيكي وواجهات المستخدم','palette'),
('content-creation','صناعة المحتوى','التصوير والمونتاج وصناعة المحتوى','video'),
('marketing','التسويق','التسويق الرقمي وصناعة العلامات التجارية','megaphone'),
('productivity','الإنتاجية','إدارة الوقت والتعلم الفعال','clock'),
('english','اللغة الإنجليزية','تعلم اللغة الإنجليزية ومهارات التواصل','languages'),
('science','العلوم','العلوم والرياضيات والمعرفة العامة','flask'),
('islamic-studies','الدراسات الإسلامية','العلوم الشرعية والمعارف الإسلامية','book-open'),
('projects','المشاريع العملية','تطبيقات عملية ومشاريع تدريبية','briefcase')
ON CONFLICT (slug) DO NOTHING;
