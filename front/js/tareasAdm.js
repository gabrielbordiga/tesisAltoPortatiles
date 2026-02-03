(() => {
  'use strict';

  const API_TAREAS = '/api/tareas';
  const API_USUARIOS = '/api/usuarios';
  const API_ALQUILERES = '/api/alquileres';
  const API_CLIENTES = '/api/clientes';

  // 1. Al inicio del archivo, detectamos el usuario logueado
    const userSession = JSON.parse(localStorage.getItem('ap_current') || '{}');
    const userRol = String(userSession.rol || "").toLowerCase();
    const esAdmin = userRol === 'administrador' || userRol === 'owner';

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
  let inpBuscarPedido, tbodyPedidos, inpPedidoId, lblPedidoInfo, inpTareaDetalle, selTareaTipo;
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

    // Inyectar select de tareas predefinidas si no existe
    if (inpTareaDetalle && !document.getElementById('selTareaTipo')) {
        const div = document.createElement('div');
        div.style.marginBottom = '15px';
        div.innerHTML = `
            <label style="display:block; margin-bottom:5px; font-weight:500;">Acción</label>
            <select id="selTareaTipo" class="input">
                <option value="">-- Seleccionar acción --</option>
                <option value="Entregar unidad">Entregar unidad</option>
                <option value="Realizar Servicio">Realizar Servicio</option>
                <option value="Retirar unidad">Retirar unidad</option>
                <option value="Otro">Otro / Nota</option>
            </select>
        `;
        const target = inpTareaDetalle.closest('label') || inpTareaDetalle;
        target.parentNode.insertBefore(div, target);
    }
    selTareaTipo = document.getElementById('selTareaTipo');
    
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
        const res = await fetch(API_USUARIOS, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('ap_token')}` }
        });
        if (!res.ok) return [];
        const data = await res.json();

        return data.filter(u => {
            const rol = String(u.rol || "").toLowerCase();
            return rol === 'empleado' || rol === 'chofer' || rol === 'mantenimiento';
        }).map(u => ({
            idUsuarios: u.idUsuarios, 
            nombre: u.nombre,
            apellido: u.apellido,
            area: u.idArea,
            zona: u.zona || 'S/D' 
        }));
    } catch (e) { 
        console.error("Error fetchEmpleados:", e); 
        return []; 
    }
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
    try {
        const [emps, alqs, clis] = await Promise.all([
            fetchEmpleados(), 
            fetchAlquileres(), 
            fetchClientes()
        ]);
        
        empleados = emps;
        alquileres = alqs;
        clientes = clis;

        if (!esAdmin) {
            // Esto SOLO se ejecuta para Empleados
            if (containerTabs) containerTabs.style.display = 'none';
            if (btnAgregarTarea) btnAgregarTarea.style.display = 'none';
            
            const cardInfo = document.querySelector('.card-tareas-info');
            if (cardInfo) {
                cardInfo.style.marginTop = '10px';
                document.querySelector('.tareas-fecha').innerHTML = `Mi Hoja de Ruta: <span id="tareasFecha" class="link-text"></span>`;
            }
        } else {
            if (containerTabs) containerTabs.style.display = 'flex'; 
            if (btnAgregarTarea) btnAgregarTarea.style.display = 'block';
        }

        renderTabs();
        renderHeader();
        
        if (empleadoActualId) {
            await loadTareas();
        }
    } catch (e) { console.error("Error en carga inicial:", e); }
  }

  async function loadTareas() {
      if (!fechaFiltro || !empleadoActualId) return;

      try {
          const res = await fetch(`${API_TAREAS}/${fechaFiltro}?idUsuario=${empleadoActualId}`);
          if (res.ok) {
              tareas = await res.json();
          }
          renderHeader();
          renderTabla();
      } catch (e) {
          console.error("Error cargando tareas:", e);
      }
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
    const idActivo = esAdmin ? empleadoActualId : (userSession.idUsuarios || userSession.id);
    const tareasEmp = tareas.filter(t => String(t.idUsuarios) === String(idActivo));

    tbody.innerHTML = tareasEmp.map(t => {
        const alq = alquileres.find(a => String(a.idAlquiler) === String(t.idAlquiler)) || t.alquiler;
        
        let clienteNombre = 'Cliente desconocido';
        if (alq && alq.idCliente) {
            const c = clientes.find(x => String(x.idCliente) === String(alq.idCliente));
            if (c) clienteNombre = c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial;
        }
        
        return `
        <tr>
          <td>
              <div style="font-weight:600; color:var(--rojo); font-size: 14px;">${alq?.ubicacion || 'Sin ubicación'}</div>
              <div style="font-size:12px; color:#555; font-weight:500;">👤 ${clienteNombre}</div>
              <div style="font-size:11px; color:#888; margin-top:2px;">Pedido #${t.idAlquiler}</div>
          </td>
          <td>${formatDetalle(alq?.lineas)}</td>
          <td>${t.detalle || '-'}</td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="check-tarea" data-id="${t.idTarea || t.id}" ${t.completada ? 'checked' : ''} 
                       style="width:18px; height:18px; cursor:pointer;">
                <label style="font-size:12px; font-weight:600; color:${t.completada ? 'green' : '#999'};">
                    ${t.completada ? 'TERMINADO' : 'PENDIENTE'}
                </label>
                
                ${esAdmin ? `<button class="btn-icon-delete" data-del="${t.id}" title="Eliminar tarea" style="margin-left:auto; background:none; border:none; cursor:pointer; font-size:1.1em;">🗑</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    if (!tareasEmp.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; color:#999;">No hay tareas asignadas para esta fecha.</td></tr>`;
    }
  }

  function formatDetalle(lineas) {
    if (!lineas || !lineas.length) return 'Sin detalle';
    return lineas.map(l => `${l.cantidad} ${l.unidad || 'unid.'}`).join(', ');
  }

  // ---------- Tabs empleados ----------
  function renderTabs() {
    containerTabs.innerHTML = '';

    // Contar ocurrencias de nombres para detectar duplicados
    const conteoNombres = {};
    empleados.forEach(e => {
        const n = (e.nombre || '').trim().toLowerCase();
        conteoNombres[n] = (conteoNombres[n] || 0) + 1;
    });

    empleados.forEach(emp => {
        const btn = document.createElement('button');
        btn.className = `tab ${String(emp.idUsuarios) === String(empleadoActualId) ? 'active' : ''}`;
        
        const n = (emp.nombre || '').trim().toLowerCase();
        btn.textContent = (conteoNombres[n] > 1) ? `${emp.nombre} ${emp.apellido || ''}` : emp.nombre;

        btn.onclick = () => {
            empleadoActualId = emp.idUsuarios;
            localStorage.setItem('ap_last_emp_view', empleadoActualId); 
            renderTabs();
            renderHeader();
            loadTareas(); 
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
    
    if (empleados.length === 0) {
        selEmpleadoModal.innerHTML = '<option value="">No hay empleados disponibles</option>';
    }

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
    if (selTareaTipo) selTareaTipo.value = ''; // Limpiar tipo

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
    
    const tipo = selTareaTipo ? selTareaTipo.value : '';
    const texto = inpTareaDetalle ? inpTareaDetalle.value.trim() : '';
    let detalle = texto;
    if (tipo && !tipo.startsWith('Otro')) {
        detalle = texto ? `${tipo} - ${texto}` : tipo;
    }

    if (!idUsuario || !idAlquiler || !fecha) {
        return window.showAlert('Atención', 'Completa todos los campos.', 'warning');
    }

    try {
        const resCheck = await fetch(`${API_TAREAS}/${fecha}`);
        if (resCheck.ok) {
            const todasLasTareasDia = await resCheck.json();
            const yaAsignado = todasLasTareasDia.some(t => String(t.idAlquiler) === String(idAlquiler));
            
            if (yaAsignado) {
                return window.showAlert('Pedido ya asignado', 'Este pedido ya fue asignado a un empleado para el día de hoy.', 'error');
            }
        }

        const res = await fetch(API_TAREAS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idUsuario, idAlquiler, fecha, detalle })
        });

        if (res.ok) {
            window.showAlert('Éxito', 'Tarea asignada correctamente', 'success');
            closeModal();
            await loadTareas(); 
        } else {
            const data = await res.json();
            throw new Error(data.error || 'Error al asignar');
        }
    } catch (err) {
        window.showAlert('Error', err.message, 'error');
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', async () => {
    if (!initDom()) return;

    // --- AJUSTE DE UI SEGÚN ROL ---
    if (!esAdmin) {
        // Ocultar elementos de jefe
        if (containerTabs) containerTabs.style.display = 'none';
        if (btnAgregarTarea) btnAgregarTarea.style.display = 'none';
        
        // Cambiar el título visual
        const cardInfo = document.querySelector('.card-tareas-info');
        if (cardInfo) {
            cardInfo.style.marginTop = '10px';
            document.querySelector('.tareas-fecha').innerHTML = `Mi Hoja de Ruta: <span id="tareasFecha" class="link-text"></span>`;
        }
    }

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
      const btnDel = e.target.closest('.btn-icon-delete'); 

      if (chk) {
        const id = chk.dataset.id;
        const completada = chk.checked;
        try {
            await fetch(`${API_TAREAS}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completada })
            });
            // Buscamos por .id para actualizar el estado local
            const t = tareas.find(x => String(x.id) === String(id));
            if (t) t.completada = completada;
            renderTabla(); 
        } catch (err) { chk.checked = !completada; }
      }

      if (btnDel) {
        // Obtenemos el ID directamente del atributo que acabamos de corregir
        const delId = btnDel.getAttribute('data-del');
        
        if (!delId || delId === "undefined") {
            return window.showAlert('Error', 'No se pudo identificar la tarea.', 'error');
        }

        const confirmar = await window.confirmAction('¿Eliminar tarea?', 'Esta acción es permanente.');
        if (confirmar) {
            try {
                // Enviamos el DELETE al ID correcto
                const res = await fetch(`${API_TAREAS}/${delId}`, { 
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('ap_token')}` }
                });

                if (res.ok) {
                    window.showAlert('Éxito', 'Tarea eliminada', 'success');
                    await loadTareas(); // Refresca la lista inmediatamente
                } else {
                    const errData = await res.json();
                    // Esto te mostrará en pantalla por qué Supabase rechaza el borrado
                    throw new Error(errData.error || "Error al eliminar");
                }
            } catch (err) { window.showAlert('Error', err.message, 'error'); }
        }
      }
    });
  });
})();
