export async function logAudit(env, ctx, action, data = {}) {
  ctx.waitUntil(
    Promise.resolve().then(() => {
      const entry = { ts: Date.now(), action, ...data };
      console.log('[AUDIT]', JSON.stringify(entry));
    })
  );
}
