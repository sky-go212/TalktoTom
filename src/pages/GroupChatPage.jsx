import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Image, MoreVertical, Users, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useWebSocket } from '../contexts/WebSocketContext.jsx';
import ChatBubble from '../components/ChatBubble.jsx';
import TypingIndicator from '../components/TypingIndicator.jsx';
import FABMenu from '../components/FABMenu.jsx';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import * as api from '../utils/api.js';

const GroupChatPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected, messages, typingUsers, sendGroupMessage, setTyping, clearMessages } = useWebSocket();
  const [inputText, setInputText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    loadMessages();
    return () => clearMessages();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, localMessages]);

  const loadMessages = async () => {
    try {
      const data = await api.getGroupMessages();
      setLocalMessages(data.messages || []);
    } catch (e) {}
  };

  const handleInputChange = (value) => {
    setInputText(value);
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendGroupMessage(inputText.trim());
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
      sendGroupMessage(null, url, 'image');
    } catch {}
  };

  const groupWsMessages = messages.filter(m => m.scope === 'group' || !m.scope);
  const normalizedLocal = localMessages.map(m => ({
    ...m, _dedupKey: `d1-${m.id}`,
    senderCode: m.senderCode || m.sender_code,
    senderName: m.senderName || m.sender_name,
    time: m.time || m.created_at,
  }));
  const normalizedWs = groupWsMessages.map(m => ({ ...m, _dedupKey: m.id }));
  const allMessages = [...normalizedLocal, ...normalizedWs];
  const uniqueMessages = Array.from(new Map(allMessages.map(m => [m._dedupKey, m])).values())
    .sort((a, b) => (a.created_at || a.time || 0) - (b.created_at || b.time || 0));

  if (!user) return null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between h-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#FF8E53] flex items-center justify-center text-xs font-bold">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm leading-tight">Ruang Umum</span>
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <span className="text-xs text-white/40">{connected ? 'terhubung' : 'menghubungkan...'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/contacts')} className="icon-btn">
              <Users className="w-4 h-4 text-white/60" />
            </button>
            <button onClick={() => setShowMenu(!showMenu)} className="icon-btn relative">
              <MoreVertical className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        <button className="tab-btn tab-btn-active">👥 Ruang Umum</button>
        <button onClick={() => navigate('/private')} className="tab-btn">💬 Chat Pribadi</button>
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
            onSend={(audioUrl) => { sendGroupMessage(null, audioUrl, 'voice'); setShowRecorder(false); }}
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

      {(user.role === 'admin' || user.role === 'main') && <FABMenu />}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-20 right-3 z-50 bg-[#1C1C24] border border-white/10 rounded-2xl p-1.5 min-w-[160px] shadow-xl"
            >
              <button
                onClick={() => { navigate('/settings'); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm text-left"
              >
                <Settings className="w-4 h-4 text-white/50" />
                <span>Settings</span>
              </button>
              <div className="h-px bg-white/5 mx-2 my-1" />
              <button
                onClick={() => { logout(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-sm text-left text-red-400"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupChatPage;
