-- Template: replace {SUB_ID} with actual SubServer ID
-- Run this for each SubServer created

CREATE TABLE IF NOT EXISTS contacts_{SUB_ID} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  deleted_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS group_messages_{SUB_ID} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_code TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT,
  content_type TEXT DEFAULT 'text',
  media_url TEXT,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS personal_messages_{SUB_ID} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  sender_code TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT,
  content_type TEXT DEFAULT 'text',
  media_url TEXT,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS personal_chat_rooms_{SUB_ID} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL UNIQUE,
  participant_a TEXT NOT NULL,
  participant_b TEXT NOT NULL,
  last_message TEXT,
  last_message_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_msg_time_{SUB_ID} ON group_messages_{SUB_ID}(created_at);
CREATE INDEX IF NOT EXISTS idx_group_msg_expires_{SUB_ID} ON group_messages_{SUB_ID}(expires_at);
CREATE INDEX IF NOT EXISTS idx_personal_msg_room_{SUB_ID} ON personal_messages_{SUB_ID}(room_id);
CREATE INDEX IF NOT EXISTS idx_personal_msg_expires_{SUB_ID} ON personal_messages_{SUB_ID}(expires_at);
CREATE INDEX IF NOT EXISTS idx_contacts_code_{SUB_ID} ON contacts_{SUB_ID}(contact_code);
