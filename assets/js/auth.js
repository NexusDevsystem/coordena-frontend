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
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email, password})
      });
      if (!res.ok) throw new Error('Credenciais inválidas');
      const { token } = await res.json();
      saveToken(token);
      return token;
    }
    async function register(data) {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro no cadastro');
      }
      // já retorna token para logar automaticamente
      const { token } = await res.json();
      saveToken(token);
      return token;
    }
    function logout() {
      localStorage.removeItem('token');
      window.location = 'login.html';
    }
    function getCurrentUser() {
      const t = getToken();
      if (!t) return null;
      try {
        const [, payload] = t.split('.');
        const data = JSON.parse(atob(payload));
        return data;
      } catch {
        return null;
      }
    }
    return { login, register, logout, getCurrentUser, getToken };
  })();
  window.Auth = Auth;
  