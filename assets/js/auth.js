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
  };

  // ---- Utils ----
  const jparse = (s) => { try { return JSON.parse(s); } catch { return null; } };

  function saveSession({ user, token }) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    localStorage.setItem(KEYS.TOKEN, token);

    // Somente se for admin, mantém cópia admin_*
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
  }

  function getUser() { return jparse(localStorage.getItem(KEYS.USER)); }
  function getToken() { return localStorage.getItem(KEYS.TOKEN) || ""; }

  // ---- MIGRAÇÃO/limpeza de resíduos que causam login automático ----
  (function purgeWeirdState() {
    const au = jparse(localStorage.getItem(KEYS.ADMIN_USER));
    const at = localStorage.getItem(KEYS.ADMIN_TOKEN);
    // Se tem admin_* mas não tem token normal, ou role inválida -> limpa
    if ((au && au.role !== "admin") || (at && !localStorage.getItem(KEYS.TOKEN))) {
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
    const body = isEmail ? { email: id.toLowerCase(), password: pw }
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
    try { data = await res.json(); }
    catch { throw new Error("Resposta inválida do servidor."); }

    if (!res.ok) {
      const msg = data?.error || data?.message || `Falha no login (${res.status}).`;
      throw new Error(msg);
    }

    const { user, token } = data || {};
    if (!user || !token) throw new Error("Resposta inesperada do servidor.");

    // Exemplo para bloquear pendente:
    // if (user.status === "pending") throw new Error("Sua conta está pendente de aprovação.");

    saveSession({ user, token });

    // Redireciona só após login bem-sucedido
    if (user.role === "admin") window.location.assign("/pages/admin.html");
    else window.location.assign("/index.html");

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
    try { result = await res.json(); }
    catch { throw new Error("Resposta inválida do servidor."); }

    if (!res.ok) {
      const msg = result?.error || result?.message || `Erro no cadastro (${res.status}).`;
      throw new Error(msg);
    }
    return result; // { ok, message, user }
  }

  // --------------------------------------------------
  // /me -> valida sessão no backend (evita “login automático”)
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

    // Re-sincroniza storage (caso role/claims tenham mudado)
    saveSession({ user: data.user, token });
    return data.user;
  }

  // --------------------------------------------------
  // GUARD de página
  // - requiredRole: 'admin' para páginas de admin; null para apenas exigir login
  // --------------------------------------------------
  async function guardPage(requiredRole = null) {
    const u = getUser();
    const t = getToken();
    if (!u || !t) {
      // sem sessão local -> login
      window.location.assign("/pages/login.html");
      return;
    }
    // Confirma com o backend
    const serverUser = await me();
    if (!serverUser) {
      window.location.assign("/pages/login.html");
      return;
    }
    if (requiredRole && serverUser.role !== requiredRole) {
      // Sem permissão -> manda pra home pública
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

  // Getters (sem role cross)
  function getCurrentUser() { return getUser(); }
  function getCurrentToken() { return getToken(); }

  return { login, register, logout, me, guardPage, getCurrentUser, getCurrentToken };
})();

window.Auth = Auth;
