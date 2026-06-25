/**
 * Cloudflare Pages Function — proxy /websocket ke Workers Durable Object
 * WebSocket upgrade forwarded ke Workers backend
 * Set env var WORKERS_URL di Cloudflare Pages Settings
 */
export async function onRequest(context) {
  const { request, env } = context;

  const WORKERS_URL = env.WORKERS_URL;
  if (!WORKERS_URL) {
    return new Response('WORKERS_URL not configured', { status: 503 });
  }

  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, WORKERS_URL);

  // Forward as-is — includes WebSocket Upgrade header
  return fetch(new Request(targetUrl.toString(), request));
}
