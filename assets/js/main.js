// assets/js/main.js

// ======================================
// CORES PARA TURNOS FIXOS DE AULA
// ======================================
const turnoColors = {
  "Manhã": "rgba(75, 85, 99, 0.2)",   // azul claro
  "Tarde": "rgba(75, 85, 99, 0.2)",    // laranja claro
  "Noite": "rgba(75, 85, 99, 0.2)"      // cinza claro
};

// ----------------------
// UTILIDADES
// ----------------------
function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

// ----------------------
// VARIÁVEL GLOBAL PARA SABER SE TEM PERMISSÃO DE NOTIFICAÇÃO
// ----------------------
let notificacoesAtivas = false;

// ----------------------
// FUNÇÃO: SOLICITA PERMISSÃO DE NOTIFICAÇÕES (chamada no clique do botão)
// ----------------------
function solicitarPermissaoNotificacao() {
  if (!("Notification" in window)) {
    console.warn("Este navegador não suporta notificações.");
    return;
  }

  // Se já aceitou, não pede de novo
  if (Notification.permission === "granted") {
    notificacoesAtivas = true;
    return;
  }

  // Se estiver negado, não adianta pedir de novo (ou pode tentar solicitar)
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        notificacoesAtivas = true;
        console.log("Permissão de Notificações: concedida");
      } else {
        notificacoesAtivas = false;
        console.log("Permissão de Notificações: negada ou pausada");
      }
    });
  }
}

// ----------------------
// FUNÇÃO: ENVIA NOTIFICAÇÃO (se tiver permissão)
// ----------------------
function enviarNotificacao(titulo, texto) {
  if (notificacoesAtivas && Notification.permission === "granted") {
    new Notification(titulo, {
      body: texto,
      icon: "/assets/img/logo-notification.png" // altere o caminho do ícone se necessário
    });
  }
}

// ----------------------
// MÓDULO DE TEMA (Dark/Light)
// ----------------------
const ThemeToggle = (() => {
  const themeKey = 'theme';
  const root = document.documentElement;

  function applyTheme(mode) {
    root.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(themeKey, mode);
  }

  function init() {
    const saved = localStorage.getItem(themeKey) || 'light';
    applyTheme(saved);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        applyTheme(root.classList.contains('dark') ? 'light' : 'dark');
      });
    }
  }

  return { init };
})();

