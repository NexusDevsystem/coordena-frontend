// assets/js/main.js

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
  const root     = document.documentElement;

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
  const BASE = window.location.hostname.includes('localhost')
    ? 'http://localhost:10000/api/reservas'
    : 'https://coordena-backend.onrender.com/api/reservas';

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

  return { fetchEvents, createEvent, updateEvent, deleteEvent };
})();

// ----------------------
// MÓDULO CALENDÁRIO (SUPORTE MOBILE)
// ----------------------
const CalendarModule = (() => {
  let calendar;
  let events = [];

  function init(rawEvents, onDateClick, onEventClick) {
    events = rawEvents;
    const el = document.getElementById('calendar');
    if (!el) return console.error('#calendar não encontrado');

    const isMobile = window.innerWidth < 640;
    calendar = new FullCalendar.Calendar(el, {
      locale: 'pt-br',
      initialView: isMobile ? 'listWeek' : 'dayGridMonth',
      headerToolbar: {
        left:   isMobile ? 'prev,next' : 'prev,next today',
        center: 'title',
        right:  isMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      events: events.map(e => ({
        id:    e._id,
        title: `${e.title} (${e.time})`,
        start: `${e.date}T${e.start}`,
        end:   `${e.date}T${e.end}`
      })),
      dateClick:  onDateClick,
      eventClick: onEventClick,
      height:     el.clientHeight,
      allDaySlot: false
    });

    calendar.render();
    window.addEventListener('resize', () => {
      const nowMobile = window.innerWidth < 640;
      const newView   = nowMobile ? 'listWeek' : 'dayGridMonth';
      calendar.changeView(newView);
      calendar.setOption('headerToolbar', {
        left:   nowMobile ? 'prev,next' : 'prev,next today',
        center: 'title',
        right:  nowMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay'
      });
    });
  }

  function add(ev) {
    calendar.addEvent({
      id:    ev._id,
      title: `${ev.title} (${ev.time})`,
      start: `${ev.date}T${ev.start}`,
      end:   `${ev.date}T${ev.end}`
    });
    events.push(ev);
  }

  function update(id, ev) {
    events = events.map(e => (e._id === id ? ev : e));
    const obj = calendar.getEventById(id);
    if (obj) {
      obj.setProp('title', `${ev.title} (${ev.time})`);
      obj.setStart(`${ev.date}T${ev.start}`);
      obj.setEnd(`${ev.date}T${ev.end}`);
    }
  }

  function remove(id) {
    events = events.filter(e => e._id !== id);
    calendar.getEventById(id)?.remove();
  }

  return { init, add, update, remove, getEvents: () => events };
})();

// ----------------------
// MÓDULO FORMULÁRIO
// ----------------------
const FormModule = (() => {
  let currentId = null;
  const selectors = {};

  function cacheSelectors() {
    selectors.modal    = document.getElementById('form-modal');
    selectors.form     = document.getElementById('agendamento-form');
    selectors.btnOpen  = document.getElementById('open-form-modal');
    selectors.btnClose = document.getElementById('form-close');
    selectors.fields   = {
      data:          document.getElementById('data'),
      start:         document.getElementById('start'),
      end:           document.getElementById('end'),
      recurso:       document.getElementById('recurso'),
      salaContainer: document.getElementById('sala-container'),
      sala:          document.getElementById('sala'),
      type:          document.getElementById('tipo-evento'),
      resp:          document.getElementById('responsavel'),
      dept:          document.getElementById('departamento'),
      materia:       document.getElementById('curso'),
      status:        document.getElementById('status'),
      desc:          document.getElementById('descricao')
    };
  }

  function open(id = null, evData = null) {
    currentId = id;
    selectors.form.reset();

    // sempre esconder sala
    selectors.fields.salaContainer.classList.add('hidden');

    // reset curso & matéria
    selectors.fields.dept.value = '';
    selectors.fields.materia.innerHTML = '<option value="">Selecione o curso primeiro</option>';
    selectors.fields.materia.disabled = true;

    if (evData) {
      selectors.fields.data.value    = evData.date;
      selectors.fields.start.value   = evData.start;
      selectors.fields.end.value     = evData.end;
      selectors.fields.recurso.value = evData.resource;
      selectors.fields.recurso.dispatchEvent(new Event('change'));
      selectors.fields.sala.value    = evData.sala || '';
      selectors.fields.type.value    = evData.type;
      selectors.fields.resp.value    = evData.responsible;
      selectors.fields.dept.value    = evData.department;
      selectors.fields.status.value  = evData.status;
      selectors.fields.desc.value    = evData.description;

      // se vier materia, preencher
      if (evData.materia) {
        selectors.fields.materia.innerHTML = `<option>${evData.materia}</option>`;
        selectors.fields.materia.disabled = false;
      }
    }

    if (!currentId) {
      const user = Auth.getCurrentUser();
      if (user?.name) {
        selectors.fields.resp.value = user.name;
        selectors.fields.resp.setAttribute('readonly', 'readonly');
      }
    }

    selectors.modal.classList.remove('hidden');
  }

  function close() {
    selectors.modal.classList.add('hidden');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const f = selectors.fields;
    const payload = {
      date:        f.data.value,
      start:       f.start.value,
      end:         f.end.value,
      resource:    f.recurso.value,
      sala:        f.salaContainer.classList.contains('hidden') ? '' : f.sala.value,
      type:        f.type.value,
      responsible: f.resp.value,
      department:  f.dept.value,
      materia:     f.materia.value,
      status:      f.status.value,
      description: f.desc.value,
      time:        `${f.start.value}-${f.end.value}`,
      title:       f.salaContainer.classList.contains('hidden')
                    ? f.type.value
                    : `${f.type.value} - ${f.sala.value}`
    };

    (async () => {
      try {
        let saved;
        if (currentId) {
          saved = await Api.updateEvent(currentId, payload);
          CalendarModule.update(currentId, saved);
        } else {
          saved = await Api.createEvent(payload);
          CalendarModule.add(saved);
        }
        close();
      } catch (err) {
        alert(err.message);
      }
    })();
  }

  function init() {
    cacheSelectors();

    selectors.fields.materia.innerHTML = '<option value="">Selecione o curso primeiro</option>';
    selectors.fields.materia.disabled = true;

    selectors.btnOpen?.addEventListener('click', () => open());
    selectors.btnClose?.addEventListener('click', close);
    selectors.form?.addEventListener('submit', handleSubmit);

    const salaOpts = {
      'Laboratório': ['Lab401','Lab402','Lab403'],
      'Sala de Aula': ['Sala101','Sala102','Sala103'],
      'Auditório': ['Auditório A','Auditório B']
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
        /* ... lista de disciplinas ... */
      ]
    };
    selectors.fields.dept?.addEventListener('change', () => {
      const curso = selectors.fields.dept.value;
      const lista = courseMap[curso] || [];
      const sel   = selectors.fields.materia;
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
    selectors.modal     = document.getElementById('event-modal');
    selectors.btnClose  = document.getElementById('modal-close');
    selectors.btnEdit   = document.getElementById('modal-edit');
    selectors.btnDelete = document.getElementById('modal-cancel');
    selectors.fields    = {
      date:     document.getElementById('modal-date'),
      resource: document.getElementById('modal-resource'),
      type:     document.getElementById('modal-type'),
      resp:     document.getElementById('modal-resp'),
      dept:     document.getElementById('modal-dept'),
      materia:  document.getElementById('modal-materia'),
      status:   document.getElementById('modal-status'),
      desc:     document.getElementById('modal-desc')
    };
  }

  function open(ev) {
    currentId = ev._id;
    const f = selectors.fields;
    f.date.textContent     = `Data: ${ev.date} (${ev.time})`;
    f.resource.textContent = `Recurso: ${ev.resource}`;
    f.type.textContent     = `Evento: ${ev.type}`;
    f.resp.textContent     = `Responsável: ${ev.responsible}`;
    f.dept.textContent     = `Curso: ${ev.department}`;
    f.materia.textContent  = `Matéria: ${ev.materia || '—'}`;
    f.status.textContent   = `Status: ${ev.status}`;
    f.desc.textContent     = ev.description || 'Sem descrição';
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
      try { await Api.deleteEvent(currentId);
        CalendarModule.remove(currentId);
        close();
      } catch (err) { alert(err.message); }
    });
  }

  return { init, open };
})();

