// ======================================
// assets/js/main.js
// ======================================

// ----------------------
// UTILIDADES
// ----------------------
function onReady(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

// --------------------------------------------------
// CORES POR TURNO
// --------------------------------------------------
const turnoColors = {
  Matutino: "rgba(59,130,246,0.8)",
  Vespertino: "rgba(234,179,8,0.8)",
  Noturno: "rgba(220,38,38,0.8)",
};

// --------------------------------------------------
// NOTIFICAÇÕES NATIVAS
// --------------------------------------------------
let notificacoesAtivas = false;

function solicitarPermissaoNotificacao() {
  if (!("Notification" in window)) return console.warn("Sem API de Notificações.");
  if (Notification.permission === "granted") {
    notificacoesAtivas = true;
    return;
  }
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => (notificacoesAtivas = p === "granted"));
  }
}

function enviarNotificacao(titulo, texto) {
  if (notificacoesAtivas && Notification.permission === "granted") {
    new Notification(titulo, {
      body: texto,
      icon: "/assets/img/logo-notification.png",
    });
  }
}

// --------------------------------------------------
// THEME (Dark/Light)
// --------------------------------------------------
const ThemeToggle = (() => {
  const themeKey = "theme";
  const root = document.documentElement;
  function applyTheme(mode) {
    root.classList.toggle("dark", mode === "dark");
    localStorage.setItem(themeKey, mode);
  }
  function init() {
    applyTheme(localStorage.getItem(themeKey) || "light");
    const btn = document.getElementById("theme-toggle");
    btn?.addEventListener("click", () => applyTheme(root.classList.contains("dark") ? "light" : "dark"));
  }
  return { init };
})();

