(() => {
  'use strict';

  const KEY_ALQUILERES = 'ap_alquileres';
  const KEY_CLIENTES   = 'ap_clientes'; // para llenar combo de clientes

  // ------ Helpers de storage ------
  function loadAlquileres() {
    const raw = localStorage.getItem(KEY_ALQUILERES);
    return raw ? JSON.parse(raw) : [];
  }

  function saveAlquileres(list) {
    localStorage.setItem(KEY_ALQUILERES, JSON.stringify(list));
  }

  function loadClientes() {
    const raw = localStorage.getItem(KEY_CLIENTES);
    return raw ? JSON.parse(raw) : [];
  }

  // Semilla de ejemplo si está vacío
  function seedIfEmptyAlq() {
  const raw = localStorage.getItem(KEY_ALQUILERES);
  const arr = raw ? JSON.parse(raw) : [];
    if (!arr.length) {
      const seed = [
        {
          id: 1,
          numero: '001',
          cliente: 'Pedro Martínez',
          ubicacion: 'Obispo Salguero',
          fechaDesde: '2025-05-27',
          fechaHasta: '2025-05-31',
          lineas: [{ unidad: 'Baño estándar', cantidad: 5, precioUnit: 50000 }],
          pagos: [{ fecha: '25/05/2025', monto: 200000, metodo: 'Transferencia' }]
        }
      ];
      saveAlquileres(seed);
    }
  }

  // precios simulados por tipo de unidad
  const PRECIOS_UNIDAD = {
    'Baño estándar': 50000,
    'Baño para obras': 60000,
    'Baños VIP': 80000,
    'Cabinas de seguridad': 70000
  };

  function formatMoneda(n) {
    if (n == null || isNaN(n)) return '-';
    return '$' + Number(n).toLocaleString('es-AR');
  }

  function calcTotales(lineas, pagos) {
    const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnit, 0);
    const pagado = pagos.reduce((acc, p) => acc + p.monto, 0);
    const saldo = total - pagado;
    return { total, pagado, saldo };
  }

  function estadoDesdeSaldo({ total, pagado, saldo }) {
    if (total === 0) return 'Sin unidades';
    if (saldo <= 0) return 'Pagado';
    if (pagado > 0) return 'Pago parcial';
    return 'Pendiente';
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

  function initDomAlquileres() {
    tbody         = document.getElementById('tbodyAlquileres');
    txtBuscar     = document.getElementById('buscarAlquiler');
    form          = document.getElementById('formAlquiler');
    btnNuevoAlquiler = document.getElementById('btnNuevoAlquiler');

    if (!tbody || !form) return false;

    selCliente    = document.getElementById('alqCliente');
    inpUbicacion  = document.getElementById('alqUbicacion');
    inpDesde      = document.getElementById('fechaDesde');
    inpHasta      = document.getElementById('fechaHasta');

    selUnidad     = document.getElementById('tipoUnidadAlq');
    inpCantidad   = document.getElementById('cantidadUnidadAlq');
    tbodyLineas   = document.getElementById('tbodyLineasUnidades');

    inpMontoPagado = document.getElementById('montoPagado');
    selMetodoPago  = document.getElementById('metodoPago');
    btnAgregarPago = document.getElementById('btnAgregarPago');
    tbodyPagos     = document.getElementById('tbodyPagos');

    return true;
  }

  // ------ Render tabla principal ------
  function renderTablaAlquileres(filtro = '') {
    const q = String(filtro || '').trim().toLowerCase();

    tbody.innerHTML = ALQUILERES
      .filter(a =>
        [a.numero, a.cliente, a.ubicacion].some(v =>
          String(v || '').toLowerCase().includes(q)
        )
      )
      .map(a => {
        const { total, pagado, saldo } = calcTotales(a.lineas || [], a.pagos || []);
        const unidadesTexto = (a.lineas || [])
          .map(l => `${l.cantidad} ${l.unidad.toLowerCase()}`)
          .join(', ') || '-';

        const fechaRango = `${a.fechaDesde || ''} - ${a.fechaHasta || ''}`.trim();
        return `
        <tr>
          <td>${a.numero}</td>
          <td>${a.cliente}</td>
          <td>${a.ubicacion}</td>
          <td>${fechaRango}</td>
          <td>${unidadesTexto}</td>
          <td>${estadoDesdeSaldo({ total, pagado, saldo })}</td>
          <td>${formatMoneda(saldo)}</td>
          <td>
            <button class="action" data-edit="${a.id}">Editar</button>
            <button class="action danger" data-del="${a.id}">🗑</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  // ------ Render mini tabla de unidades ------
  function renderLineas() {
    tbodyLineas.innerHTML = lineas.map((l, i) => `
      <tr>
        <td>${l.unidad}</td>
        <td>${l.cantidad}</td>
        <td>${formatMoneda(l.precioUnit)}</td>
        <td>${formatMoneda(l.cantidad * l.precioUnit)}</td>
        <td class="col-icon-remove" data-linea="${i}">✖</td>
      </tr>
    `).join('');

    const totales = calcTotales(lineas, pagos);
    const totalSpan = document.querySelector('.mini-table-block .precio-total-resaltado');
    if (totalSpan) totalSpan.textContent = formatMoneda(totales.total);

    renderPagos(); // actualiza saldo en pagos
  }

  // ------ Render mini tabla de pagos ------
  function renderPagos() {
    const totales = calcTotales(lineas, pagos);
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
        <td>${p.fecha}</td>
        <td>${formatMoneda(p.monto)}</td>
        <td>${p.metodo}</td>
        <td class="saldo-pendiente">${formatMoneda(saldo)}</td>
        <td class="col-icon-remove" data-pago="${i}">✖</td>
      </tr>
    `).join('');
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
    currentId = a.id;

    // cliente: buscamos por texto
    if (selCliente && selCliente.options.length > 0) {
      let found = false;
      Array.from(selCliente.options).forEach((opt, idx) => {
        if (opt.text === a.cliente) {
          selCliente.selectedIndex = idx;
          found = true;
        }
      });
      if (!found) selCliente.selectedIndex = 0;
    }

    inpUbicacion.value = a.ubicacion || '';
    inpDesde.value     = a.fechaDesde || '';
    inpHasta.value     = a.fechaHasta || '';

    lineas = Array.isArray(a.lineas) ? JSON.parse(JSON.stringify(a.lineas)) : [];
    pagos  = Array.isArray(a.pagos)  ? JSON.parse(JSON.stringify(a.pagos))  : [];

    renderLineas();
    renderPagos();
  }

  // ------ Carga de combo clientes desde storage ------
  function fillClientesSelect() {
    const clientes = loadClientes();
    selCliente.innerHTML = '<option value="" disabled selected>Seleccionar cliente</option>';
    clientes.forEach(c => {
      const nombre = c.tipo === 'persona'
        ? `${c.nombre} ${c.apellido}`.trim()
        : (c.razonSocial || '');
      if (!nombre) return;
      const opt = document.createElement('option');
      opt.value = nombre;
      opt.textContent = nombre;
      selCliente.appendChild(opt);
    });
  }

  // ------ Init ------
  document.addEventListener('DOMContentLoaded', () => {
    if (!initDomAlquileres()) return;

    fillClientesSelect();
    seedIfEmptyAlq();
    ALQUILERES = loadAlquileres();
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
    tbody.addEventListener('click', e => {
      const btnEdit = e.target.getAttribute('data-edit');
      const btnDel  = e.target.getAttribute('data-del');

      if (btnEdit) {
        const id = Number(btnEdit);
        const alq = ALQUILERES.find(a => a.id === id);
        if (alq) fillFormAlquiler(alq);
      }

      if (btnDel) {
        const id = Number(btnDel);
        if (confirm('¿Eliminar alquiler?')) {
          ALQUILERES = ALQUILERES.filter(a => a.id !== id);
          saveAlquileres(ALQUILERES);
          renderTablaAlquileres(txtBuscar.value);
          if (currentId === id) clearFormAlquiler();
        }
      }
    });

    // Agregar unidad
    document.getElementById('btnAgregarUnidad')?.addEventListener('click', () => {
      const unidad = selUnidad.value;
      const cant   = Number(inpCantidad.value);

      if (!unidad) return alert('Seleccioná una unidad.');
      if (!cant || cant <= 0) return alert('Ingresá una cantidad válida.');

      const precioUnit = PRECIOS_UNIDAD[unidad] || 50000;

      lineas.push({ unidad, cantidad: cant, precioUnit });
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

      if (!monto || monto <= 0) return alert('Ingresá un monto válido.');
      if (!metodo || metodo === '' || metodo.startsWith('Seleccionar')) {
        return alert('Seleccioná un método de pago.');
      }

      const hoy = new Date();
      const fecha = hoy.toLocaleDateString('es-AR');

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
    form.addEventListener('submit', e => {
      e.preventDefault();

      const cliente    = selCliente.value || '';
      const clienteTxt = selCliente.options[selCliente.selectedIndex]?.text || '';
      const ubicacion  = inpUbicacion.value.trim();
      const fechaDesde = inpDesde.value.trim();
      const fechaHasta = inpHasta.value.trim();

      if (!cliente || !clienteTxt)   return alert('Seleccioná un cliente.');
      if (!ubicacion)                return alert('Ingresá la ubicación.');
      if (!lineas.length)            return alert('Agregá al menos una unidad.');

      const id = currentId ?? (Math.max(0, ...ALQUILERES.map(a => a.id)) + 1);
      const numero = currentId
        ? (ALQUILERES.find(a => a.id === currentId)?.numero || String(id).padStart(3, '0'))
        : String(id).padStart(3, '0');

      const nuevo = {
        id,
        numero,
        cliente: clienteTxt,
        ubicacion,
        fechaDesde,
        fechaHasta,
        lineas: JSON.parse(JSON.stringify(lineas)),
        pagos:  JSON.parse(JSON.stringify(pagos))
      };

      const idx = ALQUILERES.findIndex(a => a.id === id);
      if (idx >= 0) {
        ALQUILERES[idx] = nuevo;
      } else {
        ALQUILERES.push(nuevo);
      }

      saveAlquileres(ALQUILERES);
      renderTablaAlquileres(txtBuscar.value);
      clearFormAlquiler();
      alert('Alquiler guardado');
    });

    // arrancamos con el formulario limpio y placeholders seleccionados
    clearFormAlquiler();

    // Exponer refresh para tabs externas
  window.refreshAlquileres = function() {
    ALQUILERES = loadAlquileres();
    renderTablaAlquileres(txtBuscar ? txtBuscar.value : '');
  };
  });


})();
