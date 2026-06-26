import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';

const WebSocketContext = createContext(null);
const TOKEN_KEY = 'sky_chat_token';

// Fix #3: Exponential backoff constants
const INITIAL_RETRY_DELAY = 2000;
const MAX_RETRY_DELAY = 30000;
const MAX_RETRIES = 10;

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [retryCount, setRetryCount] = useState(0);

  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const typingTimers = useRef({});
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const { user } = useAuth();

  const clearReconnectTimer = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (!token || !user) return;

    // Tutup koneksi lama jika masih ada
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      ws.current.onclose = null;
      ws.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/websocket?subId=${user.subId || ''}`);
    ws.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) { socket.close(); return; }
      setConnected(true);
      retryCountRef.current = 0;
      setRetryCount(0);
      socket.send(JSON.stringify({ type: 'connect', token }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setMessages(prev => {
            // Fix #2: deduplikasi pakai id konsisten dari server
            const exists = prev.some(m => m.id === data.id);
            if (exists) return prev;
            return [...prev, { ...data, _source: 'ws' }];
          });
        } else if (data.type === 'typing' && data.contactCode) {
          setTypingUsers(prev => ({ ...prev, [data.contactCode]: data.isTyping }));
          if (typingTimers.current[data.contactCode]) clearTimeout(typingTimers.current[data.contactCode]);
          typingTimers.current[data.contactCode] = setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [data.contactCode]: false }));
          }, 3500);
        }
      } catch (e) {}
    };

    socket.onclose = (event) => {
      if (!mountedRef.current) return;
      setConnected(false);

      // Fix #3: exponential backoff dengan max retry
      if (user && retryCountRef.current < MAX_RETRIES) {
        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(1.5, retryCountRef.current), MAX_RETRY_DELAY);
        retryCountRef.current += 1;
        setRetryCount(retryCountRef.current);
        reconnectTimer.current = setTimeout(() => connect(), delay);
      }
    };

    socket.onerror = () => setConnected(false);
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    if (user) connect();
    return () => {
      mountedRef.current = false;
      clearReconnectTimer();
      Object.values(typingTimers.current).forEach(clearTimeout);
      if (ws.current) { ws.current.onclose = null; ws.current.close(); }
    };
  }, [user, connect]);

  const sendRaw = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  const sendGroupMessage = useCallback((text, mediaUrl = null, mediaType = 'text') => {
    sendRaw({ type: 'message', scope: 'group', contentType: mediaUrl ? mediaType : 'text', content: text || '', ...(mediaUrl && { mediaUrl }) });
  }, [sendRaw]);

  const sendPrivateMessage = useCallback((roomId, text, mediaUrl = null, mediaType = 'text') => {
    sendRaw({ type: 'message', scope: 'private', roomId, contentType: mediaUrl ? mediaType : 'text', content: text || '', ...(mediaUrl && { mediaUrl }) });
  }, [sendRaw]);

  const setTyping = useCallback((isTyping) => sendRaw({ type: 'typing', isTyping }), [sendRaw]);
  const clearMessages = useCallback(() => setMessages([]), []);

  return (
    <WebSocketContext.Provider value={{ connected, messages, typingUsers, retryCount, sendMessage: sendRaw, sendGroupMessage, sendPrivateMessage, setTyping, clearMessages }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be inside WebSocketProvider');
  return context;
}
