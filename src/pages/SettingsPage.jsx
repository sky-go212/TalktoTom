import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, LogOut, Bell, Shield, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3 h-10">
          <button onClick={() => navigate(-1)} className="icon-btn -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Settings</span>
        </div>
      </div>

      <div className="page-content px-3 py-4 space-y-3 no-scrollbar">
        {/* Profile Card */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[#FF8E53] flex items-center justify-center text-xl font-bold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold">{user?.name}</p>
            <p className="text-xs text-white/40 font-mono mt-0.5">{user?.contactCode}</p>
            {user?.role === 'admin' && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">Admin</span>
            )}
          </div>
        </div>

        {/* Settings Items */}
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          {[
            { icon: Bell, label: 'Notifikasi', sub: 'Push notification settings', color: 'text-primary' },
            { icon: Shield, label: 'Privasi', sub: 'Security settings', color: 'text-cyan-400' },
            { icon: Info, label: 'Tentang', sub: 'SKY-CHAT v1.0', color: 'text-yellow-400' },
          ].map(({ icon: Icon, label, sub, color }, i, arr) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:bg-white/8 text-left transition-colors ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}
            >
              <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-white/40">{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/15 active:bg-red-500/20 transition-colors text-left"
        >
          <LogOut className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="font-semibold text-sm text-red-400">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
