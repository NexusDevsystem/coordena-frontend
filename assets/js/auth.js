// assets/js/auth.js
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
      const err = await res.json();
      throw new Error(err.error || 'Credenciais inválidas');
    }

    // agora o backend retorna { user, token }
    const { user, token } = await res.json();
    saveToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    // login OK → redireciona para a home (index.html)
    window.location.assign('/index.html');
    return token;
  }

  async function register(data) {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro no cadastro');
    }

    // backend retorna { user, token }
    const { user, token } = await res.json();
    saveToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    // registro OK → redireciona para o login.html
    window.location.assign('/login.html');
    return token;
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
