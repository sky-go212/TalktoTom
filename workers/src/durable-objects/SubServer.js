import { verifyJWT } from '../utils/jwt.js';
import { dbRun, dbAll } from '../utils/d1.js';

const GROUP_MSG_TTL = 86400 * 2;

export class SubServer {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // contactCode -> WebSocket
    this.rateLimitWindows = new Map(); // key -> { count, resetAt }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Rate limit endpoint (internal use)
    if (url.pathname === '/ratelimit') {
      return this.handleRateLimit(request);
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleRateLimit(request) {
    const { maxRequests, windowSeconds } = await request.json();
    const key = request.url;
    const now = Date.now();
    let window = this.rateLimitWindows.get(key) || { count: 0, resetAt: now + windowSeconds * 1000 };

    if (now > window.resetAt) {
      window = { count: 0, resetAt: now + windowSeconds * 1000 };
    }
    window.count++;
    this.rateLimitWindows.set(key, window);

    return new Response(JSON.stringify({ allowed: window.count <= maxRequests }), {
      headers: { 'Content-Type': 'application/json' }
    });
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

      // Get sender info from ws metadata
      const meta = this.state.getTags(ws);
      const contactCode = meta[0];
      const subId = meta[1];
      const name = meta[2];

      if (!contactCode) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
      }

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
      const { token, code } = data;
      if (!token) { ws.close(1008, 'Token required'); return; }

      const claims = await verifyJWT(token, this.env.JWT_SECRET);
      if (!claims || !claims.contactCode) { ws.close(1008, 'Invalid token'); return; }

      const subId = claims.subId || 'default';
      // Store metadata as tags: [contactCode, subId, name]
      this.state.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
      );

      // Tag the WebSocket for routing
      // Note: tags are set during acceptWebSocket, so we store in a map
      this.sessions.set(claims.contactCode, { ws, subId, name: claims.name });

      ws.send(JSON.stringify({ type: 'connected', contactCode: claims.contactCode }));

      // Broadcast presence
      this.broadcast(subId, { type: 'presence', contactCode: claims.contactCode, online: true }, [claims.contactCode]);
    } catch (e) {
      ws.close(1011, 'Server error');
    }
  }

  async handleMessage(ws, data, contactCode, name, subId) {
    const now = Math.floor(Date.now() / 1000);
    const msgId = `${now}-${Math.random().toString(36).slice(2)}`;

    const outMsg = {
      type: 'message',
      id: msgId,
      scope: data.scope,
      senderCode: contactCode,
      senderName: name,
      content: data.content,
      contentType: data.contentType || 'text',
      mediaUrl: data.mediaUrl,
      roomId: data.roomId,
      time: now,
    };

    // Broadcast to all in subServer
    if (data.scope === 'group') {
      this.broadcastToSubServer(subId, outMsg);
      // Persist non-blocking
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
        [msg.senderCode, msg.senderName, msg.content, msg.contentType, msg.mediaUrl, now + 86400 * 2, now]
      );
    } catch (e) {}
  }

  async persistPrivateMessage(subId, msg, now) {
    try {
      const id = subId.replace(/-/g, '_');
      await dbRun(this.env,
        `INSERT INTO personal_messages_${id} (room_id, sender_code, sender_name, content, content_type, media_url, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [msg.roomId, msg.senderCode, msg.senderName, msg.content, msg.contentType, msg.mediaUrl, now + 86400 * 2, now]
      );
    } catch (e) {}
  }

  broadcastToSubServer(subId, msg) {
    const payload = JSON.stringify(msg);
    for (const [code, session] of this.sessions.entries()) {
      if (session.subId === subId) {
        try { session.ws.send(payload); } catch {}
      }
    }
  }

  broadcastToRoom(subId, roomId, msg) {
    const payload = JSON.stringify(msg);
    const [a, b] = roomId.split('-');
    for (const [code, session] of this.sessions.entries()) {
      if (session.subId === subId && (code === a || code === b)) {
        try { session.ws.send(payload); } catch {}
      }
    }
  }

  broadcast(subId, msg, excludeCodes = []) {
    const payload = JSON.stringify(msg);
    for (const [code, session] of this.sessions.entries()) {
      if (session.subId === subId && !excludeCodes.includes(code)) {
        try { session.ws.send(payload); } catch {}
      }
    }
  }

  webSocketClose(ws, code, reason) {
    for (const [contactCode, session] of this.sessions.entries()) {
      if (session.ws === ws) {
        this.sessions.delete(contactCode);
        this.broadcast(session.subId, { type: 'presence', contactCode, online: false }, []);
        break;
      }
    }
  }

  webSocketError(ws, error) {
    this.webSocketClose(ws, 1011, 'Error');
  }
}
