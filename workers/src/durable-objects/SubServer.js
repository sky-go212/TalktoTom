import { verifyJWT } from '../utils/jwt.js';
import { dbRun, dbAll } from '../utils/d1.js';

const GROUP_MSG_TTL = 86400 * 2;

export class SubServer {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Fix #1: nested Map by subId for O(1) broadcast
    // sessions: Map<subId, Map<contactCode, {ws, name}>>
    this.sessions = new Map();
    // Reverse lookup: Map<ws, {contactCode, subId, name}>
    this.wsToUser = new Map();
    this.rateLimitWindows = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/ratelimit') return this.handleRateLimit(request);

    // Fix #5: internal broadcast from REST handler
    if (url.pathname === '/internal/broadcast') return this.handleInternalBroadcast(request);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleRateLimit(request) {
    const { maxRequests, windowSeconds } = await request.json();
    const key = request.headers.get('x-rate-key') || request.url;
    const now = Date.now();
    let window = this.rateLimitWindows.get(key) || { count: 0, resetAt: now + windowSeconds * 1000 };
    if (now > window.resetAt) window = { count: 0, resetAt: now + windowSeconds * 1000 };
    window.count++;
    this.rateLimitWindows.set(key, window);
    return new Response(JSON.stringify({ allowed: window.count <= maxRequests }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fix #5: REST-triggered broadcast
  async handleInternalBroadcast(request) {
    try {
      const msg = await request.json();
      const { subId, scope, roomId } = msg;
      const outMsg = { type: 'message', ...msg };
      if (scope === 'group') {
        this.broadcastToSubServer(subId, outMsg);
      } else if (scope === 'private' && roomId) {
        this.broadcastToRoom(subId, roomId, outMsg);
      }
      return new Response('ok');
    } catch (e) {
      return new Response('error', { status: 500 });
    }
  }

  async handleWebSocketUpgrade(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      if (data.type === 'connect') {
        await this.handleConnect(ws, data);
        return;
      }

      // Fix #1: O(1) user lookup via reverse map
      const userMeta = this.wsToUser.get(ws);
      if (!userMeta) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
      }
      const { contactCode, subId, name } = userMeta;

      if (data.type === 'message') {
        await this.handleMessage(ws, data, contactCode, name, subId);
      } else if (data.type === 'typing') {
        this.broadcast(subId, { type: 'typing', contactCode, isTyping: data.isTyping }, [contactCode]);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  }

  async handleConnect(ws, data) {
    try {
      const { token } = data;
      if (!token) { ws.close(1008, 'Token required'); return; }

      // Fix #4: check KV session first (faster), fallback to JWT verify
      let claims = null;
      try {
        const session = await this.env.KV.get(`session:${token}`, { type: 'json' });
        if (session && session.contactCode) claims = session;
      } catch {}

      if (!claims) {
        claims = await verifyJWT(token, this.env.JWT_SECRET);
      }

      if (!claims || !claims.contactCode) { ws.close(1008, 'Invalid token'); return; }

      const subId = claims.subId || 'default';
      const userMeta = { contactCode: claims.contactCode, subId, name: claims.name || 'User' };

      // Fix #1: store in nested Map by subId
      if (!this.sessions.has(subId)) this.sessions.set(subId, new Map());
      this.sessions.get(subId).set(claims.contactCode, { ws, name: claims.name });

      // Reverse lookup for O(1) identification on incoming messages
      this.wsToUser.set(ws, userMeta);

      ws.send(JSON.stringify({ type: 'connected', contactCode: claims.contactCode }));
      this.broadcast(subId, { type: 'presence', contactCode: claims.contactCode, online: true }, [claims.contactCode]);
    } catch (e) {
      ws.close(1011, 'Server error');
    }
  }

  async handleMessage(ws, data, contactCode, name, subId) {
    const now = Math.floor(Date.now() / 1000);
    const msgId = `ws-${now}-${Math.random().toString(36).slice(2)}`;

    const outMsg = {
      type: 'message',
      id: msgId,
      scope: data.scope,
      senderCode: contactCode,
      senderName: name,
      content: data.content,
      contentType: data.contentType || 'text',
      mediaUrl: data.mediaUrl || null,
      roomId: data.roomId || null,
      time: now,
    };

    if (data.scope === 'group') {
      this.broadcastToSubServer(subId, outMsg);
      this.state.waitUntil(this.persistGroupMessage(subId, outMsg, now));
    } else if (data.scope === 'private' && data.roomId) {
      this.broadcastToRoom(subId, data.roomId, outMsg);
      this.state.waitUntil(this.persistPrivateMessage(subId, outMsg, now));
    }
  }

  async persistGroupMessage(subId, msg, now) {
    try {
      const id = subId.replace(/-/g, '_');
      await dbRun(this.env,
        `INSERT INTO group_messages_${id} (sender_code, sender_name, content, content_type, media_url, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [msg.senderCode, msg.senderName, msg.content, msg.contentType, msg.mediaUrl, now + GROUP_MSG_TTL, now]
      );
    } catch (e) { console.error('persist group msg error:', e); }
  }

  async persistPrivateMessage(subId, msg, now) {
    try {
      const id = subId.replace(/-/g, '_');
      await dbRun(this.env,
        `INSERT INTO personal_messages_${id} (room_id, sender_code, sender_name, content, content_type, media_url, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [msg.roomId, msg.senderCode, msg.senderName, msg.content, msg.contentType, msg.mediaUrl, now + GROUP_MSG_TTL, now]
      );
    } catch (e) { console.error('persist private msg error:', e); }
  }

  // Fix #1: O(1) - langsung akses Map subId, tidak perlu iterasi semua session
  broadcastToSubServer(subId, msg) {
    const subSessions = this.sessions.get(subId);
    if (!subSessions) return;
    const payload = JSON.stringify(msg);
    for (const [, session] of subSessions.entries()) {
      try { session.ws.send(payload); } catch {}
    }
  }

  broadcastToRoom(subId, roomId, msg) {
    const subSessions = this.sessions.get(subId);
    if (!subSessions) return;
    const payload = JSON.stringify(msg);
    const participants = roomId.split('-');
    for (const code of participants) {
      const session = subSessions.get(code);
      if (session) try { session.ws.send(payload); } catch {}
    }
  }

  broadcast(subId, msg, excludeCodes = []) {
    const subSessions = this.sessions.get(subId);
    if (!subSessions) return;
    const payload = JSON.stringify(msg);
    for (const [code, session] of subSessions.entries()) {
      if (!excludeCodes.includes(code)) {
        try { session.ws.send(payload); } catch {}
      }
    }
  }

  webSocketClose(ws, code, reason) {
    const userMeta = this.wsToUser.get(ws);
    if (!userMeta) return;
    const { contactCode, subId } = userMeta;
    this.wsToUser.delete(ws);
    const subSessions = this.sessions.get(subId);
    if (subSessions) {
      subSessions.delete(contactCode);
      if (subSessions.size === 0) this.sessions.delete(subId);
    }
    this.broadcast(subId, { type: 'presence', contactCode, online: false }, []);
  }

  webSocketError(ws, error) {
    this.webSocketClose(ws, 1011, 'Error');
  }
}
