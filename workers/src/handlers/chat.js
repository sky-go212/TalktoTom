import { requireAuth } from './auth.js';
import { dbAll, dbFirst, dbRun } from '../utils/d1.js';

const GROUP_MSG_TTL = 86400 * 2;
const DM_MSG_TTL = 86400 * 2;

export async function handleChat(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/chat', '');
  const subId = user.subId;

  if (!subId || subId === 'admin') return jsonError('Invalid session', 400);

  if (path === '/group/history') return getGroupHistory(env, subId, url);
  if (path === '/personal/rooms') return getPersonalRooms(env, subId, user);
  if (path === '/personal/history') return getPersonalHistory(env, subId, url, user);
  if (path === '/send') return sendMessage(request, env, ctx, user);

  return new Response('Not Found', { status: 404 });
}

async function getGroupHistory(env, subId, url) {
  const id = subId.replace(/-/g, '_');
  const before = url.searchParams.get('before') || Math.floor(Date.now() / 1000);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const msgs = await dbAll(env,
    `SELECT * FROM group_messages_${id} WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`,
    [before, limit]
  );
  return json({ messages: msgs.reverse() });
}

async function getPersonalRooms(env, subId, user) {
  const id = subId.replace(/-/g, '_');
  const rooms = await dbAll(env,
    `SELECT * FROM personal_chat_rooms_${id} WHERE participant_a = ? OR participant_b = ? ORDER BY last_message_at DESC`,
    [user.contactCode, user.contactCode]
  );
  return json({ rooms });
}

async function getPersonalHistory(env, subId, url, user) {
  const id = subId.replace(/-/g, '_');
  const roomId = url.searchParams.get('roomId');
  if (!roomId) return jsonError('roomId diperlukan');
  const before = url.searchParams.get('before') || Math.floor(Date.now() / 1000);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const msgs = await dbAll(env,
    `SELECT * FROM personal_messages_${id} WHERE room_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
    [roomId, before, limit]
  );
  return json({ messages: msgs.reverse() });
}

async function sendMessage(request, env, ctx, user) {
  const { scope, content, contentType, mediaUrl, roomId } = await request.json();
  const subId = user.subId;
  const id = subId.replace(/-/g, '_');
  const now = Math.floor(Date.now() / 1000);
  const msgId = `rest-${now}-${Math.random().toString(36).slice(2)}`;

  const outMsg = {
    id: msgId,
    subId,
    scope,
    senderCode: user.contactCode,
    senderName: user.name,
    content: content || null,
    contentType: contentType || 'text',
    mediaUrl: mediaUrl || null,
    roomId: roomId || null,
    time: now,
  };

  if (scope === 'group') {
    ctx.waitUntil(dbRun(env,
      `INSERT INTO group_messages_${id} (sender_code, sender_name, content, content_type, media_url, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.contactCode, user.name, content || null, contentType || 'text', mediaUrl || null, now + GROUP_MSG_TTL, now]
    ));
  } else if (scope === 'private' && roomId) {
    ctx.waitUntil((async () => {
      await dbRun(env,
        `INSERT INTO personal_messages_${id} (room_id, sender_code, sender_name, content, content_type, media_url, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [roomId, user.contactCode, user.name, content || null, contentType || 'text', mediaUrl || null, now + DM_MSG_TTL, now]
      );
      await dbRun(env,
        `INSERT INTO personal_chat_rooms_${id} (room_id, participant_a, participant_b, last_message, last_message_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(room_id) DO UPDATE SET last_message = excluded.last_message, last_message_at = excluded.last_message_at`,
        [roomId, user.contactCode, roomId.replace(user.contactCode, '').replace('-', ''), content, now]
      );
    })());
  }

  // Fix #5: broadcast via DO setelah persist, agar semua user online dapat pesan real-time
  ctx.waitUntil((async () => {
    try {
      const doId = env.SUB_SERVER.idFromName(subId);
      const doStub = env.SUB_SERVER.get(doId);
      await doStub.fetch('https://internal/internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outMsg),
      });
    } catch (e) {
      console.error('DO broadcast error:', e);
    }
  })());

  return json({ success: true, id: msgId });
}

function json(data) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
function jsonError(msg, status = 400) { return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