// ----------------------
// INICIALIZAÇÃO PRINCIPAL
// ----------------------
onReady(async () => {
  ThemeToggle.init();
  FormModule.init();
  DetailModule.init();

  const currentUser = Auth.getCurrentUser();
  let data = [];
  try {
    data = await Api.fetchEvents();
  } catch (err) {
    console.warn('Falha ao buscar reservas, iniciando calendário vazio', err);
  }

  CalendarModule.init(
    data,
    info => FormModule.open(null, {
      date:        info.dateStr,
      start:       '00:00',
      end:         '00:00',
      resource:    '',
      sala:        '',
      type:        '',
      responsible: '',
      department:  '',
      materia:     '',
      status:      '',
      description: '',
      time:        ''
    }),
    info => {
      const ev = CalendarModule.getEvents().find(e => e._id === info.event.id);
      if (ev) DetailModule.open(ev);
    }
  );

  // controle UI por papel
  if (currentUser?.role === 'student') {
    document.getElementById('open-form-modal')?.style.display = 'none';
    document.getElementById('modal-edit')?.style.display       = 'none';
    document.getElementById('modal-cancel')?.style.display     = 'none';
  }

  // ----------------------
  // MENU OFF-CANVAS / TOGGLE (estilo Rockstar)
  // ----------------------
  const menuToggle = document.getElementById('menu-toggle');
  const sideMenu   = document.getElementById('side-menu');
  const bars       = menuToggle.querySelectorAll('span');

  menuToggle.addEventListener('click', () => {
    const opened = sideMenu.classList.toggle('show');
    document.body.classList.toggle('menu-open', opened);

    if (opened) {
      bars[0].classList.add('rotate-45', 'translate-y-1.5');
      bars[1].classList.add('-rotate-45', '-translate-y-1.5');
    } else {
      bars[0].classList.remove('rotate-45', 'translate-y-1.5');
      bars[1].classList.remove('-rotate-45', '-translate-y-1.5');
    }
  });
});
