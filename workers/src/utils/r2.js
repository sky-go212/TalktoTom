export async function r2Upload(env, key, data, contentType) {
  await env.R2.put(key, data, { httpMetadata: { contentType } });
  return key;
}

export async function r2Get(env, key) {
  return env.R2.get(key);
}

export async function r2Delete(env, key) {
  try { await env.R2.delete(key); } catch {}
}

export async function r2List(env, prefix) {
  const list = await env.R2.list({ prefix });
  return list.objects || [];
}

export function mediaKey(subId, type, filename) {
  return `${subId}/${type}/${filename}`;
}

export function avatarKey(subId, contactCode) {
  return `${subId}/avatars/${contactCode}`;
}
