import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';

const WebSocketContext = createContext(null);
const TOKEN_KEY = 'sky_chat_token';

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const typingTimers = useRef({});
  const { user } = useAuth();

  const connect = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (!token || !user) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/websocket`);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: 'connect', code: user.contactCode || user.code, token }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setMessages(prev => [...prev, { ...data, id: data.id || `ws-${Date.now()}-${Math.random()}`, timestamp: data.time || data.timestamp || Date.now() }]);
        } else if (data.type === 'typing' && data.contactCode) {
          setTypingUsers(prev => ({ ...prev, [data.contactCode]: data.isTyping }));
          if (typingTimers.current[data.contactCode]) clearTimeout(typingTimers.current[data.contactCode]);
          typingTimers.current[data.contactCode] = setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [data.contactCode]: false }));
          }, 3500);
        }
      } catch (e) {}
    };

    socket.onclose = () => {
      setConnected(false);
      if (user) reconnectTimer.current = setTimeout(() => connect(), 3000);
    };
    socket.onerror = () => setConnected(false);
  }, [user]);

  useEffect(() => {
    if (user) connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      Object.values(typingTimers.current).forEach(clearTimeout);
      if (ws.current) { ws.current.onclose = null; ws.current.close(); }
    };
  }, [user, connect]);

  const sendRaw = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(data));
  };

  const sendGroupMessage = (text, mediaUrl = null, mediaType = 'text') => {
    sendRaw({ type: 'message', scope: 'group', contentType: mediaUrl ? mediaType : 'text', content: text || '', ...(mediaUrl && { mediaUrl }) });
  };

  const sendPrivateMessage = (roomId, text, mediaUrl = null, mediaType = 'text') => {
    sendRaw({ type: 'message', scope: 'private', roomId, contentType: mediaUrl ? mediaType : 'text', content: text || '', ...(mediaUrl && { mediaUrl }) });
  };

  const setTyping = (isTyping) => sendRaw({ type: 'typing', isTyping });
  const clearMessages = () => setMessages([]);

  return (
    <WebSocketContext.Provider value={{ connected, messages, typingUsers, sendMessage: sendRaw, sendGroupMessage, sendPrivateMessage, setTyping, clearMessages }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be inside WebSocketProvider');
  return context;
}
