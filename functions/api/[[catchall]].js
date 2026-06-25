/**
 * Cloudflare Pages Function — proxy /api/* ke Workers backend
 * Set env var WORKERS_URL di Cloudflare Pages Settings
 * Contoh: https://sky-chat.YOUR_SUBDOMAIN.workers.dev
 */
export async function onRequest(context) {
  const { request, env } = context;

  const WORKERS_URL = env.WORKERS_URL;
  if (!WORKERS_URL) {
    return new Response(
      JSON.stringify({ error: 'WORKERS_URL not configured in Pages environment variables' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, WORKERS_URL);

  const proxyReq = new Request(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  try {
    return await fetch(proxyReq);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Workers unreachable', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
