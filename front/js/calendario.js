// front/js/calendario.js

document.addEventListener('DOMContentLoaded', () => {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || !window.FullCalendar) return;

  const LS_KEY = 'ap_recordatorios';

  // --------- helpers storage ----------
  function loadEvents() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEvents(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  // --------- eventos iniciales ----------
  let events = loadEvents();

  if (!events.length) {
    events = [
      { id: 'rec-1', title: 'Cobranza Juan Pérez (Contrato #1823)', start: '2025-05-25', allDay: true },
      { id: 'rec-2', title: 'Retiro baños químicos (3) – Manantiales', start: '2025-05-14', allDay: true },
      { id: 'rec-3', title: 'Evento social – 2 baños estándar', start: '2025-05-19', allDay: true },
      { id: 'rec-4', title: 'Reunión con cliente Galván', start: '2025-05-04', allDay: true }
    ];
    saveEvents(events);
  }

  // --------- refs modal NUEVO recordatorio ----------
  const modalOverlay = document.getElementById('modalRecordatorio');
  const formRecordatorio = document.getElementById('formRecordatorio');
  const fechaTextoEl = document.getElementById('modalFechaTexto');
  const textoRecordatorioEl = document.getElementById('textoRecordatorio');
  const btnCerrarRecordatorio = document.getElementById('btnCerrarRecordatorio');

  let selectedDateStr = null; // YYYY-MM-DD

  function openModalNuevo(fechaISO) {
    selectedDateStr = fechaISO;
    const fechaBonita = new Date(fechaISO).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    fechaTextoEl.textContent = fechaBonita;
    textoRecordatorioEl.value = '';
    modalOverlay.classList.remove('hidden');
  }

  function closeModalNuevo() {
    modalOverlay.classList.add('hidden');
    selectedDateStr = null;
    textoRecordatorioEl.value = '';
  }

  btnCerrarRecordatorio?.addEventListener('click', () => {
    closeModalNuevo();
  });

  // --------- refs modal ELIMINAR recordatorio ----------
  const modalEliminar = document.getElementById('modalEliminarRecordatorio');
  const textoEliminarEl = document.getElementById('textoEliminarRecordatorio');
  const btnCancelarEliminar = document.getElementById('btnCancelarEliminarRec');
  const btnConfirmarEliminar = document.getElementById('btnConfirmarEliminarRec');

  let eventToDelete = null; // instancia de FullCalendar Event

  function openModalEliminar(fcEvent) {
    eventToDelete = fcEvent;
    textoEliminarEl.textContent =
      `¿Seguro que querés eliminar el recordatorio:\n“${fcEvent.title}”?`;
    modalEliminar.classList.remove('hidden');
  }

  function closeModalEliminar() {
    modalEliminar.classList.add('hidden');
    eventToDelete = null;
  }

  btnCancelarEliminar?.addEventListener('click', () => {
    closeModalEliminar();
  });

  btnConfirmarEliminar?.addEventListener('click', () => {
    if (!eventToDelete) return;

    const id = eventToDelete.id;
    eventToDelete.remove();
    events = events.filter(e => e.id !== id);
    saveEvents(events);

    closeModalEliminar();
  });

  // --------- cerrar modales con ESC ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModalNuevo();
      closeModalEliminar();
    }
  });

  // --------- submit modal NUEVO ----------
  formRecordatorio?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedDateStr) return;

    const texto = textoRecordatorioEl.value.trim();
    if (!texto) {
      alert('Ingresá un detalle para el recordatorio.');
      return;
    }

    const id = 'rec-' + Date.now();
    const nuevo = {
      id,
      title: texto,
      start: selectedDateStr,
      allDay: true
    };

    calendar.addEvent(nuevo);
    events.push(nuevo);
    saveEvents(events);
    closeModalNuevo();
  });

  // --------- calendario ----------
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    initialDate: new Date(),
    locale: 'es',
    buttonText: {
      today: 'Hoy'
    },
    headerToolbar: {
      left: 'prevYear,prev today next,nextYear',
      center: 'title',
      right: ''
    },
    customButtons: {
      prevYear: {
        text: '« Año',
        click() {
          calendar.prevYear();
        }
      },
      nextYear: {
        text: 'Año »',
        click() {
          calendar.nextYear();
        }
      }
    },
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    events,

    // click en día -> abrir modal NUEVO
    dateClick(info) {
      openModalNuevo(info.dateStr);
    },

    // click en evento -> abrir modal ELIMINAR
    eventClick(info) {
      openModalEliminar(info.event);
    }
  });

  calendar.render();
});
