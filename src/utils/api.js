const TOKEN_KEY = 'sky_chat_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }), ...options.headers };
  const response = await fetch(endpoint, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function login(code, rememberMe = false) {
  const { getDeviceFingerprint } = await import('./device.js');
  const deviceFingerprint = await getDeviceFingerprint();
  return apiFetch('/api/auth/validate', { method: 'POST', body: JSON.stringify({ code: code.toUpperCase(), rememberMe, deviceFingerprint }) });
}

export async function logout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function getSession() { return apiFetch('/api/auth/session'); }
export async function getContacts() { return apiFetch('/api/subserver/contacts'); }
export async function createContact(name) { return apiFetch('/api/subserver/contacts', { method: 'POST', body: JSON.stringify({ name }) }); }
export async function deleteContact(code) { return apiFetch(`/api/subserver/contacts/${code}`, { method: 'DELETE' }); }
export async function resetContactCode(code) { return apiFetch(`/api/subserver/contacts/${code}/reset`, { method: 'POST' }); }
export async function getGroupMessages() { return apiFetch('/api/chat/group/history'); }
export async function getPrivateMessages(roomId) { return apiFetch(`/api/chat/personal/history?roomId=${roomId}`); }
export async function getChatRooms() { return apiFetch('/api/chat/personal/rooms'); }

export async function uploadMedia(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/media/upload', { method: 'POST', headers: token ? { 'Authorization': `Bearer ${token}` } : {}, body: formData });
  if (!response.ok) throw new Error('Upload failed');
  return response.json();
}
