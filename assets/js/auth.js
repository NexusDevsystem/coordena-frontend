// assets/js/auth.js
const Auth = (() => {
  // Define a URL base para a API, dependendo se estamos em localhost ou em produção
  const API = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/auth'
    : 'https://coordena-backend.onrender.com/api/auth';

  /** Grava o token no localStorage */
  function saveToken(token) {
    localStorage.setItem('token', token);
  }

  /** Retorna o token salvo ou null */
  function getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Faz login enviando e-mail/senha para POST /api/auth/login.
   * Se der certo, salva token e user no localStorage, redireciona para index.html.
   * Em caso de erro, lança Error com a mensagem retornada pelo back-end.
   */
  async function login(email, password) {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    // Se não retornou 200-OK, captura a mensagem de erro
    if (!res.ok) {
      let errText = 'Credenciais inválidas.';
      try {
        const errJson = await res.json();
        // Se for “aguardando aprovação”
        if (res.status === 403 && errJson.error) {
          errText = errJson.error;
        }
        // Caso padrão (401 ou outro), usa errJson.error
        else if (errJson.error) {
          errText = errJson.error;
        }
      } catch {
        // se não conseguir ler JSON, mantém errText genérico
      }
      throw new Error(errText);
    }

    // Se OK, deve vir um JSON { token, user: {...} }
    const data = await res.json();
    saveToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Redireciona para a home
    window.location.assign('/index.html');
    return data.token;
  }

  /**
   * Faz registro enviando {name, email, password} para POST /api/auth/register.
   * O back-end agora retorna apenas { message: 'Cadastro recebido! Aguarde...' }.
   * Então, mostramos um alert e redirecionamos para login.html (sem salvar token).
   */
  async function register(regData) {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData)
    });

    if (!res.ok) {
      let errText = 'Erro no cadastro.';
      try {
        const errJson = await res.json();
        if (errJson.error) errText = errJson.error;
      } catch {
        // sem corpo JSON, mantemos errText
      }
      throw new Error(errText);
    }

    // Se foi 201 Created, o body contém { message: 'Cadastro recebido! Aguarde aprovação...' }
    const result = await res.json();
    alert(result.message || 'Cadastro bem‐sucedido! Aguarde aprovação.');
    // Redireciona para a tela de login
    window.location.assign('/login.html');
    return;
  }

  /** Limpa token + usuário e retorna para a página de login */
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('/login.html');
  }

  /**
   * Retorna o usuário atual (objeto salvo no localStorage) ou null se não existir
   */
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

// Expõe no escopo global para ser usado em login.html, register.html etc.
window.Auth = Auth;
