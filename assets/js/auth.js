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
  // --------------------------------------------------
  async function login(email, password) {
    let res;
    try {
      res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (fetchErr) {
      throw new Error('Falha ao conectar com o servidor. Verifique sua conexão de rede.');
    }

    if (!res.ok) {
      let errText = 'Credenciais inválidas.';
      try {
        const errJson = await res.json();
        errText = errJson.error || errJson.message || errText;
      } catch {}
      throw new Error(errText);
    }

    const data = await res.json();
    const token = data.token;
    const role  = data.role;

    const userObj = {
      _id:    data._id,
      name:   data.name,
      email:  data.email,
      role:   data.role,
      status: data.status
    };

    saveTokenForRole(role, token);
    saveUserForRole(role, userObj);

    if (role === 'admin') {
      window.location.assign('pages/admin.html');
    } else {
      window.location.assign('index.html');
    }

    return token;
  }


  // --------------------------------------------------
  // FUNÇÃO: register({ name, email, password, matricula })
  // → não redireciona mais automaticamente
  // --------------------------------------------------
  async function register(data) {
    let res;
    try {
      res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (fetchErr) {
      throw new Error('Falha ao conectar com o servidor. Verifique sua conexão de rede.');
    }

    if (!res.ok) {
      let errText = 'Erro no cadastro.';
      try {
        const errJson = await res.json();
        errText = errJson.error || errJson.message || errText;
      } catch {}
      throw new Error(errText);
    }

    const result = await res.json();
    return result;
  }


  // --------------------------------------------------
  // FUNÇÃO: forgotPassword(email)
  // → POST /forgot-password
  // --------------------------------------------------
  async function forgotPassword(email) {
    let res;
    try {
      res = await fetch(`${API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (fetchErr) {
      throw new Error('Não foi possível conectar ao servidor.');
    }

    if (!res.ok) {
      let errText = 'Erro ao solicitar recuperação de senha.';
      try {
        const errJson = await res.json();
        errText = errJson.error || errJson.message || errText;
      } catch {}
      throw new Error(errText);
    }

    return await res.json();
  }


  // --------------------------------------------------
  // FUNÇÃO: logout(role)
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
  // Consulta
  // --------------------------------------------------
  function getCurrentUser(role = 'user') {
    return getUserForRole(role);
  }

  function getToken(role = 'user') {
    return getTokenForRole(role);
  }

  return {
    login,
    register,
    forgotPassword,
    logout,
    getCurrentUser,
    getToken
  };
})();

// expõe globalmente
window.Auth = Auth;
