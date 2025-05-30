// assets/js/main.js
// ======================================
// CORES PARA TURNOS FIXOS DE AULA
// ======================================
const turnoColors = {
  "Manhã": "rgba(59, 130, 246, 0.2)",   // azul claro
  "Tarde": "rgba(245, 241, 6, 0.2)",    // laranja claro
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
  // rota base de reservas
  const BASE = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/reservas'
    : 'https://coordena-backend.onrender.com/api/reservas';

  // rota derivada para horários fixos
  const FIXED = BASE.replace('/reservas', '/fixedSchedules');

  function authHeaders(isJson = false) {
    const headers = { 'Authorization': `Bearer ${Auth.getToken() || ''}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  }

  // busca reservas dinâmicas
  async function fetchEvents() {
    const res = await fetch(BASE, { headers: authHeaders(false) });
    if (!res.ok) throw new Error(`Falha ao buscar reservas: ${res.status}`);
    return res.json();
  }

  // busca horários fixos
  async function fetchFixedSchedules() {
    const res = await fetch(FIXED, { headers: authHeaders(false) });
    if (!res.ok) throw new Error(`Falha ao buscar horários fixos: ${res.status}`);
    return res.json();
  }

  // cria reserva
  async function createEvent(data) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao criar reserva');
    return res.json();
  }

  // atualiza reserva
  async function updateEvent(id, data) {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar reserva');
    return res.json();
  }

  // deleta reserva
  async function deleteEvent(id) {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(false)
    });
    if (!res.ok) throw new Error('Falha ao excluir reserva');
  }

  return {
    fetchEvents,
    fetchFixedSchedules,  // ← exporta função de fixedSchedules
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

  // 1) Função auxiliar: carrega os horários fixos do back
  async function loadFixedSchedules() {
    try {
      const fixed = await Api.fetchFixedSchedules();
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

  function init(rawEvents, onDateClick, onEventClick) {
    events = rawEvents;

    const el = document.getElementById('calendar');
    if (!el) return console.error('#calendar não encontrado');

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
    setInterval(() => buildOccupancyTable(), 60 * 1000);
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

  // adiciona um evento recém-criado
  function add(ev) {
    // 1) atualiza array interno
    events.push(ev);
    // 2) injeta no FullCalendar
    calendar.addEvent({
      id: ev._id,
      title: `${ev.title} (${ev.time})`,
      start: `${ev.date}T${ev.start}`,
      end: `${ev.date}T${ev.end}`
    });
  }

  // atualiza um evento existente
  function update(id, ev) {
    // 1) atualiza array interno
    const idx = events.findIndex(x => x._id === id);
    if (idx !== -1) events[idx] = ev;

    // 2) localiza e atualiza no FullCalendar
    const fcEvent = calendar.getEventById(id);
    if (fcEvent) {
      fcEvent.setProp('title', `${ev.title} (${ev.time})`);
      fcEvent.setStart(`${ev.date}T${ev.start}`);
      fcEvent.setEnd(`${ev.date}T${ev.end}`);
    }
  }

  // remove um evento
  function remove(id) {
    // 1) remove do array interno
    events = events.filter(x => x._id !== id);

    // 2) remove do FullCalendar
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
// MÓDULO FORMULÁRIO
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

    // pré-preenche sempre com o usuário logado
    const user = Auth.getCurrentUser();
    if (user?.name) {
      selectors.fields.resp.value = user.name;
      selectors.fields.resp.setAttribute('readonly', 'readonly');
    }

    if (evData) {
      // pré-preencher para edição (somente sobrescreve resp se evData.responsible existir)
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
      status: f.status.value,
      description: f.desc.value,
      time: `${f.start.value}-${f.end.value}`,
      title: f.salaContainer.classList.contains('hidden')
        ? f.type.value
        : `${f.type.value} - ${f.sala.value}`
    };

    // ————————————————————————————————
    // valida conflito (dinâmico + fixos)
    // ————————————————————————————————
    const allEvents = CalendarModule.getEvents();
    const dtStart = new Date(`${payload.date}T${payload.start}`);
    const dtEnd = new Date(`${payload.date}T${payload.end}`);
    // checa eventos do backend
    let conflict = allEvents.some(ev => {
      if (ev.date !== payload.date) return false;
      if ((ev.sala || ev.resource) !== (payload.sala || payload.resource)) return false;
      const evStart = new Date(`${ev.date}T${ev.start}`);
      const evEnd = new Date(`${ev.date}T${ev.end}`);
      return dtStart < evEnd && dtEnd > evStart;
    });
    // checa conflitos contra slots fixos (se quiser)
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

    // ————————————————————————————————
    // cria/atualiza no backend e no calendário
    // ————————————————————————————————
    try {
      let saved;
      if (currentId) {
        saved = await Api.updateEvent(currentId, payload);
        CalendarModule.update(currentId, saved);
      } else {
        saved = await Api.createEvent(payload);
        CalendarModule.add(saved);
      }
      // atualiza tabela
      buildOccupancyTable(f.data.value);
      close();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  function init() {
    cacheSelectors();

    const user = Auth.getCurrentUser();
    if (user?.name) {
      selectors.fields.resp.value = user.name;
      selectors.fields.resp.setAttribute('readonly', 'readonly');
    }

    // pré-calcula término +50min
    selectors.fields.start.addEventListener('change', () => {
      const [hh, mm] = selectors.fields.start.value.split(':').map(Number);
      const d = new Date(); d.setHours(hh, mm + 50);
      selectors.fields.end.value =
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    // botões
    selectors.btnOpen?.addEventListener('click', () => open());
    selectors.btnClose?.addEventListener('click', close);
    selectors.form?.addEventListener('submit', handleSubmit);

    // mapa de salas
    const salaOpts = {
      'Laboratório': ['Lab B401', 'Lab B402', 'Lab B403', 'Lab B404', 'Lab B405', 'Lab B406', 'Lab imaginologia'],
      //'Sala de Aula': ['Sala101', 'Sala102', 'Sala103'],
      //'Auditório': ['Auditório A', 'Auditório B']
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

    // mapa de cursos × matérias (completo)
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
        'ARA0154 - PROCESSOS INDUSTRIAIS E ROBÓTICA',
        'ARA0869 - INOVAÇÃO, EMPREENDE. E PROJETO FINAL - ENG DE COMP',
        'ARA2074 - SEGURANÇA CIBERNÉTICA'
      ]
    };

    selectors.fields.dept?.addEventListener('change', () => {
      const lista = courseMap[selectors.fields.dept.value] || [];
      const sel = selectors.fields.materia; // é o <select id="curso">
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
  let currentId = null
  const selectors = {}

  function cacheSelectors() {
    selectors.modal = document.getElementById('event-modal')
    selectors.btnClose = document.getElementById('modal-close')
    selectors.btnEdit = document.getElementById('modal-edit')
    selectors.btnDelete = document.getElementById('modal-cancel')
    selectors.fields = {
      date: document.getElementById('modal-date'),
      resource: document.getElementById('modal-resource'),
      type: document.getElementById('modal-type'),
      resp: document.getElementById('modal-resp'),
      dept: document.getElementById('modal-dept'),
      materia: document.getElementById('modal-materia'),
      status: document.getElementById('modal-status'),
      desc: document.getElementById('modal-desc')
    }
  }

  function open(ev) {
    currentId = ev._id
    const f = selectors.fields
    f.date.textContent = `Data: ${ev.date} (${ev.time})`
    f.resource.textContent = `Recurso: ${ev.resource}`
    f.type.textContent = `Evento: ${ev.type}`
    f.resp.textContent = `Responsável: ${ev.responsible}`
    f.dept.textContent = `Curso: ${ev.department}`
    f.materia.textContent = `Matéria: ${ev.materia || '—'}`
    f.status.textContent = `Status: ${ev.status}`
    f.desc.textContent = ev.description || 'Sem descrição'
    selectors.modal.classList.remove('hidden')
  }

  function close() {
    selectors.modal.classList.add('hidden')
  }

  function init() {
    cacheSelectors()
    selectors.btnClose?.addEventListener('click', close)
    selectors.btnEdit?.addEventListener('click', () => {
      if (!currentId) return
      const ev = CalendarModule.getEvents().find(e => e._id === currentId)
      if (ev) FormModule.open(currentId, ev)
      close()
    })
    selectors.btnDelete?.addEventListener('click', async () => {
      if (!currentId) return
      try {
        await Api.deleteEvent(currentId)
        CalendarModule.remove(currentId)
        const dateValue = document.getElementById('occupancy-date').value
        buildOccupancyTable(dateValue)
        close()
      } catch (err) {
        alert(err.message)
      }
    })
  }

  return { init, open }
})()

// ────────────────────────────────────
// MÓDULO DE TABELA DE OCUPAÇÃO DINÂMICA
// ────────────────────────────────────

let fixedSlots = [];  // já populado via Api.fetchFixedSchedules()

function padHM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function toDate(Y, M, D, hm) {
  const [h, m] = hm.split(':').map(Number);
  return new Date(Y, M - 1, D, h, m);
}

async function buildOccupancyTable(filterDate) {
  const table = document.getElementById('occupancy-table');
  table.innerHTML = '';  // limpa antes de tudo

  // 1) dados de reservas e slots fixos do dia
  const allEvents       = CalendarModule.getEvents();
  const dateStr         = filterDate || new Date().toISOString().slice(0,10);
  const [Y, M, D]       = dateStr.split('-').map(Number);
  const weekday         = new Date(Y, M-1, D).getDay();
  const now             = new Date();
  const dayEvents       = allEvents.filter(e => e.date === dateStr);
  const fixedTodaySlots = fixedSlots.filter(s => s.dayOfWeek === weekday);

  // 2) gera grade uniforme de 50 min do dia (08:00–22:00)
  const slotStart = toDate(Y, M, D, '08:00');
  const slotEnd   = toDate(Y, M, D, '22:00');
  const timeRanges = [];
  let cursor = new Date(slotStart);
  while (cursor < slotEnd) {
    const next = new Date(cursor);
    next.setMinutes(cursor.getMinutes() + 50);
    timeRanges.push(
      `${padHM(cursor)}-${padHM(next)}`
    );
    cursor = next;
  }

  // 3) lista de salas (fixos + reservas)
  const labs = Array.from(new Set([
    ...fixedTodaySlots.map(s => s.lab),
    ...dayEvents.map(e => e.sala || e.resource)
  ]));

  // 4) se não há dados
  if (!timeRanges.length || !labs.length) {
    table.innerHTML = `<tr><td class="p-4 text-center text-white">Sem dados para exibir</td></tr>`;
    return;
  }

  // 5) cabeçalho
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="px-2 py-1 border">Sala / Horário</th>
      ${timeRanges.map(r =>
        `<th class="px-2 py-1 border text-center">${r}</th>`
      ).join('')}
    </tr>`;
  table.appendChild(thead);

  // 6) corpo
  const tbody = document.createElement('tbody');
  labs.forEach(lab => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="px-2 py-1 border font-semibold">${lab}</td>`;

    timeRanges.forEach(range => {
      const [start, end] = range.split('-');
      const cellStart    = toDate(Y, M, D, start);
      const cellEnd      = toDate(Y, M, D, end);

      // existe reserva que cruza este intervalo?
      const hasReservation = dayEvents.some(ev => {
        if ((ev.sala || ev.resource) !== lab) return false;
        const evStart = toDate(Y, M, D, ev.start);
        const evEnd   = toDate(Y, M, D, ev.end);
        return evStart < cellEnd && evEnd > cellStart;
      });

      // existe slot fixo (aula) que cruza este intervalo?
      const fixed = fixedTodaySlots.find(fs =>
        fs.lab === lab &&
        toDate(Y, M, D, fs.startTime) < cellEnd &&
        toDate(Y, M, D, fs.endTime) > cellStart
      );

      // escolhe cor e texto
      let style = '', label = '';
      if (hasReservation) {
        style = 'background-color: rgba(220,38,38,0.8);'; // vermelho
        label = 'ocupado';
      } else if (fixed) {
        // se o agora for antes do fim da aula, mostra turno; se não, mostra livre
        if (now < toDate(Y, M, D, fixed.endTime)) {
          style = `background-color: ${turnoColors[fixed.turno]};`;
          label = fixed.turno;
        } else {
          style = 'background-color: rgba(16,185,129,0.8);'; // verde
          label = 'livre';
        }
      } else {
        style = 'background-color: rgba(16,185,129,0.8);'; // verde
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
    // limpa o calendário interno
    CalendarModule.getEvents().slice().forEach(e => CalendarModule.remove(e._id));
    // re‐adiciona tudo
    updated.forEach(e => CalendarModule.add(e));
  } catch (err) {
    console.error('Erro ao buscar eventos:', err);
  }
}

async function initOccupancyUpdates() {
  // carrega fixedSlots só uma vez
  try {
    fixedSlots = await Api.fetchFixedSchedules();
  } catch (err) {
    console.error('Falha ao buscar fixedSchedules:', err);
  }

  const dateInput = document.getElementById('occupancy-date');

  // função única de refresh da tabela
  function refreshTable() {
    buildOccupancyTable(dateInput.value);
  }

  // listener só de data
  dateInput.addEventListener('change', refreshTable);

  // valor inicial e primeiros ciclos
  dateInput.value = new Date().toISOString().slice(0, 10);
  refreshTable();

  // re‐monta a tabela a cada 5s
  setInterval(refreshTable, 5 * 1000);

  // re‐busca reservas a cada 2min e reconstrói
  setInterval(async () => {
    await refreshEvents();
    refreshTable();
  }, 2 * 60 * 1000);
}


// ----------------------
// INICIALIZAÇÃO PRINCIPAL
// ----------------------
onReady(async () => {
  ThemeToggle.init();
  FormModule.init();
  DetailModule.init();

  let data = [];
  try {
    data = await Api.fetchEvents();
  } catch (err) {
    console.warn('Falha ao buscar reservas, iniciando calendário vazio', err);
  }

  // referências únicas
  const dateInput = document.getElementById('occupancy-date');
  const turnoSelect = document.getElementById('turno-filter');

  // 1) Inicializa o calendário com seus callbacks originais
  CalendarModule.init(
    data,
    info => {
      // atualiza date-picker e tabela
      dateInput.value = info.dateStr;
      buildOccupancyTable(info.dateStr, turnoSelect.value);

      // abre formulário
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

  // 2) Preenche data inicial e listeners de filtro
  dateInput.value = new Date().toISOString().slice(0, 10);

  dateInput.addEventListener('change', () => {
    buildOccupancyTable(dateInput.value, turnoSelect.value);
  });
  turnoSelect.addEventListener('change', () => {
    buildOccupancyTable(dateInput.value, turnoSelect.value);
  });

  // 3) Ativa atualização automática da tabela (com filtro por data e turno)
  initOccupancyUpdates({
    getDate: () => dateInput.value,
    getTurno: () => turnoSelect.value
  });

  // 4) Demais listeners…
  document.getElementById('import-schedule')
    .addEventListener('click', () => {
      alert('Importação de horários fixos desativada nesta versão.');
    });

  // off-canvas menu…
  // (… seu código existente …)

  // 5) Chamada inicial
  buildOccupancyTable(dateInput.value, turnoSelect.value);
});


