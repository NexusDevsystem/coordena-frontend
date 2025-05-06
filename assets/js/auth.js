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
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Credenciais inválidas');

    // agora o back já devolve { _id,name,email,role,token }
    const user = await res.json();
    saveToken(user.token);
    localStorage.setItem('user', JSON.stringify(user));
    // login OK → redireciona para a home (index)
    window.location.assign('/');
    return user.token;
  }

  async function register(data) {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Erro no cadastro');
    }

    // também recebe { _id,name,email,role,token }
    const user = await res.json();
    saveToken(user.token);
    localStorage.setItem('user', JSON.stringify(user));
    // registro OK → redireciona para o login
    window.location.assign('/login');
    return user.token;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('/login');
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
