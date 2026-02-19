(() => {
  'use strict';

  const API_TAREAS = '/api/tareas';
  const API_ALQUILERES = '/api/alquileres';
  const API_RECORDATORIOS = '/api/recordatorios';
  const API_CLIENTES = '/api/clientes';
  const API_UNIDADES = '/api/unidades';

  let calendarInstance = null;
  let clientesCache = [];
  let unidadesCache = [];

  function getHeaders() {
    const token = localStorage.getItem('ap_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const h = getHeaders();
      const [resC] = await Promise.all([
        fetch(API_CLIENTES, { headers: h })
      ]);
      if (resC.ok) clientesCache = await resC.json();
      
      await loadTiposUnidad(); 
      await renderRemindersList(); 
      initCalendarLogic();
      await loadUnidades();
      initUnidadesLogic();

      const filtro = document.getElementById('filtroTipo');
      if (filtro) filtro.addEventListener('change', renderUnidades);

      initRemindersLogic();
    } catch (e) { console.error("Error en inicio:", e); }
  });

  // =========================================================
  // AGENDA UNIFICADA (LADO DERECHO)
  // =========================================================
  async function renderRemindersList() {
    const ul = document.getElementById('listaRecordatorios');
    if (!ul) return;

    try {
      const h = getHeaders();
      const [resA, resR] = await Promise.all([
        fetch(`${API_ALQUILERES}?t=${Date.now()}`, { headers: h }),
        fetch(`${API_RECORDATORIOS}?t=${Date.now()}`, { headers: h })
      ]);

      const alquileres = resA.ok ? await resA.json() : [];
      const recordatorios = resR.ok ? await resR.json() : [];

      const ahora = new Date();
      const hoyNum = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();

      let agendaTotal = [
        ...recordatorios.map(r => ({
          id: r.id, 
          fecha: r.fecha, 
          texto: r.descripcion,
          tipo: 'REC'
        }))
      ];

      alquileres.forEach(a => {
        const c = clientesCache.find(x => String(x.idCliente) === String(a.idCliente));
        const nom = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
        
        // Verificamos si ya fue entregado
        const estaEntregado = (a.estado === 'ENTREGADO' || a.estado === 'SERVICIO PENDIENTE');

        // A. Entrega: Solo mostrar si NO fue entregado aún
        if (a.fechaDesde && !estaEntregado) {
          agendaTotal.push({
            id: `ent-${a.idAlquiler}`,
            fecha: a.fechaDesde,
            texto: nom,
            tipo: 'ALQ_ENT'
          });
        }

        // B. Retiro: Mostrar siempre (porque es a futuro)
        if (a.fechaHasta) {
          agendaTotal.push({
            id: `ret-${a.idAlquiler}`,
            fecha: a.fechaHasta,
            texto: nom,
            tipo: 'ALQ_RET'
          });
        }
      });

      const agendaFinal = agendaTotal.filter(e => {
        if (!e.fecha) return false;
        const p = e.fecha.split('-');
        const fechaEventoNum = new Date(p[0], p[1] - 1, p[2]).getTime();
        return fechaEventoNum >= hoyNum;
      }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 4);

      if (agendaFinal.length === 0) {
        ul.innerHTML = '<li style="text-align:center; padding:20px; color:#999;">No hay eventos próximos.</li>';
        return;
      }

      ul.innerHTML = agendaFinal.map(e => {
        const p = e.fecha.split('-');
        const diaMes = `${p[2]}/${p[1]}`;
        
        let color = '#ff9f89'; 
        let prefijo = '';
        let icono = '📌';

        if (e.tipo === 'ALQ_ENT') {
          color = '#28a745'; // Verde para Entrega
          prefijo = 'Entrega: ';
          icono = '🚚';
        } else if (e.tipo === 'ALQ_RET') {
          color = '#3788d8'; // Celeste para Retiro
          prefijo = 'Retiro: ';
          icono = '🧹';
        }

        const textoFinal = `${prefijo}${e.texto}`;

        return `
          <li style="border-left: 5px solid ${color}; padding: 12px; margin-bottom: 10px; background: #fff; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); list-style:none; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
            <div style="min-width: 0; flex: 1;">
              <span style="font-weight:bold; color:${color}; font-size: 0.75em; display: block; margin-bottom: 4px;">
                  ${diaMes} ${icono}
              </span>
              <div style="font-size: 0.95em; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;" title="${textoFinal}">
                  ${textoFinal}
              </div>
            </div>
            ${e.tipo === 'REC' ? `
              <button onclick="window.borrarRecordatorio('${e.id}')" 
                      style="background: #f5f5f5; border: none; color: #333; cursor: pointer; padding: 4px 8px; font-size: 1.1em; line-height: 1; border-radius: 4px; font-weight: bold;">
                  &times;
              </button>` : ''}
          </li>`;
      }).join('');
    } catch (e) { console.error("Error Agenda:", e); }
  }

  // =========================================================
  // LÓGICA DEL CALENDARIO
  // =========================================================
  function initCalendarLogic() {
    const btnAbrir = document.getElementById('btnCalendario');
    const modal = document.getElementById('modalCalendarioGrande');
    const btnCerrar = document.getElementById('btnCerrarCalendario');
    const calendarEl = document.getElementById('calendar');

    if (!btnAbrir || !modal || !calendarEl) return;

    btnAbrir.addEventListener('click', () => {
      modal.classList.remove('hidden');
      if (!calendarInstance) {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          locale: 'es',
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' },
          events: fetchAllEvents,
          dateClick: (info) => openModalRecordatorio(info.dateStr),
          eventClick: handleEventClick
        });
        calendarInstance.render();
      } else {
        setTimeout(() => {
          calendarInstance.updateSize();
          calendarInstance.refetchEvents();
        }, 100);
      }
    });
    if (btnCerrar) btnCerrar.addEventListener('click', () => modal.classList.add('hidden'));
  }

  async function fetchAllEvents(info, successCallback, failureCallback) {
    try {
      const h = getHeaders();
      const [resA, resT, resR] = await Promise.all([
        fetch(API_ALQUILERES, { headers: h }),
        fetch(API_TAREAS, { headers: h }),
        fetch(API_RECORDATORIOS, { headers: h })
      ]);
      const alquileres = resA.ok ? await resA.json() : [];
      const tareas = resT.ok ? await resT.json() : [];
      const recordatoriosBD = resR.ok ? await resR.json() : [];
      
      const eventosFinales = [];

      // A. Recordatorios (Puntos)
      recordatoriosBD.forEach(r => {
        eventosFinales.push({
          id: r.id,
          title: `📌 ${r.descripcion}`,
          start: r.fecha,
          allDay: true,
          backgroundColor: '#ff9f89',
          borderColor: '#ff9f89',
          extendedProps: { tipo: 'RECORDATORIO' }
        });
      });

      // B. Alquileres (Barras de corrido)
      alquileres.forEach(a => {
        const c = clientesCache.find(x => String(x.idCliente) === String(a.idCliente));
        const nom = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
        
        if (a.fechaDesde && a.fechaHasta) {
            const fFin = new Date(a.fechaHasta);
            fFin.setDate(fFin.getDate() + 1);

            eventosFinales.push({
                id: `alq-${a.idAlquiler}`,
                title: `Alquiler: ${nom}`,
                start: a.fechaDesde,
                end: fFin.toISOString().split('T')[0],
                backgroundColor: '#3788d8',
                borderColor: '#3788d8',
                extendedProps: { tipo: 'ALQUILER', detalle: `Ubicación: ${a.ubicacion}` }
            });
        }
      });

      // C. Tareas
      tareas.forEach(t => {
        eventosFinales.push({
          title: `Tarea: ${t.usuario?.nombre || 'Pendiente'}`,
          start: t.fecha,
          backgroundColor: t.completada ? '#28a745' : '#ec1f26',
          extendedProps: { tipo: 'TAREA', detalle: t.descripcion }
        });
      });

      successCallback(eventosFinales);
    } catch (e) { failureCallback(e); }
  }

  // =========================================================
  // GESTIÓN DE RECORDATORIOS
  // =========================================================
  function initRemindersLogic() {
    const form = document.getElementById('formRecordatorio');
    const btnNuevo = document.getElementById('btnNuevoRecordatorio');
    const modal = document.getElementById('modalRecordatorio'); 
    const btnCerrar = document.getElementById('btnCerrarRecordatorio'); 

    if (btnNuevo) btnNuevo.addEventListener('click', () => openModalRecordatorio(new Date().toISOString().split('T')[0]));

    if (btnCerrar && modal) {
      btnCerrar.addEventListener('click', () => {
        modal.classList.add('hidden');
        form.reset(); 
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userSession = JSON.parse(localStorage.getItem('ap_current') || '{}');
        const payload = {
          fecha: document.getElementById('fechaRecordatorio').value,
          descripcion: document.getElementById('textoRecordatorio').value,
          idUsuarios: userSession.id || userSession.idUsuarios 
        };
        try {
          const res = await fetch(API_RECORDATORIOS, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            window.showAlert('Éxito', 'Guardado', 'success');
            document.getElementById('modalRecordatorio').classList.add('hidden');
            form.reset();
            await renderRemindersList(); 
            if (calendarInstance) calendarInstance.refetchEvents(); 
          }
        } catch (e) { console.error(e); }
      });
    }
  }

  window.borrarRecordatorio = async (id) => {
    if (await window.confirmAction('¿Eliminar?', 'Se borrará de la base de datos.')) {
      const res = await fetch(`${API_RECORDATORIOS}/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) {
        await renderRemindersList();
        if (calendarInstance) calendarInstance.refetchEvents();
      }
    }
  };

  async function handleEventClick(info) {
    const props = info.event.extendedProps;
    if (props.tipo === 'RECORDATORIO') {
      window.borrarRecordatorio(info.event.id);
    } else {
      window.showAlert(info.event.title, props.detalle || 'Sin descripción', 'info');
    }
  }

  function openModalRecordatorio(dateStr) {
    const modal = document.getElementById('modalRecordatorio');
    const inpFecha = document.getElementById('fechaRecordatorio');
    if (modal && inpFecha) {
      inpFecha.value = dateStr.split('T')[0];
      modal.classList.remove('hidden');
      modal.style.zIndex = "2000"; 
    }
  }

  // =========================================================
  // LÓGICA DE UNIDADES
  // =========================================================
  async function loadUnidades() {
    try {
      const res = await fetch(`/api/unidades/resumen`, { headers: getHeaders() });
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
    if (filtro && filtro.value !== 'todos') {
        data = data.filter(u => String(u.idTipo) === String(filtro.value));
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay unidades registradas</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(u => {
        const colorDisp = u.disponibles > 0 ? 'green' : 'red';
        return `
          <tr>
            <td style="font-weight: 500;">${u.nombre}</td>
            <td><span style="font-weight:bold; color:${colorDisp};">${u.disponibles}</span></td>
            <td>
                <span style="font-weight:bold; color:orange; cursor:pointer; text-decoration:underline;" 
                      onclick="window.verDetalleAlquiladas('${u.idTipo}', '${u.nombre}')">
                    ${u.alquiladas}
                </span>
            </td>
            <td><span style="font-weight:bold; color:#666;">${u.servicio}</span></td>
            <td>$${(u.precio || 0).toLocaleString('es-AR')}</td>
            <td>
              <button class="action danger" data-accion="${u.idTipo}" data-nombre="${u.nombre}" data-precio="${u.precio}">
                Editar
              </button>
            </td>
          </tr>`;
    }).join('');
  }

  async function loadTiposUnidad() {
    try {
        const res = await fetch(`${API_UNIDADES}/tipos`, { headers: getHeaders() });
        if (res.ok) {
            const tipos = await res.json();
            const selModal = document.getElementById('tipoUnidad');
            if (selModal) selModal.innerHTML = tipos.map(t => `<option value="${t.idTipo}">${t.nombre}</option>`).join('');
            const selFiltro = document.getElementById('filtroTipo');
            if (selFiltro) selFiltro.innerHTML = `<option value="todos">Todos</option>` + tipos.map(t => `<option value="${t.idTipo}">${t.nombre}</option>`).join('');
        }
    } catch (e) { console.error(e); }
  }

  function initUnidadesLogic() {
    const btnGestion = document.getElementById('btnGestionUnidades');
    const modalGestion = document.getElementById('modalGestionUnidades');
    const btnCerrarGestion = document.getElementById('btnCerrarGestionUnidades');
    const formGestion = document.getElementById('formGestionUnidades');
    const modalAcciones = document.getElementById('modalAccionesUnidad');
    const btnCerrarAcciones = document.getElementById('btnCerrarAcciones');
    const formAcciones = document.getElementById('formAccionesStock');
    const btnGuardarPrecio = document.getElementById('btnGuardarPrecio');
    const selAccion = document.getElementById('accionStock');

    

    if (btnGestion && modalGestion) {
        btnGestion.addEventListener('click', async (e) => { 
            e.preventDefault(); 
            console.log("Clic detectado en el botón +");
            try {
                await loadTiposUnidad(); 
                modalGestion.classList.remove('hidden');
                modalGestion.style.display = 'flex'; 
                modalGestion.style.zIndex = '9999';
            } catch (err) {
                console.error("Error al abrir modal:", err);
            }
        });
    }

    if (btnCerrarGestion) {
        btnCerrarGestion.addEventListener('click', () => {
            modalGestion.classList.add('hidden');
            modalGestion.style.display = 'none';
        });
    }
    if (btnCerrarAcciones) btnCerrarAcciones.addEventListener('click', () => modalAcciones.classList.add('hidden'));

    if (formGestion) formGestion.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
          idTipo: document.getElementById('tipoUnidad').value,
          accion: 'alta',
          stock: parseInt(document.getElementById('cantidadUnidad').value),
          estado: document.getElementById('estadoUnidad').value,
          precio: document.getElementById('precioUnidad').value || null
      };
      try {
          const res = await fetch(`${API_UNIDADES}/gestion`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
          if (res.ok) { window.showAlert('Éxito', 'Stock actualizado', 'success'); modalGestion.classList.add('hidden'); formGestion.reset(); await loadUnidades(); }
      } catch (e) { console.error(e); }
    });

    if (selAccion) selAccion.addEventListener('change', () => {
        const val = selAccion.value;
        document.getElementById('bloqueMover').classList.toggle('hidden', val !== 'mover');
        document.getElementById('bloqueEliminar').classList.toggle('hidden', val !== 'baja');
    });

    if (formAcciones) formAcciones.addEventListener('submit', async (e) => {
        e.preventDefault();
        const accion = selAccion.value;
        const payload = { idTipo: document.getElementById('idTipoAccion').value, accion, stock: document.getElementById('stockCantidad').value };
        if (accion === 'mover') { payload.origen = document.getElementById('stockOrigen').value; payload.destino = document.getElementById('stockDestino').value; }
        else { payload.estado = document.getElementById('stockEliminar').value; }
        try {
            const res = await fetch(`${API_UNIDADES}/gestion`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
            if (res.ok) { window.showAlert('Éxito', 'Cambio realizado', 'success'); modalAcciones.classList.add('hidden'); loadUnidades(); }
        } catch (e) { console.error(e); }
    });

    if (btnGuardarPrecio) {
      btnGuardarPrecio.addEventListener('click', async () => {
          const precio = document.getElementById('editPrecio').value;
          if (precio === "" || parseFloat(precio) < 0) return window.showAlert('Atención', 'Precio inválido', 'warning');
          try {
              const res = await fetch(`${API_UNIDADES}/gestion`, {
                  method: 'POST', headers: getHeaders(),
                  body: JSON.stringify({ idTipo: document.getElementById('idTipoAccion').value, accion: 'precio', precio: parseFloat(precio), stock: 0 })
              });
              if (res.ok) { window.showAlert('Éxito', 'Precio actualizado', 'success'); await loadUnidades(); }
          } catch (e) { console.error(e); }
      });
    }

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

    // Dentro de initUnidadesLogic()
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'btnAbrirNuevoTipoUnidad') {
            e.preventDefault();
            
            const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');
            
            if (modalNuevoTipo) {
                modalNuevoTipo.classList.remove('hidden');

                Object.assign(modalNuevoTipo.style, {
                    display: 'flex',
                    zIndex: '10000', 
                    opacity: '1'  
                });
            }
        }

        if (e.target && e.target.id === 'btnCerrarNuevoTipoUnidad') {
            const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');
            if (modalNuevoTipo) {
                modalNuevoTipo.classList.add('hidden');
                modalNuevoTipo.style.display = 'none';
            }
        }
    });

    // 3. Lógica para guardar el nuevo tipo (el submit del segundo modal)
    const formNuevoTipo = document.getElementById('formNuevoTipoUnidad');
    if (formNuevoTipo) {
        formNuevoTipo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nombreNuevoTipoUnidad').value;
            
            try {
                const res = await fetch('/api/unidades/tipos', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ nombre })
                });

                if (res.ok) {
                    window.showAlert('Éxito', 'Tipo de unidad creado', 'success');
                    document.getElementById('modalNuevoTipoUnidad').classList.add('hidden');
                    formNuevoTipo.reset();
                    // Recargamos los combos para que aparezca el nuevo tipo
                    await loadTiposUnidad(); 
                } else {
                    const err = await res.json();
                    window.showAlert('Error', err.error, 'error');
                }
            } catch (error) {
                console.error(error);
            }
        });
    }
  }

  window.verDetalleAlquiladas = async (idTipo, nombre) => {
    const modal = document.getElementById('modalDetalleAlquiladas');
    const tbody = document.getElementById('tbodyDetalleAlquiladas');
    document.getElementById('nombreUnidadDetalle').textContent = nombre.toUpperCase();
    modal.classList.remove('hidden');
    try {
        const res = await fetch(`/api/unidades/${idTipo}/alquiladas`, { headers: getHeaders() });
        const data = await res.json();
        tbody.innerHTML = data.map(d => {
            const c = clientesCache.find(x => String(x.idCliente) === String(d.Alquileres.idCliente));
            const cli = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Desconocido';
            return `<tr><td>${cli}</td><td>${d.Alquileres.ubicacion || '-'}</td><td style="text-align:center;">${d.cantidad}</td><td>${d.Alquileres.fechaHasta.split('-').reverse().join('/')}</td></tr>`;
        }).join('');
    } catch (e) { console.error(e); }
  };

})();