// ----------------------
// MÓDULO DE API
// ----------------------
const Api = (() => {
  // rota base de reservas (coleção “reservations”)
  const BASE = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/reservations'
    : 'https://coordena-backend.onrender.com/api/reservations';

  // rota derivada para horários fixos
  const FIXED = BASE.replace('/reservations', '/fixedSchedules');

  function authHeaders(isJson = false) {
    const headers = { 'Authorization': `Bearer ${Auth.getToken() || ''}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async function fetchEvents() {
    const res = await fetch(BASE, { headers: authHeaders(false) });
    if (!res.ok) throw new Error(`Falha ao buscar reservas: ${res.status}`);
    return res.json();
  }

  async function fetchFixedSchedules() {
    const res = await fetch(FIXED, { headers: authHeaders(false) });
    if (!res.ok) throw new Error(`Falha ao buscar horários fixos: ${res.status}`);
    return res.json();
  }

  async function createEvent(data) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao criar reserva');
    return res.json();
  }

  async function updateEvent(id, data) {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar reserva');
    return res.json();
  }

  async function deleteEvent(id) {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(false)
    });
    if (!res.ok) throw new Error('Falha ao excluir reserva');
  }

  return {
    fetchEvents,
    fetchFixedSchedules,
    createEvent,
    updateEvent,
    deleteEvent
  };
})();

// ----------------------
// MÓDULO CALENDÁRIO (SUPORTE MOBILE + FIXED)
// ----------------------
const CalendarModule = (() => {
  let calendar;
  let events = [];
  let fixedSlots = [];

  async function loadFixedSchedules() {
    try {
      const fixed = await Api.fetchFixedSchedules();
      fixedSlots = fixed;
      const fixedEvents = fixed.map(slot => ({
        title: `${slot.lab} (${slot.turno})`,
        daysOfWeek: [slot.dayOfWeek],
        startTime: slot.startTime,
        endTime: slot.endTime,
        display: 'background',
        color: '#66666680'
      }));
      calendar.addEventSource(fixedEvents);
    } catch (err) {
      console.error('Falha ao carregar horários fixos:', err);
    }
  }

  async function reloadEvents() {
    try {
      const approvedReservations = await Api.fetchEvents();
      calendar.getEvents().forEach(fcEvent => {
        if (fcEvent.rendering !== 'background') {
          fcEvent.remove();
        }
      });
      events = approvedReservations;
      approvedReservations.forEach(ev => {
        calendar.addEvent({
          id: ev._id,
          title: `${ev.title} (${ev.time})`,
          start: `${ev.date}T${ev.start}`,
          end: `${ev.date}T${ev.end}`
        });
      });
    } catch (err) {
      console.error('Erro ao recarregar eventos aprovados:', err);
    }
  }

  function init(rawEvents, onDateClick, onEventClick) {
    events = rawEvents;
    const el = document.getElementById('calendar');
    if (!el) {
      console.error('#calendar não encontrado');
      return;
    }
    const isMobile = window.innerWidth < 640;
    calendar = new FullCalendar.Calendar(el, {
      locale: 'pt-br',
      initialView: isMobile ? 'listWeek' : 'dayGridMonth',
      headerToolbar: {
        left: isMobile ? 'prev,next' : 'prev,next today',
        center: 'title',
        right: isMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      events: events.map(e => ({
        id: e._id,
        title: `${e.title} (${e.time})`,
        start: `${e.date}T${e.start}`,
        end: `${e.date}T${e.end}`
      })),
      dateClick: onDateClick,
      eventClick: onEventClick,
      height: el.clientHeight,
      allDaySlot: false,
      selectable: true,
      selectAllow: selectInfo => {
        return !calendar.getEvents().some(ev =>
          ev.rendering === 'background' &&
          ev.start < selectInfo.end &&
          ev.end > selectInfo.start
        );
      }
    });
    calendar.render();
    loadFixedSchedules();
    setInterval(() => {
      reloadEvents();
      if (typeof buildOccupancyTable === 'function') {
        buildOccupancyTable(document.getElementById('occupancy-date')?.value);
      }
    }, 30 * 1000);
    window.addEventListener('resize', () => {
      const nowMobile = window.innerWidth < 640;
      calendar.changeView(nowMobile ? 'listWeek' : 'dayGridMonth');
      calendar.setOption('headerToolbar', {
        left: nowMobile ? 'prev,next' : 'prev,next today',
        center: 'title',
        right: nowMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay'
      });
    });
  }

  function add(ev) {
    events.push(ev);
    calendar.addEvent({
      id: ev._id,
      title: `${ev.title} (${ev.time})`,
      start: `${ev.date}T${ev.start}`,
      end: `${ev.date}T${ev.end}`
    });
  }

  function update(id, ev) {
    const idx = events.findIndex(x => x._id === id);
    if (idx !== -1) events[idx] = ev;
    const fcEvent = calendar.getEventById(id);
    if (fcEvent) {
      fcEvent.setProp('title', `${ev.title} (${ev.time})`);
      fcEvent.setStart(`${ev.date}T${ev.start}`);
      fcEvent.setEnd(`${ev.date}T${ev.end}`);
    }
  }

  function remove(id) {
    events = events.filter(x => x._id !== id);
    const fcEvent = calendar.getEventById(id);
    if (fcEvent) fcEvent.remove();
  }

  return {
    init,
    add,
    update,
    remove,
    getEvents: () => events
  };
})();

// ----------------------
// MÓDULO FORMULÁRIO (CRIAÇÃO E EDIÇÃO DE RESERVA)
// ----------------------
const FormModule = (() => {
  let currentId = null;
  const selectors = {};

  function cacheSelectors() {
    selectors.modal = document.getElementById('form-modal');
    selectors.form = document.getElementById('agendamento-form');
    selectors.btnOpen = document.getElementById('open-form-modal');
    selectors.btnClose = document.getElementById('form-close');
    selectors.fields = {
      data: document.getElementById('data'),
      start: document.getElementById('start'),
      end: document.getElementById('end'),
      recurso: document.getElementById('recurso'),
      salaContainer: document.getElementById('sala-container'),
      sala: document.getElementById('sala'),
      type: document.getElementById('tipo-evento'),
      resp: document.getElementById('responsavel'),
      dept: document.getElementById('departamento'),
      materia: document.getElementById('curso'),
      status: document.getElementById('status'),
      desc: document.getElementById('descricao')
    };
  }

  function open(id = null, evData = null) {
    currentId = id;
    selectors.form.reset();
    selectors.fields.salaContainer.classList.add('hidden');
    selectors.fields.dept.value = '';
    selectors.fields.materia.innerHTML = '<option value="">Selecione o curso primeiro</option>';
    selectors.fields.materia.disabled = true;
    selectors.fields.resp.removeAttribute('readonly');

    const user = Auth.getCurrentUser();
    if (user?.name) {
      selectors.fields.resp.value = user.name;
      selectors.fields.resp.setAttribute('readonly', 'readonly');
    }

    if (evData) {
      selectors.fields.data.value = evData.date;
      selectors.fields.start.value = evData.start;
      selectors.fields.end.value = evData.end;
      selectors.fields.recurso.value = evData.resource;
      selectors.fields.recurso.dispatchEvent(new Event('change'));
      selectors.fields.sala.value = evData.sala || '';
      selectors.fields.type.value = evData.type;
      if (evData.responsible) {
        selectors.fields.resp.value = evData.responsible;
        selectors.fields.resp.setAttribute('readonly', 'readonly');
      }
      selectors.fields.dept.value = evData.department;
      selectors.fields.status.value = evData.status;
      selectors.fields.desc.value = evData.description;
      if (evData.materia) {
        selectors.fields.materia.innerHTML = `<option value="${evData.materia}">${evData.materia}</option>`;
        selectors.fields.materia.disabled = false;
      }
    }

    selectors.modal.classList.remove('hidden');
  }

  function close() {
    selectors.modal.classList.add('hidden');
    currentId = null;
    selectors.form.reset();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const f = selectors.fields;
    const payload = {
      date: f.data.value,
      start: f.start.value,
      end: f.end.value,
      resource: f.recurso.value,
      sala: f.salaContainer.classList.contains('hidden') ? '' : f.sala.value,
      type: f.type.value,
      responsible: f.resp.value,
      department: f.dept.value,
      materia: f.materia.value,
      status: 'pending',
      description: f.desc.value,
      time: `${f.start.value}-${f.end.value}`,
      title: f.salaContainer.classList.contains('hidden')
        ? f.type.value
        : `${f.type.value} - ${f.sala.value}`
    };

    const allEvents = CalendarModule.getEvents();
    const dtStart = new Date(`${payload.date}T${payload.start}`);
    const dtEnd = new Date(`${payload.date}T${payload.end}`);
    let conflict = allEvents.some(ev => {
      if (ev.date !== payload.date) return false;
      if ((ev.sala || ev.resource) !== (payload.sala || payload.resource)) return false;
      const evStart = new Date(`${ev.date}T${ev.start}`);
      const evEnd = new Date(`${ev.date}T${ev.end}`);
      return dtStart < evEnd && dtEnd > evStart;
    });
    if (!conflict && typeof fixedSlots !== 'undefined') {
      const weekday = new Date(payload.date).getDay();
      conflict = fixedSlots.some(fs => {
        if (fs.lab !== payload.sala) return false;
        if (fs.dayOfWeek !== weekday) return false;
        const fsStart = new Date(`${payload.date}T${fs.startTime}`);
        const fsEnd = new Date(`${payload.date}T${fs.endTime}`);
        return dtStart < fsEnd && dtEnd > fsStart;
      });
    }
    if (conflict) {
      return alert('Conflito: já existe agendamento ou horário fixo nesse período.');
    }

    try {
      if (currentId) {
        const updated = await Api.updateEvent(currentId, payload);
        CalendarModule.update(currentId, updated);
      } else {
        await Api.createEvent(payload);
        alert('✅ Reserva criada! Aguardando aprovação do administrador.');
      }
      const dateValue = f.data.value;
      safeBuildOccupancyTable(dateValue);
      close();
    } catch (err) {
      alert('Erro ao criar/atualizar reserva: ' + err.message);
    }
  }

  function init() {
    cacheSelectors();
    const user = Auth.getCurrentUser();
    if (user?.name) {
      selectors.fields.resp.value = user.name;
      selectors.fields.resp.setAttribute('readonly', 'readonly');
    }
    selectors.fields.start.addEventListener('change', () => {
      const [hh, mm] = selectors.fields.start.value.split(':').map(Number);
      const d = new Date();
      d.setHours(hh, mm + 50);
      selectors.fields.end.value =
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    selectors.btnOpen?.addEventListener('click', () => open());
    selectors.btnClose?.addEventListener('click', close);
    selectors.form?.addEventListener('submit', handleSubmit);

    const salaOpts = {
      'Laboratório': ['Lab B401', 'Lab B402', 'Lab B403', 'Lab B404', 'Lab B405', 'Lab B406', 'Lab Imaginologia']
    };
    selectors.fields.recurso?.addEventListener('change', () => {
      const tipo = selectors.fields.recurso.value;
      if (salaOpts[tipo]) {
        selectors.fields.salaContainer.classList.remove('hidden');
        selectors.fields.sala.innerHTML =
          '<option value="">Selecione...</option>' +
          salaOpts[tipo].map(s => `<option>${s}</option>`).join('');
      } else {
        selectors.fields.salaContainer.classList.add('hidden');
      }
    });

    const courseMap = {
      'Engenharia de Computação': [
        'ARA0003 - PRINCÍPIOS DE GESTÃO',
        'ARA0017 - INTRODUCAO A PROGRAMAÇÃO DE COMPUTADORES',
        'ARA0039 - ARQUITETURA DE COMPUTADORES',
        'ARA0045 - ENGENHARIA, SOCIEDADE E SUSTENTABILIDADE',
        'ARA0015 - CÁLCULO DIFERENCIAL E INTEGRAL',
        'ARA0020 - GEOMETRIA ANALÍTICA E ÁLGEBRA LINEAR',
        'ARA0038 - REPRESENTAÇÃO GRÁFICA PARA PROJETO',
        'ARA0048 - FÍSICA TEÓRICA EXPERIMENTAL - MECÂNICA',
        'ARA1386 - SISTEMAS OPERACIONAIS',
        'ARA0002 - PENSAMENTO COMPUTACIONAL',
        'ARA0014 - ANÁLISE DE DADOS',
        'ARA0018 - CÁLCULO DE MÚLTIPLAS VARIÁVEIS',
        'ARA0044 - ELETRICIDADE E MAGNETISMO',
        'ARA0047 - FÍSICA TEÓRICA EXPER. - FLUIDOS, CALOR, OSCILAÇÕES',
        'ARA1398 - MECÂNICA DOS SÓLIDOS',
        'ARA0029 - ELETRICIDADE APLICADA',
        'ARA0030 - EQUAÇÕES DIFERENCIAIS',
        'ARA0046 - FENÔMENOS DE TRANSPORTE',
        'ARA0056 - QUÍMICA TECNOLÓGICA',
        'ARA2042 - SISTEMAS DIGITAIS',
        'ARA0079 - COMUNICAÇÕES DE DADOS E REDES DE COMPUTADORES',
        'ARA0083 - ELETRÔNICA ANALÓGICA',
        'ARA0125 - CONTROLADORES LÓGICOS PROGRAMÁVEIS',
        'ARA1943 - MODELAGEM MATEMÁTICA',
        'ARA0040 - BANCO DE DADOS',
        'ARA0098 - ESTRUTURA DE DADOS',
        'COMPILADORES',
        'ARA2545 - SISTEMAS DISTRIBUÍDOS E COMPUTAÇÃO PARALELA',
        'ARA0095 - DESENVOLVIMENTO RÁPIDO DE APLICAÇÕES EM PYTHON',
        'ARA0141 - INSTRUMENTAÇÃO INDUSTRIAL',
        'ARA0363 - PROGRAMAÇÃO DE SOFTWARE BÁSICO EM C',
        'ARA2086 - ALGORITMOS EM GRAFOS',
        'ARA0301 - PROGRAMAÇÃO DE MICROCONTROLADORES',
        'ARA0309 - LINGUAGENS FORMAIS E AUTÔMATOS',
        'ARA1879 - AUTOMAÇÃO INDUSTRIAL',
        'ARA0085 - INTELIGÊNCIA ARTIFICIAL',
        'ARA0115 - SISTEMAS EMBARCADOS',
        'ARA1191 - SUP. DE ESTÁGIO E PRÉ-PROJETO EM ENG. DE COM.',
        'ARA1518 - ALGORITMOS DE PROCESSAMENTO DE IMAGEM',
        'ARA0026 - TÓPICOS EM LIBRAS: SURDEZ E INCLUSÃO',
        'ARA0154 - PROCESSOS INDUSTRIAIS E ROBÔTICA',
        'ARA0869 - INOVAÇÃO, EMPREENDE. E PROJETO FINAL - ENG DE COMP',
        'ARA2074 - SEGURANÇA CIBERNÉTICA'
      ]
    };

    selectors.fields.dept?.addEventListener('change', () => {
      const lista = courseMap[selectors.fields.dept.value] || [];
      const sel = selectors.fields.materia;
      if (lista.length) {
        sel.innerHTML =
          '<option value="">Selecione a matéria...</option>' +
          lista.map(m => `<option value="${m}">${m}</option>`).join('');
        sel.disabled = false;
      } else {
        sel.innerHTML = '<option value="">Selecione o curso primeiro</option>';
        sel.disabled = true;
      }
    });
  }

  return { init, open };
})();

// ----------------------
// MÓDULO MODAL DETALHES
// ----------------------
const DetailModule = (() => {
  let currentId = null;
  const selectors = {};

  function cacheSelectors() {
    selectors.modal = document.getElementById('event-modal');
    selectors.btnClose = document.getElementById('modal-close');
    selectors.btnEdit = document.getElementById('modal-edit');
    selectors.btnDelete = document.getElementById('modal-cancel');
    selectors.fields = {
      date: document.getElementById('modal-date'),
      resource: document.getElementById('modal-resource'),
      type: document.getElementById('modal-type'),
      resp: document.getElementById('modal-resp'),
      dept: document.getElementById('modal-dept'),
      materia: document.getElementById('modal-materia'),
      status: document.getElementById('modal-status'),
      desc: document.getElementById('modal-desc')
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
    f.materia.textContent = `Matéria: ${ev.materia || '—'}`;
    f.status.textContent = `Status: ${ev.status}`;
    f.desc.textContent = ev.description || 'Sem descrição';
    selectors.modal.classList.remove('hidden');
  }

  function close() {
    selectors.modal.classList.add('hidden');
  }

  function init() {
    cacheSelectors();
    selectors.btnClose?.addEventListener('click', close);
    selectors.btnEdit?.addEventListener('click', () => {
      if (!currentId) return;
      const ev = CalendarModule.getEvents().find(e => e._id === currentId);
      if (ev) FormModule.open(currentId, ev);
      close();
    });
    selectors.btnDelete?.addEventListener('click', async () => {
      if (!currentId) return;
      try {
        await Api.deleteEvent(currentId);
        CalendarModule.remove(currentId);
        const dateValue = document.getElementById('occupancy-date').value;
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
// MÓDULO DE TABELA DE OCUPAÇÃO DINÂMICA
// ────────────────────────────────────

let fixedSlots = [];

function padHM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function toDate(Y, M, D, hm) {
  const [h, m] = hm.split(':').map(Number);
  return new Date(Y, M - 1, D, h, m);
}

async function safeBuildOccupancyTable(filterDate) {
  try {
    await buildOccupancyTable(filterDate);
  } catch (err) {
    console.error('Erro na tabela de ocupação:', err);
  }
}

async function buildOccupancyTable(filterDate) {
  const table = document.getElementById('occupancy-table');
  table.innerHTML = '';

  const allEvents = CalendarModule.getEvents();
  const dateStr = filterDate || new Date().toISOString().slice(0, 10);
  const [Y, M, D] = dateStr.split('-').map(Number);
  const weekday = new Date(Y, M - 1, D).getDay();
  const now = new Date();
  const dayEvents = allEvents.filter(e => e.date === dateStr);
  const fixedTodaySlots = fixedSlots.filter(s => s.dayOfWeek === weekday);

  const slotStart = toDate(Y, M, D, '08:00');
  const slotEnd = toDate(Y, M, D, '22:00');
  const timeRanges = [];
  let cursor = new Date(slotStart);
  while (cursor < slotEnd) {
    const next = new Date(cursor);
    next.setMinutes(cursor.getMinutes() + 50);
    timeRanges.push(`${padHM(cursor)}-${padHM(next)}`);
    cursor = next;
  }

  const labs = Array.from(new Set([
    ...fixedTodaySlots.map(s => s.lab),
    ...dayEvents.map(e => e.sala || e.resource)
  ]));

  if (!timeRanges.length || !labs.length) {
    table.innerHTML = `<tr><td class="p-4 text-center text-white">Sem dados para exibir</td></tr>`;
    return;
  }

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="px-2 py-1 border">Sala / Horário</th>
      ${timeRanges.map(r =>
    `<th class="px-2 py-1 border text-center">${r}</th>`
  ).join('')}
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  labs.forEach(lab => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="px-2 py-1 border font-semibold">${lab}</td>`;

    timeRanges.forEach(range => {
      const [start, end] = range.split('-');
      const cellStart = toDate(Y, M, D, start);
      const cellEnd = toDate(Y, M, D, end);

      const hasReservation = dayEvents.some(ev => {
        if ((ev.sala || ev.resource) !== lab) return false;
        const evStart = toDate(Y, M, D, ev.start);
        const evEnd = toDate(Y, M, D, ev.end);
        return evStart < cellEnd && evEnd > cellStart;
      });

      const fixed = fixedTodaySlots.find(fs =>
        fs.lab === lab &&
        toDate(Y, M, D, fs.startTime) < cellEnd &&
        toDate(Y, M, D, fs.endTime) > cellStart
      );

      let style = '', label = '';
      if (hasReservation) {
        style = 'background-color: rgba(220,38,38,0.8);';
        label = 'ocupado';
      } else if (fixed) {
        style = `background-color: ${turnoColors[fixed.turno]};`;
        label = fixed.turno;
      } else {
        style = 'background-color: rgba(16,185,129,0.8);';
        label = 'livre';
      }

      tr.innerHTML += `
        <td class="px-2 py-1 border text-white text-center" style="${style}">
          ${label}
        </td>`;
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

// ────────────────────────────────────
// SINCRONIZAÇÃO & ATUALIZAÇÃO AUTOMÁTICA
// ────────────────────────────────────
async function refreshEvents() {
  try {
    const updated = await Api.fetchEvents();
    CalendarModule.getEvents().slice().forEach(e => CalendarModule.remove(e._id));
    updated.forEach(e => CalendarModule.add(e));
  } catch (err) {
    console.error('Erro ao buscar eventos:', err);
  }
}

async function initOccupancyUpdates() {
  try {
    fixedSlots = await Api.fetchFixedSchedules();
  } catch (err) {
    console.error('Falha ao buscar fixedSchedules:', err);
  }

  const dateInput = document.getElementById('occupancy-date');
  dateInput.value = new Date().toISOString().slice(0, 10);

  dateInput.addEventListener('change', () => safeBuildOccupancyTable(dateInput.value));

  safeBuildOccupancyTable(dateInput.value);
  setInterval(() => safeBuildOccupancyTable(dateInput.value), 5 * 1000);
  setInterval(async () => {
    await refreshEvents();
    safeBuildOccupancyTable(dateInput.value);
  }, 2 * 60 * 1000);
}

// ----------------------
// INICIALIZAÇÃO PRINCIPAL
// ----------------------
onReady(async () => {
  // 0) ** NÃO chamar solicitarPermissaoNotificacao() aqui **
  //    pois muitos navegadores móveis bloqueiam se não houver "toque" do usuário.

  // 1) Preenche nome e e-mail do usuário no menu
  const user = window.user || (typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null);
  if (user) {
    const nameEl = document.getElementById('menu-user-name');
    const emailEl = document.getElementById('menu-user-email');
    if (nameEl) nameEl.textContent = user.name || '—';
    if (emailEl) emailEl.textContent = user.email || '—';
  }

  // 2) Inicializa tema, formulários e detalhes
  ThemeToggle.init();
  FormModule.init();
  DetailModule.init();

  // 3) Sincroniza botão de tema no menu
  const menuThemeBtn = document.getElementById('menu-theme-btn');
  if (menuThemeBtn) {
    if (document.documentElement.classList.contains('dark')) {
      menuThemeBtn.classList.add('dark');
    }
    menuThemeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        menuThemeBtn.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        menuThemeBtn.classList.add('dark');
      }
    });
  }

  // 4) Botão de logout
  const menuLogoutBtn = document.getElementById('menu-logout-btn');
  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', () => {
      if (typeof Auth !== 'undefined' && Auth.logout) {
        Auth.logout();
      }
      window.location.href = '/login.html';
    });
  }

  // 5) NOVO: Botão para ativar notificações (precisa estar em algum lugar do HTML)
  const btnNotifs = document.getElementById('btn-ativar-notificacoes');
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      solicitarPermissaoNotificacao();
      // Desabilita após pedir permissão para não ficar pedindo de novo
      btnNotifs.setAttribute('disabled', 'disabled');
      btnNotifs.innerHTML = '<i class="fas fa-bell-slash"></i> Notificações Ativadas';
    });
  }

  // 6) Busca reservas iniciais para o FullCalendar
  let data = [];
  try {
    data = await Api.fetchEvents();
  } catch (err) {
    console.warn('Falha ao buscar reservas, iniciando calendário vazio', err);
  }

  // 7) Referência única ao date-picker
  const dateInput = document.getElementById('occupancy-date');
  if (!dateInput) {
    console.error('Elemento #occupancy-date não encontrado!');
    return;
  }

  // 8) Inicializa o FullCalendar
  CalendarModule.init(
    data,
    info => {
      dateInput.value = info.dateStr;
      buildOccupancyTable(info.dateStr);

      FormModule.open(null, {
        date: info.dateStr,
        start: '00:00',
        end: '00:00',
        resource: '',
        sala: '',
        type: '',
        responsible: '',
        department: '',
        status: '',
        description: '',
        time: ''
      });
    },
    info => {
      const ev = CalendarModule
        .getEvents()
        .find(e => e._id === info.event.id);
      if (ev) DetailModule.open(ev);
    }
  );

  // 9) Configura date-picker
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateInput.addEventListener('change', () => {
    buildOccupancyTable(dateInput.value);
  });

  // 10) Inicia auto-refresh da tabela de ocupação
  initOccupancyUpdates();

  // 11) Listener extra (importação desativada)
  document
    .getElementById('import-schedule')
    ?.addEventListener('click', () => {
      alert('Importação de horários fixos desativada nesta versão.');
    });

  // 12) Chamada inicial para popular a tabela
  buildOccupancyTable(dateInput.value);
});


