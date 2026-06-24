export async function checkRateLimit(env, key, maxRequests = 20, windowSeconds = 60) {
  const id = env.SUB_SERVER.idFromName(`ratelimit:${key}`);
  const stub = env.SUB_SERVER.get(id);
  const res = await stub.fetch('https://internal/ratelimit', {
    method: 'POST',
    body: JSON.stringify({ maxRequests, windowSeconds }),
  });
  const data = await res.json();
  return data.allowed;
}
