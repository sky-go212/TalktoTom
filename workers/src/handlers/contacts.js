import { requireAuth } from './auth.js';
import { dbAll, dbFirst, dbRun, tbl } from '../utils/d1.js';
import { kvSet, kvGet, contactKey, subServerKey } from '../utils/kv.js';
import { generateCode } from '../utils/jwt.js';
import { logAudit } from '../utils/audit.js';

export async function handleContacts(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  if (user.role !== 'main' && user.role !== 'admin') return jsonError('Forbidden', 403);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/subserver/contacts', '');
  const subId = user.subId;

  if (!subId || subId === 'admin') return jsonError('SubServer tidak ditemukan', 400);

  if (path === '' && request.method === 'GET') return getContacts(env, subId);
  if (path === '' && request.method === 'POST') return addContact(request, env, ctx, user);
  const match = path.match(/^\/([^/]+)(\/reset)?$/);
  if (match) {
    const code = match[1];
    if (match[2] === '/reset' && request.method === 'POST') return resetContact(env, ctx, subId, code, user);
    if (request.method === 'DELETE') return deleteContact(env, ctx, subId, code, user);
  }
  return new Response('Not Found', { status: 404 });
}

async function getContacts(env, subId) {
  const id = subId.replace(/-/g, '_');
  const contacts = await dbAll(env, `SELECT * FROM contacts_${id} WHERE deleted_at IS NULL ORDER BY created_at DESC`);
  return json({ contacts });
}

async function addContact(request, env, ctx, user) {
  const { name } = await request.json();
  if (!name?.trim()) return jsonError('Nama diperlukan');
  const subId = user.subId;
  const id = subId.replace(/-/g, '_');

  const contactCode = generateCode('USR');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 86400 * 2; // text expires 48h

  await dbRun(env,
    `INSERT INTO contacts_${id} (contact_code, name, is_active, created_at) VALUES (?, ?, 1, ?)`,
    [contactCode, name.trim(), now]
  );

  ctx.waitUntil(logAudit(env, {waitUntil: () => {}}, 'contact.created', { contactCode, name: name.trim(), subId }));

  return json({ contactCode, name: name.trim() });
}

async function resetContact(env, ctx, subId, code, user) {
  const id = subId.replace(/-/g, '_');
  const contact = await dbFirst(env, `SELECT * FROM contacts_${id} WHERE contact_code = ?`, [code]);
  if (!contact) return jsonError('Kontak tidak ditemukan', 404);

  const newCode = generateCode('USR');
  await dbRun(env, `UPDATE contacts_${id} SET contact_code = ? WHERE contact_code = ?`, [newCode, code]);

  return json({ newCode, oldCode: code });
}

async function deleteContact(env, ctx, subId, code, user) {
  const id = subId.replace(/-/g, '_');
  const now = Math.floor(Date.now() / 1000);
  await dbRun(env,
    `UPDATE contacts_${id} SET is_active = 0, deleted_at = ? WHERE contact_code = ?`,
    [now, code]
  );
  return json({ success: true });
}

function json(data) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
function jsonError(msg, status = 400) { return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