// ==================================================
// A PARTIR DAQUI: CÓDIGO DO PAINEL DE ADMINISTRAÇÃO
// ==================================================
(function () {
  // Só executa se estivermos na página de admin
  if (!document.getElementById('lista-pendentes-usuarios') &&
    !document.getElementById('lista-pendentes-reservas')) {
    return;
  }

  // ----------------------
  // VARIÁVEIS GLOBAIS DO ADMIN
  // ----------------------
  let usuariosPendentes = [];
  let reservasPendentes = [];
  let paginaAtualUsuarios = 1;
  let paginaAtualReservas = 1;
  let ultimoCountUsuarios = null;
  let ultimoCountReservas = null;

  // Obtém a URL-base do backend
  const BASE_API = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000'
    : 'https://coordena-backend.onrender.com';

  // ----------------------
  // FUNÇÃO: EXIBE NOTIFICAÇÃO IN-APP (Toast do Bootstrap)
  // ----------------------
  function mostrarToast(texto) {
    const body = document.getElementById('meuToastBody');
    if (body) body.innerText = texto;
    const toastEl = document.getElementById('toastNovoCadastro');
    if (toastEl) {
      const toast = new bootstrap.Toast(toastEl);
      toast.show();
    }
  }

  // ----------------------
  // 1) CARREGAR E NOTIFICAR USUÁRIOS PENDENTES
  // ----------------------
  async function carregarUsuariosPendentes() {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Sessão do Admin expirada. Faça login novamente.');
        window.location.replace('/login.html');
        return;
      }

      const res = await fetch(`${BASE_API}/api/admin/pending-users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        alert('Sem permissão ou token inválido. Faça login novamente.');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.replace('/login.html');
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao carregar usuários pendentes.');
      }

      const dados = await res.json();
      const podeNotificar = notificacoesAtivas && Notification.permission === "granted";

      if (ultimoCountUsuarios === null && dados.length > 0) {
        mostrarToast(`${dados.length} usuário(s) pendente(s) no momento.`);
        if (podeNotificar) {
          enviarNotificacao(
            "Novos usuários pendentes",
            `Existem ${dados.length} novo(s) usuário(s) aguardando aprovação.`
          );
        }
      } else if (ultimoCountUsuarios !== null && dados.length > ultimoCountUsuarios) {
        const diff = dados.length - ultimoCountUsuarios;
        mostrarToast(`${diff} nova(s) solicitação(ões) de usuário!`);
        if (podeNotificar) {
          enviarNotificacao(
            "Nova(s) solicitação(ões) de usuário",
            `${diff} novo(s) usuário(s) aguardando aprovação.`
          );
        }
      }

      ultimoCountUsuarios = dados.length;
      usuariosPendentes = dados;
      renderizarUsuariosPendentes();
    } catch (err) {
      console.error('Erro em carregarUsuariosPendentes():', err);
    }
  }

  function renderizarUsuariosPendentes() {
    const busca = document.getElementById('busca-usuarios')?.value.trim().toLowerCase() || '';
    const ordenacao = document.getElementById('ordenacao-usuarios')?.value || 'createdAt';

    let filtrados = usuariosPendentes.filter(u =>
      u.name.toLowerCase().includes(busca) ||
      u.email.toLowerCase().includes(busca)
    );

    filtrados.sort((a, b) => {
      if (ordenacao === 'createdAt') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return a[ordenacao].localeCompare(b[ordenacao]);
    });

    const totalPaginas = Math.ceil(filtrados.length / 6);
    if (paginaAtualUsuarios > totalPaginas && totalPaginas > 0) {
      paginaAtualUsuarios = totalPaginas;
    }
    const inicio = (paginaAtualUsuarios - 1) * 6;
    const exibidos = filtrados.slice(inicio, inicio + 6);

    const container = document.getElementById('lista-pendentes-usuarios');
    if (!container) return;

    if (filtrados.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-light">
          <i class="fas fa-user-clock fa-3x mb-3"></i>
          <h4>Nenhuma solicitação de usuário pendente</h4>
          <p>Não há novos usuários aguardando aprovação.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="row gx-3 gy-4">';
    exibidos.forEach(u => {
      html += `
        <div class="col-md-6 col-lg-4">
          <div class="card card-coordena shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 class="card-title mb-1">${u.name}</h5>
                  <h6 class="card-subtitle mb-1">${u.email}</h6>
                </div>
                <span class="badge bg-warning text-dark rounded-pill">Pendente</span>
              </div>
              <p class="mb-1">
                <i class="fas fa-user-tag me-1"></i>
                <strong>Tipo:</strong> ${u.role}
              </p>
              <p class="mb-3">
                <i class="fas fa-calendar-alt me-1"></i>
                <strong>Criado em:</strong> ${new Date(u.createdAt).toLocaleString('pt-BR')}
              </p>
              <div class="d-flex gap-2">
                <button class="btn btn-success flex-grow-1" onclick="aprovarUsuario('${u._id}')">
                  <i class="fas fa-check me-1"></i> Aprovar
                </button>
                <button class="btn btn-danger flex-grow-1" onclick="rejeitarUsuario('${u._id}')">
                  <i class="fas fa-times me-1"></i> Rejeitar
                </button>
              </div>
            </div>
          </div>
        </div>`;
    });
    html += '</div>';

    if (totalPaginas > 1) {
      html += `<nav aria-label="Paginação de Usuários" class="mt-4"><ul class="pagination justify-content-center">`;
      html += `
        <li class="page-item ${paginaAtualUsuarios === 1 ? 'disabled' : ''}">
          <a class="page-link" href="#" onclick="mudarPaginaUsuarios(${paginaAtualUsuarios - 1})">&laquo;</a>
        </li>`;
      for (let p = 1; p <= totalPaginas; p++) {
        html += `
          <li class="page-item ${paginaAtualUsuarios === p ? 'active' : ''}">
            <a class="page-link" href="#" onclick="mudarPaginaUsuarios(${p})">${p}</a>
          </li>`;
      }
      html += `
        <li class="page-item ${paginaAtualUsuarios === totalPaginas ? 'disabled' : ''}">
          <a class="page-link" href="#" onclick="mudarPaginaUsuarios(${paginaAtualUsuarios + 1})">&raquo;</a>
        </li>
      </ul></nav>`;
    }

    container.innerHTML = html;
  }

  function mudarPaginaUsuarios(p) {
    paginaAtualUsuarios = p;
    renderizarUsuariosPendentes();
    document.getElementById('lista-pendentes-usuarios')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function aprovarUsuario(id) {
    if (!confirm('Tem certeza que deseja aprovar este usuário?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BASE_API}/api/admin/approve-user/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao aprovar o usuário.');
      }
      carregarUsuariosPendentes();
    } catch (err) {
      console.error('Erro em aprovarUsuario():', err);
      alert(err.message);
    }
  }

  async function rejeitarUsuario(id) {
    if (!confirm('Tem certeza que deseja rejeitar e excluir este usuário?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BASE_API}/api/admin/reject-user/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao rejeitar o usuário.');
      }
      carregarUsuariosPendentes();
    } catch (err) {
      console.error('Erro em rejeitarUsuario():', err);
      alert(err.message);
    }
  }

  window.aprovarUsuario = aprovarUsuario;
  window.rejeitarUsuario = rejeitarUsuario;
  window.mudarPaginaUsuarios = mudarPaginaUsuarios;

  // ----------------------
// 2) CARREGAR E NOTIFICAR RESERVAS PENDENTES
// ----------------------
async function carregarReservasPendentes() {
  try {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      alert('Sessão do Admin expirada. Faça login novamente.');
      window.location.replace('/login.html');
      return;
    }

    const res = await fetch(`${BASE_API}/api/admin/pending-reservations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      alert('Sem permissão ou token inválido. Faça login novamente.');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.replace('/login.html');
      return;
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Falha ao carregar reservas pendentes.');
    }

    const dados = await res.json();
    const podeNotificar = notificacoesAtivas && Notification.permission === "granted";

    // 1) Sempre exibe o Toast interno:
    if (ultimoCountReservas === null && dados.length > 0) {
      mostrarToast(`${dados.length} reserva(s) pendente(s) no momento.`);
      // 2) Se push estiver ativo, envia também a notificação do sistema:
      if (podeNotificar) {
        enviarNotificacao(
          "🆕 Reservas Pendentes",
          `Existem ${dados.length} reserva(s) aguardando aprovação.`
        );
      }
    }
    else if (ultimoCountReservas !== null && dados.length > ultimoCountReservas) {
      const diff = dados.length - ultimoCountReservas;
      mostrarToast(`${diff} nova(s) solicitação(ões) de reserva!`);
      if (podeNotificar) {
        enviarNotificacao(
          "🔔 Nova(s) Solicitação(ões) de Reserva",
          `${diff} nova(s) reserva(s) aguardando aprovação.`
        );
      }
    }

    ultimoCountReservas = dados.length;
    reservasPendentes = dados;
    renderizarReservasPendentes();
  } catch (err) {
    console.error('Erro em carregarReservasPendentes():', err);
  }
}

  // ----------------------
  // 3) MÓDULO “RESERVAS ATIVAS” (AUTODELETE AO CHEGAR EM 100%)
  // ----------------------

  let intervaloReservasAtivas = null;

  async function deleteReservation(id) {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      await fetch(`${BASE_API}/api/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log(`🗑️ Reserva ${id} deletada pois já terminou.`);
    } catch (err) {
      console.error(`Erro ao deletar reserva ${id}:`, err);
    }
  }

  async function carregarReservasAtivas() {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const url = `${BASE_API}/api/reservations?status=approved`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!resp.ok) {
        throw new Error(`Falha ao buscar reservas aprovadas (status ${resp.status})`);
      }
      const todasReservas = await resp.json();
      console.log("🔍[DEBUG] reservas aprovadas vindas da API:", todasReservas);

      const agora = new Date();
      todasReservas.forEach(r => {
        const fim = new Date(`${r.date}T${r.end}:00`);
        if (agora > fim) {
          deleteReservation(r._id);
        }
      });

      const termoBusca = document.getElementById('busca-ativas')?.value.trim().toLowerCase() || '';
      const filtroData = document.getElementById('filtro-data-ativas')?.value || '';

      const filtradas = todasReservas.filter(r => {
        const fim = new Date(`${r.date}T${r.end}:00`);
        if (agora > fim) return false;
        if (filtroData && r.date !== filtroData) return false;
        const nomeLab = (r.sala || r.resource || '').toLowerCase();
        const nomeResp = (r.responsible || '').toLowerCase();
        if (termoBusca && !nomeLab.includes(termoBusca) && !nomeResp.includes(termoBusca)) {
          return false;
        }
        return true;
      });

      filtradas.sort((a, b) => {
        const da = new Date(`${a.date}T${a.start}:00`);
        const db = new Date(`${b.date}T${b.start}:00`);
        return da - db;
      });

      renderizarReservasAtivas(filtradas);

    } catch (err) {
      console.error("Erro no módulo de Reservas Ativas:", err);
    }
  }

  function renderizarReservasAtivas(reservas) {
    const container = document.getElementById("lista-ativas");
    if (!container) return;

    container.innerHTML = "";

    const agora = new Date();

    reservas.forEach(r => {
      const inicio = new Date(`${r.date}T${r.start}:00`);
      const fim    = new Date(`${r.date}T${r.end}:00`);

      let porcentagem = 0;
      if (agora < inicio) {
        porcentagem = 0;
      } else if (agora > fim) {
        porcentagem = 100;
      } else {
        porcentagem = ((agora - inicio) / (fim - inicio)) * 100;
      }

      const col = document.createElement("div");
      col.className = "col-12 col-md-6 col-lg-4";

      const card = document.createElement("div");
      card.className = "card shadow-sm h-100";

      const cardBody = document.createElement("div");
      cardBody.className = "card-body";

      cardBody.innerHTML = `
        <h5 class="card-title mb-1">${r.sala || r.resource || ''}</h5>
        <p class="card-text text-secondary mb-2">${r.responsible || ''}</p>
        <p class="card-text text-muted small">
          ${inicio.toLocaleDateString("pt-BR")} &nbsp;|&nbsp;
          ${r.start} – ${r.end}
        </p>
        <div class="progress mt-3" style="height: 8px;">
          <div
            class="progress-bar bg-success"
            role="progressbar"
            style="width: ${porcentagem}%;"
            aria-valuenow="${porcentagem.toFixed(2)}"
            aria-valuemin="0"
            aria-valuemax="100"
          ></div>
        </div>
        <p class="text-end text-sm mt-1">
          <small>${porcentagem.toFixed(0)}%</small>
        </p>
      `;

      card.appendChild(cardBody);
      col.appendChild(card);
      container.appendChild(col);
    });

    if (reservas.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-light w-100">
          <i class="fas fa-calendar-check fa-3x mb-3"></i>
          <h4>Não há reservas aprovadas para exibir</h4>
          <p>Ou ainda não existe reserva aprovada para o critério selecionado.</p>
        </div>
      `;
    }
  }

  document.getElementById('busca-ativas')?.addEventListener('input', () => {
    carregarReservasAtivas();
  });
  document.getElementById('filtro-data-ativas')?.addEventListener('change', () => {
    carregarReservasAtivas();
  });

  onReady(() => {
    carregarReservasAtivas();
    intervaloReservasAtivas = setInterval(() => {
      carregarReservasAtivas();
    }, 30_000);
  });

  // ----------------------
  // 4) BIND DOS EVENTOS DE BUSCA / FILTRO (Usuários + Reservas)
  // ----------------------
  document.getElementById('busca-usuarios')?.addEventListener('input', () => {
    paginaAtualUsuarios = 1;
    renderizarUsuariosPendentes();
  });
  document.getElementById('ordenacao-usuarios')?.addEventListener('change', () => {
    paginaAtualUsuarios = 1;
    renderizarUsuariosPendentes();
  });

  document.getElementById('busca-reservas')?.addEventListener('input', () => {
    paginaAtualReservas = 1;
    renderizarReservasPendentes();
  });
  document.getElementById('ordenacao-reservas')?.addEventListener('change', () => {
    paginaAtualReservas = 1;
    renderizarReservasPendentes();
  });
  document.getElementById('filtro-data-reservas')?.addEventListener('change', () => {
    paginaAtualReservas = 1;
    renderizarReservasPendentes();
  });

  // ----------------------
  // 5) POLLING AUTOMÁTICO (Usuários + Reservas)
  // ----------------------
  setInterval(async () => {
    await carregarUsuariosPendentes();
    await carregarReservasPendentes();
  }, 10000);

  // ----------------------
  // 6) CHAMADA INICIAL QUANDO A PÁGINA FOR CARREGADA
  // ----------------------
  onReady(() => {
    carregarUsuariosPendentes();
    carregarReservasPendentes();
  });

  // ----------------------
  // 7) LOGOUT DO ADMIN
  // ----------------------
  document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
    window.location.replace('/login.html');
  });
})();
