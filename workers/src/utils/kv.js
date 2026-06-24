export async function kvGet(env, key) {
  try { return await env.KV.get(key, { type: 'json' }); } catch { return null; }
}

export async function kvSet(env, key, value, ttlSeconds = null) {
  const opts = {};
  if (ttlSeconds) opts.expirationTtl = ttlSeconds;
  await env.KV.put(key, JSON.stringify(value), opts);
}

export async function kvDel(env, key) {
  try { await env.KV.delete(key); } catch {}
}

export async function kvList(env, prefix) {
  const list = await env.KV.list({ prefix });
  return list.keys;
}

// Session management
export const SESSION_TTL = 86400; // 24h
export function sessionKey(token) { return `session:${token}`; }
export function subServerKey(subId) { return `subserver:${subId}`; }
export function contactKey(subId, code) { return `contact:${subId}:${code}`; }

export async function getSession(env, token) {
  return kvGet(env, sessionKey(token));
}
export async function setSession(env, token, data, ttl = SESSION_TTL) {
  return kvSet(env, sessionKey(token), data, ttl);
}
export async function delSession(env, token) {
  return kvDel(env, sessionKey(token));
}
