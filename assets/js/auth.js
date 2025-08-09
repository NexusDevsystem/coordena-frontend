// assets/js/auth.js

const Auth = (() => {
  // Usa localhost em dev ou backend em produção
  const API = window.location.hostname.includes("localhost")
    ? "http://localhost:10000/api/auth"
    : "https://coordena-backend.onrender.com/api/auth";

  // --------------------------
  // Helpers de storage por role
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
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  // --------------------------------------------------
  // LOGIN: apenas por e-mail institucional
  // Backend já ajusta role=admin quando email for admin@admin.estacio.br
  // --------------------------------------------------
  async function login(email, password) {
    const id = (email || "").trim().toLowerCase();
    const pw = password || "";
    if (!id || !pw) throw new Error("Preencha e-mail e senha.");

    // validação simples de e-mail (o HTML pode ter validações adicionais)
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    if (!okEmail) throw new Error("Digite um e-mail válido.");

    let res;
    try {
      res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: id, password: pw }),
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
      const msg = data?.error || data?.message || "Credenciais inválidas.";
      throw new Error(msg);
    }

    const { user, token } = data || {};
    if (!user || !token) throw new Error("Resposta inesperada do servidor.");

    // Salva por role e redireciona
    saveTokenForRole(user.role, token);
    saveUserForRole(user.role, user);

    if (user.role === "admin") {
      window.location.assign("/pages/admin.html"); // absoluto
    } else {
      window.location.assign("/index.html"); // absoluto
    }

    return token;
  }

  // --------------------------------------------------
  // REGISTER
  // --------------------------------------------------
  async function register(data) {
    let res;
    try {
      res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      const msg = result?.error || result?.message || "Erro no cadastro.";
      throw new Error(msg);
    }

    return result;
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

  // --------------------------------------------------
  // GETTERS
  // --------------------------------------------------
  function getCurrentUser(role = "user") {
    return getUserForRole(role);
  }

  function getToken(role = "user") {
    return getTokenForRole(role);
  }

  return { login, register, logout, getCurrentUser, getToken };
})();

// Expor global
window.Auth = Auth;
