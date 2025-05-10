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
    selectors.fields.salaContainer.classList.add('hidden');

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
    selectors.btnOpen?.addEventListener('click', () => open());
    selectors.btnClose?.addEventListener('click', close);
    selectors.form?.addEventListener('submit', handleSubmit);

    // mapa de salas
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

    // mapa de cursos × matérias (Computação com todas as ARA)
    const courseMap = {
      'Computação': [
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
      ],
      // adicione outros cursos aqui...
    };

    selectors.fields.dept?.addEventListener('change', () => {
      const curso = selectors.fields.dept.value;
      const lista = courseMap[curso] || [];
      const sel   = selectors.fields.materia;
      sel.innerHTML = lista.length
        ? '<option value="">Selecione a matéria...</option>' +
          lista.map(m => `<option value="${m}">${m}</option>`).join('')
        : '<option value="">Digite primeiro um curso válido</option>';
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
    f.dept.textContent     = `Departamento: ${ev.department}`;
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
      try {
        await Api.deleteEvent(currentId);
        CalendarModule.remove(currentId);
        close();
      } catch (err) {
        alert(err.message);
      }
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
      status:      '',
      description: '',
      time:        ''
    }),
    info => {
      const ev = CalendarModule.getEvents().find(e => e._id === info.event.id);
      if (ev) DetailModule.open(ev);
    }
  );

  // ——— controle de UI por papel ———
  const role = currentUser?.role?.toLowerCase();
  if (role === 'student') {
    document.getElementById('open-form-modal')?.style.setProperty('display','none');
    document.getElementById('modal-edit')?.style.setProperty('display','none');
    document.getElementById('modal-cancel')?.style.setProperty('display','none');
  }
});
