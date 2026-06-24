-- Dev seeds — replace {SUB_ID} with actual SubServer table prefix
-- Run AFTER migrate.sql

-- Insert dummy contacts
INSERT OR IGNORE INTO contacts_{SUB_ID} (contact_code, name, is_active, created_at)
VALUES
  ('USR-TEST-001', 'Alice', 1, unixepoch()),
  ('USR-TEST-002', 'Bob', 1, unixepoch()),
  ('USR-TEST-003', 'Charlie', 1, unixepoch());

-- Insert dummy group messages
INSERT OR IGNORE INTO group_messages_{SUB_ID} (sender_code, sender_name, content, content_type, expires_at, created_at)
VALUES
  ('USR-TEST-001', 'Alice', 'Hello everyone!', 'text', unixepoch() + 172800, unixepoch()),
  ('USR-TEST-002', 'Bob', 'Hey Alice!', 'text', unixepoch() + 172800, unixepoch()),
  ('UTAMA-XXXX-001', 'User Utama', 'Welcome to SKY-CHAT', 'text', unixepoch() + 172800, unixepoch());
