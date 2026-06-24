import { requireAuth } from './auth.js';
import { kvGet, kvSet, kvList, subServerKey } from '../utils/kv.js';
import { initSubServerTables } from '../utils/d1.js';
import { generateCode } from '../utils/jwt.js';
import { logAudit } from '../utils/audit.js';

export async function handleAdmin(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user || user.role !== 'admin') return jsonError('Forbidden', 403);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/admin', '');

  if (path === '/subserver' && request.method === 'GET') return listSubServers(env);
  if (path === '/subserver' && request.method === 'POST') return createSubServer(request, env, ctx, user);
  if (path.startsWith('/subserver/') && request.method === 'DELETE') {
    const subId = path.split('/')[2];
    return disableSubServer(env, subId, user, ctx);
  }
  return new Response('Not Found', { status: 404 });
}

async function listSubServers(env) {
  const list = await kvGet(env, 'subservers:list') || [];
  const servers = await Promise.all(list.map(id => kvGet(env, subServerKey(id)).then(m => m ? { id, ...m } : null)));
  return json({ subServers: servers.filter(Boolean) });
}

async function createSubServer(request, env, ctx, adminUser) {
  const { name } = await request.json();
  if (!name?.trim()) return jsonError('Nama diperlukan');

  const subId = `sub-${generateCode('', 8).toLowerCase()}`;
  const mainCode = generateCode('UTAMA');

  // Initialize D1 tables for new SubServer
  try { await initSubServerTables(env, subId); } catch (e) {}

  const meta = { name: name.trim(), mainCode, mainName: 'User Utama', status: 'active', createdAt: Date.now() };
  ctx.waitUntil((async () => {
    await kvSet(env, subServerKey(subId), meta);
    const list = await kvGet(env, 'subservers:list') || [];
    if (!list.includes(subId)) list.push(subId);
    await kvSet(env, 'subservers:list', list);
    await logAudit(env, ctx, 'subserver.created', { subId, name, adminUser: adminUser.contactCode });
  })());

  return json({ subId, mainCode, name: name.trim() });
}

async function disableSubServer(env, subId, user, ctx) {
  const meta = await kvGet(env, subServerKey(subId));
  if (!meta) return jsonError('SubServer tidak ditemukan', 404);
  meta.status = 'disabled';
  ctx.waitUntil(kvSet(env, subServerKey(subId), meta));
  return json({ success: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
