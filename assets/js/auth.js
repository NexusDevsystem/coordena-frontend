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
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Credenciais inválidas');
    const { token } = await res.json();
    saveToken(token);
    window.location.assign('/');
    return token;
  }

  async function register(data) {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data)    // agora inclui name, email, password e role
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Erro no cadastro');
    }
    const { token } = await res.json();
    saveToken(token);
    window.location.assign('/login');
    return token;
  }

  function logout() {
    localStorage.removeItem('token');
    window.location.assign('/login');
  }

  function getCurrentUser() {
    const t = getToken();
    if (!t) return null;
    try {
      const [, payload] = t.split('.');
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }

  return { login, register, logout, getCurrentUser, getToken };
})();
window.Auth = Auth;
