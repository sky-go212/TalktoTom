import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import VerifyAgePage from './components/VerifyAgePage.jsx';
import GroupChatPage from './pages/GroupChatPage.jsx';
import PrivateChatListPage from './pages/PrivateChatListPage.jsx';
import PrivateChatPage from './pages/PrivateChatPage.jsx';
import ContactManagerPage from './pages/ContactManagerPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { WebSocketProvider } from './contexts/WebSocketContext.jsx';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      // Sembunyikan native HTML splash (#splash-root di index.html)
      const nativeSplash = document.getElementById('splash-root');
      if (nativeSplash) {
        nativeSplash.classList.add('hidden');
        setTimeout(() => nativeSplash.remove(), 600);
      }
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return null;

  return (
    <AuthProvider>
      <WebSocketProvider>
        <Routes>
          <Route path="/" element={<VerifyAgePage />} />
          <Route path="/chat" element={<GroupChatPage />} />
          <Route path="/private" element={<PrivateChatListPage />} />
          <Route path="/private/:roomId" element={<PrivateChatPage />} />
          <Route path="/contacts" element={<ContactManagerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
