// ======================================
// assets/js/auth.js (HARDENED)
// ======================================
const Auth = (() => {
  const API = window.location.hostname.includes("localhost")
    ? "http://localhost:10000/api/auth"
    : "https://coordena-backend.onrender.com/api/auth";

  // ---- Storage keys (sem fallback cruzado) ----
  const KEYS = {
    USER: "user",
    TOKEN: "token",
    ADMIN_USER: "admin_user",
    ADMIN_TOKEN: "admin_token",
    LAST_ROUTE: "last_route", // <- NOVO
  };

  // ---- Utils ----
  const jparse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const now = () => Date.now();

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
    localStorage.removeItem(KEYS.LAST_ROUTE); // <- limpa também
  }

  function getUser() {
    return jparse(localStorage.getItem(KEYS.USER));
  }
  function getToken() {
    return localStorage.getItem(KEYS.TOKEN) || "";
  }

  // ---- Última rota visitada (persistente) ----
  function setLastRoute(path, role) {
    if (!path) return;
    const data = { path, role: role || getUser()?.role || null, ts: now() };
    localStorage.setItem(KEYS.LAST_ROUTE, JSON.stringify(data));
  }
  function getLastRoute() {
    const obj = jparse(localStorage.getItem(KEYS.LAST_ROUTE));
    // (opcional) expirar depois de 7 dias
    if (obj?.ts && now() - obj.ts > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEYS.LAST_ROUTE);
      return null;
    }
    return obj;
  }

  // ---- MIGRAÇÃO/limpeza de resíduos que causam login automático ----
  (function purgeWeirdState() {
    const au = jparse(localStorage.getItem(KEYS.ADMIN_USER));
    const at = localStorage.getItem(KEYS.ADMIN_TOKEN);
    if (
      (au && au.role !== "admin") ||
      (at && !localStorage.getItem(KEYS.TOKEN))
    ) {
      localStorage.removeItem(KEYS.ADMIN_USER);
      localStorage.removeItem(KEYS.ADMIN_TOKEN);
    }
  })();

  // --------------------------------------------------
  // LOGIN (email ou username)
  // --------------------------------------------------
  async function login(identifier, password) {
    const id = (identifier || "").trim();
    const pw = password || "";
    if (!id || !pw) throw new Error("Preencha usuário e senha.");

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const body = isEmail
      ? { email: id.toLowerCase(), password: pw }
      : { username: id, password: pw };

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
      throw new Error("Resposta inválida do servidor.");
    }

    if (!res.ok) {
      const msg =
        data?.error || data?.message || `Falha no login (${res.status}).`;
      throw new Error(msg);
    }

    const { user, token } = data || {};
    if (!user || !token) throw new Error("Resposta inesperada do servidor.");

    saveSession({ user, token });

    // marca última rota no momento do login
    if (user.role === "admin") {
      setLastRoute("/pages/admin.html", "admin");
      window.location.assign("/pages/admin.html");
    } else {
      setLastRoute("/index.html", user.role);
      window.location.assign("/index.html");
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

    let result;
    try {
      result = await res.json();
    } catch {
      throw new Error("Resposta inválida do servidor.");
    }

    if (!res.ok) {
      const msg =
        result?.error || result?.message || `Erro no cadastro (${res.status}).`;
      throw new Error(msg);
    }
    return result;
  }

  // --------------------------------------------------
  // /me -> valida sessão no backend
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
  // GUARD de página
  // --------------------------------------------------
  async function guardPage(requiredRole = null) {
    const u = getUser();
    const t = getToken();
    if (!u || !t) {
      window.location.assign("/pages/login.html");
      return;
    }
    const serverUser = await me();
    if (!serverUser) {
      window.location.assign("/pages/login.html");
      return;
    }
    // atualiza última rota validada
    setLastRoute(location.pathname || "/index.html", serverUser.role);

    if (requiredRole && serverUser.role !== requiredRole) {
      window.location.assign("/index.html");
      return;
    }
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------
  function logout() {
    clearSession();
    window.location.assign("/pages/login.html");
  }

  // --------------------------------------------------
  // Redireciona admin logado que cair na Home
  // -> SOMENTE se houver token e o /me confirmar admin
  // --------------------------------------------------
  async function redirectIfAdminOnHome() {
    const pathname = (location.pathname || "/").toLowerCase();
    const isHomePath = pathname === "/" || pathname.endsWith("/index.html");
    if (!isHomePath) return;

    const token = getToken();
    if (!token) {
      // sem sessão -> home pública
      localStorage.removeItem(KEYS.LAST_ROUTE);
      return;
    }

    try {
      // valida com o backend; me() re-sincroniza ou limpa storage se inválido
      const u = await me();
      if (u?.role === "admin") {
        setLastRoute("/pages/admin.html", "admin");
        location.replace("/pages/admin.html");
        return;
      }
    } catch (e) {
      console.error("[redirectIfAdminOnHome] /me falhou:", e);
    }

    // não é admin ou token inválido -> permanece na home
    localStorage.removeItem(KEYS.LAST_ROUTE);
  }

  // Getters
  function getCurrentUser() {
    return getUser();
  }
  function getCurrentToken() {
    return getToken();
  }

  return {
    login,
    register,
    logout,
    me,
    guardPage,
    getCurrentUser,
    getCurrentToken,
    redirectIfAdminOnHome, // exportado
    setLastRoute, // exporta p/ uso explícito no admin se quiser
    getLastRoute,
  };
})();

window.Auth = Auth;
