import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Copy, Check, Share2, RefreshCw, Trash2, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ContactManagerPage() {
  const [contacts, setContacts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('sky_chat_token');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/subserver/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setContacts((await res.json()).contacts || []);
    } catch { setError('Gagal memuat kontak'); }
    finally { setLoading(false); }
  }

  async function addContact() {
    if (!newContactName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/subserver/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newContactName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedCode(data.contactCode);
        setNewContactName('');
        fetchContacts();
      } else { setError('Gagal menambah kontak'); }
    } catch { setError('Gagal menambah kontak'); }
    finally { setLoading(false); }
  }

  async function resetContactCode(contactCode) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/subserver/contacts/${contactCode}/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { setGeneratedCode((await res.json()).newCode); fetchContacts(); }
    } catch { setError('Gagal reset kode'); }
    finally { setLoading(false); }
  }

  async function deleteContact(contactCode) {
    if (!confirm('Hapus kontak ini?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/subserver/contacts/${contactCode}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchContacts();
    } catch { setError('Gagal menghapus kontak'); }
    finally { setLoading(false); }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }

  function shareCode(code) {
    const text = `Gabung SKY-CHAT dengan kode: ${code}`;
    if (navigator.share) navigator.share({ title: 'SKY-CHAT', text });
    else copyCode(code);
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between h-10">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/chat')} className="icon-btn -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm">Kelola Kontak</span>
          </div>
          <button
            onClick={() => { setShowAddModal(true); setGeneratedCode(''); setNewContactName(''); setError(''); }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-[#FF8E53] px-3 py-1.5 rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 mx-3 mt-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Contact List */}
      <div className="page-content px-3 py-3 no-scrollbar">
        {loading && contacts.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
            <Users className="w-12 h-12 opacity-40" />
            <p className="text-sm">Belum ada kontak</p>
            <p className="text-xs text-white/20">Tap "+ Tambah" untuk buat kode baru</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map(contact => (
              <div key={contact.contact_code} className="bg-white/5 border border-white/8 rounded-2xl p-3.5 flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-[#FF8E53] flex items-center justify-center text-base font-bold">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  {contact.is_active === 1 && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0A0A0F]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{contact.name}</p>
                  <p className="text-xs text-white/40 font-mono tracking-widest">{contact.contact_code}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => copyCode(contact.contact_code)} className="icon-btn" title="Salin">
                    {copiedCode === contact.contact_code
                      ? <Check className="w-4 h-4 text-green-400" />
                      : <Copy className="w-4 h-4 text-white/40" />}
                  </button>
                  <button onClick={() => shareCode(contact.contact_code)} className="icon-btn" title="Bagikan">
                    <Share2 className="w-4 h-4 text-white/40" />
                  </button>
                  <button onClick={() => resetContactCode(contact.contact_code)} className="icon-btn" title="Reset kode">
                    <RefreshCw className="w-4 h-4 text-white/40" />
                  </button>
                  <button onClick={() => deleteContact(contact.contact_code)} className="icon-btn hover:bg-red-500/15" title="Hapus">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-3">
          <div className="bg-[#16161D] border border-white/10 rounded-3xl w-full max-w-md p-5">
            <h2 className="text-lg font-bold mb-4">
              {generatedCode ? 'Kode Kontak Baru' : 'Tambah Kontak'}
            </h2>

            {generatedCode ? (
              <div className="text-center py-2">
                <p className="text-white/40 text-sm mb-3">Bagikan kode ini ke kontak Anda</p>
                <div className="bg-black/40 border border-white/10 rounded-2xl py-5 px-4 mb-5">
                  <p className="text-3xl font-mono font-bold tracking-widest text-primary">{generatedCode}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyCode(generatedCode)}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-[#FF8E53] font-semibold text-sm"
                  >
                    {copiedCode === generatedCode ? '✓ Tersalin' : 'Salin'}
                  </button>
                  <button
                    onClick={() => shareCode(generatedCode)}
                    className="flex-1 py-3 rounded-2xl bg-white/8 font-semibold text-sm"
                  >
                    Bagikan
                  </button>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setGeneratedCode(''); }}
                  className="mt-3 text-white/30 text-sm w-full py-2"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addContact()}
                  placeholder="Nama kontak"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 text-sm"
                  maxLength={50}
                  autoFocus
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { setShowAddModal(false); setNewContactName(''); setError(''); }}
                    className="flex-1 py-3 rounded-2xl bg-white/5 text-white/50 font-semibold text-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={addContact}
                    disabled={!newContactName.trim() || loading}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-[#FF8E53] font-semibold text-sm disabled:opacity-40"
                  >
                    {loading ? '...' : 'Simpan'}
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
