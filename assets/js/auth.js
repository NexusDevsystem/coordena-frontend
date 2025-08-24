// ======================================
// assets/js/auth.js
// Fluxo de guarda: 'public' | 'user' | 'admin'
// - public (login): se logado → volta p/ última página ou padrão
// - user (home/agendamentos): exige token (user OU admin). Senão → /login.html
// - admin (painel): exige admin_token. Senão → /login.html
// ======================================
const Auth = (() => {
  const API = window.location.hostname.includes("localhost")
    ? "http://localhost:10000/api/auth"
    : "https://coordena-backend.onrender.com/api/auth";

  // ---- Storage keys (mantidos do projeto) ----
  const KEYS = {
    USER: "user",
    TOKEN: "token",
    ADMIN_USER: "admin_user",
    ADMIN_TOKEN: "admin_token",
    LAST_PATH: "last_path", // lembrar última página segura
  };

  // ---- Rotas canônicas ----
  const PATH = {
    home: "/index.html",
    login: "/login.html",
    admin: "/pages/admin.html",
  };

  // ---- Cache leve de sessão (em memória) ----
  let __lastUserCache = null;
  let __lastCheckedMs = 0;

  // ---- JWT helpers: decodifica e checa expiração ----
  function decodeJwtPayload(tk) {
    try {
      const base = tk.split(".")[1];
      if (!base) return null;
      const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  function tokenExpMs(tk) {
    const p = decodeJwtPayload(tk);
    return p && typeof p.exp === "number" ? p.exp * 1000 : null;
  }
  function isTokenExpiringSoon(tk, marginSec = 120) {
    const exp = tokenExpMs(tk);
    if (!exp) return false; // se não tem exp, tratamos como não expira "logo"
    return Date.now() + marginSec * 1000 >= exp;
  }
  function shouldHitMe(lastCheckedMs, minIntervalMs = 60_000) {
    // evita flood em /me: no máximo 1x por minuto (ajuste fino)
    return Date.now() - lastCheckedMs >= minIntervalMs;
  }

  // ---- Helpers de JSON e tempo ----
  const jparse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const now = () => Date.now();

  // ---- Sessão ----
  function saveSession({ user, token }) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    localStorage.setItem(KEYS.TOKEN, token);
    if (user?.role === "admin") {
      localStorage.setItem(KEYS.ADMIN_USER, JSON.stringify(user));
      localStorage.setItem(KEYS.ADMIN_TOKEN, token);
    } else {
      localStorage.removeItem(KEYS.ADMIN_USER);
      localStorage.removeItem(KEYS.ADMIN_TOKEN);
    }
  }
  function clearSession() {
    localStorage.removeItem(KEYS.USER);
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.ADMIN_USER);
    localStorage.removeItem(KEYS.ADMIN_TOKEN);
    // Mantemos LAST_PATH para restaurar pós-login (se quiser resetar, apague aqui)
  }
  function getUser() {
    return jparse(localStorage.getItem(KEYS.USER));
  }
  function getToken() {
    return localStorage.getItem(KEYS.TOKEN) || "";
  }
  function getAdminToken() {
    return localStorage.getItem(KEYS.ADMIN_TOKEN) || "";
  }
  function isLogged() {
    return !!getToken();
  }
  function isAdminLogged() {
    return !!getAdminToken();
  }

  // ---- Última página visitada (não salva login) ----
  function remember() {
    const p = (window.location.pathname || "").toLowerCase();
    if (p.endsWith("/pages/login.html") || p.endsWith("/pages/login")) return;
    localStorage.setItem(
      KEYS.LAST_PATH,
      JSON.stringify({ path: window.location.pathname, ts: now() })
    );
  }
  function getLastPath() {
    const obj = jparse(localStorage.getItem(KEYS.LAST_PATH));
    if (!obj?.path) return null;
    // (opcional) expirar em 7 dias
    if (obj?.ts && now() - obj.ts > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEYS.LAST_PATH);
      return null;
    }
    return obj.path;
  }

  // ---- Navegação segura ----
  function go(to) {
    if (window.location.pathname !== to) window.location.replace(to);
  }

  // --------------------------------------------------
  // LOGIN (email ou username)
  // --------------------------------------------------
  function extractUsername(id) {
    if (!id) return "";
    const at = id.indexOf("@");
    return at > 0 ? id.slice(0, at) : id;
  }

  // --------------------------------------------------
  // LOGIN (email ou username) com fallback inteligente
  // --------------------------------------------------
  async function login(identifier, password) {
    const id = (identifier || "").trim();
    const pw = password || "";
    if (!id || !pw) throw new Error("Preencha usuário e senha.");

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const primaryBody = isEmail
      ? { email: id.toLowerCase(), password: pw }
      : { username: id, password: pw };

    // se vier e-mail, tentaremos também pelo username (antes do @)
    const altBody = isEmail
      ? { username: extractUsername(id), password: pw }
      : null;

    async function doRequest(body) {
      let res;
      try {
        res = await fetch(`${API}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("[Auth.login] Fetch error:", err);
        throw new Error("Falha ao conectar com o servidor.");
      }
      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      return { res, data };
    }

    // 1ª tentativa (como digitado)
    let { res, data } = await doRequest(primaryBody);

    // Se falhou, tenta rota alternativa (ex.: username extraído do e-mail)
    if (!res.ok && altBody && altBody.username) {
      // Re-tenta apenas em casos típicos de bloqueio/usuário não encontrado
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        console.warn("[Auth.login] Tentativa alternativa via username:", altBody.username);
        const retry = await doRequest(altBody);
        if (retry.res.ok) {
          res = retry.res;
          data = retry.data;
        } else {
          // mantém a melhor mensagem de erro
          const msg = retry.data?.error || retry.data?.message ||
                      data?.error || data?.message ||
                      `Falha no login (${retry.res.status}).`;
          throw new Error(msg);
        }
      } else {
        const msg = data?.error || data?.message || `Falha no login (${res.status}).`;
        throw new Error(msg);
      }
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `Falha no login (${res.status}).`;
      throw new Error(msg);
    }

    const { user, token } = data || {};
    if (!user || !token) throw new Error("Resposta inesperada do servidor.");

    saveSession({ user, token });

    // Pós-login: respeita última página (se não for admin), senão cai no padrão
    const last = getLastPath && getLastPath();
    if (user.role === "admin") {
      go(PATH.admin);
    } else {
      if (last && !String(last).endsWith("/pages/admin.html")) go(last);
      else go(PATH.home);
    }

    return token;
  }

  // --------------------------------------------------
  // REGISTER
  // --------------------------------------------------
  async function register(data) {
    const payload = {
      name: (data?.name || "").trim(),
      matricula: (data?.matricula || "").trim(),
      password: data?.password || "",
    };
    if (data?.email) payload.email = data.email.trim().toLowerCase();

    if (!payload.name || !payload.matricula || !payload.password)
      throw new Error("Preencha nome, matrícula e senha.");
    if (payload.password.length < 6)
      throw new Error("A senha deve ter pelo menos 6 caracteres.");

    let res;
    try {
      res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[Auth.register] Fetch error:", err);
      throw new Error("Falha ao conectar com o servidor.");
    }

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        result?.error || result?.message || `Erro no cadastro (${res.status}).`;
      throw new Error(msg);
    }
    return result;
  }

  // --------------------------------------------------
  // /me -> valida sessão no backend (com cache e debounce)
  // --------------------------------------------------
  async function me() {
    const token = getToken();
    if (!token) {
      __lastUserCache = null;
      return null;
    }

    // 1) Se temos cache recente e token não está perto de expirar, usa cache
    if (
      __lastUserCache &&
      !isTokenExpiringSoon(token) &&
      !shouldHitMe(__lastCheckedMs, 60_000)
    ) {
      return __lastUserCache;
    }

    // 2) Se token não está perto de expirar e já passamos no /me há pouco tempo,
    //    devolve o user salvo localmente (evita chamadas desnecessárias)
    if (!isTokenExpiringSoon(token) && !shouldHitMe(__lastCheckedMs, 60_000)) {
      const u = getUser();
      if (u) {
        __lastUserCache = u;
        return u;
      }
    }

    // 3) Chama /me apenas quando necessário
    const res = await fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    __lastCheckedMs = Date.now();

    if (!res || res.status === 401 || res.status === 403) {
      clearSession();
      __lastUserCache = null;
      return null;
    }
    if (!res.ok) {
      // falha temporária: mantém o usuário local se existir
      const u = getUser();
      __lastUserCache = u;
      return u || null;
    }

    const data = await res.json().catch(() => null);
    if (!data?.user) return null;

    saveSession({ user: data.user, token });
    __lastUserCache = data.user;
    return data.user;
  }

  // --------------------------------------------------
  // GUARD principal por tipo de página (estável)
  // pageType: 'public' | 'user' | 'admin'
  // --------------------------------------------------
  async function guardPage(pageType) {
    const adminOn = isAdminLogged();
    const userOn = isLogged();

    // Páginas públicas (login): não precisa consultar backend.
    if (pageType === "public") {
      if (adminOn) {
        const last = getLastPath && getLastPath();
        if (last && last.endsWith("/pages/admin.html")) return go(PATH.admin);
        return go(PATH.admin);
      }
      if (userOn) {
        const last = getLastPath && getLastPath();
        if (last && !last.endsWith("/pages/admin.html")) return go(last);
        return go(PATH.home);
      }
      return; // segue no login
    }

    // Páginas de usuário: basta ter token (user OU admin).
    if (pageType === "user") {
      if (!userOn && !adminOn) return go(PATH.login);
      const u = await me();           // valida levemente (com cache/debounce)
      if (!u) return go(PATH.login);  // token inválido/expirado
      return;                         // ok
    }

    // Páginas de admin: exige admin_token + confirma role quando necessário.
    if (pageType === "admin") {
      if (!adminOn) return go(PATH.login);
      const u = await me();
      if (!u) return go(PATH.login);
      if (u.role !== "admin") return go(PATH.home);
      return; // ok
    }
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------
  function logout() {
    clearSession();
    // redirect ABSOLUTO, sem depender de base path nem página atual
    window.location.href = `${window.location.origin}/login.html`;
  }

  // Expostos
  return {
    login,
    register,
    logout,
    me,
    guardPage,
    remember,
    isLogged,
    isAdminLogged,
    getToken,
    getAdminToken,
  };
})();

window.Auth = Auth;
