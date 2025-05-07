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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Credenciais inválidas');
    }

    saveToken(data.token);
    localStorage.setItem('user', JSON.stringify(data));
    window.location.assign('/index.html');
    return data.token;
  }

  async function register({ name, email, password, role }) {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    const response = await res.json();
    if (!res.ok) {
      throw new Error(response.error || 'Erro no cadastro');
    }

    saveToken(response.token);
    localStorage.setItem('user', JSON.stringify(response));
    window.location.assign('/login.html');
    return response.token;
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
