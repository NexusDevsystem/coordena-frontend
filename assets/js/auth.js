// assets/js/auth.js

const Auth = (() => {
  // Ajuste automático para usar localhost em dev ou backend real em produção
  const API = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/auth'
    : 'https://coordena-backend.onrender.com/api/auth';

  // --------------------------------------------------
  // Helpers para armazenar token + user no localStorage,
  // em chaves distintas para “admin” e para “user”
  // --------------------------------------------------
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

  function saveUserForRole(role, userObj) {
    const json = JSON.stringify(userObj);
    if (role === 'admin') {
      localStorage.setItem('admin_user', json);
    } else {
      localStorage.setItem('user', json);
    }
  }

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

  // --------------------------------------------------
  // FUNÇÃO: login(email, password)
  // → Faz POST /api/auth/login → { _id, name, email, role, status, token }
  // → Se status 403 ou 401, joga um Error com a mensagem do backend
  // → Se OK, salva token+user e redireciona de acordo com a role
  // --------------------------------------------------
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
      throw new Error('Falha ao conectar com o servidor. Verifique sua conexão de rede.');
    }

    console.log('[Auth.login] Status HTTP da resposta:', res.status);
    if (!res.ok) {
      // Lê JSON de erro, se possível
      let errText = 'Credenciais inválidas.';
      try {
        const errJson = await res.json();
        console.log('[Auth.login] JSON de erro recebido:', errJson);
        if (errJson.error) {
          errText = errJson.error;
        } else if (errJson.message) {
          errText = errJson.message;
        }
      } catch (jsonErr) {
        console.warn('[Auth.login] Não foi possível ler JSON de erro:', jsonErr);
      }
      throw new Error(errText);
    }

    // Se OK, parseia o JSON de sucesso
    let data;
    try {
      data = await res.json();
    } catch (jsonParseErr) {
      console.error('[Auth.login] Erro ao fazer parse do JSON de sucesso:', jsonParseErr);
      throw new Error('Resposta inválida do servidor.');
    }

    console.log('[Auth.login] Login bem-sucedido. Dados recebidos:', data);

    // → AQUI ESTÁ A MUDANÇA MAIS IMPORTANTE:
    // O backend agora retorna um objeto achatado, ex:
    // { _id: "...", name: "...", email: "...", role: "professor", status: "approved", token: "..." }
    //
    // Extraímos o token diretamente, e construímos um objeto “userObj” para salvar no localStorage.
    const token = data.token;
    const role  = data.role; // <-- pegamos do objeto retornado

    // Reconstruímos um “userObj” sem o campo “token”
    const userObj = {
      _id:    data._id,
      name:   data.name,
      email:  data.email,
      role:   data.role,
      status: data.status
    };

    // 1) Salva token + user no localStorage, separando por role
    saveTokenForRole(role, token);
    saveUserForRole(role, userObj);

    // 2) Redireciona conforme a role
    if (role === 'admin') {
      window.location.assign('pages/admin.html');
    } else {
      window.location.assign('index.html');
    }

    return token;
  }

  // --------------------------------------------------
  // FUNÇÃO: register({ name, email, password })
  // → Faz POST /api/auth/register
  // → Se status != 2xx, joga Error com mensagem do backend
  // → Se cadastrado, redireciona o usuário para login.html
  // --------------------------------------------------
  async function register(data) {
  console.log('[Auth.register] API endpoint:', `${API}/register`);
  console.log('[Auth.register] Payload →', data);

  let res;
  try {
    res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (fetchErr) {
    console.error('[Auth.register] Erro no fetch:', fetchErr);
    throw new Error('Falha ao conectar com o servidor. Verifique sua conexão de rede.');
  }

  console.log('[Auth.register] Status HTTP da resposta:', res.status);
  if (!res.ok) {
    let errText = 'Erro no cadastro.';
    try {
      const errJson = await res.json();
      console.error('[Auth.register] JSON de erro recebido:', errJson);
      if (errJson.error) errText = errJson.error;
      else if (errJson.message) errText = errJson.message;
    } catch { /* ignora */ }
    throw new Error(errText);
  }

  let result;
  try {
    result = await res.json();
  } catch (jsonErr) {
    console.error('[Auth.register] Erro ao fazer parse do JSON de sucesso:', jsonErr);
    throw new Error('Resposta inválida do servidor.');
  }

  console.log('[Auth.register] Cadastro bem-sucedido. JSON recebido:', result);

  // **REMOVA ou COMENTE** esta linha:
  // window.location.assign('pages/login.html');

  return result;
}

  // --------------------------------------------------
  // FUNÇÃO: logout(role)
  // → Remove token + user do localStorage para a role passada
  // → Redireciona para pages/login.html
  // --------------------------------------------------
  function logout(role = 'user') {
    if (role === 'admin') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    window.location.assign('pages/login.html');
  }

  // --------------------------------------------------
  // FUNÇÕES DE CONSULTA (expor o user e token no front)
  // --------------------------------------------------
  function getCurrentUser(role = 'user') {
    return getUserForRole(role);
  }

  function getToken(role = 'user') {
    return getTokenForRole(role);
  }

  return { login, register, logout, getCurrentUser, getToken };
})();

// Expõe as funções globalmente para as páginas HTML
window.Auth = Auth;
