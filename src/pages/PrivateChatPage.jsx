import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Mic, Image } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useWebSocket } from '../contexts/WebSocketContext.jsx';
import ChatBubble from '../components/ChatBubble.jsx';
import TypingIndicator from '../components/TypingIndicator.jsx';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import * as api from '../utils/api.js';

const PrivateChatPage = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { user } = useAuth();
  const { connected, messages, typingUsers, sendPrivateMessage, setTyping, clearMessages } = useWebSocket();
  const [inputText, setInputText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);
  const [contactName, setContactName] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    loadMessages();
    return () => clearMessages();
  }, [user, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, localMessages]);

  const loadMessages = async () => {
    try {
      const data = await api.getPrivateMessages(roomId);
      setLocalMessages(data.messages || []);
      if (data.messages?.length > 0) {
        const other = data.messages.find(m => m.sender_code !== user.contactCode);
        if (other) setContactName(other.sender_name || other.sender_code || 'Chat');
      }
    } catch {}
  };

  const handleInputChange = (value) => {
    setInputText(value);
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendPrivateMessage(roomId, inputText.trim());
    setInputText('');
    setTyping(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { url } = await api.uploadMedia(file);
      sendPrivateMessage(roomId, null, url, 'image');
    } catch {}
  };

  const roomWsMessages = messages.filter(m => m.roomId === roomId);
  const normalizedLocal = localMessages.map(m => ({
    ...m, _dedupKey: `d1-${m.id}`,
    senderCode: m.senderCode || m.sender_code,
    senderName: m.senderName || m.sender_name,
    time: m.time || m.created_at,
  }));
  const normalizedWs = roomWsMessages.map(m => ({ ...m, _dedupKey: m.id }));
  const allMessages = [...normalizedLocal, ...normalizedWs];
  const uniqueMessages = Array.from(new Map(allMessages.map(m => [m._dedupKey, m])).values())
    .sort((a, b) => (a.created_at || a.time || 0) - (b.created_at || b.time || 0));

  if (!user) return null;

  const initials = (contactName || 'CH').slice(0, 2).toUpperCase();

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 h-10">
          <button onClick={() => navigate('/private')} className="icon-btn -ml-1 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-[#FF8E53]/30 flex items-center justify-center text-xs font-bold border border-primary/20 flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{contactName || 'Chat Pribadi'}</span>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <span className="text-xs text-white/40">{connected ? 'online' : 'offline'}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="page-content px-3 py-3 space-y-3 no-scrollbar">
        <AnimatePresence>
          {uniqueMessages.map((msg, index) => (
            <ChatBubble key={msg._dedupKey || msg.id || index} message={msg} isOwn={msg.senderCode === user.contactCode} />
          ))}
        </AnimatePresence>
        {Object.entries(typingUsers)
          .filter(([code, isTyping]) => isTyping && code !== user.contactCode)
          .map(([code]) => <TypingIndicator key={code} contactCode={code} />)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="page-footer">
        {showRecorder ? (
          <VoiceRecorder
            onCancel={() => setShowRecorder(false)}
            onSend={(audioUrl) => { sendPrivateMessage(roomId, null, audioUrl, 'voice'); setShowRecorder(false); }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRecorder(true)} className="icon-btn text-primary flex-shrink-0">
              <Mic className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tulis pesan..."
              className="input-glass flex-1 text-sm py-2.5"
            />
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
            <button onClick={() => fileInputRef.current?.click()} className="icon-btn text-primary flex-shrink-0">
              <Image className="w-5 h-5" />
            </button>
            <button onClick={handleSend} disabled={!inputText.trim()} className="send-btn flex-shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivateChatPage;
