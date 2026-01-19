(() => {
  'use strict';

  const API_TAREAS = '/api/tareas';
  const API_ALQUILERES = '/api/alquileres';
  const API_CLIENTES = '/api/clientes';
  const API_UNIDADES = '/api/unidades';
  const LS_REMINDERS = 'ap_recordatorios';

  let calendarInstance = null;
  let clientesCache = [];
  let unidadesCache = [];

  document.addEventListener('DOMContentLoaded', async () => {
    // Cargar clientes para enriquecer datos si es necesario
    try {
      const res = await fetch(API_CLIENTES);
      if (res.ok) clientesCache = await res.json();
    } catch (e) {}

    initCalendarLogic();
    
    // Cargar unidades y lógica de gestión
    await loadUnidades();
    initUnidadesLogic();

    const filtro = document.getElementById('filtroTipo');
    if (filtro) filtro.addEventListener('change', renderUnidades);

    // Inicializar Recordatorios
    renderRemindersList();
    initRemindersLogic();
  });

  function initCalendarLogic() {
    const btnAbrir = document.getElementById('btnCalendario');
    const modal = document.getElementById('modalCalendarioGrande');
    const btnCerrar = document.getElementById('btnCerrarCalendario');
    const calendarEl = document.getElementById('calendar');

    if (!btnAbrir || !modal || !calendarEl) return;

    // Abrir Modal
    btnAbrir.addEventListener('click', () => {
      modal.classList.remove('hidden');
      
      if (!calendarInstance) {
        // Inicializar FullCalendar
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          locale: 'es',
          buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            list: 'Agenda'
          },
          allDayText: 'Todo el día',
          noEventsText: 'No hay eventos para mostrar',
          headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
          },
          height: '100%',
          events: fetchEvents, // Función para cargar datos
          eventClick: handleEventClick,
          eventTimeFormat: { // Formato hora
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
          }
        });
        calendarInstance.render();
      } else {
        // Si ya existe, forzar render para ajustar tamaño al modal
        setTimeout(() => {
          calendarInstance.render();
          calendarInstance.refetchEvents(); // Recargar datos por si hubo cambios
        }, 100);
      }
    });

    // Cerrar Modal
    const cerrar = () => modal.classList.add('hidden');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrar);
  }

  // Función que FullCalendar llama para obtener eventos
  async function fetchEvents(info, successCallback, failureCallback) {
    try {
      // Cargar Tareas y Alquileres en paralelo
      const [resTareas, resAlquileres] = await Promise.all([
        fetch(API_TAREAS),
        fetch(API_ALQUILERES)
      ]);

      const tareas = resTareas.ok ? await resTareas.json() : [];
      const alquileres = resAlquileres.ok ? await resAlquileres.json() : [];

      const eventos = [];

      // 0. Mapear RECORDATORIOS (LocalStorage)
      const reminders = loadReminders();
      reminders.forEach(r => {
          eventos.push({
              id: r.id,
              title: r.title,
              start: r.start,
              allDay: true,
              backgroundColor: '#ff9f89', // Color salmón distintivo
              borderColor: '#ff9f89',
              extendedProps: { tipo: 'RECORDATORIO', detalle: r.title }
          });
      });

      // 1. Mapear TAREAS (Puntos en el tiempo)
      tareas.forEach(t => {
        const empNombre = t.usuario ? `${t.usuario.nombre} ${t.usuario.apellido}` : 'Sin asignar';
        const ubicacion = t.alquiler ? t.alquiler.ubicacion : '';
        const color = t.completada ? '#28a745' : '#ec1f26'; // Verde o Rojo
        
        eventos.push({
          id: `tarea-${t.idTarea || t.id}`,
          title: `Tarea: ${empNombre}`,
          start: t.fecha,
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            tipo: 'TAREA',
            detalle: `Ubicación: ${ubicacion}\nEstado: ${t.completada ? 'Completada' : 'Pendiente'}`
          }
        });
      });

      // 2. Mapear ALQUILERES (Rangos de fecha)
      alquileres.forEach(a => {
        // Buscar nombre cliente
        const c = clientesCache.find(x => x.idCliente == a.idCliente);
        const clienteNombre = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
        
        if (a.fechaDesde && a.fechaHasta) {
          // Ajustar fecha fin (FullCalendar es exclusivo en end date, sumamos 1 día visualmente si es allDay)
          const fechaFin = new Date(a.fechaHasta);
          fechaFin.setDate(fechaFin.getDate() + 1);

          eventos.push({
            id: `alq-${a.idAlquiler}`,
            title: `Alquiler: ${clienteNombre}`,
            start: a.fechaDesde,
            end: fechaFin.toISOString().split('T')[0],
            allDay: true,
            backgroundColor: '#3788d8', // Azul
            borderColor: '#3788d8',
            extendedProps: {
              tipo: 'ALQUILER',
              detalle: `Ubicación: ${a.ubicacion}\nEstado: ${a.estado}`
            }
          });
        }
      });

      successCallback(eventos);
    } catch (e) {
      console.error("Error cargando calendario", e);
      failureCallback(e);
    }
  }

  async function handleEventClick(info) {
    const props = info.event.extendedProps;
    if (props.tipo === 'RECORDATORIO') {
        if (await window.confirmAction('¿Eliminar recordatorio?', 'Se borrará de la lista.')) {
            deleteReminder(info.event.id);
        }
    } else {
        window.showAlert(info.event.title, props.detalle, 'info');
    }
  }

  // =========================================================
  // LÓGICA DE UNIDADES (GRILLA Y GESTIÓN)
  // =========================================================

  async function loadUnidades() {
    try {
      const res = await fetch(`${API_UNIDADES}/resumen`);
      if (res.ok) {
        unidadesCache = await res.json();
        renderUnidades();
      }
    } catch (e) { console.error(e); }
  }

  function renderUnidades() {
    const tbody = document.getElementById('tbodyUnidades');
    const filtro = document.getElementById('filtroTipo');
    if (!tbody) return;

    let data = unidadesCache;
    if (filtro) {
        const val = filtro.value;
        if (val === 'banios') data = data.filter(u => u.nombre.toLowerCase().includes('baño'));
        if (val === 'cabinas') data = data.filter(u => u.nombre.toLowerCase().includes('cabina'));
    }

    tbody.innerHTML = data.map(u => `
      <tr>
        <td>${u.nombre}</td>
        <td><span style="font-weight:bold; color:green;">${u.disponibles}</span></td>
        <td><span style="font-weight:bold; color:orange;">${u.alquiladas}</span></td>
        <td><span style="font-weight:bold; color:red;">${u.servicio}</span></td>
        <td>$${(u.precio || 0).toLocaleString()}</td>
        <td>
          <button class="action danger" data-accion="${u.idTipo}" data-nombre="${u.nombre}" data-precio="${u.precio}">Editar</button>
        </td>
      </tr>
    `).join('');
  }

  async function loadTiposUnidad() {
      try {
          const res = await fetch(`${API_UNIDADES}/tipos`);
          if (res.ok) {
              const tipos = await res.json();
              const sel = document.getElementById('tipoUnidad');
              if (sel) {
                  sel.innerHTML = tipos.map(t => `<option value="${t.idTipo}">${t.nombre}</option>`).join('');
              }
          }
      } catch (e) { console.error(e); }
  }

  function initUnidadesLogic() {
    // Referencias DOM
    const btnGestion = document.getElementById('btnGestionUnidades');
    const modalGestion = document.getElementById('modalGestionUnidades');
    const btnCerrarGestion = document.getElementById('btnCerrarGestionUnidades');
    const formGestion = document.getElementById('formGestionUnidades');
    
    const btnNuevoTipo = document.getElementById('btnAbrirNuevoTipoUnidad');
    const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');
    const btnCerrarNuevoTipo = document.getElementById('btnCerrarNuevoTipoUnidad');
    const formNuevoTipo = document.getElementById('formNuevoTipoUnidad');

    const modalAcciones = document.getElementById('modalAccionesUnidad');
    const btnCerrarAcciones = document.getElementById('btnCerrarAcciones');
    const formAcciones = document.getElementById('formAccionesStock');
    const btnGuardarPrecio = document.getElementById('btnGuardarPrecio');
    const selAccion = document.getElementById('accionStock');

    // Eventos Modales
    if (btnGestion) btnGestion.addEventListener('click', () => {
        loadTiposUnidad();
        modalGestion.classList.remove('hidden');
    });
    if (btnCerrarGestion) btnCerrarGestion.addEventListener('click', () => modalGestion.classList.add('hidden'));

    if (btnNuevoTipo) btnNuevoTipo.addEventListener('click', () => modalNuevoTipo.classList.remove('hidden'));
    if (btnCerrarNuevoTipo) btnCerrarNuevoTipo.addEventListener('click', () => modalNuevoTipo.classList.add('hidden'));

    if (btnCerrarAcciones) btnCerrarAcciones.addEventListener('click', () => modalAcciones.classList.add('hidden'));

    // Nuevo Tipo
    if (formNuevoTipo) formNuevoTipo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombreNuevoTipoUnidad').value;
        if (!nombre) return window.showAlert('Error', 'Nombre requerido', 'error');
        
        try {
            const res = await fetch(`${API_UNIDADES}/tipos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });
            if (res.ok) {
                window.showAlert('Éxito', 'Tipo creado', 'success');
                modalNuevoTipo.classList.add('hidden');
                loadTiposUnidad();
            }
        } catch (e) { console.error(e); }
    });

    // Gestionar Stock (Agregar/Actualizar)
    if (formGestion) formGestion.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idTipo = document.getElementById('tipoUnidad').value;
        const cantidad = document.getElementById('cantidadUnidad').value;
        const estado = document.getElementById('estadoUnidad').value;
        const precio = document.getElementById('precioUnidad').value;

        if (!idTipo || !cantidad) return window.showAlert('Error', 'Completar campos', 'error');

        try {
            const res = await fetch(`${API_UNIDADES}/gestion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idTipo, stock: cantidad, estado, precio })
            });
            if (res.ok) {
                window.showAlert('Éxito', 'Stock actualizado', 'success');
                modalGestion.classList.add('hidden');
                loadUnidades();
            }
        } catch (e) { console.error(e); }
    });

    // Acciones Stock (Mover/Baja) y Precio
    if (selAccion) selAccion.addEventListener('change', () => {
        const val = selAccion.value;
        document.getElementById('bloqueMover').classList.toggle('hidden', val !== 'mover');
        document.getElementById('bloqueEliminar').classList.toggle('hidden', val !== 'baja');
    });

    if (formAcciones) formAcciones.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idTipo = document.getElementById('idTipoAccion').value;
        const accion = selAccion.value;
        const cantidad = document.getElementById('stockCantidad').value;
        
        const payload = { idTipo, accion, stock: cantidad };
        if (accion === 'mover') {
            payload.origen = document.getElementById('stockOrigen').value;
            payload.destino = document.getElementById('stockDestino').value;
        } else {
            payload.estado = document.getElementById('stockEliminar').value;
        }

        try {
            const res = await fetch(`${API_UNIDADES}/gestion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                window.showAlert('Éxito', 'Cambio realizado', 'success');
                modalAcciones.classList.add('hidden');
                loadUnidades();
            } else {
                const err = await res.json();
                window.showAlert('Error', err.error, 'error');
            }
        } catch (e) { console.error(e); }
    });

    if (btnGuardarPrecio) btnGuardarPrecio.addEventListener('click', async () => {
        const idTipo = document.getElementById('idTipoAccion').value;
        const precio = document.getElementById('editPrecio').value;
        try {
            const res = await fetch(`${API_UNIDADES}/gestion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idTipo, accion: 'precio', precio })
            });
            if (res.ok) {
                window.showAlert('Éxito', 'Precio actualizado', 'success');
                loadUnidades();
            }
        } catch (e) { console.error(e); }
    });

    // Click en tabla (Abrir acciones)
    const tbody = document.getElementById('tbodyUnidades');
    if (tbody) tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (btn) {
            const { accion, nombre, precio } = btn.dataset;
            document.getElementById('idTipoAccion').value = accion;
            document.getElementById('lblNombreUnidad').textContent = nombre;
            document.getElementById('editPrecio').value = precio;
            modalAcciones.classList.remove('hidden');
        }
    });
  }

  // =========================================================
  // LÓGICA DE RECORDATORIOS
  // =========================================================

  function loadReminders() {
    try {
      return JSON.parse(localStorage.getItem(LS_REMINDERS) || '[]');
    } catch { return []; }
  }

  function saveReminders(list) {
    localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
    renderRemindersList();
    if (calendarInstance) calendarInstance.refetchEvents();
  }

  function deleteReminder(id) {
      let list = loadReminders();
      list = list.filter(r => r.id !== id);
      saveReminders(list);
  }

  function renderRemindersList() {
      const list = loadReminders();
      // Ordenar por fecha
      list.sort((a,b) => new Date(a.start) - new Date(b.start));
      
      const ul = document.getElementById('listaRecordatorios');
      if(!ul) return;
      
      if(list.length === 0) {
          ul.innerHTML = '<li style="text-align:center; color:#777; padding:10px;">No hay recordatorios pendientes.</li>';
          return;
      }

      ul.innerHTML = list.map(r => {
          const [y,m,d] = r.start.split('-');
          const fechaFmt = `${d}/${m}`;
          return `
          <li>
              <span style="font-weight:600; color:var(--rojo); min-width:45px;">${fechaFmt}</span>
              <span style="flex:1;">${r.title}</span>
              <button class="btn-icon-delete" data-del-rec="${r.id}" title="Eliminar">🗑</button>
          </li>
      `}).join('');
  }

  function initRemindersLogic() {
      const modal = document.getElementById('modalRecordatorio');
      const form = document.getElementById('formRecordatorio');
      const btnCerrar = document.getElementById('btnCerrarRecordatorio');
      const ul = document.getElementById('listaRecordatorios');
      const btnNuevo = document.getElementById('btnNuevoRecordatorio');

      if(btnCerrar) btnCerrar.addEventListener('click', () => modal.classList.add('hidden'));
      
      if(btnNuevo) btnNuevo.addEventListener('click', () => {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          openModalRecordatorio(`${y}-${m}-${d}`);
      });
      
      if(form) form.addEventListener('submit', e => {
          e.preventDefault();
          const txt = document.getElementById('textoRecordatorio').value;
          const fecha = document.getElementById('fechaRecordatorio').value;
          if(txt && fecha) {
              const list = loadReminders();
              list.push({ id: 'rec-'+Date.now(), title: txt, start: fecha });
              saveReminders(list);
              modal.classList.add('hidden');
              document.getElementById('textoRecordatorio').value = '';
          }
      });

      if(ul) ul.addEventListener('click', async e => {
          const btn = e.target.closest('.btn-icon-delete');
          if(btn) {
              const id = btn.dataset.delRec;
              if(await window.confirmAction('¿Eliminar?', '')) {
                  deleteReminder(id);
              }
          }
      });
  }

  function openModalRecordatorio(dateStr) {
      const modal = document.getElementById('modalRecordatorio');
      const inpFecha = document.getElementById('fechaRecordatorio');
      
      if(modal && inpFecha) {
          inpFecha.value = dateStr;
          modal.classList.remove('hidden');
      }
  }

})();