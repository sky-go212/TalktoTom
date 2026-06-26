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
    } catch (e) {
      console.error('Load rooms error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getContactName = (room) => {
    if (!user) return 'Unknown';
    const contactCode = room.participant_a === user.contactCode
      ? room.participant_b
      : room.participant_a;
    return contactCode;
  };

  const filteredRooms = rooms.filter(r => {
    const name = getContactName(r).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  if (!user) return null;

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="glass sticky top-0 z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Chat Pribadi</h1>
            <div className="flex items-center gap-1 text-xs text-success">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-error'}`} />
              <span>{connected ? 'Online' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex border-b border-white/10">
        <button onClick={() => navigate('/group')} className="flex-1 py-3 text-text-muted text-sm">
          👥 Ruang Umum
        </button>
        <button className="flex-1 py-3 text-primary border-b-2 border-primary font-semibold text-sm">
          💬 Chat Pribadi
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Cari percakapan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder-text-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-text-muted">
            <MessageCircle className="w-10 h-10 opacity-30" />
            <p className="text-sm">Belum ada chat pribadi</p>
          </div>
        ) : (
          filteredRooms.map((room, i) => (
            <motion.button
              key={room.room_id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/private/${room.room_id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/5 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-sm">
                  {getContactName(room).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm truncate">{getContactName(room)}</span>
                  <span className="text-xs text-text-muted flex-shrink-0 ml-2">{formatTime(room.last_message_at)}</span>
                </div>
                <p className="text-xs text-text-muted truncate mt-0.5">
                  {room.last_message || 'Mulai percakapan'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
};

export default PrivateChatListPage;
