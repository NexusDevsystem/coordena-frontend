const Auth = (() => {
  const API = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/auth'
    : 'https://coordena-backend.onrender.com/api/auth';

  function saveToken(token) {
    localStorage.setItem('token', token);
  }
  function getToken() {
    return localStorage.getItem('token');
  }

  async function login(email, password) {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Credenciais inválidas');
    }

    // **Agora a API retorna { user: {...}, token }**
    const { user, token } = await res.json();
    saveToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }

  async function register(data) {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro no cadastro');
    }

    const { user, token } = await res.json();
    saveToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('/login.html');
  }

  function getCurrentUser() {
    const str = localStorage.getItem('user');
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  return { login, register, logout, getCurrentUser, getToken };
})();
window.Auth = Auth;
