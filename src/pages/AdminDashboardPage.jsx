import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [subServers, setSubServers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newSubServer, setNewSubServer] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');

  const token = localStorage.getItem('sky_chat_token') || sessionStorage.getItem('sky_chat_token');

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    if (user.role !== 'admin') { navigate('/chat'); return; }
    fetchSubServers();
  }, [user, navigate]);

  async function fetchSubServers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subserver', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubServers(data.subServers || []);
      }
    } catch { setError('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  async function createSubServer() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subserver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setNewSubServer(data);
        setNewName('');
        fetchSubServers();
      } else { setError('Gagal membuat SubServer'); }
    } catch { setError('Gagal membuat SubServer'); }
    finally { setLoading(false); }
  }

  async function disableSubServer(subId) {
    if (!confirm('Nonaktifkan SubServer ini?')) return;
    try {
      await fetch(`/api/admin/subserver/${subId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchSubServers();
    } catch { setError('Gagal menonaktifkan'); }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8B8B9E] font-mono">{user.contactCode}</span>
            <button onClick={logout} className="text-xs text-[#FF4757] px-3 py-1.5 rounded-lg bg-[#FF4757]/10">
              Logout
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-[#FF4757]/20 border border-[#FF4757]/30 rounded-xl text-sm text-[#FF4757]">
          {error}
        </div>
      )}

      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-[#16161D] border border-white/5 rounded-2xl p-4">
          <p className="text-3xl font-bold text-[#FF6B9D]">{subServers.length}</p>
          <p className="text-sm text-[#8B8B9E] mt-1">Total SubServer</p>
        </div>
        <div className="bg-[#16161D] border border-white/5 rounded-2xl p-4">
          <p className="text-3xl font-bold text-[#00F5FF]">
            {subServers.filter(s => s.status === 'active').length}
          </p>
          <p className="text-sm text-[#8B8B9E] mt-1">Aktif</p>
        </div>
      </div>

      <div className="px-4 mb-4">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 bg-gradient-to-r from-[#FF6B9D] to-[#FF8E53] rounded-2xl font-semibold"
        >
          + Buat SubServer Baru
        </button>
      </div>

      <div className="px-4 space-y-3 pb-10">
        <h2 className="text-sm font-medium text-[#8B8B9E] uppercase tracking-wider">Semua SubServer</h2>
        {loading && subServers.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-[#FF6B9D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : subServers.length === 0 ? (
          <div className="text-center py-10 text-[#8B8B9E]">Belum ada SubServer</div>
        ) : (
          subServers.map(server => (
            <div key={server.id} className="bg-[#16161D] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{server.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      server.status === 'active' ? 'bg-[#00F5A0]/20 text-[#00F5A0]' : 'bg-[#FF4757]/20 text-[#FF4757]'
                    }`}>
                      {server.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#8B8B9E] mt-1 font-mono">{server.id}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-[#8B8B9E]">Kode User Utama:</span>
                    <span className="text-xs font-mono text-[#FF6B9D]">{server.mainCode}</span>
                    <button onClick={() => copyCode(server.mainCode)} className="text-[#8B8B9E] hover:text-white">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {copiedCode === server.mainCode
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 002 2z" />
                        }
                      </svg>
                    </button>
                  </div>
                </div>
                {server.status === 'active' && (
                  <button
                    onClick={() => disableSubServer(server.id)}
                    className="text-xs text-[#FF4757] px-3 py-1.5 rounded-lg bg-[#FF4757]/10"
                  >
                    Nonaktif
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#16161D] border border-white/10 rounded-3xl w-full max-w-md p-6">
            {newSubServer ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-[#00F5A0]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#00F5A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">SubServer Dibuat!</h2>
                <p className="text-[#8B8B9E] text-sm mb-4">Kirim kode ini ke User Utama:</p>
                <div className="bg-[#0A0A0F] border border-white/10 rounded-2xl p-4 mb-4">
                  <p className="text-2xl font-mono font-bold tracking-wider text-[#FF6B9D]">{newSubServer.mainCode}</p>
                  <p className="text-xs text-[#8B8B9E] mt-1">{newSubServer.name}</p>
                </div>
                <button
                  onClick={() => copyCode(newSubServer.mainCode)}
                  className="w-full py-3 bg-gradient-to-r from-[#FF6B9D] to-[#FF8E53] rounded-2xl font-medium mb-2"
                >
                  {copiedCode === newSubServer.mainCode ? '✓ Tersalin!' : 'Salin Kode'}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewSubServer(null); }}
                  className="w-full py-3 bg-white/5 rounded-2xl text-[#8B8B9E]"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Buat SubServer</h2>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama SubServer (contoh: Tim Alpha)"
                  className="w-full bg-[#0A0A0F] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-[#8B8B9E] focus:outline-none focus:border-[#FF6B9D]/50"
                  maxLength={50}
                  autoFocus
                />
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-2xl bg-white/5 text-[#8B8B9E]">
                    Batal
                  </button>
                  <button
                    onClick={createSubServer}
                    disabled={!newName.trim() || loading}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#FF6B9D] to-[#FF8E53] font-medium disabled:opacity-50"
                  >
                    {loading ? '...' : 'Buat'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
