export async function r2Upload(env, key, data, contentType) {
  if (!env.R2) return null;
  try {
    await env.R2.put(key, data, { httpMetadata: { contentType } });
    return key;
  } catch (e) {
    console.error('R2 upload error:', e);
    return null;
  }
}

export async function r2Get(env, key) {
  if (!env.R2) return null;
  try {
    return await env.R2.get(key);
  } catch (e) {
    console.error('R2 get error:', e);
    return null;
  }
}

export async function r2Delete(env, key) {
  if (!env.R2) return;
  try { await env.R2.delete(key); } catch {}
}

export async function r2List(env, prefix) {
  if (!env.R2) return [];
  try {
    const list = await env.R2.list({ prefix });
    return list.objects || [];
  } catch (e) {
    console.error('R2 list error:', e);
    return [];
  }
}

export function mediaKey(subId, type, filename) {
  return `${subId}/${type}/${filename}`;
}

export function avatarKey(subId, contactCode) {
  return `${subId}/avatars/${contactCode}`;
}
