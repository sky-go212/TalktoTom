import { requireAuth } from './auth.js';
import { subServerKey, kvGet } from '../utils/kv.js';

export async function handleWebSocket(request, env, ctx) {
  // Verify token before upgrading
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ||
    (request.headers.get('Authorization') || '').replace('Bearer ', '');

  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Route to the correct SubServer Durable Object
  // The sub-ID is determined after first message (connect event), so we use a
  // temporary DO based on token hash, then reroute if needed.
  // For simplicity: route to subserver DO via token -> subId mapping
  let subId = url.searchParams.get('subId') || 'default';

  const doId = env.SUB_SERVER.idFromName(subId);
  const doStub = env.SUB_SERVER.get(doId);

  // Forward the WebSocket upgrade to the DO
  return doStub.fetch(request);
}
