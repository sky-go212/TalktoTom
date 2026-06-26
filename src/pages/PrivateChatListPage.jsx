import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useWebSocket } from '../contexts/WebSocketContext.jsx';
import * as api from '../utils/api.js';

const PrivateChatListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connected } = useWebSocket();
  const [rooms, setRooms] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    loadRooms();
  }, [user]);

  const loadRooms = async () => {
    try {
      const data = await api.getChatRooms();
      setRooms(data.rooms || []);
    } catch {}
    finally { setLoading(false); }
  };

  const getContactName = (room) => {
    if (!user) return 'Unknown';
    return room.participant_a === user.contactCode ? room.participant_b : room.participant_a;
  };

  const filteredRooms = rooms.filter(r =>
    getContactName(r).toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

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
                <span className="font-semibold text-sm leading-tight">SKY-CHAT</span>
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <span className="text-xs text-white/40">{connected ? 'terhubung' : 'menghubungkan...'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        <button onClick={() => navigate('/chat')} className="tab-btn">👥 Ruang Umum</button>
        <button className="tab-btn tab-btn-active">💬 Chat Pribadi</button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2.5">
        <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
          <input
            type="text"
            placeholder="Cari percakapan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder-white/30"
          />
        </div>
      </div>

      {/* List */}
      <div className="page-content no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/30">
            <MessageCircle className="w-10 h-10 opacity-40" />
            <p className="text-sm">Belum ada chat pribadi</p>
          </div>
        ) : (
          filteredRooms.map((room, i) => (
            <motion.button
              key={room.room_id || i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/private/${room.room_id}`)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/3 active:bg-white/5 border-b border-white/5 text-left transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-[#FF8E53]/20 flex items-center justify-center flex-shrink-0 border border-primary/20">
                <span className="text-primary font-bold text-sm">
                  {getContactName(room).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-sm truncate">{getContactName(room)}</span>
                  <span className="text-xs text-white/30 flex-shrink-0 ml-2">{formatTime(room.last_message_at)}</span>
                </div>
                <p className="text-xs text-white/40 truncate">
                  {room.last_message || 'Mulai percakapan'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
};

export default PrivateChatListPage;
