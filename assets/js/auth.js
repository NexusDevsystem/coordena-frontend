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
    // ← use crases (backticks) aqui para interpolar a variável API
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      let errText = 'Credenciais inválidas.';
      try {
        const errJson = await res.json();
        if (res.status === 403 && errJson.error) {
          // caso “aguardando aprovação” ou outro erro específico
          errText = errJson.error;
        } else if (errJson.error) {
          errText = errJson.error;
        }
      } catch {
        // se não conseguir ler JSON, mantém errText genérico
      }
      throw new Error(errText);
    }

    const data = await res.json();
    saveToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.assign('/index.html');
    return data.token;
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
    const result = await res.json(); // { message: '…', … }
    // aqui você não vai receber token, pois o register só retorna mensagem de sucesso
    window.location.assign('/login.html');
    return result;
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
