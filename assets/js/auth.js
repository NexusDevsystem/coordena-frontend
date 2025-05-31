// assets/js/auth.js

const Auth = (() => {
  // Verifica se estamos em localhost ou produção
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
    // 1) Logamos a URL final que será chamada
    console.log('[Auth.login] API endpoint:', `${API}/login`);

    // 2) Logamos o payload (apenas para debug; não deixe exposto em produção)
    console.log('[Auth.login] Payload →', { email, password });

    let res;
    try {
      res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (fetchErr) {
      // erro de rede / CORS / DNS
      console.error('[Auth.login] Erro no fetch:', fetchErr);
      throw new Error('Falha ao conectar com o servidor. Verifique a rede.');
    }

    // 3) Logamos o status HTTP que veio do servidor
    console.log('[Auth.login] Status HTTP da resposta:', res.status);

    if (!res.ok) {
      // 4) Caso não seja OK, tentamos extrair o JSON de erro (se houver) e mostrar
      let errText = 'Credenciais inválidas.';
      try {
        const errJson = await res.json();
        console.log('[Auth.login] JSON de erro recebido:', errJson);

        if (res.status === 403 && errJson.error) {
          errText = errJson.error; // ex: “aguardando aprovação”, ou outro texto vindo do backend
        } else if (errJson.error) {
          errText = errJson.error;
        }
      } catch (jsonErr) {
        console.warn('[Auth.login] Não foi possível ler JSON de erro:', jsonErr);
        // mantém errText genérico
      }
      throw new Error(errText);
    }

    // 5) Se chegou aqui, foi 200 OK. Vamos extrair o JSON de sucesso
    let data;
    try {
      data = await res.json();
    } catch (jsonParseErr) {
      console.error('[Auth.login] Erro ao fazer parse do JSON de sucesso:', jsonParseErr);
      throw new Error('Resposta inválida do servidor.');
    }

    console.log('[Auth.login] Login bem-sucedido. Dados recebidos:', data);

    // 6) Armazena token e user no localStorage
    saveToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // 7) Redireciona conforme o role que veio em data.user.role
    if (data.user.role === 'admin') {
      // Caso 1: É administrador → usa CAMINHO RELATIVO para o admin.html
      // Ajuste aqui conforme a estrutura do seu servidor:
      // Se o admin.html estiver em /frontend/pages/admin.html,
      // e se 'frontend' for diretamente acessível, use 'frontend/pages/admin.html'.
      // Se o 'frontend' já for a raiz pública, basta 'pages/admin.html'.

      window.location.assign('pages/admin.html');
    } else {
      // Caso 2: Qualquer outro papel → redireciona para a home (index.html)
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

// Expõe as funções no escopo global para serem chamadas do HTML
window.login = Auth.login;
window.register = Auth.register;
window.logout = Auth.logout;
window.getCurrentUser = Auth.getCurrentUser;
window.getToken = Auth.getToken;
window.Auth = Auth;
