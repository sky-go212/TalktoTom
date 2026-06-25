import { requireAuth } from './auth.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VOICE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4'];

// graceful degrade jika R2 belum diaktifkan
function r2Missing() {
  return new Response(JSON.stringify({ error: 'Media storage not enabled yet. Enable R2 in Cloudflare Dashboard.' }), {
    status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export async function handleMedia(request, env, ctx) {
  if (!env.R2) return r2Missing();

  const user = await requireAuth(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/media', '');

  if (path === '/upload' && request.method === 'POST') return uploadMedia(request, env, ctx, user);
  if (path === '/avatar' && request.method === 'POST') return uploadAvatar(request, env, ctx, user);
  if (path.startsWith('/file/') && request.method === 'GET') return getMedia(env, path.replace('/file/', ''), user);

  return new Response('Not Found', { status: 404 });
}

async function uploadMedia(request, env, ctx, user) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return jsonError('File diperlukan');
  const contentType = file.type;
  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
  const isVoice = ALLOWED_VOICE_TYPES.includes(contentType);
  if (!isImage && !isVoice) return jsonError('Format file tidak didukung');
  const bytes = await file.arrayBuffer();
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VOICE_BYTES;
  if (bytes.byteLength > maxBytes) return jsonError('File terlalu besar');
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const filename = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
  const type = isImage ? 'images' : 'voice';
  const key = `${user.subId}/${type}/${filename}`;
  ctx.waitUntil(env.R2.put(key, bytes, { httpMetadata: { contentType } }));
  return json({ url: '/api/media/file/' + key, type: isImage ? 'image' : 'voice', key });
}

async function uploadAvatar(request, env, ctx, user) {
  const formData = await request.formData();
  const file = formData.get('avatar');
  if (!file) return jsonError('Avatar diperlukan');
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return jsonError('Format harus gambar');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 1024 * 1024) return jsonError('Avatar max 1MB');
  const key = `${user.subId}/avatars/${user.contactCode}`;
  ctx.waitUntil(env.R2.put(key, bytes, { httpMetadata: { contentType: file.type } }));
  return json({ url: '/api/media/file/' + key });
}

async function getMedia(env, key, user) {
  const obj = await env.R2.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(obj.body, { headers });
}

function json(data) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
function jsonError(msg, status = 400) { return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
