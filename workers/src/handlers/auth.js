import { verifyJWT, signJWT, generateCode } from '../utils/jwt.js';
import { getSession, setSession, delSession, subServerKey, contactKey, kvGet, kvSet } from '../utils/kv.js';
import { dbFirst, dbAll, tbl } from '../utils/d1.js';

const TOKEN_TTL = 86400; // 24h

export async function handleAuth(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  if (path === '/validate' && request.method === 'POST') {
    return validateCode(request, env, ctx);
  }
  if (path === '/session' && request.method === 'GET') {
    return getSessionInfo(request, env);
  }
  if (path === '/logout' && request.method === 'POST') {
    return doLogout(request, env, ctx);
  }
  return new Response('Not Found', { status: 404 });
}

async function validateCode(request, env, ctx) {
  try {
    const { code, rememberMe } = await request.json();
    if (!code || typeof code !== 'string') {
      return jsonError('Kode diperlukan', 400);
    }
    const cleanCode = code.trim().toUpperCase();

    // Look up the code in KV (all SubServer metadata)
    const subServerList = await kvGet(env, 'subservers:list') || [];

    let foundUser = null;
    let foundSubId = null;

    for (const subId of subServerList) {
      const meta = await kvGet(env, subServerKey(subId));
      if (!meta) continue;

      // Check if it's the main user code
      if (meta.mainCode === cleanCode) {
        foundUser = { contactCode: meta.mainCode, name: meta.mainName || 'User Utama', role: 'main', subId };
        foundSubId = subId;
        break;
      }

      // Check contacts in D1
      const tableId = subId.replace(/-/g, '_');
      try {
        const contact = await dbFirst(env,
          `SELECT * FROM contacts_${tableId} WHERE contact_code = ? AND is_active = 1 AND deleted_at IS NULL`,
          [cleanCode]
        );
        if (contact) {
          foundUser = { contactCode: contact.contact_code, name: contact.name, role: 'contact', subId };
          foundSubId = subId;
          break;
        }
      } catch {}
    }

    // Check admin code
    if (!foundUser) {
      const adminCode = await kvGet(env, 'admin:code');
      if (adminCode && adminCode === cleanCode) {
        foundUser = { contactCode: cleanCode, name: 'Admin', role: 'admin', subId: 'admin' };
        foundSubId = 'admin';
      }
    }

    if (!foundUser) {
      return jsonError('Kode tidak valid atau sudah dinonaktifkan', 401);
    }

    const token = await signJWT(
      { ...foundUser, subId: foundSubId },
      env.JWT_SECRET,
      rememberMe ? TOKEN_TTL * 7 : TOKEN_TTL
    );

    ctx.waitUntil(setSession(env, token, { ...foundUser, subId: foundSubId }, rememberMe ? TOKEN_TTL * 7 : TOKEN_TTL));

    return json({ token, ...foundUser, subId: foundSubId });
  } catch (err) {
    return jsonError('Server error', 500);
  }
}

async function getSessionInfo(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  return json(user);
}

async function doLogout(request, env, ctx) {
  const token = extractToken(request);
  if (token) ctx.waitUntil(delSession(env, token));
  return json({ success: true });
}

export async function requireAuth(request, env) {
  const token = extractToken(request);
  if (!token) return null;
  const session = await getSession(env, token);
  if (session) return session;
  // Fall back to JWT verification
  const claims = await verifyJWT(token, env.JWT_SECRET);
  return claims;
}

function extractToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders({ 'Content-Type': 'application/json' }) });
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders({ 'Content-Type': 'application/json' }) });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extra,
  };
}
