(() => {
  'use strict';

  const KEY_TAREAS     = 'ap_tareas';
  const KEY_ALQUILERES = 'ap_alquileres';

  // Empleados "fijos" para tabs
  const EMPLEADOS = [
    { id: 'noel',   corto: 'Noel',   nombre: 'Noel Castro',   zona: 'SUR'   },
    { id: 'dario',  corto: 'Dario',  nombre: 'Dario Gómez',   zona: 'NORTE' },
    { id: 'damian', corto: 'Damian', nombre: 'Damian Pérez',  zona: 'OESTE' }
  ];

  // ---------- Storage helpers ----------
  function loadAlquileres() {
    const raw = localStorage.getItem(KEY_ALQUILERES);
    return raw ? JSON.parse(raw) : [];
  }

  function loadTareas() {
    const raw = localStorage.getItem(KEY_TAREAS);
    return raw ? JSON.parse(raw) : [];
  }

  function saveTareas(list) {
    localStorage.setItem(KEY_TAREAS, JSON.stringify(list));
  }

  function seedIfEmptyTareas() {
    if (!localStorage.getItem(KEY_TAREAS)) {
      const hoyIso = new Date().toISOString().slice(0,10);
      const seed = [
        {
          id: 1,
          empleadoId: 'noel',
          fecha: hoyIso,
          zona: 'SUR',
          pedido: '001',
          ubicacion: 'Chacabuco 459, Nva. Cba',
          datos: '2 baños estándar',
          completo: true
        },
        {
          id: 2,
          empleadoId: 'noel',
          fecha: hoyIso,
          zona: 'SUR',
          pedido: '002',
          ubicacion: 'Capdevila, Ampl. America',
          datos: '5 baños estándar',
          completo: false
        }
      ];
      saveTareas(seed);
    }
  }

  function formatFechaLarga(iso) {
    if (!iso) {
      const hoy = new Date();
      return hoy.toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    }
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // ---------- Estado ----------
  let tareas = [];
  let empleadoActual = EMPLEADOS[0].id; // por defecto Noel

  // ---------- DOM refs ----------
  let tabsEmpleados, tbody, lblFecha, lblEmpleado, lblZona;
  let modalOverlay, formTarea, selEmpleadoModal, inpPedido;
  let btnAgregarTarea, btnGuardarTarea, btnCancelarTarea;

  function initDom() {
    tabsEmpleados   = document.querySelectorAll('.tabs-empleados .tab');
    tbody           = document.getElementById('tbodyTareas');
    lblFecha        = document.getElementById('tareasFecha');
    lblEmpleado     = document.getElementById('tareasEmpleado');
    lblZona         = document.getElementById('tareasZona');

    modalOverlay    = document.getElementById('modalTarea');
    formTarea       = document.getElementById('formTarea');
    selEmpleadoModal= document.getElementById('tareaEmpleado');
    inpPedido       = document.getElementById('tareaPedido');

    btnAgregarTarea = document.getElementById('btnAgregarTarea');
    btnGuardarTarea = document.getElementById('btnGuardarTarea');
    btnCancelarTarea= document.getElementById('btnCancelarTarea');

    return !!tbody;
  }

  // ---------- Render header (fecha + empleado + zona) ----------
  function renderHeader() {
    const emp = EMPLEADOS.find(e => e.id === empleadoActual) || EMPLEADOS[0];
    // Usamos la fecha de la primera tarea del empleado si existe, sino hoy
    const tareasEmp = tareas.filter(t => t.empleadoId === emp.id);
    const fechaIso = tareasEmp[0]?.fecha || new Date().toISOString().slice(0,10);

    lblFecha.textContent    = formatFechaLarga(fechaIso);
    lblEmpleado.textContent = emp.nombre;
    lblZona.textContent     = emp.zona || '-';
  }

  // ---------- Render tabla ----------
  function renderTabla() {
    const empId = empleadoActual;
    const tareasEmp = tareas.filter(t => t.empleadoId === empId);

    tbody.innerHTML = tareasEmp.map(t => `
      <tr>
        <td>${t.ubicacion}</td>
        <td>${t.datos}</td>
        <td>
          <input type="checkbox" class="check-tarea" data-id="${t.id}" ${t.completo ? 'checked' : ''}>
          <button class="btn-icon-delete" data-del="${t.id}">🗑</button>
        </td>
      </tr>
    `).join('');

    if (!tareasEmp.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; font-size:13px; color:#777;">
            No hay tareas asignadas para este empleado.
          </td>
        </tr>
      `;
    }
  }

  // ---------- Tabs empleados ----------
  function initTabs() {
    tabsEmpleados.forEach(tab => {
      tab.addEventListener('click', () => {
        const empId = tab.dataset.emp;
        if (!empId) return;

        empleadoActual = empId;
        tabsEmpleados.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        renderHeader();
        renderTabla();
      });
    });
  }

  // ---------- Modal ----------
  function openModal() {
    const emp = EMPLEADOS.find(e => e.id === empleadoActual) || EMPLEADOS[0];

    // llenar combo de empleados (si aún no)
    selEmpleadoModal.innerHTML = '';
    EMPLEADOS.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.nombre;
      selEmpleadoModal.appendChild(opt);
    });

    selEmpleadoModal.value = emp.id;
    inpPedido.value = '';

    modalOverlay.classList.remove('hidden');
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  // ---------- Alta de tarea ----------
  function handleGuardarTarea() {
    const empleadoId = selEmpleadoModal.value;
    const pedido     = inpPedido.value.trim();

    if (!empleadoId) return alert('Seleccioná un empleado.');
    if (!pedido)     return alert('Ingresá el número de pedido.');

    const alquileres = loadAlquileres();
    const alq = alquileres.find(a => a.numero === pedido);

    if (!alq) {
      return alert('No se encontró ese N° de pedido en los alquileres.');
    }

    const ubicacion = alq.ubicacion || '-';
    const datos = (alq.lineas || [])
      .map(l => `${l.cantidad} ${l.unidad.toLowerCase()}`)
      .join(', ') || 'Sin datos de unidades';

    const hoyIso = new Date().toISOString().slice(0,10);
    const emp    = EMPLEADOS.find(e => e.id === empleadoId) || EMPLEADOS[0];

    const id = Math.max(0, ...tareas.map(t => t.id)) + 1;

    const nueva = {
      id,
      empleadoId,
      fecha: hoyIso,
      zona: emp.zona,
      pedido,
      ubicacion,
      datos,
      completo: false
    };

    tareas.push(nueva);
    saveTareas(tareas);
    closeModal();

    // si estoy viendo a ese empleado, refresco
    if (empleadoActual === empleadoId) {
      renderHeader();
      renderTabla();
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (!initDom()) return;

    seedIfEmptyTareas();
    tareas = loadTareas();

    initTabs();
    renderHeader();
    renderTabla();

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
    tbody.addEventListener('click', e => {
      const chkId = e.target.getAttribute('data-id');
      const delId = e.target.getAttribute('data-del');

      if (chkId) {
        const id = Number(chkId);
        const t = tareas.find(x => x.id === id);
        if (t) {
          t.completo = !t.completo;
          saveTareas(tareas);
        }
      }

      if (delId) {
        const id = Number(delId);
        if (confirm('¿Eliminar tarea?')) {
          tareas = tareas.filter(t => t.id !== id);
          saveTareas(tareas);
          renderHeader();
          renderTabla();
        }
      }
    });
  });
})();
