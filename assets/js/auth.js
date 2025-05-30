// assets/js/auth.js

const Auth = (() => {
  // Ajuste automático para usar localhost em dev ou backend real em produção
  const API = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/auth'
    : 'https://coordena-backend.onrender.com/api/auth';

  // NÃO vamos mais usar uma única chave “token”; guardaremos tokens em chaves separadas
  function saveTokenForRole(role, token) {
    if (role === 'admin') {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.setItem('token', token);
    }
  }

  function getTokenForRole(role) {
    return role === 'admin'
      ? localStorage.getItem('admin_token')
      : localStorage.getItem('token');
  }

  // Guarda o objeto user também em chaves separadas
  function saveUserForRole(role, userObj) {
    const json = JSON.stringify(userObj);
    if (role === 'admin') {
      localStorage.setItem('admin_user', json);
    } else {
      localStorage.setItem('user', json);
    }
  }

  // Recupera o user do localStorage, conforme a role
  function getUserForRole(role) {
    const key = role === 'admin' ? 'admin_user' : 'user';
    const str = localStorage.getItem(key);
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
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

    // 1) Salva no localStorage com chaves separadas
    const role = data.user.role; // 'admin', 'professor' ou 'student'
    saveTokenForRole(role, data.token);
    saveUserForRole(role, data.user);

    // 2) Redireciona conforme a role
    if (role === 'admin') {
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

  function logout(role) {
    // Remove apenas as chaves correspondentes àquela sessão
    if (role === 'admin') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    window.location.assign('login.html');
  }

  function getCurrentUser(role) {
    return getUserForRole(role);
  }

  function getToken(role) {
    return getTokenForRole(role);
  }

  return { login, register, logout, getCurrentUser, getToken };
})();

// Expõe as funções globalmente para as páginas HTML
window.Auth = Auth;
