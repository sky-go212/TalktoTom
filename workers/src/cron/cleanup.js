import { kvGet } from '../utils/kv.js';
import { subServerKey } from '../utils/kv.js';
import { dbRun, dbAll } from '../utils/d1.js';
import { r2Delete } from '../utils/r2.js';

export async function runCleanup(env, ctx) {
  const now = Math.floor(Date.now() / 1000);
  const subServerList = await kvGet(env, 'subservers:list') || [];

  console.log(`[CRON] Cleanup started. SubServers: ${subServerList.length}`);

  for (const subId of subServerList) {
    const id = subId.replace(/-/g, '_');
    ctx.waitUntil((async () => {
      try {
        // Delete expired group messages
        const expiredGroup = await dbAll(env,
          `SELECT id, media_url FROM group_messages_${id} WHERE expires_at < ? AND expires_at IS NOT NULL`,
          [now]
        );
        for (const msg of expiredGroup) {
          if (msg.media_url) {
            const key = msg.media_url.replace('/api/media/file/', '');
            await r2Delete(env, key);
          }
        }
        if (expiredGroup.length > 0) {
          await dbRun(env, `DELETE FROM group_messages_${id} WHERE expires_at < ? AND expires_at IS NOT NULL`, [now]);
          console.log(`[CRON] ${subId}: deleted ${expiredGroup.length} group messages`);
        }

        // Delete expired personal messages
        const expiredDM = await dbAll(env,
          `SELECT id, media_url FROM personal_messages_${id} WHERE expires_at < ? AND expires_at IS NOT NULL`,
          [now]
        );
        for (const msg of expiredDM) {
          if (msg.media_url) {
            const key = msg.media_url.replace('/api/media/file/', '');
            await r2Delete(env, key);
          }
        }
        if (expiredDM.length > 0) {
          await dbRun(env, `DELETE FROM personal_messages_${id} WHERE expires_at < ? AND expires_at IS NOT NULL`, [now]);
          console.log(`[CRON] ${subId}: deleted ${expiredDM.length} personal messages`);
        }
      } catch (e) {
        console.error(`[CRON] Error cleaning ${subId}:`, e.message);
      }
    })());
  }

  // Heartbeat to external monitor
  if (env.HEARTBEAT_URL) {
    ctx.waitUntil(fetch(env.HEARTBEAT_URL).catch(() => {}));
  }

  console.log('[CRON] Cleanup done');
}
