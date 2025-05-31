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
    console.log('[Auth.login] API endpoint:', `${API}/login`);
    console.log('[Auth.login] Payload →', { email, password });

    let res;
    try {
      res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (fetchErr) {
      console.error('[Auth.login] Erro no fetch:', fetchErr);
      throw new Error('Falha ao conectar com o servidor. Verifique a rede.');
    }

    console.log('[Auth.login] Status HTTP da resposta:', res.status);
    if (!res.ok) {
      let errText = 'Credenciais inválidas.';
      try {
        const errJson = await res.json();
        console.log('[Auth.login] JSON de erro recebido:', errJson);
        if (res.status === 403 && errJson.error) {
          errText = errJson.error;
        } else if (errJson.error) {
          errText = errJson.error;
        }
      } catch (jsonErr) {
        console.warn('[Auth.login] Não foi possível ler JSON de erro:', jsonErr);
      }
      throw new Error(errText);
    }

    let data;
    try {
      data = await res.json();
    } catch (jsonParseErr) {
      console.error('[Auth.login] Erro ao fazer parse do JSON de sucesso:', jsonParseErr);
      throw new Error('Resposta inválida do servidor.');
    }

    console.log('[Auth.login] Login bem-sucedido. Dados recebidos:', data);

    // 1) Armazena token e user
    saveToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // 2) Redireciona conforme role
    if (data.user.role === 'admin') {
      // Se, de fato, o admin.html fica em /pages/admin.html:
      window.location.assign('pages/admin.html');
    } else {
      window.location.assign('index.html');
    }

    return data.token;
  }

  async function register(data) {
    console.log('[Auth.register] API endpoint:', `${API}/register`);
    console.log('[Auth.register] Payload →', data);

    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    console.log('[Auth.register] Status HTTP da resposta:', res.status);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Auth.register] JSON de erro recebido:', err);
      throw new Error(err.error || 'Erro no cadastro');
    }

    const result = await res.json();
    console.log('[Auth.register] Cadastro bem-sucedido. JSON recebido:', result);

    window.location.assign('login.html');
    return result;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('login.html');
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

window.login = Auth.login;
window.register = Auth.register;
window.logout = Auth.logout;
window.getCurrentUser = Auth.getCurrentUser;
window.getToken = Auth.getToken;
window.Auth = Auth;
