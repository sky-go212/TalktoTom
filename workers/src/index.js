import { handleAuth } from './handlers/auth.js';
import { handleAdmin } from './handlers/admin.js';
import { handleContacts } from './handlers/contacts.js';
import { handleChat } from './handlers/chat.js';
import { handleMedia } from './handlers/media.js';
import { handleWebSocket } from './handlers/websocket.js';
import { runCleanup } from './cron/cleanup.js';
export { SubServer } from './durable-objects/SubServer.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const path = url.pathname;

    try {
      // WebSocket upgrade
      if (path === '/websocket') return handleWebSocket(request, env, ctx);

      // API routes
      if (path.startsWith('/api/auth')) return handleAuth(request, env, ctx);
      if (path.startsWith('/api/admin')) return handleAdmin(request, env, ctx);
      if (path.startsWith('/api/subserver/contacts')) return handleContacts(request, env, ctx);
      if (path.startsWith('/api/chat')) return handleChat(request, env, ctx);
      if (path.startsWith('/api/media')) return handleMedia(request, env, ctx);

      // Health check
      if (path === '/api/healthz') {
        return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }

      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCleanup(env, ctx));
  },
};
