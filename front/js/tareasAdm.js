(() => {
  'use strict';

  const API_TAREAS = '/api/tareas';
  const API_USUARIOS = '/api/usuarios';
  const API_ALQUILERES = '/api/alquileres';
  const API_CLIENTES = '/api/clientes';

  function formatFechaLarga(iso) {
    if (!iso) return '-';
    // Crear fecha asumiendo input YYYY-MM-DD local
    const [y, m, d] = iso.split('-');
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-AR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // ---------- Estado ----------
  let tareas = [];
  let empleados = [];
  let alquileres = [];
  let clientes = [];
  let empleadoActualId = null;
  // Usar fecha local para evitar errores de zona horaria (UTC vs Local)
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  let fechaFiltro = `${year}-${month}-${day}`;

  // ---------- DOM refs ----------
  let containerTabs, tbody, lblFecha, lblEmpleado, lblZona, inpFiltroFecha;
  let modalOverlay, formTarea, selEmpleadoModal, inpFechaTarea;
  let inpBuscarPedido, tbodyPedidos, inpPedidoId, lblPedidoInfo, inpTareaDetalle;
  let btnAgregarTarea, btnGuardarTarea, btnCancelarTarea;

  function initDom() {
    containerTabs   = document.getElementById('containerTabs');
    tbody           = document.getElementById('tbodyTareas');
    lblFecha        = document.getElementById('tareasFecha');
    lblEmpleado     = document.getElementById('tareasEmpleado');
    lblZona         = document.getElementById('tareasZona');
    inpFiltroFecha  = document.getElementById('filtroFecha');

    modalOverlay    = document.getElementById('modalTarea');
    formTarea       = document.getElementById('formTarea');
    selEmpleadoModal= document.getElementById('tareaEmpleado');
    inpFechaTarea   = document.getElementById('tareaFecha');
    inpTareaDetalle = document.getElementById('tareaDetalle');
    
    inpBuscarPedido = document.getElementById('buscarPedidoModal');
    tbodyPedidos    = document.getElementById('tbodyPedidosModal');
    inpPedidoId     = document.getElementById('tareaPedidoId');
    lblPedidoInfo   = document.getElementById('pedidoSeleccionadoInfo');

    btnAgregarTarea = document.getElementById('btnAgregarTarea');
    btnGuardarTarea = document.getElementById('btnGuardarTarea');
    btnCancelarTarea= document.getElementById('btnCancelarTarea');

    if (inpFiltroFecha) {
        inpFiltroFecha.value = fechaFiltro;
        inpFiltroFecha.addEventListener('change', () => {
            fechaFiltro = inpFiltroFecha.value;
            loadTareas();
        });
    }

    if (inpBuscarPedido) {
        inpBuscarPedido.addEventListener('input', () => renderPedidosModal(inpBuscarPedido.value));
    }

    return !!tbody;
  }

  // ---------- API Calls ----------
  async function fetchEmpleados() {
    try {
        const res = await fetch(API_USUARIOS);
        if (!res.ok) return [];
        const data = await res.json();
        // Filtramos usuarios que sean 'Empleado' o tengan rol operativo
        return data.filter(u => {
            const rol = String(u.rol || u.permisos).toLowerCase();
            return rol.includes('empleado') || rol.includes('chofer') || rol.includes('mantenimiento') || rol.includes('servicio');
        }).map(u => ({
            // Normalizar ID de usuario
            idUsuarios: u.idUsuarios || u.idusuarios || u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            area: u.area || u.idArea,
            zona: u.zona // Mapeamos la zona de trabajo (ubicación)
        }));
    } catch (e) { console.error(e); return []; }
  }

  async function fetchTareas(fecha) {
    try {
        const res = await fetch(`${API_TAREAS}/${fecha}`);
        if (!res.ok) {
            console.error("Error cargando tareas:", await res.text());
            return [];
        }
        const data = await res.json();
        // Normalizar tareas
        return data.map(t => ({
            ...t,
            idTarea: t.idTarea || t.idtarea || t.id,
            idUsuarios: t.idUsuarios || t.idusuarios || t.idUsuario,
            idAlquiler: t.idAlquiler || t.idalquiler,
            // Asegurar que alquiler tenga ID normalizado también
            alquiler: t.alquiler ? { ...t.alquiler, idAlquiler: t.alquiler.idAlquiler || t.alquiler.idalquiler } : null
        }));
    } catch (e) { console.error(e); return []; }
  }

  async function fetchAlquileres() {
    try {
        const res = await fetch(API_ALQUILERES);
        return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  }

  async function fetchClientes() {
    try {
        const res = await fetch(API_CLIENTES);
        return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  }

  async function loadData() {
    const [emps, alqs, clis] = await Promise.all([fetchEmpleados(), fetchAlquileres(), fetchClientes()]);
    empleados = emps;
    alquileres = alqs;
    clientes = clis;

    if (empleados.length > 0 && !empleadoActualId) {
        empleadoActualId = empleados[0].idUsuarios; // Seleccionar el primero por defecto
    }
    renderTabs();
    await loadTareas();
  }

  async function loadTareas() {
    tareas = await fetchTareas(fechaFiltro);
    renderHeader();
    renderTabla();
  }

  // ---------- Render header (fecha + empleado + zona) ----------
  function renderHeader() {
    const emp = empleados.find(e => String(e.idUsuarios) === String(empleadoActualId));
    lblFecha.textContent    = formatFechaLarga(fechaFiltro);
    lblEmpleado.textContent = emp ? `${emp.nombre} ${emp.apellido}` : 'Seleccione empleado';
    lblZona.textContent     = (emp && emp.zona) ? emp.zona : '-';
  }

  // ---------- Render tabla ----------
  function renderTabla() {
    if (!empleadoActualId) return;
    
    // Filtrar tareas del empleado seleccionado
    const tareasEmp = tareas.filter(t => String(t.idUsuarios) === String(empleadoActualId));

    tbody.innerHTML = tareasEmp.map(t => {
      // Buscamos el alquiler completo en la lista cargada (que tiene los nombres de unidades)
      const alq = alquileres.find(a => String(a.idAlquiler || a.idalquiler) === String(t.idAlquiler)) || t.alquiler;

      // Resolver nombre del cliente
      let clienteNombre = '-';
      if (alq && alq.idCliente) {
          const c = clientes.find(x => x.idCliente == alq.idCliente);
          if (c) clienteNombre = c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial;
      }
      return `
      <tr>
        <td>
            <div style="font-weight:500;">${alq?.ubicacion || 'Sin ubicación'}</div>
            <div style="font-size:12px; color:#333;">${clienteNombre}</div>
            <div style="font-size:11px; color:#888;">
                Pedido #${t.idAlquiler} 
                <span style="color:${alq?.estado === 'PAGADO' ? 'green' : '#ec1f26'}; font-weight:500;">(${alq?.estado || '-'})</span>
            </div>
        </td>
        <td>${formatDetalle(alq?.lineas)}</td>
        <td>${t.detalle || '-'}</td>
        <td>
          <input type="checkbox" class="check-tarea" data-id="${t.idTarea}" ${t.completada ? 'checked' : ''}>
          <button class="btn-icon-delete" data-del="${t.idTarea}" title="Eliminar tarea">🗑</button>
        </td>
      </tr>
    `}).join('');

    if (!tareasEmp.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; font-size:13px; color:#777; padding:20px;">
            No hay tareas asignadas para este empleado en la fecha seleccionada.
          </td>
        </tr>
      `;
    }
  }

  function formatDetalle(lineas) {
    if (!lineas || !lineas.length) return 'Sin detalle';
    return lineas.map(l => `${l.cantidad} ${l.unidad || 'unid.'}`).join(', ');
  }

  // ---------- Tabs empleados ----------
  function renderTabs() {
    containerTabs.innerHTML = '';
    empleados.forEach(emp => {
        const btn = document.createElement('button');
        btn.className = `tab ${String(emp.idUsuarios) === String(empleadoActualId) ? 'active' : ''}`;
        btn.textContent = emp.nombre; // O nombre corto
        btn.onclick = () => {
            empleadoActualId = emp.idUsuarios;
            renderTabs(); // Re-render para actualizar clase active
            renderHeader();
            renderTabla();
        };
        containerTabs.appendChild(btn);
    });
  }

  // ---------- Render Pedidos Modal ----------
  function renderPedidosModal(filtro = '') {
    const q = filtro.toLowerCase();
    const selectedId = inpPedidoId.value;

    // Filtrar alquileres activos o relevantes
    const data = alquileres.filter(a => {
        // Enriquecer con nombre cliente
        const c = clientes.find(x => x.idCliente == a.idCliente);
        a._nombreCliente = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Desconocido';
        
        const id = a.idAlquiler || a.idalquiler;
        const texto = `${id} ${a._nombreCliente} ${a.ubicacion} ${a.estado}`.toLowerCase();
        return texto.includes(q);
    });

    tbodyPedidos.innerHTML = data.map(a => {
        const id = a.idAlquiler || a.idalquiler;
        const isSelected = String(id) === String(selectedId);
        return `
            <tr style="cursor:pointer; background:${isSelected ? '#e3f2fd' : 'transparent'}" 
                onclick="window.selectPedido('${id}', '${a._nombreCliente}', '${a.ubicacion}')">
                <td>${id}</td>
                <td>${a._nombreCliente}</td>
                <td>${a.ubicacion}</td>
                <td><span class="tag">${a.estado}</span></td>
                <td>${isSelected ? '✔' : ''}</td>
            </tr>
        `;
    }).join('');
  }

  // Exponer función global para el onclick del string template
  window.selectPedido = function(id, cliente, ubicacion) {
    inpPedidoId.value = id;
    lblPedidoInfo.textContent = `Seleccionado: #${id} - ${cliente} (${ubicacion})`;
    // Re-render para actualizar el highlight
    renderPedidosModal(inpBuscarPedido.value);
  };

  // ---------- Modal ----------
  function openModal() {
    // llenar combo de empleados (si aún no)
    selEmpleadoModal.innerHTML = '';
    empleados.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.idUsuarios;
      opt.textContent = `${e.nombre} ${e.apellido}`;
      selEmpleadoModal.appendChild(opt);
    });

    if (empleadoActualId) selEmpleadoModal.value = empleadoActualId;
    
    inpPedidoId.value = '';
    lblPedidoInfo.textContent = 'Ningún pedido seleccionado';
    inpBuscarPedido.value = '';
    renderPedidosModal();

    inpFechaTarea.value = fechaFiltro; // Sugerir fecha actual del filtro
    if (inpTareaDetalle) inpTareaDetalle.value = ''; // Limpiar detalle

    modalOverlay.classList.remove('hidden');
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  // ---------- Alta de tarea ----------
  async function handleGuardarTarea() {
    const idUsuario = selEmpleadoModal.value;
    const idAlquiler = inpPedidoId.value;
    const fecha = inpFechaTarea.value;
    const detalle = inpTareaDetalle ? inpTareaDetalle.value : '';

    if (!idUsuario) return window.showAlert('Atención', 'Seleccioná un empleado.', 'warning');
    if (!idAlquiler) return window.showAlert('Atención', 'Seleccioná un pedido de la lista.', 'warning');
    if (!fecha) return window.showAlert('Atención', 'Ingresá la fecha.', 'warning');

    try {
        const res = await fetch(API_TAREAS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idUsuario, idAlquiler, fecha, detalle })
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error(`Error del servidor (${res.status}). Verifica que la ruta de la API exista.`);
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al asignar tarea');

        window.showAlert('Éxito', 'Tarea asignada correctamente', 'success');
        closeModal();
        
        // Si la fecha asignada es la que estamos viendo, recargar
        if (fecha === fechaFiltro) {
            await loadTareas();
        }

    } catch (err) {
        window.showAlert('Error', err.message, 'error');
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', async () => {
    if (!initDom()) return;

    await loadData();

    // Abrir modal
    btnAgregarTarea?.addEventListener('click', openModal);

    // Cerrar modal
    btnCancelarTarea?.addEventListener('click', e => {
      e.preventDefault();
      closeModal();
    });

    // Guardar tarea
    btnGuardarTarea?.addEventListener('click', e => {
      e.preventDefault();
      handleGuardarTarea();
    });

    // Completar / eliminar desde la tabla
    tbody.addEventListener('click', async e => {
      const chk = e.target.closest('.check-tarea');
      const delId = e.target.getAttribute('data-del');

      if (chk) {
        const id = chk.dataset.id;
        const completada = chk.checked;
        try {
            await fetch(`${API_TAREAS}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completada })
            });
            // Actualizar estado local
            const t = tareas.find(x => x.idTarea == id);
            if (t) t.completada = completada;
        } catch (err) {
            console.error("Error actualizando estado", err);
            chk.checked = !completada; // Revertir visualmente si falla
        }
      }

      if (delId) {
        if (await window.confirmAction('¿Eliminar tarea?', 'Se borrará de la lista.')) {
            try {
                await fetch(`${API_TAREAS}/${delId}`, { method: 'DELETE' });
                await loadTareas();
            } catch (err) { window.showAlert('Error', 'No se pudo eliminar', 'error'); }
        }
      }
    });
  });
})();
