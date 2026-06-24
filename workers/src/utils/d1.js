export function tbl(name, subId) {
  return `${name}_${subId.replace(/-/g, '_')}`;
}

export async function dbRun(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).run();
}

export async function dbAll(env, sql, params = []) {
  const result = await env.DB.prepare(sql).bind(...params).all();
  return result.results || [];
}

export async function dbFirst(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).first();
}

export async function initSubServerTables(env, subId) {
  const id = subId.replace(/-/g, '_');
  const stmts = [
    `CREATE TABLE IF NOT EXISTS contacts_${id} (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar_url TEXT, is_active INTEGER DEFAULT 1, deleted_at INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS group_messages_${id} (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_code TEXT NOT NULL, sender_name TEXT NOT NULL, content TEXT, content_type TEXT DEFAULT 'text', media_url TEXT, expires_at INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS personal_messages_${id} (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, sender_code TEXT NOT NULL, sender_name TEXT NOT NULL, content TEXT, content_type TEXT DEFAULT 'text', media_url TEXT, expires_at INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS personal_chat_rooms_${id} (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL UNIQUE, participant_a TEXT NOT NULL, participant_b TEXT NOT NULL, last_message TEXT, last_message_at INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
    `CREATE INDEX IF NOT EXISTS idx_grp_time_${id} ON group_messages_${id}(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_grp_exp_${id} ON group_messages_${id}(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_pm_room_${id} ON personal_messages_${id}(room_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pm_exp_${id} ON personal_messages_${id}(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_cont_code_${id} ON contacts_${id}(contact_code)`,
  ];
  await env.DB.batch(stmts.map(s => env.DB.prepare(s)));
}
