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
      console.log("Datos iniciales cargados");

      // AGREGAMOS ESTO: Carga los tipos en ambos combobox
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

      console.log("DEBUG - Alquileres recibidos:", alquileres);

      const ahora = new Date();
      const hoyNum = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();

      let agendaTotal = [
        ...recordatorios.map(r => ({
          id: r.id, 
          fecha: r.fecha,
          texto: r.descripcion,
          tipo: 'REC'
        })),
        ...alquileres.map(a => {
          const c = clientesCache.find(x => String(x.idCliente) === String(a.idCliente));
          const nom = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
          return {
            id: a.idAlquiler,
            fecha: a.fechaDesde, 
            texto: `Alquiler: ${nom}`,
            tipo: 'ALQ'
          };
        })
      ];

      // Filtrar por fecha (hoy o futuro) y ordenar
      const agendaFiltrada = agendaTotal.filter(e => {
        if (!e.fecha) return false;
        const p = e.fecha.split('-');
        const fechaEventoNum = new Date(p[0], p[1] - 1, p[2]).getTime();
        return fechaEventoNum >= hoyNum;
      }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      const agendaFinal = agendaFiltrada.slice(0, 4);

      if (agendaFinal.length === 0) {
        ul.innerHTML = '<li style="text-align:center; padding:20px; color:#999;">No hay eventos próximos.</li>';
        return;
      }

      ul.innerHTML = agendaFinal.map(e => {
        const p = e.fecha.split('-');
        const diaMes = `${p[2]}/${p[1]}`;
        const esRec = e.tipo === 'REC';
        const color = esRec ? '#ff9f89' : '#3788d8';

        return `
          <li style="border-left: 5px solid ${color}; padding: 10px; margin-bottom: 8px; background: #fff; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); list-style:none;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight:bold; color:${color}; font-size: 0.8em;">${diaMes} ${esRec ? '📌' : '🗓️'}</span>
                <div style="font-size: 0.9em; color: #333;">${e.texto}</div>
              </div>
              ${esRec ? `<button class="btn-icon-delete" onclick="window.borrarRecordatorio('${e.id}')" style="background:none; border:none; color:#ddd; cursor:pointer;">🗑</button>` : ''}
            </div>
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
          selectable: true,
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
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
      const [resA, resR] = await Promise.all([
        fetch(API_ALQUILERES, { headers: h }),
        fetch(API_RECORDATORIOS, { headers: h })
      ]);
      const alquileres = resA.ok ? await resA.json() : [];
      const recordatoriosBD = resR.ok ? await resR.json() : [];
      
      const eventos = [
        ...alquileres.map(a => {
          const c = clientesCache.find(x => String(x.idCliente) === String(a.idCliente));
          const nom = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
          return {
            title: `Alquiler: ${nom}`,
            start: a.fechaDesde,
            end: a.fechaHasta,
            backgroundColor: '#3788d8',
            extendedProps: { tipo: 'ALQUILER', detalle: a.ubicacion }
          };
        }),
        ...recordatoriosBD.map(r => ({
          id: r.id,
          title: `📌 ${r.descripcion}`,
          start: r.fecha,
          allDay: true,
          backgroundColor: '#ff9f89',
          borderColor: '#ff9f89',
          extendedProps: { tipo: 'RECORDATORIO' }
        }))
      ];
      successCallback(eventos);
    } catch (e) { failureCallback(e); }
  }

  // =========================================================
  // GESTIÓN DE RECORDATORIOS
  // =========================================================
  function initRemindersLogic() {
    const form = document.getElementById('formRecordatorio');
    const btnNuevo = document.getElementById('btnNuevoRecordatorio');

    if (btnNuevo) {
      btnNuevo.addEventListener('click', () => {
        const now = new Date().toISOString().split('T')[0];
        openModalRecordatorio(now);
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
            window.showAlert('Éxito', 'Guardado correctamente', 'success');
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
      window.showAlert(info.event.title, props.detalle, 'info');
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
  // LÓGICA DE UNIDADES (GRILLA Y GESTIÓN)
  // =========================================================

  async function loadUnidades() {
    try {
      // Cargamos el resumen que agrupa por tipo de unidad
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
                      onclick="window.verDetalleAlquiladas('${u.idTipo}', '${u.nombre}')"
                      title="Hacer clic para ver quiénes tienen estas unidades">
                    ${u.alquiladas}
                </span>
            </td>
            <td><span style="font-weight:bold; color:#666;">${u.servicio}</span></td>
            <td>$${(u.precio || 0).toLocaleString('es-AR')}</td>
            <td>
              <button class="action danger" 
                      data-accion="${u.idTipo}" 
                      data-nombre="${u.nombre}" 
                      data-precio="${u.precio}">
                Editar
              </button>
            </td>
          </tr>
        `;
    }).join('');
  }

  async function loadTiposUnidad() {
    try {
        const res = await fetch(`${API_UNIDADES}/tipos`, { headers: getHeaders() });
        if (res.ok) {
            const tipos = await res.json();
            
            const selModal = document.getElementById('tipoUnidad');
            if (selModal) {
                selModal.innerHTML = tipos.map(t => `<option value="${t.idTipo}">${t.nombre}</option>`).join('');
            }

            const selFiltro = document.getElementById('filtroTipo');
            if (selFiltro) {
                selFiltro.innerHTML = `<option value="todos">Todos</option>` + 
                    tipos.map(t => `<option value="${t.idTipo}">${t.nombre}</option>`).join('');
            }
        }
    } catch (e) { console.error("Error cargando tipos:", e); }
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
      
      const idTipo   = document.getElementById('tipoUnidad').value;
      const cantidad = document.getElementById('cantidadUnidad').value;
      const estado   = document.getElementById('estadoUnidad').value;
      const precioInput = document.getElementById('precioUnidad').value;

      if (!idTipo || !cantidad) return window.showAlert('Error', 'Completar campos', 'error');

      const precioFinal = precioInput === "" ? 0 : parseFloat(precioInput);

      const payload = {
          idTipo,
          accion: 'alta',
          stock: parseInt(cantidad),
          estado: estado,
          precio: precioFinal
      };

      try {
          const res = await fetch(`${API_UNIDADES}/gestion`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify(payload)
          });

          if (res.ok) {
              window.showAlert('Éxito', 'Stock actualizado', 'success');
              modalGestion.classList.add('hidden');
              formGestion.reset();
              await loadUnidades(); 
          } else {
              const errorData = await res.json();
              window.showAlert('Error', errorData.error || 'Error al guardar', 'error');
          }
      } catch (e) { 
          console.error("Error en submit gestión:", e); 
      }
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
                headers: getHeaders(),
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

    if (btnGuardarPrecio) {
      btnGuardarPrecio.addEventListener('click', async () => {
          const idTipo = document.getElementById('idTipoAccion').value;
          const precio = document.getElementById('editPrecio').value;

          // Validamos solo el precio
          if (precio === "" || parseFloat(precio) < 0) {
              return window.showAlert('Atención', 'Ingresá un precio válido (0 o más).', 'warning');
          }

          try {
              const res = await fetch(`${API_UNIDADES}/gestion`, {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({ 
                      idTipo: idTipo, 
                      accion: 'precio', 
                      precio: parseFloat(precio),
                      stock: 0 
                  })
              });

              if (res.ok) {
                  window.showAlert('Éxito', 'Precio actualizado para todas las unidades de este tipo.', 'success');
                  await loadUnidades(); 
              } else {
                  const err = await res.json();
                  window.showAlert('Error', err.error || 'No se pudo actualizar el precio', 'error');
              }
          } catch (e) { 
              console.error("Error al actualizar precio:", e); 
          }
      });
    }

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

  async function renderRemindersList() {
    const ul = document.getElementById('listaRecordatorios');
    if (!ul) return;

    try {
        const h = getHeaders();
        // 1. Buscamos Alquileres y Recordatorios en paralelo
        const [resA, resR] = await Promise.all([
            fetch(`${API_ALQUILERES}?t=${Date.now()}`, { headers: h }),
            fetch(`${API_RECORDATORIOS}?t=${Date.now()}`, { headers: h })
        ]);

        const alquileres = resA.ok ? await resA.json() : [];
        const recordatorios = resR.ok ? await resR.json() : [];

        // 2. Normalizar "Hoy" para comparar fechas sin horas
        const ahora = new Date();
        const hoyNum = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();

        // 3. Unificar ambos tipos en una sola "Agenda"
        let agendaTotal = [
            ...recordatorios.map(r => ({
                id: r.id, 
                fecha: r.fecha, // 'YYYY-MM-DD'
                texto: r.descripcion,
                tipo: 'REC'
            })),
            ...alquileres.map(a => {
                const c = clientesCache.find(x => String(x.idCliente) === String(a.idCliente));
                const nom = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
                return {
                    id: a.idAlquiler,
                    fecha: a.fechaDesde, 
                    texto: `Alquiler: ${nom}`,
                    tipo: 'ALQ'
                };
            })
        ];

        // 4. Filtrar (solo hoy o futuro), ordenar por fecha y tomar los mejores 4
        const agendaFinal = agendaTotal
            .filter(e => {
                if (!e.fecha) return false;
                const p = e.fecha.split('-');
                const fechaEventoNum = new Date(p[0], p[1] - 1, p[2]).getTime();
                return fechaEventoNum >= hoyNum;
            })
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .slice(0, 4);

        if (agendaFinal.length === 0) {
            ul.innerHTML = '<li style="text-align:center; padding:20px; color:#999; font-size:0.9em;">No hay eventos próximos.</li>';
            return;
        }

        // 5. Renderizar HTML unificado
        ul.innerHTML = agendaFinal.map(e => {
            const p = e.fecha.split('-');
            const diaMes = `${p[2]}/${p[1]}`;
            const esRec = e.tipo === 'REC';
            const color = esRec ? '#ff9f89' : '#3788d8'; // Salmón o Azul

            return `
                <li style="border-left: 5px solid ${color}; padding: 10px; margin-bottom: 8px; background: #fff; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); list-style:none;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="overflow:hidden;">
                            <span style="font-weight:bold; color:${color}; font-size: 0.8em;">${diaMes} ${esRec ? '📌' : '🗓️'}</span>
                            <div style="font-size: 0.9em; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.texto}</div>
                        </div>
                        ${esRec ? `<button class="btn-icon-delete" onclick="window.borrarRecordatorio('${e.id}')" style="background:none; border:none; color:#ddd; cursor:pointer; padding:5px;">🗑</button>` : ''}
                    </div>
                </li>`;
        }).join('');

    } catch (e) {
        console.error("Error cargando agenda unificada:", e);
    }
  }

  function initRemindersLogic() {
      const modal = document.getElementById('modalRecordatorio');
      const form = document.getElementById('formRecordatorio');
      const btnCerrar = document.getElementById('btnCerrarRecordatorio');
      const btnNuevo = document.getElementById('btnNuevoRecordatorio');

      if(btnCerrar) btnCerrar.addEventListener('click', () => modal.classList.add('hidden'));
      
      if(btnNuevo) btnNuevo.addEventListener('click', () => {
          const now = new Date().toISOString().split('T')[0];
          openModalRecordatorio(now);
      });
      
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
                const res = await fetch('/api/recordatorios', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    window.showAlert('Éxito', 'Guardado en base de datos', 'success');
                    modal.classList.add('hidden');
                    form.reset();
                    // Refrescamos la lista y el calendario
                    renderRemindersList(); 
                    if (calendarInstance) calendarInstance.refetchEvents(); 
                } else {
                    const err = await res.json();
                    window.showAlert('Error', err.error, 'error');
                }
            } catch (e) { 
                console.error("Error al guardar:", e); 
            }
        });
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

  window.verDetalleAlquiladas = async (idTipo, nombre) => {
    const modal = document.getElementById('modalDetalleAlquiladas');
    const tbody = document.getElementById('tbodyDetalleAlquiladas');
    const lblNombre = document.getElementById('nombreUnidadDetalle');

    if (!modal || !tbody) return;

    lblNombre.textContent = nombre.toUpperCase();
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando detalles...</td></tr>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/unidades/${idTipo}/alquiladas`, { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('ap_token')}` } 
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#999;">No hay alquileres activos para esta unidad hoy.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(d => {
            const c = clientesCache.find(x => String(x.idCliente) === String(d.Alquileres.idCliente));
            const clienteLabel = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Desconocido';
            const fechaVence = d.Alquileres.fechaHasta ? d.Alquileres.fechaHasta.split('-').reverse().join('/') : '-';

            return `
                <tr>
                    <td style="font-size:12px;">${clienteLabel}</td>
                    <td style="font-size:11px; color:#555;">${d.Alquileres.ubicacion || '-'}</td>
                    <td style="text-align:center; font-weight:600;">${d.cantidad}</td>
                    <td style="font-size:12px; white-space:nowrap;">${fechaVence}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Error al cargar detalle de alquiladas:", e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error al obtener datos.</td></tr>';
    }
  };

})();