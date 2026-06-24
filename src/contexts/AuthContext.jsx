import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'sky_chat_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch('/api/auth/session', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.contactCode) setUser({ ...data, token });
          else { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); }
        })
        .catch(() => { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (code, rememberMe = false) => {
    try {
      const res = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error || 'Kode tidak valid' };
      const token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      if (!rememberMe) sessionStorage.setItem(TOKEN_KEY, token);
      setUser({ ...data, token });
      return { success: true, ...data };
    } catch (err) {
      return { success: false, message: 'Koneksi gagal. Coba lagi.' };
    }
  };

  const logout = async () => {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); } catch (e) {}
    }
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}
