// assets/js/auth.js
const Auth = (() => {
  // Base da API
  const API = window.location.hostname.includes("localhost")
    ? "http://localhost:10000/api/auth"
    : "https://coordena-backend.onrender.com/api/auth";

  // --------------------------
  // Storage helpers por role
  // --------------------------
  function saveTokenForRole(role, token) {
    if (role === "admin") localStorage.setItem("admin_token", token);
    else localStorage.setItem("token", token);
  }

  function getTokenForRole(role) {
    return role === "admin"
      ? localStorage.getItem("admin_token")
      : localStorage.getItem("token");
  }

  function saveUserForRole(role, userObj) {
    const json = JSON.stringify(userObj);
    if (role === "admin") localStorage.setItem("admin_user", json);
    else localStorage.setItem("user", json);
  }

  function getUserForRole(role) {
    const key = role === "admin" ? "admin_user" : "user";
    const str = localStorage.getItem(key);
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  }

  // --------------------------------------------------
  // LOGIN (por e-mail por padrão; aceita username se quiser)
  // --------------------------------------------------
  async function login(identifier, password) {
    const id = (identifier || "").trim();
    const pw = password || "";
    if (!id || !pw) throw new Error("Preencha usuário e senha.");

    // Decide se é e-mail ou username
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

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Resposta inválida do servidor.");
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `Falha no login (${res.status}).`;
      throw new Error(msg);
    }

    const { user, token } = data || {};
    if (!user || !token) throw new Error("Resposta inesperada do servidor.");

    // Se quiser bloquear pendente no front:
    // if (user.status === "pending") {
    //   throw new Error("Sua conta está pendente de aprovação.");
    // }

    saveTokenForRole(user.role, token);
    saveUserForRole(user.role, user);

    if (user.role === "admin") {
      window.location.assign("/pages/admin.html");
    } else {
      window.location.assign("/index.html");
    }

    return token;
  }

  // --------------------------------------------------
  // REGISTER
  // data: { name, matricula, password, email? }
  // --------------------------------------------------
  async function register(data) {
    const payload = {
      name: (data?.name || "").trim(),
      matricula: (data?.matricula || "").trim(),
      password: data?.password || "",
    };

    if (data?.email) payload.email = data.email.trim().toLowerCase();

    if (!payload.name || !payload.matricula || !payload.password) {
      throw new Error("Preencha nome, matrícula e senha.");
    }
    if (payload.password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

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
      const msg = result?.error || result?.message || `Erro no cadastro (${res.status}).`;
      throw new Error(msg);
    }

    return result; // { ok, message, user }
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------
  function logout(role = "user") {
    if (role === "admin") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    window.location.assign("/pages/login.html");
  }

  // Getters
  function getCurrentUser(role = "user") { return getUserForRole(role); }
  function getToken(role = "user") { return getTokenForRole(role); }

  return { login, register, logout, getCurrentUser, getToken };
})();

// Expor global
window.Auth = Auth;
