// ======================================
// assets/js/auth.js
// Fluxo de guarda: 'public' | 'user' | 'admin'
// - public (login): se logado → volta p/ última página ou padrão
// - user (home/agendamentos): exige token (user OU admin). Senão → /pages/login.html
// - admin (painel): exige admin_token. Senão → /pages/login.html
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
    LAST_PATH: "last_path",      // <- usamos para lembrar última página segura
  };

  // ---- Rotas canônicas ----
  const PATH = {
    home: "/index.html",
    login: "/pages/login.html",
    admin: "/pages/admin.html",
  };

  // ---- Helpers de JSON e tempo ----
  const jparse = (s) => { try { return JSON.parse(s); } catch { return null; } };
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
  function getUser() { return jparse(localStorage.getItem(KEYS.USER)); }
  function getToken() { return localStorage.getItem(KEYS.TOKEN) || ""; }
  function getAdminToken() { return localStorage.getItem(KEYS.ADMIN_TOKEN) || ""; }
  function isLogged() { return !!getToken(); }
  function isAdminLogged() { return !!getAdminToken(); }

  // ---- Última página visitada (não salva login) ----
  function remember() {
    const p = (window.location.pathname || "").toLowerCase();
    if (p.endsWith("/pages/login.html") || p.endsWith("/pages/login")) return;
    localStorage.setItem(KEYS.LAST_PATH, JSON.stringify({ path: window.location.pathname, ts: now() }));
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
  async function login(identifier, password) {
    const id = (identifier || "").trim();
    const pw = password || "";
    if (!id || !pw) throw new Error("Preencha usuário e senha.");

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const body = isEmail ? { email: id.toLowerCase(), password: pw } : { username: id, password: pw };

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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.message || `Falha no login (${res.status}).`;
      throw new Error(msg);
    }

    const { user, token } = data || {};
    if (!user || !token) throw new Error("Resposta inesperada do servidor.");

    saveSession({ user, token });

    // Pós-login: respeita última página (se não for admin), senão cai no padrão
    const last = getLastPath();
    if (user.role === "admin") {
      go(PATH.admin);
    } else {
      if (last && !last.endsWith("/pages/admin.html")) go(last);
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
      const msg = result?.error || result?.message || `Erro no cadastro (${res.status}).`;
      throw new Error(msg);
    }
    return result;
  }

  // --------------------------------------------------
  // /me -> valida sessão no backend e re-sincroniza user
  // --------------------------------------------------
  async function me() {
    const token = getToken();
    if (!token) return null;

    const res = await fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (!res || res.status === 401 || res.status === 403) {
      clearSession();
      return null;
    }
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data?.user) return null;

    saveSession({ user: data.user, token });
    return data.user;
  }

  // --------------------------------------------------
  // GUARD principal por tipo de página
  // pageType: 'public' | 'user' | 'admin'
  // --------------------------------------------------
  async function guardPage(pageType) {
    const adminOn = isAdminLogged();
    const userOn = isLogged();

    if (pageType === "public") {
      // Login: se já logado, manda pra última página apropriada
      if (adminOn) {
        const last = getLastPath();
        if (last && last.endsWith("/pages/admin.html")) return go(last);
        return go(PATH.admin);
      }
      if (userOn) {
        const last = getLastPath();
        if (last && !last.endsWith("/pages/admin.html")) return go(last);
        return go(PATH.home);
      }
      return; // seguir no login
    }

    if (pageType === "user") {
      if (userOn || adminOn) return; // ok
      return go(PATH.login);          // não logado -> login
    }

    if (pageType === "admin") {
      if (adminOn) return;            // ok
      return go(PATH.login);          // sem admin_token -> login
    }
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------
  function logout() {
    clearSession();
    go(PATH.login);
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
