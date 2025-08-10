// ======================================
// assets/js/auth.js
// Sessão, login e guard robusto
// ======================================

const Auth = (() => {
  const API_BASE = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/auth'
    : 'https://coordena-backend.onrender.com/api/auth';

  // Chaves de storage (sem fallback cruzado!)
  const KEYS = {
    USER: 'user',
    TOKEN: 'token',
    ADMIN_USER: 'admin_user',
    ADMIN_TOKEN: 'admin_token',
  };

  // MIGRAÇÃO: remove chaves antigas que causam login automático/errado
  (function purgeBadFallbacks() {
    try {
      const ra = localStorage.getItem('rawAdminUser');
      if (ra) localStorage.removeItem('rawAdminUser');

      // Se por algum motivo existem admin_user/admin_token sem role admin, limpa
      const auser = safeParse(localStorage.getItem(KEYS.ADMIN_USER));
      if (auser && auser.role && auser.role !== 'admin') {
        localStorage.removeItem(KEYS.ADMIN_USER);
        localStorage.removeItem(KEYS.ADMIN_TOKEN);
      }
    } catch (_) {}
  })();

  function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function saveSession({ user, token }) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    localStorage.setItem(KEYS.TOKEN, token);

    // Só salva chaves de admin se REALMENTE for admin
    if (user?.role === 'admin') {
      localStorage.setItem(KEYS.ADMIN_USER, JSON.stringify(user));
      localStorage.setItem(KEYS.ADMIN_TOKEN, token);
    } else {
      localStorage.removeItem(KEYS.ADMIN_USER);
      localStorage.removeItem(KEYS.ADMIN_TOKEN);
    }
  }

  function clearSession() {
    localStorage.removeItem(KEYS.USER);
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.ADMIN_USER);
    localStorage.removeItem(KEYS.ADMIN_TOKEN);
  }

  function getToken() {
    return localStorage.getItem(KEYS.TOKEN) || '';
  }

  function getUser() {
    return safeParse(localStorage.getItem(KEYS.USER));
  }

  async function login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha no login');
    }
    const data = await res.json();
    // Espera { user, token }
    saveSession(data);
    return data;
  }

  async function me() {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      clearSession();
      return null;
    }
    if (!res.ok) return null;
    return res.json(); // { user }
  }

  function logout() {
    clearSession();
    location.href = '/pages/login.html';
  }

  // Guard genérico: exige login e (opcional) role
  async function guardPage(requiredRole = null) {
    const sessionUser = getUser();
    const token = getToken();

    if (!token || !sessionUser) {
      // Não está logado -> manda pro login
      location.href = '/pages/login.html';
      return;
    }

    // Confirma no backend (evita “login automático” por storage podre)
    const server = await me();
    if (!server || !server.user) {
      location.href = '/pages/login.html';
      return;
    }

    // Se exigiu role e não bate, volta pra Home (ou login)
    if (requiredRole && server.user.role !== requiredRole) {
      // opção: enviar para home pública
      location.href = '/index.html';
      return;
    }

    // Atualiza storage com payload conferido
    saveSession({ user: server.user, token });
  }

  return {
    login,
    logout,
    me,
    guardPage,
    getUser,
    getToken,
    clearSession,
  };
})();

window.Auth = Auth;