// --------------------------------------------------
// API (reservas e horários fixos) - token de usuário comum ou admin
// --------------------------------------------------
const Api = (() => {
  const BASE = window.location.hostname.includes("localhost")
    ? "http://localhost:10000/api/reservations"
    : "https://coordena-backend.onrender.com/api/reservations";
  const FIXED = BASE.replace("/reservations", "/fixedSchedules");

  function authHeaders(isJson = false) {
    // token de usuário ou admin
    const userToken  = (typeof Auth !== "undefined" && Auth.getToken) ? Auth.getToken() : null;
    const adminToken = (typeof Auth !== "undefined" && Auth.getAdminToken) ? Auth.getAdminToken() : "";
    const token = userToken || adminToken;

    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (isJson) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function fetchJson(url, opt = {}) {
    const res = await fetch(url, opt);
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
    return res.json();
  }

  return {
    fetchEvents: () => fetchJson(BASE, { headers: authHeaders() }),
    fetchFixedSchedules: () => fetchJson(FIXED, { headers: authHeaders() }),
    createEvent: (data) => fetchJson(BASE, { method: "POST", headers: authHeaders(true), body: JSON.stringify(data) }),
    updateEvent: (id, data) => fetchJson(`${BASE}/${id}`, { method: "PUT", headers: authHeaders(true), body: JSON.stringify(data) }),
    deleteEvent: (id) => fetchJson(`${BASE}/${id}`, { method: "DELETE", headers: authHeaders() }),
  };
})();

// --------------------------------------------------
// CALENDÁRIO (FullCalendar) + FIXED
// --------------------------------------------------
const CalendarModule = (() => {
  let calendar;
  let events = [];
  let fixedSlots = [];

  async function loadFixedSchedules() {
    try {
      const fixed = await Api.fetchFixedSchedules();
      fixedSlots = fixed;
      const fixedEvents = fixed.map((s) => ({
        title: `${s.lab} (${s.turno})`,
        daysOfWeek: [s.dayOfWeek],
        startTime: s.startTime,
        endTime: s.endTime,
        display: "background",
        color: "#66666680",
      }));
      calendar.addEventSource(fixedEvents);
    } catch (e) {
      console.error("Horários fixos:", e);
    }
  }

  async function reloadEvents() {
    try {
      const approved = await Api.fetchEvents();
      calendar.getEvents().forEach((fc) => { if (fc.rendering !== "background") fc.remove(); });
      events = approved;
      approved.forEach((ev) => {
        calendar.addEvent({
          id: ev._id,
          title: `${ev.title} (${ev.time})`,
          start: `${ev.date}T${ev.start}`,
          end: `${ev.date}T${ev.end}`,
        });
      });
    } catch (e) {
      console.error("Recarregar eventos:", e);
    }
  }

  function init(rawEvents, onDateClick, onEventClick) {
    events = rawEvents;
    const el = document.getElementById("calendar");
    if (!el) return console.error("#calendar não encontrado");

    calendar = new FullCalendar.Calendar(el, {
      locale: "pt-br",
      initialView: "dayGridMonth",
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" },
      events: events.map((e) => ({ id: e._id, title: `${e.title} (${e.time})`, start: `${e.date}T${e.start}`, end: `${e.date}T${e.end}` })),
      dateClick: onDateClick,
      eventClick: onEventClick,
      height: el.clientHeight,
      allDaySlot: false,
      selectable: true,
      selectAllow: (sel) =>
        !calendar.getEvents().some((ev) => ev.rendering === "background" && ev.start < sel.end && ev.end > sel.start),
    });

    calendar.render();
    loadFixedSchedules();

    setInterval(() => {
      reloadEvents();
      if (typeof buildOccupancyTable === "function") {
        buildOccupancyTable(document.getElementById("occupancy-date")?.value);
      }
    }, 30_000);

    window.addEventListener("resize", () => {
      calendar.changeView("dayGridMonth");
      calendar.setOption("headerToolbar", { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" });
    });
  }

  return {
    init,
    add(ev) {
      events.push(ev);
      calendar.addEvent({ id: ev._id, title: `${ev.title} (${ev.time})`, start: `${ev.date}T${ev.start}`, end: `${ev.date}T${ev.end}` });
    },
    update(id, ev) {
      const i = events.findIndex((x) => x._id === id);
      if (i !== -1) events[i] = ev;
      const fc = calendar.getEventById(id);
      if (fc) {
        fc.setProp("title", `${ev.title} (${ev.time})`);
        fc.setStart(`${ev.date}T${ev.start}`);
        fc.setEnd(`${ev.date}T${ev.end}`);
      }
    },
    remove(id) {
      events = events.filter((x) => x._id !== id);
      calendar.getEventById(id)?.remove();
    },
    getEvents() { return events; },
  };
})();

// --------------------------------------------------
// FORMULÁRIO DE RESERVA
// --------------------------------------------------
const FormModule = (() => {
  let currentId = null;
  const selectors = {};
  function $id(id) { return document.getElementById(id); }

  function cacheSelectors() {
    selectors.modal = $id("form-modal");
    selectors.form = $id("agendamento-form");
    selectors.btnOpen = $id("open-form-modal");
    selectors.btnClose = $id("form-close");
    selectors.fields = {
      data: $id("data"),
      start: $id("start"),
      end: $id("end"),
      recurso: $id("recurso"),
      salaContainer: $id("sala-container"),
      sala: $id("sala"),
      type: $id("tipo-evento"),
      resp: $id("responsavel"),
      dept: $id("departamento"),
      materia: $id("curso"),
      status: $id("status"),
      desc: $id("descricao"),
    };
  }

  function open(id = null, evData = null) {
    currentId = id;
    selectors.form.reset();
    selectors.fields.salaContainer.classList.add("hidden");
    selectors.fields.dept.value = "";
    selectors.fields.materia.innerHTML = '<option value="">Selecione o curso primeiro</option>';
    selectors.fields.materia.disabled = true;
    selectors.fields.resp.removeAttribute("readonly");

    const user = (typeof Auth !== "undefined" && Auth.getUser) ? Auth.getUser() : null;
    
    if (user?.name) {
      selectors.fields.resp.value = user.name;
      selectors.fields.resp.setAttribute("readonly", "readonly");
    } else {
      selectors.fields.resp.value = "";
    }

    if (evData) {
      const f = selectors.fields;
      f.data.value = evData.date;
      f.start.value = evData.start;
      f.end.value = evData.end;
      f.recurso.value = evData.resource;
      f.recurso.dispatchEvent(new Event("change"));
      f.sala.value = evData.sala || "";
      f.type.value = evData.type;
      if (evData.responsible) { f.resp.value = evData.responsible; f.resp.setAttribute("readonly", "readonly"); }
      f.dept.value = evData.department;
      f.status.value = evData.status;
      f.desc.value = evData.description;
      if (evData.materia) {
        f.materia.innerHTML = `<option value="${evData.materia}">${evData.materia}</option>`;
        f.materia.disabled = false;
      }
    }
    selectors.modal.classList.remove("hidden");
  }

  function close() { selectors.modal.classList.add("hidden"); currentId = null; selectors.form.reset(); }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const user = (typeof Auth !== "undefined" && Auth.getUser) ? Auth.getUser() : null;
    const userId = user?._id || user?.id; // Aceita tanto _id (do MongoDB) quanto id (do backend)

    if (!userId) {
        alert("Erro: Usuário não autenticado. Faça o login novamente.");
        return;
    }

    const f = selectors.fields;
    const payload = {
      date: f.data.value,
      start: f.start.value,
      end: f.end.value,
      resource: f.recurso.value,
      sala: f.salaContainer.classList.contains("hidden") ? "" : f.sala.value,
      type: f.type.value,
      responsible: f.resp.value,
      department: f.dept.value,
      materia: f.materia.value,
      status: "pending",
      description: f.desc.value,
      time: `${f.start.value}-${f.end.value}`,
      title: f.salaContainer.classList.contains("hidden") ? f.type.value : `${f.type.value} - ${f.sala.value}`,
    };
    try {
      if (currentId) {
        const updated = await Api.updateEvent(currentId, payload);
        CalendarModule.update(currentId, updated);
      } else {
        await Api.createEvent(payload);
        alert("✅ Reserva criada! Aguardando aprovação do administrador.");
      }
      const dateValue = f.data.value;
      safeBuildOccupancyTable(dateValue);
      close();
    } catch (err) {
      alert("Erro ao criar/atualizar reserva: " + err.message);
    }
  }

  function init() {
    if (!document.getElementById("agendamento-form")) return;
    cacheSelectors();

    const user = (typeof Auth !== "undefined" && Auth.getUser) ? Auth.getUser() : null;
    if (user?.name) { selectors.fields.resp.value = user.name; selectors.fields.resp.setAttribute("readonly", "readonly"); }

    selectors.fields.start.addEventListener("change", () => {
      const [hh, mm] = selectors.fields.start.value.split(":").map(Number);
      const d = new Date(); d.setHours(hh, mm + 50);
      selectors.fields.end.value = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    });

    selectors.btnOpen?.addEventListener("click", () => open());
    selectors.btnClose?.addEventListener("click", close);
    selectors.form?.addEventListener("submit", handleSubmit);

    const salaOpts = {
      Laboratório: ["Lab B401","Lab B402","Lab B403","Lab B404","Lab B405","Lab B406","Lab Imaginologia"],
    };
    selectors.fields.recurso?.addEventListener("change", () => {
      const tipo = selectors.fields.recurso.value;
      if (salaOpts[tipo]) {
        selectors.fields.salaContainer.classList.remove("hidden");
        selectors.fields.sala.innerHTML = '<option value="">Selecione...</option>' + salaOpts[tipo].map((s) => `<option>${s}</option>`).join("");
      } else selectors.fields.salaContainer.classList.add("hidden");
    });

    const courseMap = {
      "Engenharia de Computação": [
        "ARA0003 - PRINCÍPIOS DE GESTÃO",
        "ARA0017 - INTRODUCAO A PROGRAMAÇÃO DE COMPUTADORES",
        "ARA0039 - ARQUITETURA DE COMPUTADORES",
        "ARA0045 - ENGENHARIA, SOCIEDADE E SUSTENTABILIDADE",
        "ARA0015 - CÁLCULO DIFERENCIAL E INTEGRAL",
        "ARA0020 - GEOMETRIA ANALÍTICA E ÁLGEBRA LINEAR",
        "ARA0038 - REPRESENTAÇÃO GRÁFICA PARA PROJETO",
        "ARA0048 - FÍSICA TEÓRICA EXPERIMENTAL - MECÂNICA",
        "ARA1386 - SISTEMAS OPERACIONAIS",
        "ARA0002 - PENSAMENTO COMPUTACIONAL",
        "ARA0014 - ANÁLISE DE DADOS",
        "ARA0018 - CÁLCULO DE MÚLTIPLAS VARIÁVEIS",
        "ARA0044 - ELETRICIDADE E MAGNETISMO",
        "ARA0047 - FÍSICA TEÓRICA EXPER. - FLUIDOS, CALOR, OSCILAÇÕES",
        "ARA1398 - MECÂNICA DOS SÓLIDOS",
        "ARA0029 - ELETRICIDADE APLICADA",
        "ARA0030 - EQUAÇÕES DIFERENCIAIS",
        "ARA0046 - FENÔMENOS DE TRANSPORTE",
        "ARA0056 - QUÍMICA TECNOLÓGICA",
        "ARA2042 - SISTEMAS DIGITAIS",
        "ARA0079 - COMUNICAÇÕES DE DADOS E REDES DE COMPUTADORES",
        "ARA0083 - ELETRÔNICA ANALÓGICA",
        "ARA0125 - CONTROLADORES LÓGICOS PROGRAMÁVEIS",
        "ARA1943 - MODELAGEM MATEMÁTICA",
        "ARA0040 - BANCO DE DADOS",
        "ARA0098 - ESTRUTURA DE DADOS",
        "COMPILADORES",
        "ARA2545 - SISTEMAS DISTRIBUÍDOS E COMPUTAÇÃO PARALELA",
        "ARA0095 - DESENVOLVIMENTO RÁPIDO DE APLICAÇÕES EM PYTHON",
        "ARA0141 - INSTRUMENTAÇÃO INDUSTRIAL",
        "ARA0363 - PROGRAMAÇÃO DE SOFTWARE BÁSICO EM C",
        "ARA2086 - ALGORITMOS EM GRAFOS",
        "ARA0301 - PROGRAMAÇÃO DE MICROCONTROLADORES",
        "ARA0309 - LINGUAGENS FORMAIS E AUTÔMATOS",
        "ARA1879 - AUTOMAÇÃO INDUSTRIAL",
        "ARA0085 - INTELIGÊNCIA ARTIFICIAL",
        "ARA0115 - SISTEMAS EMBARCADOS",
        "ARA1191 - SUP. DE ESTÁGIO E PRÉ-PROJETO EM ENG. DE COM.",
        "ARA1518 - ALGORITMOS DE PROCESSAMENTO DE IMAGEM",
        "ARA0026 - TÓPICOS EM LIBRAS: SURDEZ E INCLUSÃO",
        "ARA0154 - PROCESSOS INDUSTRIAIS E ROBÓTICA",
        "ARA0869 - INOVAÇÃO, EMPREENDE. E PROJETO FINAL - ENG DE COMP",
        "ARA2074 - SEGURANÇA CIBERNÉTICA",
      ],
    };

    selectors.fields.dept?.addEventListener("change", () => {
      const lista = courseMap[selectors.fields.dept.value] || [];
      const sel = selectors.fields.materia;
      if (lista.length) {
        sel.innerHTML = '<option value="">Selecione a matéria...</option>' + lista.map((m) => `<option value="${m}">${m}</option>`).join("");
        sel.disabled = false;
      } else {
        sel.innerHTML = '<option value="">Selecione o curso primeiro</option>';
        sel.disabled = true;
      }
    });
  }

  return { init, open };
})();

// --------------------------------------------------
// MODAL DE DETALHES
// --------------------------------------------------
const DetailModule = (() => {
  let currentId = null;
  const selectors = {};

  function cacheSelectors() {
    selectors.modal = document.getElementById("event-modal");
    selectors.btnClose = document.getElementById("modal-close");
    selectors.btnEdit = document.getElementById("modal-edit");
    selectors.btnDelete = document.getElementById("modal-cancel");
    selectors.fields = {
      date: document.getElementById("modal-date"),
      resource: document.getElementById("modal-resource"),
      type: document.getElementById("modal-type"),
      resp: document.getElementById("modal-resp"),
      dept: document.getElementById("modal-dept"),
      materia: document.getElementById("modal-materia"),
      status: document.getElementById("modal-status"),
      desc: document.getElementById("modal-desc"),
    };
  }

  function open(ev) {
    currentId = ev._id;
    const f = selectors.fields;
    f.date.textContent = `Data: ${ev.date} (${ev.time})`;
    f.resource.textContent = `Recurso: ${ev.resource}`;
    f.type.textContent = `Evento: ${ev.type}`;
    f.resp.textContent = `Responsável: ${ev.responsible}`;
    f.dept.textContent = `Curso: ${ev.department}`;
    f.materia.textContent = `Matéria: ${ev.materia || "—"}`;
    f.status.textContent = `Status: ${ev.status}`;
    f.desc.textContent = ev.description || "Sem descrição";

    const currentUser = (typeof Auth !== "undefined" && Auth.getUser) ? Auth.getUser() : null;
    const isOwner = currentUser && ev.responsible === currentUser.name;
    selectors.btnDelete.style.display = isOwner ? "inline-block" : "none";
    selectors.btnEdit.style.display = isOwner ? "inline-block" : "none";

    selectors.modal.classList.remove("hidden");
  }

  function close() { selectors.modal.classList.add("hidden"); }

  function init() {
    cacheSelectors();
    selectors.btnClose?.addEventListener("click", close);
    selectors.btnEdit?.addEventListener("click", () => {
      if (!currentId) return;
      const ev = CalendarModule.getEvents().find((e) => e._id === currentId);
      if (ev) FormModule.open(currentId, ev);
      close();
    });
    selectors.btnDelete?.addEventListener("click", async () => {
      if (!currentId) return;
      if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return;
      try {
        await Api.deleteEvent(currentId);
        CalendarModule.remove(currentId);
        const dateValue = document.getElementById("occupancy-date")?.value;
        safeBuildOccupancyTable(dateValue);
        close();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  return { init, open };
})();

// ────────────────────────────────────
// TABELA DE OCUPAÇÃO
// ────────────────────────────────────
let fixedSlots = [];
function padHM(d) { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function toDate(Y, M, D, hm) { const [h, m] = hm.split(":").map(Number); return new Date(Y, M - 1, D, h, m); }

async function safeBuildOccupancyTable(filterDate) {
  try { await buildOccupancyTable(filterDate); } catch (e) { console.error("Tabela:", e); }
}

async function buildOccupancyTable(filterDate) {
  const table = document.getElementById("occupancy-table");
  if (!table) return console.error("#occupancy-table não encontrado");
  table.innerHTML = "";

  const isDark = document.documentElement.classList.contains("dark");
  const textClass = isDark ? "text-white" : "text-gray-900";

  const allEvents = CalendarModule.getEvents();
  const dateStr = filterDate || new Date().toISOString().slice(0, 10);
  const [Y, M, D] = dateStr.split("-").map(Number);
  const weekday = new Date(Y, M - 1, D).getDay();
  const dayEvents = allEvents.filter((e) => e.date === dateStr);
  const fixedTodaySlots = fixedSlots.filter((s) => s.dayOfWeek === weekday);

  // grade 50 min 08:00–22:00
  const slotStart = toDate(Y, M, D, "08:00"), slotEnd = toDate(Y, M, D, "22:00");
  const timeRanges = [];
  let cur = new Date(slotStart);
  while (cur < slotEnd) {
    const next = new Date(cur); next.setMinutes(cur.getMinutes() + 50);
    timeRanges.push(`${padHM(cur)}-${padHM(next)}`);
    cur = next;
  }

  const labs = Array.from(new Set([...fixedTodaySlots.map((s) => s.lab), ...dayEvents.map((e) => e.sala || e.resource)]));

  if (!timeRanges.length || !labs.length) {
    table.innerHTML = `<tr><td class="p-4 text-center ${textClass}">Sem dados para exibir</td></tr>`;
    return;
  }

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th class="px-2 py-1 border ${textClass}">Sala / Horário</th>${
    timeRanges.map((r) => `<th class="px-2 py-1 border ${textClass} text-center">${r}</th>`).join("")
  }</tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  labs.forEach((lab) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="px-2 py-1 border font-semibold ${textClass}">${lab}</td>`;

    timeRanges.forEach((range) => {
      const [start, end] = range.split("-");
      const cellStart = toDate(Y, M, D, start), cellEnd = toDate(Y, M, D, end);

      const hasReservation = dayEvents.some((ev) => {
        if ((ev.sala || ev.resource) !== lab) return false;
        const evStart = toDate(Y, M, D, ev.start), evEnd = toDate(Y, M, D, ev.end);
        return evStart < cellEnd && evEnd > cellStart;
      });

      const fixed = fixedTodaySlots.find((fs) =>
        fs.lab === lab &&
        toDate(Y, M, D, fs.startTime) < cellEnd &&
        toDate(Y, M, D, fs.endTime) > cellStart
      );

      let style = "", label = "";
      if (hasReservation) { style = "background-color: rgba(220,38,38,0.8);"; label = "ocupado"; }
      else if (fixed) { const c = turnoColors[fixed.turno] || "rgba(107,114,128,0.5)"; style = `background-color: ${c};`; label = fixed.turno; }
      else { style = "background-color: rgba(16,185,129,0.8);"; label = "livre"; }

      tr.innerHTML += `<td class="px-2 py-1 border ${textClass} text-center" style="${style}">${label}</td>`;
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

// ────────────────────────────────────
// SYNC
// ────────────────────────────────────
async function refreshEvents() {
  try {
    const updated = await Api.fetchEvents();
    CalendarModule.getEvents().slice().forEach((e) => CalendarModule.remove(e._id));
    updated.forEach((e) => CalendarModule.add(e));
  } catch (e) { console.error("Buscar eventos:", e); }
}

async function initOccupancyUpdates() {
  try { fixedSlots = await Api.fetchFixedSchedules(); } catch (e) { console.error("fixedSchedules:", e); }
  const dateInput = document.getElementById("occupancy-date");
  if (!dateInput) return console.error("#occupancy-date não encontrado");
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateInput.addEventListener("change", () => safeBuildOccupancyTable(dateInput.value));
  safeBuildOccupancyTable(dateInput.value);
  setInterval(() => safeBuildOccupancyTable(dateInput.value), 5_000);
  setInterval(async () => { await refreshEvents(); safeBuildOccupancyTable(dateInput.value); }, 120_000);
}

// --------------------------------------------------
// INICIALIZAÇÃO APP
// --------------------------------------------------
onReady(async () => {
  // user atual
  const storedUser = (typeof Auth !== "undefined" && Auth.getUser) ? Auth.getUser() : null;
  if (storedUser && !window.user) window.user = storedUser;

  // notificações
  if ("Notification" in window && Notification.permission === "granted") {
    notificacoesAtivas = true;
    const btn = document.getElementById("btn-ativar-notificacoes");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-bell-slash"></i> Notificações Ativadas'; }
  }
  solicitarPermissaoNotificacao();

  // rota protegida? (aceita admin_token também)
  const protectedIds = ["calendar","agendamento-form","reservations-container"];
  const isProtected = protectedIds.some((id) => document.getElementById(id));
  const userToken  = (typeof Auth !== "undefined" && Auth.getToken) ? Auth.getToken() : null;
  const adminToken = (typeof Auth !== "undefined" && Auth.getAdminToken) ? Auth.getAdminToken() : "";
  if (isProtected && !(userToken || adminToken)) {
    const host = window.location.hostname;
    const path = window.location.pathname;
    if (host.includes("coordenaplus.com.br")) window.location.href = "/login.html";
    else window.location.href = path.includes("/pages/") ? "../pages/login.html" : "pages/login.html";
    return;
  }

  // topo menu
  const user = window.user;
  if (user) {
    const nameEl = document.getElementById("menu-user-name");
    const emailEl = document.getElementById("menu-user-email");
    if (nameEl) nameEl.textContent = user.name || "—";
    if (emailEl) emailEl.textContent = user.email || "—";
    const fullNameEl = document.getElementById("menu-user-fullname");
    if (fullNameEl) fullNameEl.textContent = user.name || "—";
    let papelLegivel = user.role === "admin" ? "Administrador" : user.role === "professor" ? "Professor" : user.role === "student" ? "Aluno" : user.role || "";
    const roleEl = document.getElementById("menu-user-role");
    if (roleEl) roleEl.textContent = papelLegivel;
  }

  ThemeToggle.init();
  FormModule.init();
  DetailModule.init();

  // botão tema no menu
  const menuThemeBtn = document.getElementById("menu-theme-btn");
  if (menuThemeBtn) {
    if (document.documentElement.classList.contains("dark")) menuThemeBtn.classList.add("dark");
    menuThemeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", !isDark);
      localStorage.setItem("theme", !isDark ? "dark" : "light");
      menuThemeBtn.classList.toggle("dark", !isDark);
    });
  }

  // logout (usuário comum)
  document.getElementById("menu-logout-btn")?.addEventListener("click", () => {
    Auth.logout?.();
    window.user = null;
    window.location.href = "../login.html";
  });

  // btn notif
  const btnNotifs = document.getElementById("btn-ativar-notificacoes");
  btnNotifs?.addEventListener("click", () => {
    solicitarPermissaoNotificacao();
    btnNotifs.disabled = true;
    btnNotifs.innerHTML = '<i class="fas fa-bell-slash"></i> Notificações Ativadas';
  });

  // dados calendário
  let data = [];
  try { data = await Api.fetchEvents(); } catch (e) { console.warn("Falha buscar reservas, iniciando vazio", e); }

  const dateInput = document.getElementById("occupancy-date");
  if (!dateInput) console.error("Elemento #occupancy-table não encontrado!");
  else {
    if (document.getElementById("calendar")) {
      CalendarModule.init(
        data,
        (info) => {
          dateInput.value = info.dateStr;
          buildOccupancyTable(info.dateStr);
          FormModule.open(null, { date: info.dateStr, start: "00:00", end: "00:00", resource: "", sala: "", type: "", responsible: "", department: "", status: "", description: "", time: "" });
        },
        (info) => {
          const ev = CalendarModule.getEvents().find((e) => e._id === info.event.id);
          if (ev) DetailModule.open(ev);
        }
      );
    }
    dateInput.value = new Date().toISOString().slice(0, 10);
    dateInput.addEventListener("change", () => buildOccupancyTable(dateInput.value));
    initOccupancyUpdates();
    document.getElementById("import-schedule")?.addEventListener("click", () => alert("Importação de horários fixos desativada nesta versão."));
    buildOccupancyTable(dateInput.value);
  }
});

// “olhinho” de senha (páginas que tiverem)
document.querySelectorAll("button.toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = btn.closest(".form-group")?.querySelector("input");
    if (!input) return;
    const icon = btn.querySelector("i");
    if (input.type === "password") { input.type = "text"; icon?.classList.replace("fa-eye-slash", "fa-eye"); }
    else { input.type = "password"; icon?.classList.replace("fa-eye", "fa-eye-slash"); }
  });
});

// =======================
// HISTÓRICO DE USUÁRIOS (ADMIN)
// =======================
async function carregarHistoricoUsuarios() {
  const container = document.getElementById("lista-historico-usuarios");
  if (!container) return console.error("#lista-historico-usuarios não encontrado");
  container.innerHTML = '<p class="text-center py-4">Carregando histórico...</p>';
  try {
    const token = (typeof Auth !== "undefined" && Auth.getAdminToken) ? Auth.getAdminToken() : "";
    const BASE_API = window.location.hostname.includes("localhost") ? "http://localhost:10000" : "https://coordena-backend.onrender.com";
    const res = await fetch(`${BASE_API}/api/admin/users-history`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const historico = await res.json();
    if (!historico.length) {
      container.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-user-clock fa-3x mb-3"></i><h5>Nenhum usuário aprovado ou rejeitado ainda</h5><p>Ainda não há histórico de usuários.</p></div>`;
      return;
    }

    const termoBusca = document.getElementById("busca-historico-usuarios")?.value.trim().toLowerCase() || "";
    const ordenacao = document.getElementById("ordenacao-historico-usuarios")?.value || "updatedAt";

    let filtrados = historico.filter((u) => (((u.name || "") + " " + (u.email || "")).toLowerCase().includes(termoBusca)));
    filtrados.sort((a, b) =>
      ordenacao === "updatedAt" ? new Date(b.updatedAt) - new Date(a.updatedAt)
      : ordenacao === "status" ? (a.status || "").localeCompare(b.status || "")
      : (a[ordenacao] || "").localeCompare(b[ordenacao] || "")
    );

    let html = '<div class="row gx-3 gy-4">';
    filtrados.forEach((u) => {
      html += `<div class="col-12 col-md-6 col-lg-4"><div class="card shadow-sm h-100"><div class="card-body">
        <h5 class="card-title mb-1">${u.name}</h5>
        <p class="card-text text-secondary mb-1">${u.email}</p>
        <p class="card-text mb-1"><small>Função: <strong>${u.role}</strong></small></p>
        <p class="card-text mb-2"><small>Status: ${
          u.status === "approved" ? '<span class="badge bg-success">Aprovado</span>' : '<span class="badge bg-danger">Rejeitado</span>'
        }</small></p>
        <p class="card-text text-muted small">Data de cadastro: ${new Date(u.createdAt).toLocaleDateString("pt-BR")}<br>Última atualização: ${new Date(u.updatedAt).toLocaleDateString("pt-BR")} às ${new Date(u.updatedAt).toLocaleTimeString("pt-BR")}</p>
      </div></div></div>`;
    });
    html += "</div>";
    container.innerHTML = html;
  } catch (e) {
    console.error("Histórico usuários:", e);
    container.innerHTML = `<div class="text-center py-5 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-2"></i><p>Não foi possível carregar o histórico de usuários.</p></div>`;
  }
}
document.getElementById("historico-tab")?.addEventListener("shown.bs.tab", carregarHistoricoUsuarios);
document.getElementById("busca-historico-usuarios")?.addEventListener("input", carregarHistoricoUsuarios);
document.getElementById("ordenacao-historico-usuarios")?.addEventListener("change", carregarHistoricoUsuarios);

// ==================================================
// PAINEL DE ADMINISTRAÇÃO
// ==================================================
(function () {
  const hasUsers  = !!document.getElementById("lista-pendentes-usuarios");
  const hasResv   = !!document.getElementById("lista-pendentes-reservas");
  const hasAtivas = !!document.getElementById("lista-ativas");
  if (!hasUsers && !hasResv && !hasAtivas) return;

  solicitarPermissaoNotificacao();

  let usuariosPendentes = [];
  let reservasPendentes = [];
  let paginaAtualUsuarios = 1;
  let paginaAtualReservas = 1;
  let ultimoCountUsuarios = null;
  let ultimoCountReservas = null;

  const BASE_API = window.location.hostname.includes("localhost") ? "http://localhost:10000" : "https://coordena-backend.onrender.com";

  // Toast in-app
  function mostrarToast(txt) {
    const body = document.getElementById("meuToastBody");
    if (body) body.innerText = txt;
    const el = document.getElementById("toastNovoCadastro");
    if (el) new bootstrap.Toast(el).show();
  }

  // fetch admin com token + erros
  async function adminFetch(url, options = {}) {
    const token = (typeof Auth !== "undefined" && Auth.getAdminToken) ? Auth.getAdminToken() : "";
    if (!token) {
      alert("Sessão do Admin expirada. Faça login novamente.");
      window.location.replace("/login.html");
      return null;
    }
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          try {
            const errorData = await res.json();
            
            // Se o backend confirma que o token expirou ou é inválido
            if (errorData.expired || errorData.invalid) {
              alert("Sessão expirada. Faça login novamente.");
              Auth.logout?.();
              return null;
            }
            
            // Caso contrário, pode ser erro de permissão, não de token
            throw new Error(errorData.error || "Erro de autorização");
          } catch (jsonErr) {
            // Se não conseguir parsear JSON, verifica token localmente
            const currentToken = Auth.getAdminToken?.() || Auth.getToken?.();
            if (!currentToken || Auth.isTokenExpired?.(currentToken)) {
              alert("Sessão expirada. Faça login novamente.");
              Auth.logout?.();
              return null;
            } else {
              console.warn("Erro de autorização, mas token ainda válido");
              throw new Error("Erro de autorização temporário");
            }
          }
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const txt = await res.text();
      return txt ? JSON.parse(txt) : {};
    } catch (e) {
      console.error("adminFetch:", e);
      alert(e.message);
      return null;
    }
  }

  // ---- USUÁRIOS PENDENTES
  async function carregarUsuariosPendentes() {
    try {
      const dados = await adminFetch(`${BASE_API}/api/admin/pending-users`);
      if (!dados) return;
      const podeNotificar = typeof enviarNotificacao === "function" && notificacoesAtivas && Notification.permission === "granted";

      if (ultimoCountUsuarios === null && dados.length > 0) {
        mostrarToast(`${dados.length} usuário(s) pendente(s) no momento.`);
        if (podeNotificar) enviarNotificacao("🆕 Usuários Pendentes", `Existem ${dados.length} usuário(s) aguardando aprovação.`);
      } else if (ultimoCountUsuarios !== null && dados.length > ultimoCountUsuarios) {
        const diff = dados.length - ultimoCountUsuarios;
        mostrarToast(`${diff} nova(s) solicitação(ões) de usuário!`);
        if (podeNotificar) enviarNotificacao("🔔 Nova(s) Solicitação(ões) de Usuário", `${diff} novo(s) usuário(s) aguardando aprovação.`);
      }

      ultimoCountUsuarios = dados.length;
      usuariosPendentes = dados;
      renderizarUsuariosPendentes();
    } catch (e) { console.error("carregarUsuariosPendentes:", e); }
  }

  function renderizarUsuariosPendentes() {
    const container = document.getElementById("lista-pendentes-usuarios");
    if (!container) return;
    const busca = document.getElementById("busca-usuarios")?.value.trim().toLowerCase() || "";
    const ordenacao = document.getElementById("ordenacao-usuarios")?.value || "createdAt";

    let filtrados = usuariosPendentes.filter((u) => (((u.name || "") + " " + (u.email || "")).toLowerCase().includes(busca)));
    filtrados.sort((a, b) => ordenacao === "createdAt" ? new Date(a.createdAt) - new Date(b.createdAt) : (a[ordenacao] || "").localeCompare(b[ordenacao] || ""));

    const totalPag = Math.ceil(filtrados.length / 6) || 1;
    if (paginaAtualUsuarios > totalPag) paginaAtualUsuarios = totalPag;
    const inicio = (paginaAtualUsuarios - 1) * 6;
    const exibidos = filtrados.slice(inicio, inicio + 6);

    if (!filtrados.length) {
      container.innerHTML = `<div class="text-center py-5 text-light"><i class="fas fa-user-clock fa-3x mb-3"></i><h4>Nenhuma solicitação de usuário pendente</h4><p>Não há novos usuários aguardando aprovação.</p></div>`;
      return;
    }

    let html = '<div class="row gx-3 gy-4">';
    exibidos.forEach((u) => {
      const id = u._id || u.id;
      html += `<div class="col-md-6 col-lg-4"><div class="card card-coordena shadow-sm"><div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div><h5 class="card-title mb-1">${u.name}</h5><h6 class="card-subtitle mb-1">${u.email}</h6></div>
          <span class="badge bg-warning text-dark rounded-pill">Pendente</span>
        </div>
        <p class="mb-1"><i class="fas fa-user-tag me-1"></i><strong>Tipo:</strong> ${u.role}</p>
        <p class="mb-3"><i class="fas fa-calendar-alt me-1"></i><strong>Criado em:</strong> ${new Date(u.createdAt).toLocaleString("pt-BR")}</p>
        <div class="d-flex gap-2">
          <button class="btn btn-success flex-grow-1" onclick="aprovarUsuario('${id}')"><i class="fas fa-check me-1"></i> Aprovar</button>
          <button class="btn btn-danger flex-grow-1" onclick="rejeitarUsuario('${id}')"><i class="fas fa-times me-1"></i> Rejeitar</button>
        </div>
      </div></div></div>`;
    });
    html += "</div>";

    if (totalPag > 1) {
      html += `<nav aria-label="Paginação de Usuários" class="mt-4"><ul class="pagination justify-content-center">
        <li class="page-item ${paginaAtualUsuarios === 1 ? "disabled" : ""}"><a class="page-link" href="#" onclick="mudarPaginaUsuarios(${paginaAtualUsuarios - 1})">&laquo;</a></li>`;
      for (let p = 1; p <= totalPag; p++)
        html += `<li class="page-item ${paginaAtualUsuarios === p ? "active" : ""}"><a class="page-link" href="#" onclick="mudarPaginaUsuarios(${p})">${p}</a></li>`;
      html += `<li class="page-item ${paginaAtualUsuarios === totalPag ? "disabled" : ""}"><a class="page-link" href="#" onclick="mudarPaginaUsuarios(${paginaAtualUsuarios + 1})">&raquo;</a></li>
      </ul></nav>`;
    }
    container.innerHTML = html;
  }

  function mudarPaginaUsuarios(p) {
    paginaAtualUsuarios = Math.max(1, p);
    renderizarUsuariosPendentes();
    document.getElementById("lista-pendentes-usuarios")?.scrollIntoView({ behavior: "smooth" });
  }

  async function aprovarUsuario(id) {
    if (!id) return alert("ID inválido de usuário.");
    if (!confirm("Aprovar este usuário?")) return;
    const ok = await adminFetch(`${BASE_API}/api/admin/approve-user/${id}`, { method: "PATCH" });
    if (ok !== null) carregarUsuariosPendentes();
  }

  async function rejeitarUsuario(id) {
    if (!id) return alert("ID inválido de usuário.");
    if (!confirm("Rejeitar e excluir este usuário?")) return;
    const ok = await adminFetch(`${BASE_API}/api/admin/reject-user/${id}`, { method: "PATCH", body: JSON.stringify({ reason: "" }) });
    if (ok !== null) carregarUsuariosPendentes();
  }

  window.aprovarUsuario = aprovarUsuario;
  window.rejeitarUsuario = rejeitarUsuario;
  window.mudarPaginaUsuarios = mudarPaginaUsuarios;

  // ---- RESERVAS PENDENTES
  async function carregarReservasPendentes() {
    try {
      const dados = await adminFetch(`${BASE_API}/api/admin/pending-reservations`);
      if (!dados) return;
      const podeNotificar = typeof enviarNotificacao === "function" && notificacoesAtivas && Notification.permission === "granted";

      if (ultimoCountReservas === null && dados.length > 0) {
        mostrarToast(`${dados.length} reserva(s) pendente(s) no momento.`);
        if (podeNotificar) enviarNotificacao("🆕 Reservas Pendentes", `Existem ${dados.length} reserva(s) aguardando aprovação.`);
      } else if (ultimoCountReservas !== null && dados.length > ultimoCountReservas) {
        const diff = dados.length - ultimoCountReservas;
        mostrarToast(`${diff} nova(s) solicitação(ões) de reserva!`);
        if (podeNotificar) enviarNotificacao("🔔 Nova(s) Solicitação(ões) de Reserva", `${diff} nova(s) reserva(s) aguardando aprovação.`);
      }

      ultimoCountReservas = dados.length;
      reservasPendentes = dados;
      renderizarReservasPendentes();
    } catch (e) { console.error("carregarReservasPendentes:", e); }
  }

  function renderizarReservasPendentes() {
    const container = document.getElementById("lista-pendentes-reservas");
    if (!container) return;
    const busca = document.getElementById("busca-reservas")?.value.trim().toLowerCase() || "";
    const filtroData = document.getElementById("filtro-data-reservas")?.value || "";
    const ordenacao = document.getElementById("ordenacao-reservas")?.value || "date";

    let filtrados = reservasPendentes.filter((r) => {
      const txt = ((r.resource || "") + " " + (r.responsible || "")).toLowerCase();
      if (busca && !txt.includes(busca)) return false;
      if (filtroData && r.date !== filtroData) return false;
      return true;
    });

    filtrados.sort((a, b) => ordenacao === "date" ? new Date(a.date) - new Date(b.date) : (a[ordenacao] || "").localeCompare(b[ordenacao] || ""));

    const totalPag = Math.ceil(filtrados.length / 6) || 1;
    if (paginaAtualReservas > totalPag) paginaAtualReservas = totalPag;
    const inicio = (paginaAtualReservas - 1) * 6;
    const exibidos = filtrados.slice(inicio, inicio + 6);

    if (!filtrados.length) {
      container.innerHTML = `<div class="text-center py-5 text-light"><i class="fas fa-calendar-times fa-3x mb-3"></i><h4>Nenhuma solicitação de reserva pendente</h4><p>Não há novas solicitações de reserva.</p></div>`;
      return;
    }

    let html = '<div class="row gx-3 gy-4">';
    exibidos.forEach((r) => {
      const id = r._id || r.id;
      html += `<div class="col-md-6 col-lg-4"><div class="card card-coordena shadow-sm"><div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div><h5 class="card-title mb-1">${r.resource}${r.sala ? " – " + r.sala : ""}</h5><h6 class="card-subtitle mb-1">${new Date(r.date).toLocaleDateString("pt-BR")}</h6></div>
          <span class="badge bg-warning text-dark rounded-pill">Pendente</span>
        </div>
        <p class="mb-1"><i class="fas fa-clock me-1"></i><strong>Horário:</strong> ${r.start} – ${r.end}</p>
        <p class="mb-1"><i class="fas fa-user me-1"></i><strong>Requisitante:</strong> ${r.responsible}</p>
        <p class="mb-1"><i class="fas fa-building me-1"></i><strong>Depto.:</strong> ${r.department}</p>
        <p class="mb-1"><i class="fas fa-info-circle me-1"></i><strong>Tipo:</strong> ${r.type}</p>
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-success flex-grow-1" onclick="aprovarReserva('${id}')"><i class="fas fa-check me-1"></i> Aprovar</button>
          <button class="btn btn-danger flex-grow-1" onclick="rejeitarReserva('${id}')"><i class="fas fa-times me-1"></i> Rejeitar</button>
        </div>
      </div></div></div>`;
    });
    html += "</div>";

    if (totalPag > 1) {
      html += `<nav aria-label="Paginação de Reservas" class="mt-4"><ul class="pagination justify-content-center">
      <li class="page-item ${paginaAtualReservas === 1 ? "disabled" : ""}"><a class="page-link" href="#" onclick="mudarPaginaReservas(${paginaAtualReservas - 1})">&laquo;</a></li>`;
      for (let p = 1; p <= totalPag; p++)
        html += `<li class="page-item ${paginaAtualReservas === p ? "active" : ""}"><a class="page-link" href="#" onclick="mudarPaginaReservas(${p})">${p}</a></li>`;
      html += `<li class="page-item ${paginaAtualReservas === totalPag ? "disabled" : ""}"><a class="page-link" href="#" onclick="mudarPaginaReservas(${paginaAtualReservas + 1})">&raquo;</a></li>
      </ul></nav>`;
    }
    container.innerHTML = html;
  }

  function mudarPaginaReservas(p) {
    paginaAtualReservas = Math.max(1, p);
    renderizarReservasPendentes();
    document.getElementById("lista-pendentes-reservas")?.scrollIntoView({ behavior: "smooth" });
  }

  async function aprovarReserva(id) {
    if (!id) return alert("ID inválido de reserva.");
    if (!confirm("Aprovar esta reserva?")) return;
    const ok = await adminFetch(`${BASE_API}/api/admin/approve-reservation/${id}`, { method: "PATCH" });
    if (ok !== null) { carregarReservasPendentes(); carregarReservasAtivas(); }
  }

  async function rejeitarReserva(id) {
    if (!id) return alert("ID inválido de reserva.");
    if (!confirm("Rejeitar esta reserva?")) return;
    // IMPORTANTE: backend usa PATCH (não DELETE)
    const ok = await adminFetch(`${BASE_API}/api/admin/reject-reservation/${id}`, { method: "PATCH", body: JSON.stringify({ reason: "" }) });
    if (ok !== null) carregarReservasPendentes();
  }

  window.aprovarReserva = aprovarReserva;
  window.rejeitarReserva = rejeitarReserva;
  window.mudarPaginaReservas = mudarPaginaReservas;

  // ---- RESERVAS ATIVAS
  async function concluirReservation(id) {
    try {
      await adminFetch(`${BASE_API}/api/reservations/${id}`, { method: "PUT", body: JSON.stringify({ status: "concluido" }) });
    } catch (e) { console.error(`concluir ${id}:`, e); }
  }

  async function carregarReservasAtivas() {
    try {
      const todas = await adminFetch(`${BASE_API}/api/reservations?status=approved`, { method: "GET" });
      if (!todas) return;
      const agora = new Date();
      todas.forEach((r) => {
        const fim = new Date(`${r.date}T${r.end}:00`);
        if (agora > fim) concluirReservation(r._id || r.id);
      });

      const termo = document.getElementById("busca-ativas")?.value.trim().toLowerCase() || "";
      const filtroData = document.getElementById("filtro-data-ativas")?.value || "";
      const filtradas = todas
        .filter((r) => {
          const fim = new Date(`${r.date}T${r.end}:00`);
          if (agora > fim) return false;
          if (filtroData && r.date !== filtroData) return false;
          const lab = (r.sala || r.resource || "").toLowerCase(), resp = (r.responsible || "").toLowerCase();
          if (termo && !lab.includes(termo) && !resp.includes(termo)) return false;
          return true;
        })
        .sort((a, b) => new Date(`${a.date}T${a.start}:00`) - new Date(`${b.date}T${b.start}:00`));

      renderizarReservasAtivas(filtradas);
    } catch (e) { console.error("Reservas Ativas:", e); }
  }

  function renderizarReservasAtivas(reservas) {
    const container = document.getElementById("lista-ativas");
    if (!container) return;
    container.innerHTML = "";
    const agora = new Date();
    reservas.forEach((r) => {
      const inicio = new Date(`${r.date}T${r.start}:00`);
      const fim = new Date(`${r.date}T${r.end}:00`);
      let perc = 0;
      if (agora < inicio) perc = 0;
      else if (agora > fim) perc = 100;
      else perc = ((agora - inicio) / (fim - inicio)) * 100;

      const col = document.createElement("div"); col.className = "col-12 col-md-6 col-lg-4";
      const card = document.createElement("div"); card.className = "card shadow-sm h-100";
      const body = document.createElement("div"); body.className = "card-body";
      body.innerHTML = `
        <h5 class="card-title mb-1">${r.sala || r.resource || ""}</h5>
        <p class="card-text text-secondary mb-2">${r.responsible || ""}</p>
        <p class="card-text text-muted small">${inicio.toLocaleDateString("pt-BR")} &nbsp;|&nbsp; ${r.start} – ${r.end}</p>
        <div class="progress mt-3" style="height:8px;"><div class="progress-bar bg-success" role="progressbar" style="width:${perc}%;" aria-valuenow="${perc.toFixed(2)}" aria-valuemin="0" aria-valuemax="100"></div></div>
        <p class="text-end text-sm mt-1"><small>${perc.toFixed(0)}%</small></p>`;
      card.appendChild(body); col.appendChild(card); container.appendChild(col);
    });

    if (!reservas.length) {
      container.innerHTML = `<div class="text-center py-5 text-light w-100"><i class="fas fa-calendar-check fa-3x mb-3"></i><h4>Não há reservas aprovadas para exibir</h4><p>Ou ainda não existe reserva aprovada para o critério selecionado.</p></div>`;
    }
  }

  document.getElementById("busca-ativas")?.addEventListener("input", carregarReservasAtivas);
  document.getElementById("filtro-data-ativas")?.addEventListener("change", carregarReservasAtivas);

  onReady(() => {
    carregarUsuariosPendentes();
    carregarReservasPendentes();
    carregarReservasAtivas();
    setInterval(carregarReservasAtivas, 30_000);
  });

  // filtros
  document.getElementById("busca-usuarios")?.addEventListener("input", () => { paginaAtualUsuarios = 1; renderizarUsuariosPendentes(); });
  document.getElementById("ordenacao-usuarios")?.addEventListener("change", () => { paginaAtualUsuarios = 1; renderizarUsuariosPendentes(); });
  document.getElementById("busca-reservas")?.addEventListener("input", () => { paginaAtualReservas = 1; renderizarReservasPendentes(); });
  document.getElementById("ordenacao-reservas")?.addEventListener("change", () => { paginaAtualReservas = 1; renderizarReservasPendentes(); });
  document.getElementById("filtro-data-reservas")?.addEventListener("change", () => { paginaAtualReservas = 1; renderizarReservasPendentes(); });

  // polling pendentes
  setInterval(() => { carregarUsuariosPendentes(); carregarReservasPendentes(); }, 10_000);

  // logout admin
  document.getElementById("admin-logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("admin_user"); localStorage.removeItem("admin_token"); window.location.replace("/login.html");
  });
})();

// ──────────────────────────────────────────────────
// POPUP de cadastro (UI simples)
// ──────────────────────────────────────────────────
const popupModal = document.getElementById("popup-modal");
const popupText = document.getElementById("popup-text");
const popupOk = document.getElementById("popup-ok");
let _onPopupOk = null;
function showPopup(msg, onOk) {
  if (!popupModal || !popupText) return alert(msg);
  popupText.textContent = msg;
  _onPopupOk = onOk || null;
  popupModal.classList.remove("opacity-0", "pointer-events-none");
}
popupOk?.addEventListener("click", () => {
  popupModal.classList.add("opacity-0", "pointer-events-none");
  if (_onPopupOk) _onPopupOk();
});

// ──────────────────────────────────────────────────
// CONTROLES DE TEMA (fallback)
// ──────────────────────────────────────────────────
{
  const btn2 = document.getElementById("theme-toggle");
  const root2 = document.documentElement;
  if (localStorage.getItem("theme") === "dark") root2.classList.add("dark");
  btn2?.addEventListener("click", () => {
    root2.classList.toggle("dark");
    localStorage.setItem("theme", root2.classList.contains("dark") ? "dark" : "light");
  });
}

// ──────────────────────────────────────────────────
// REGISTRO DE USUÁRIO (página de cadastro)
// ──────────────────────────────────────────────────
onReady(() => {
  const form = document.getElementById("register-form");
  if (!form) return;
  const estacioRegex = /^[\w.%+-]+@(alunos|professor)\.estacio\.br$/i;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const matricula = document.getElementById("matricula").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const pwd = document.getElementById("password").value;
    const pwd2 = document.getElementById("password2").value;

    if (!estacioRegex.test(email)) {
      return showPopup("Use um e-mail institucional válido:\n- Aluno: @alunos.estacio.br\n- Professor: @professor.estacio.br");
    }
    if (pwd !== pwd2) return showPopup("As senhas não coincidem");

    try {
      await Auth.register({ name, email, password: pwd, matricula });
      showPopup("✅ Cadastro enviado! Aguardando aprovação em até 24h.", () => (window.location.href = "/login.html"));
    } catch (err) {
      showPopup(err.message || "Falha no cadastro");
    }
  });

  // Olhinho senha
  document.querySelectorAll("button.toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inp = btn.closest(".form-group")?.querySelector("input");
      if (!inp) return;
      const icon = btn.querySelector("i");
      if (inp.type === "password") { inp.type = "text"; icon?.classList.replace("fa-eye-slash", "fa-eye"); }
      else { inp.type = "password"; icon?.classList.replace("fa-eye", "fa-eye-slash"); }
    });
  });

  // Critérios senha
  const commonPasswords = ["123456","password","12345678","qwerty","abc123"];
  const cMin = document.getElementById("c-min-length");
  const cCase = document.getElementById("c-uppercase-lowercase");
  const cNumSym = document.getElementById("c-number-symbol");
  const cNoMail = document.getElementById("c-no-email");
  const cCommon = document.getElementById("c-not-common");

  document.getElementById("password")?.addEventListener("input", () => {
    const pwd = document.getElementById("password").value;
    const user = (document.getElementById("email")?.value || "").split("@")[0];

    if (pwd.length >= 8) cMin?.classList.replace("text-red-500", "text-green-500"); else cMin?.classList.replace("text-green-500", "text-red-500");
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) cCase?.classList.replace("text-red-500", "text-green-500"); else cCase?.classList.replace("text-green-500", "text-red-500");
    if (/\d/.test(pwd) || /[!@#$%^&*(),.?":{}|<>]/.test(pwd)) cNumSym?.classList.replace("text-red-500", "text-green-500"); else cNumSym?.classList.replace("text-green-500", "text-red-500");
    if (user && pwd.toLowerCase().includes(user.toLowerCase())) cNoMail?.classList.replace("text-green-500", "text-red-500"); else cNoMail?.classList.replace("text-red-500", "text-green-500");
    if (commonPasswords.includes(pwd.toLowerCase())) cCommon?.classList.replace("text-green-500", "text-red-500"); else cCommon?.classList.replace("text-red-500", "text-green-500");
  });
});
