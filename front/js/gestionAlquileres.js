(() => {
  'use strict';

  const API_URL = '/api/alquileres';
  const API_CLIENTES = '/api/clientes';
  const API_UNIDADES = '/api/unidades/resumen';
  let CLIENTES_CACHE = [];
  let UNIDADES_CACHE = [];

  // ------ Helpers de storage ------
  async function loadAlquileres() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) {
        console.error("Error cargando alquileres:", await res.text());
        return [];
      }
      return await res.json();
    } catch (e) { console.error(e); return []; }
  }

  async function loadClientes() {
    try {
      const res = await fetch(API_CLIENTES);
      return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  }

  async function loadUnidades() {
    try {
      const res = await fetch(API_UNIDADES);
      const data = res.ok ? await res.json() : [];
      console.log("Unidades cargadas:", data); // Para depuración
      return data;
    } catch (e) { return []; }
  }

  function formatMoneda(n) {
    if (n == null || isNaN(n)) return '-';
    return '$' + Number(n).toLocaleString('es-AR');
  }

  function diffDias(f1, f2) {
    if (!f1 || !f2) return 1;
    const d1 = new Date(f1);
    const d2 = new Date(f2);
    const t1 = d1.getTime();
    const t2 = d2.getTime();
    if (isNaN(t1) || isNaN(t2)) return 1;
    const diff = t2 - t1;
    if (diff < 0) return 1; 
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  function calcTotales(lineas, pagos, dias = 1) {
    const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnit, 0);
    const total = subtotal * dias;
    const pagado = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
    const saldo = total - pagado;
    return { total, pagado, saldo };
  }

  function estadoDesdeSaldo({ total, pagado, saldo }) {
    // Ajuste: Probamos con mayúsculas (PENDIENTE / PAGADO) para cumplir con el check constraint
    if (saldo <= 0 && total > 0) return 'PAGADO';
    return 'PENDIENTE';
  }

  // Helper para mostrar fecha amigable (DD/MM/YYYY) aunque se guarde como YYYY-MM-DD
  function formatFechaVisual(f) {
    if (!f) return '-';
    if (f.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = f.split('-');
      return `${d}/${m}/${y}`;
    }
    // Intento de parsear ISO string completo (YYYY-MM-DDTHH:mm:ss)
    if (f.includes('T')) {
        const [fechaPart] = f.split('T');
        if (fechaPart) return formatFechaVisual(fechaPart);
    }
    return f;
  }

  // ------ Estado global de la pantalla ------
  let ALQUILERES = [];
  let currentId = null;   // null = nuevo
  let lineas = [];        // unidades del alquiler que se está editando
  let pagos  = [];        // pagos del alquiler que se está editando

  // ------ DOM refs ------
  let tbody, txtBuscar, form, btnNuevoAlquiler;
  let selCliente, inpUbicacion, inpDesde, inpHasta;
  let selUnidad, inpCantidad, tbodyLineas;
  let inpMontoPagado, selMetodoPago, btnAgregarPago, tbodyPagos;
  let modalInfo, btnCerrarInfo;

  function injectModalInfo() {
    if (document.getElementById('modalInfoAlquiler')) return;
    const div = document.createElement('div');
    div.id = 'modalInfoAlquiler';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">Detalle del Alquiler</div>
        <div class="modal-body" style="font-size:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
             <div><strong>Pedido:</strong> <span id="infoId"></span></div>
             <div><strong>Estado:</strong> <span id="infoEstado"></span></div>
             <div style="grid-column:1/-1"><strong>Cliente:</strong> <span id="infoCliente"></span></div>
             <div style="grid-column:1/-1"><strong>Ubicación:</strong> <span id="infoUbicacion"></span></div>
             <div style="grid-column:1/-1"><strong>Fecha:</strong> <span id="infoFecha"></span></div>
          </div>
          
          <h5 style="margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px;">Unidades</h5>
          <ul id="infoUnidades" style="margin-bottom:12px; padding-left:20px; list-style:disc;"></ul>

          <h5 style="margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px;">Pagos</h5>
          <div style="margin-bottom:8px;">
            <strong>Total:</strong> <span id="infoTotal"></span> &nbsp;|&nbsp; 
            <strong>Pagado:</strong> <span id="infoPagado"></span> &nbsp;|&nbsp; 
            <strong style="color:var(--rojo);">Falta:</strong> <span id="infoSaldo"></span>
          </div>
          <table class="tabla-mini">
            <thead><tr><th>Fecha</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody id="infoPagosBody"></tbody>
          </table>

          <div class="form-actions right" style="margin-top:20px;">
            <button type="button" class="btn outline" id="btnCerrarInfo">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function initDomAlquileres() {
    injectModalInfo();
    tbody         = document.getElementById('tbodyAlquileres');
    txtBuscar     = document.getElementById('buscarAlquiler');
    form          = document.getElementById('formAlquiler');
    btnNuevoAlquiler = document.getElementById('btnNuevoAlquiler');

    if (!tbody || !form) return false;

    selCliente    = document.getElementById('alqCliente');
    inpUbicacion  = document.getElementById('alqUbicacion');
    inpDesde      = document.getElementById('fechaDesde');
    inpHasta      = document.getElementById('fechaHasta');

    inpDesde.addEventListener('change', () => renderLineas());
    inpHasta.addEventListener('change', () => renderLineas());

    selUnidad     = document.getElementById('tipoUnidadAlq');
    inpCantidad   = document.getElementById('cantidadUnidadAlq');
    tbodyLineas   = document.getElementById('tbodyLineasUnidades');

    inpMontoPagado = document.getElementById('montoPagado');
    selMetodoPago  = document.getElementById('metodoPago');
    btnAgregarPago = document.getElementById('btnAgregarPago');
    tbodyPagos     = document.getElementById('tbodyPagos');

    modalInfo = document.getElementById('modalInfoAlquiler');
    btnCerrarInfo = document.getElementById('btnCerrarInfo');
    if (btnCerrarInfo) {
      btnCerrarInfo.addEventListener('click', () => modalInfo.classList.add('hidden'));
    }

    // Cambiar nombre de columna Saldo a Pendiente dinámicamente
    const headers = document.querySelectorAll('th');
    headers.forEach(th => {
        if (th.textContent.trim() === 'Saldo') th.textContent = 'Pendiente';
    });

    return true;
  }

  // ------ Render tabla principal ------
  function renderTablaAlquileres(filtro = '') {
    const q = String(filtro || '').trim().toLowerCase();

    tbody.innerHTML = ALQUILERES
      .map(a => {
        // Mapear idCliente a Nombre usando la caché
        const c = CLIENTES_CACHE.find(x => String(x.idCliente) === String(a.idCliente));
        const nombreCliente = c 
          ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) 
          : 'Cliente desconocido';
        return { ...a, nombreCliente };
      })
      .filter(a =>
        [String(a.idAlquiler), a.nombreCliente, a.ubicacion].some(v =>
          String(v || '').toLowerCase().includes(q)
        )
      )
      .map(a => {
        // Normalizar ID por si viene en minúsculas desde el backend
        a.idAlquiler = a.idAlquiler || a.idalquiler;

        const dias = diffDias(a.fechaDesde, a.fechaHasta);
        // Usar precioTotal de la BD si existe, sino calcularlo de las líneas
        const totalLineas = (a.lineas || []).reduce((acc, l) => acc + l.cantidad * (l.precioUnit || l.precioUnitario || 0), 0);
        const total = a.precioTotal !== undefined ? Number(a.precioTotal) : (totalLineas * dias);
        const pagado = (a.pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);
        const saldo = total - pagado;

        const unidadesTexto = (a.lineas || [])
          .map(l => `${l.cantidad} ${(l.unidad || '').toLowerCase()}`)
          .join(', ') || '-';

        const fDesde = a.fechaDesde ? formatFechaVisual(a.fechaDesde) : '';
        const fHasta = a.fechaHasta ? formatFechaVisual(a.fechaHasta) : '';
        const fechaRango = (fDesde && fHasta) ? `${fDesde} - ${fHasta} (${dias} días)` : (fDesde || fHasta || '-');

        // Acortar visualmente el ID si es muy largo (ej. UUID)
        const idRaw = String(a.idAlquiler);
        const idDisplay = idRaw.length > 8 ? idRaw.slice(0, 8) + '...' : idRaw.padStart(3, '0');

        return `
        <tr>
          <td title="${idRaw}">${idDisplay}</td>
          <td>${a.nombreCliente}</td>
          <td>${a.ubicacion}</td>
          <td>${fechaRango}</td>
          <td>${unidadesTexto}</td>
          <td>${a.estado || estadoDesdeSaldo({ total, pagado, saldo })}</td>
          <td>${formatMoneda(saldo)}</td>
          <td>
            <button class="action info" data-info="${a.idAlquiler}" title="Ver detalles">ℹ</button>
            <button class="action" data-edit="${a.idAlquiler}">Editar</button>
            <button class="action danger" data-del="${a.idAlquiler}">🗑</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  // ------ Render mini tabla de unidades ------
  function renderLineas() {
    const dias = diffDias(inpDesde.value, inpHasta.value);

    tbodyLineas.innerHTML = lineas.map((l, i) => `
      <tr>
        <td>${l.unidad}</td>
        <td>${l.cantidad} <span style="font-size:0.85em; color:#666;">(x${dias} días)</span></td>
        <td>${formatMoneda(l.precioUnit)}</td>
        <td>${formatMoneda(l.cantidad * l.precioUnit * dias)}</td>
        <td class="col-icon-remove" data-linea="${i}">✖</td>
      </tr>
    `).join('');

    const totales = calcTotales(lineas, pagos, dias);
    const totalSpan = document.querySelector('.mini-table-block .precio-total-resaltado');
    if (totalSpan) totalSpan.textContent = formatMoneda(totales.total);

    renderPagos(); // actualiza saldo en pagos

    // Actualizar stock en el desplegable restando lo que ya está en la grilla
    fillUnidadesSelect();
  }

  // ------ Render mini tabla de pagos ------
  function renderPagos() {
    const dias = diffDias(inpDesde.value, inpHasta.value);
    const totales = calcTotales(lineas, pagos, dias);
    const { saldo } = totales;

    if (!pagos.length) {
      tbodyPagos.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; font-size:13px; color:#777;">
            Sin pagos registrados.
          </td>
        </tr>`;
      return;
    }

    tbodyPagos.innerHTML = pagos.map((p, i) => `
      <tr>
        <td>${formatFechaVisual(p.fecha)}</td>
        <td>${formatMoneda(p.monto)}</td>
        <td>${p.metodo}</td>
        <td class="saldo-pendiente">${formatMoneda(saldo)}</td>
        <td class="col-icon-remove" data-pago="${i}">✖</td>
      </tr>
    `).join('');
  }

  // ------ Mostrar Modal Info ------
  function showModalInfo(a) {
    if (!modalInfo) return;
    
    // Calcular datos
    // Cliente
    const c = CLIENTES_CACHE.find(x => String(x.idCliente) === String(a.idCliente));
    const nombreCliente = c 
        ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) 
        : 'Cliente desconocido';

    // Totales
    // Normalizar precioUnitario vs precioUnit
    const lineasNorm = (a.lineas || []).map(l => ({
      ...l,
      precioUnit: l.precioUnit !== undefined ? l.precioUnit : l.precioUnitario
    }));
    const pagosNorm = (a.pagos || []).map(p => ({ ...p }));
    
    const dias = diffDias(a.fechaDesde, a.fechaHasta);
    const totalLineas = lineasNorm.reduce((acc, l) => acc + l.cantidad * (l.precioUnit || 0), 0);
    const total = a.precioTotal !== undefined ? Number(a.precioTotal) : (totalLineas * dias);
    const pagado = pagosNorm.reduce((acc, p) => acc + Number(p.monto || 0), 0);
    const saldo = total - pagado;
    const estado = a.estado || estadoDesdeSaldo({ total, pagado, saldo });

    // Llenar DOM
    document.getElementById('infoId').textContent = a.idAlquiler || '-';
    document.getElementById('infoCliente').textContent = nombreCliente;
    document.getElementById('infoUbicacion').textContent = a.ubicacion || '-';
    document.getElementById('infoEstado').textContent = estado;

    const fDesde = a.fechaDesde ? formatFechaVisual(a.fechaDesde) : '';
    const fHasta = a.fechaHasta ? formatFechaVisual(a.fechaHasta) : '';
    document.getElementById('infoFecha').textContent = (fDesde && fHasta) ? `${fDesde} - ${fHasta} (${dias} días)` : (fDesde || fHasta || '-');

    // Unidades
    const ulUnidades = document.getElementById('infoUnidades');
    ulUnidades.innerHTML = lineasNorm.map(l => 
        `<li>${l.cantidad} x ${l.unidad || 'Unidad'} (${formatMoneda(l.precioUnit)})</li>`
    ).join('');
    if (!lineasNorm.length) ulUnidades.innerHTML = '<li>Sin unidades</li>';

    // Pagos
    document.getElementById('infoTotal').textContent = formatMoneda(total);
    document.getElementById('infoPagado').textContent = formatMoneda(pagado);
    document.getElementById('infoSaldo').textContent = formatMoneda(saldo);

    const tbodyPagosInfo = document.getElementById('infoPagosBody');
    tbodyPagosInfo.innerHTML = pagosNorm.map(p => `
        <tr>
            <td>${formatFechaVisual(p.fecha || p.fechaPago)}</td>
            <td>${p.metodo || '-'}</td>
            <td>${formatMoneda(p.monto)}</td>
        </tr>
    `).join('');
    if (!pagosNorm.length) tbodyPagosInfo.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin pagos</td></tr>';

    modalInfo.classList.remove('hidden');
  }

  // ------ Helpers formulario principal ------
  function clearFormAlquiler() {
    currentId = null;

    // selects: dejamos siempre la primera opción (placeholder “Seleccionar…”)
    if (selCliente && selCliente.options.length > 0) {
      selCliente.selectedIndex = 0;
    }

    inpUbicacion.value = '';
    inpDesde.value     = '';
    inpHasta.value     = '';

    if (selUnidad && selUnidad.options.length > 0) {
      selUnidad.selectedIndex = 0;
    }
    inpCantidad.value = '';

    inpMontoPagado.value = '';
    if (selMetodoPago && selMetodoPago.options.length > 0) {
      selMetodoPago.selectedIndex = 0;
    }

    lineas = [];
    pagos  = [];
    renderLineas();
    renderPagos();
  }

  function fillFormAlquiler(a) {
    currentId = a.idAlquiler;

    // cliente: buscamos por value (idCliente)
    selCliente.value = a.idCliente || '';

    inpUbicacion.value = a.ubicacion || '';
    inpDesde.value     = a.fechaDesde || '';
    inpHasta.value     = a.fechaHasta || '';

    // Mapeamos para normalizar precioUnitario (BD) a precioUnit (Front)
    lineas = (a.lineas || []).map(l => ({
      ...l,
      precioUnit: l.precioUnit !== undefined ? l.precioUnit : l.precioUnitario,
      idTipo: l.idTipo || l.idUnidad || l.idunidad // Recuperar idTipo desde la BD
    }));
    pagos = (a.pagos || []).map(p => ({ 
      ...p,
      fecha: p.fecha || p.fechaPago, // Mapear fechaPago de la BD a fecha del front
      monto: Number(p.monto || 0)    // Asegurar que sea número
    }));

    renderLineas();
    renderPagos();
  }

  // ------ Carga de combo clientes desde storage ------
  function fillClientesSelect() {
    selCliente.innerHTML = '<option value="" disabled selected>Seleccionar cliente</option>';
    CLIENTES_CACHE.forEach(c => {
      const nombre = (c.tipo === 'PERSONA' || c.tipo === 'persona')
        ? `${c.nombre} ${c.apellido}`.trim()
        : (c.razonSocial || '');
      if (!nombre) return;
      const opt = document.createElement('option');
      opt.value = c.idCliente;
      opt.textContent = nombre;
      selCliente.appendChild(opt);
    });
  }

  // ------ Carga de combo unidades desde BD ------
  function fillUnidadesSelect() {
    const currentVal = selUnidad.value; // Guardar selección actual
    selUnidad.innerHTML = '<option value="" disabled selected>Seleccionar unidad</option>';
    UNIDADES_CACHE.forEach(u => {
      if (!u.nombre) return; // Evitar items sin nombre

      // Precio: soporte para minúsculas/mayúsculas y validación numérica
      const precio = Number(u.precio) || 0;
      
      // Calcular stock restante dinámicamente
      const stockBase = u.disponibles !== undefined ? Number(u.disponibles) : 0;
      const enUso = lineas
        .filter(l => l.unidad === u.nombre)
        .reduce((acc, l) => acc + l.cantidad, 0);
      const stockMostrar = Math.max(0, stockBase - enUso);

      const opt = document.createElement('option');
      opt.value = u.nombre; 
      opt.textContent = `${u.nombre} (Disp: ${stockMostrar}) - ${formatMoneda(precio)}`;
      opt.dataset.precio = precio;
      opt.dataset.idTipo = u.idTipo || ''; // Guardamos el ID del tipo
      selUnidad.appendChild(opt);
    });

    // Restaurar selección si aún es válida
    if (currentVal) selUnidad.value = currentVal;
  }

  // ------ Init ------
  document.addEventListener('DOMContentLoaded', async () => {
    if (!initDomAlquileres()) return;

    CLIENTES_CACHE = await loadClientes();
    UNIDADES_CACHE = await loadUnidades();
    fillClientesSelect();
    fillUnidadesSelect();
    ALQUILERES = await loadAlquileres();
    renderTablaAlquileres();

    // Buscar
    if (txtBuscar) {
      txtBuscar.addEventListener('input', () => {
        renderTablaAlquileres(txtBuscar.value);
      });
    }

    // Botón + Nuevo -> limpia el formulario
    if (btnNuevoAlquiler) {
      btnNuevoAlquiler.addEventListener('click', clearFormAlquiler);
    }

    // Click en tabla principal (editar / eliminar)
    tbody.addEventListener('click', async e => {
      const btnEdit = e.target.getAttribute('data-edit');
      const btnDel  = e.target.getAttribute('data-del');
      const btnInfo = e.target.getAttribute('data-info');

      if (btnInfo) {
        const id = btnInfo;
        const alq = ALQUILERES.find(a => String(a.idAlquiler) === String(id));
        if (alq) showModalInfo(alq);
      }

      if (btnEdit) {
        const id = btnEdit; // ID como string (por si es UUID)
        const alq = ALQUILERES.find(a => String(a.idAlquiler) === String(id));
        if (alq) fillFormAlquiler(alq);
      }

      if (btnDel) {
        const id = btnDel;
        if (await window.confirmAction('¿Eliminar alquiler?', 'Esta acción no se puede deshacer.')) {
          try {
            await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            ALQUILERES = await loadAlquileres();
            renderTablaAlquileres(txtBuscar.value);
            if (currentId === id) clearFormAlquiler();
          } catch (err) {
            window.showAlert('Error', 'No se pudo eliminar', 'error');
          }
        }
      }
    });

    // Agregar unidad
    document.getElementById('btnAgregarUnidad')?.addEventListener('click', () => {
      const unidad = selUnidad.value;
      const cant   = Number(inpCantidad.value);

      if (!unidad) return window.showAlert('Atención', 'Seleccioná una unidad.', 'warning');
      if (!cant || cant <= 0) return window.showAlert('Atención', 'Ingresá una cantidad válida.', 'warning');

      // Obtenemos el precio del dataset de la opción seleccionada
      const precioUnit = Number(selUnidad.options[selUnidad.selectedIndex]?.dataset.precio) || 0;
      const idTipo = selUnidad.options[selUnidad.selectedIndex]?.dataset.idTipo;

      lineas.push({ unidad, cantidad: cant, precioUnit, idTipo });
      renderLineas();

      inpCantidad.value = '';
      if (selUnidad.options.length > 0) selUnidad.selectedIndex = 0;
    });

    // Borrar unidad
    tbodyLineas.addEventListener('click', e => {
      const idx = e.target.getAttribute('data-linea');
      if (idx !== null && idx !== undefined) {
        lineas.splice(Number(idx), 1);
        renderLineas();
      }
    });

    // Agregar pago
    btnAgregarPago?.addEventListener('click', () => {
      const monto  = Number(inpMontoPagado.value);
      const metodo = selMetodoPago.value;

      if (!monto || monto <= 0) return window.showAlert('Atención', 'Ingresá un monto válido.', 'warning');
      if (!metodo || metodo === '' || metodo.startsWith('Seleccionar')) {
        return window.showAlert('Atención', 'Seleccioná un método de pago.', 'warning');
      }

      const hoy = new Date();
      const fecha = hoy.toISOString().split('T')[0]; // YYYY-MM-DD para que la BD lo acepte

      pagos.push({ fecha, monto, metodo });
      renderPagos();

      inpMontoPagado.value = '';
      if (selMetodoPago.options.length > 0) selMetodoPago.selectedIndex = 0;
    });

    // Borrar pago
    tbodyPagos.addEventListener('click', e => {
      const idx = e.target.getAttribute('data-pago');
      if (idx !== null && idx !== undefined) {
        pagos.splice(Number(idx), 1);
        renderPagos();
      }
    });

    // Guardar alquiler (alta/edición)
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const idCliente  = selCliente.value;
      const ubicacion  = inpUbicacion.value.trim();
      const fechaDesde = inpDesde.value.trim();
      const fechaHasta = inpHasta.value.trim();

      if (!idCliente)                return window.showAlert('Atención', 'Seleccioná un cliente.', 'warning');
      if (!ubicacion)                return window.showAlert('Atención', 'Ingresá la ubicación.', 'warning');
      if (!lineas.length)            return window.showAlert('Atención', 'Agregá al menos una unidad.', 'warning');

      const dias = diffDias(fechaDesde, fechaHasta);
      const { total, pagado, saldo } = calcTotales(lineas, pagos, dias);
      const estadoCalculado = estadoDesdeSaldo({ total, pagado, saldo });

      const payload = {
        idCliente: idCliente,
        ubicacion,
        fechaDesde,
        fechaHasta,
        precioTotal: total,
        estado: estadoCalculado,
        lineas, // Se envían para que el backend las procese si tiene la lógica
        pagos
      };

      try {
        const method = currentId ? 'PUT' : 'POST';
        const url = currentId ? `${API_URL}/${currentId}` : API_URL;
        
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Error al guardar');
        }

        ALQUILERES = await loadAlquileres();
        renderTablaAlquileres(txtBuscar.value);
        clearFormAlquiler();
        window.showAlert('Éxito', 'Alquiler guardado', 'success');
      } catch (err) {
        window.showAlert('Error', err.message, 'error');
      }
    });

    // arrancamos con el formulario limpio y placeholders seleccionados
    clearFormAlquiler();

    // Exponer refresh para tabs externas
  window.refreshAlquileres = async function() {
    ALQUILERES = await loadAlquileres();
    renderTablaAlquileres(txtBuscar ? txtBuscar.value : '');
  };
  });


})();
