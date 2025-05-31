// assets/js/auth.js

const Auth = (() => {
  // 1) Verifica se estamos em localhost; se sim, usa o servidor local, senão aponta pro onrender
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
    // ← usa backticks para interpolar a constante API
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
          // caso específico (por exemplo "aguardando aprovação")
          errText = errJson.error;
        } else if (errJson.error) {
          errText = errJson.error;
        }
      } catch {
        // se não conseguir ler o JSON, mantemos a mensagem genérica
      }
      throw new Error(errText);
    }

    const data = await res.json();
    saveToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    // redireciona para a página principal após login bem‐sucedido
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

    const result = await res.json();
    // após cadastro, redireciona para a página de login
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

  // expondo apenas o que for necessário no objeto Auth
  return { login, register, logout, getCurrentUser, getToken };
})();

// 2) Se você precisar chamar `login(...)` ou `register(...)` diretamente no seu HTML,
//    basta copiar essas funções para o escopo global.
//    Caso seu formulário invoque `Auth.login(...)`, você pode ignorar as linhas abaixo.

window.login = Auth.login;
window.register = Auth.register;
window.logout = Auth.logout;
window.getCurrentUser = Auth.getCurrentUser;
window.getToken = Auth.getToken;

// Também expõe todo o objeto principal, caso prefira usar Auth.login() etc.
window.Auth = Auth;
