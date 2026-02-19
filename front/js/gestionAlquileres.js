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
    if (saldo <= 0 && total > 0) return 'COMPLETO';
    return 'PARCIAL';
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
  let UNIDADES_DISPONIBLES_RANGO = [];
  let currentId = null;   // null = nuevo
  let lineas = [];        // unidades del alquiler que se está editando
  let pagos  = [];        // pagos del alquiler que se está editando
  let ubicacionValida = false; // Para verificar que la ubicación existe
  let userLat = null, userLon = null;
  let sortState = { col: null, asc: true }; // Estado de ordenamiento

  // Obtener ubicación actual para ordenar sugerencias
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      userLat = p.coords.latitude;
      userLon = p.coords.longitude;
    }, err => console.warn("Ubicación no disponible:", err));
  }

  // ------ DOM refs ------
  let tbody, txtBuscar, form, btnNuevoAlquiler;
  let selCliente, inpUbicacion, inpDesde, inpHasta;
  let selUnidad, inpCantidad, tbodyLineas;
  let inpMontoPagado, selMetodoPago, btnAgregarPago, tbodyPagos;
  let modalInfo, btnCerrarInfo;
  let inpClienteNombre; // Input de texto para búsqueda con datalist

  // Helper distancia (Haversine)
  function getDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // ------ Autocomplete Helper ------
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function setupAutocomplete(input) {
    if (!input || input.dataset.autocompleteInit) return;
    input.dataset.autocompleteInit = 'true';

    // Wrapper para posicionar la lista
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    
    // Insertar wrapper y mover input dentro
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    // Crear lista UL
    const ul = document.createElement('ul');
    ul.className = 'suggestions-list hidden';
    wrapper.appendChild(ul);

    // Crear mensaje de error (NUEVO)
    const errorMsg = document.createElement('div');
    errorMsg.style.color = 'var(--rojo)';
    errorMsg.style.fontSize = '12px';
    errorMsg.style.marginTop = '4px';
    errorMsg.style.display = 'none';
    errorMsg.textContent = 'La ubicación cargada se puede visualizar de manera incorrecta o no visualizarse';
    wrapper.appendChild(errorMsg);
    input._errorMsgElement = errorMsg;

    const fetchAddress = async (q) => {
        try {
            // Usamos Nominatim (OpenStreetMap)
            // Pedimos 10 para tener margen de ordenamiento
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=10`;
            
            // Si tenemos ubicación, enviamos viewbox para ayudar a la API
            if (userLat && userLon) {
                const box = [userLon-0.5, userLat+0.5, userLon+0.5, userLat-0.5].join(',');
                url += `&viewbox=${box}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                let data = await res.json();
                // Ordenar por cercanía si tenemos coordenadas
                if (userLat && userLon) {
                    data.sort((a, b) => getDistancia(userLat, userLon, a.lat, a.lon) - getDistancia(userLat, userLon, b.lat, b.lon));
                }
                renderSuggestions(data.slice(0, 5));
            }
        } catch (e) { console.error("Error autocompletado:", e); }
    };

    const updateValidationUI = () => {
        if (ubicacionValida || input.value.trim() === '') {
            errorMsg.style.display = 'none';
        } else {
            errorMsg.style.display = 'block';
        }
    };

    const renderSuggestions = (data) => {
        ul.innerHTML = '';
        if (!data || !data.length) {
            ul.classList.add('hidden');
            return;
        }
        data.forEach(item => {
            const li = document.createElement('li');
            
            // Formatear dirección: Calle Nro, Barrio, Ciudad
            const a = item.address || {};
            const calle = a.road || a.pedestrian || '';
            const nro = a.house_number || '';
            const barrio = a.neighbourhood || a.suburb || a.residential || '';
            const ciudad = a.city || a.town || a.village || a.municipality || '';

            let texto = [calle + (nro ? ' ' + nro : ''), barrio, ciudad].filter(Boolean).join(', ');
            if (!texto || !calle) texto = item.display_name; // Fallback si no hay datos suficientes

            li.textContent = texto;
            li.addEventListener('click', () => {
                input.value = texto;
                ubicacionValida = true; // Validado
                updateValidationUI();
                ul.classList.add('hidden');
                input.classList.remove('is-invalid');
            });
            ul.appendChild(li);
        });
        ul.classList.remove('hidden');
    };

    const onInput = debounce((e) => {
        const val = e.target.value.trim();
        ubicacionValida = false; // Al escribir se invalida hasta seleccionar
        if (val.length < 3) {
            ul.classList.add('hidden');
            return;
        }
        fetchAddress(val);
    }, 500);

    input.addEventListener('input', (e) => {
        ubicacionValida = false;
        updateValidationUI();
        onInput(e);
    });

    // Cerrar lista si click fuera
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) ul.classList.add('hidden');
    });
  }

  function injectModalRegistro() {
    if (document.getElementById('modalRegistroAlquiler')) return;
    const div = document.createElement('div');
    div.id = 'modalRegistroAlquiler';
    div.className = 'modal-overlay hidden';
    div.style.zIndex = '1001'; // Por encima del modal de info
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">Registro de Cambios</div>
        <div class="modal-body">
          <h3 id="regTitulo" style="text-align:center; margin-bottom:15px; font-size:16px; color:var(--rojo);"></h3>
          <div class="tabla-wrap" style="max-height:300px; overflow-y:auto;">
            <table class="tabla-mini">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th>Empleado</th>
                </tr>
              </thead>
              <tbody id="tbodyRegistro"></tbody>
            </table>
          </div>
          <div class="form-actions right" style="margin-top:15px;">
            <button type="button" class="btn outline" id="btnCerrarRegistro">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById('btnCerrarRegistro').addEventListener('click', () => {
        div.classList.add('hidden');
    });
  }

  function injectModalInfo() {
    if (document.getElementById('modalInfoAlquiler')) return;
    const div = document.createElement('div');
    div.id = 'modalInfoAlquiler';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">Detalle del Alquiler</div>
        <div class="modal-body" style="font-size:14px;">
          <input type="hidden" id="infoIdHidden">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
             <div><strong>Pedido:</strong> <span id="infoId"></span></div>
             <div style="display:flex; align-items:center; gap:6px;">
                <strong>Estado:</strong> 
                <select id="infoEstadoSelect" class="input" style="padding:2px 4px; height:28px; font-size:13px; width:auto;">
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="ENTREGADO">ENTREGADO</option>
                    <option value="PARA RETIRAR">PARA RETIRAR</option>
                    <option value="RETIRADO">RETIRADO</option>
                    <option value="SERVICIO PENDIENTE">SERVICIO PENDIENTE</option>
                    <option value="FINALIZADO">FINALIZADO</option>
                </select>
                <button id="btnUpdateEstado" class="action" title="Guardar estado" style="padding:2px 6px; height:28px;">💾</button>
             </div>
             <div style="grid-column:1/-1"><strong>Estado Pago:</strong> <span id="infoEstadoPago"></span></div>
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
            <button type="button" class="btn" id="btnVerRegistro" style="background:#666; color:#fff; margin-right:auto;">Ver Registro</button>
            <button type="button" class="btn outline" id="btnCerrarInfo">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // Evento para guardar el cambio de estado desde el modal
    document.getElementById('btnUpdateEstado').addEventListener('click', async () => {
      const id = document.getElementById('infoIdHidden').value;
      const nuevoEstado = document.getElementById('infoEstadoSelect').value;
      
      // Obtenemos el usuario logueado desde el localStorage
      const userSession = JSON.parse(localStorage.getItem('ap_current') || '{}');
      const idUsuarioLogueado = userSession.idUsuarios || userSession.id;
      
      // Buscamos el alquiler actual para preservar sus datos obligatorios
      const alq = ALQUILERES.find(a => String(a.idAlquiler || a.idalquiler) === String(id));
      if (!alq) return;

      // Preparamos payload incluyendo el idUsuarioEjecutor
      const payload = {
          idCliente: alq.idCliente || alq.idcliente,
          ubicacion: alq.ubicacion,
          fechaDesde: alq.fechaDesde || alq.fechadesde,
          fechaHasta: alq.fechaHasta || alq.fechahasta,
          precioTotal: alq.precioTotal !== undefined ? alq.precioTotal : alq.preciototal,
          estado: nuevoEstado,
          idUsuarioEjecutor: idUsuarioLogueado // Identificamos quién realiza el cambio
      };

      try {
          const res = await fetch(`${API_URL}/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          
          if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || 'Error al actualizar estado');
          }
          
          window.showAlert('Éxito', 'Estado actualizado', 'success');
          
          // Recargamos datos de fondo
          ALQUILERES = await loadAlquileres();
          renderTablaAlquileres(txtBuscar ? txtBuscar.value : '');
          
      } catch (e) { 
          window.showAlert('Error', e.message, 'error'); 
      }
    });

    // Evento para ver registro
    document.getElementById('btnVerRegistro').addEventListener('click', () => {
        const id = document.getElementById('infoIdHidden').value;
        if (id) showRegistro(id);
    });
  }

  async function showRegistro(id) {
      const modal = document.getElementById('modalRegistroAlquiler');
      const tbody = document.getElementById('tbodyRegistro');;
      const titulo = document.getElementById('regTitulo');
      
      titulo.textContent = `Historial del Alquiler #${id.substring(0, 8)}...`;
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Cargando historial...</td></tr>';
      modal.classList.remove('hidden')

      try {
          if (!id || id === 'undefined') throw new Error("ID de alquiler no válido.");
          
          // Llamada a la nueva ruta que configuraremos en el backend
          const res = await fetch(`${API_URL}/${id}/historial`);
          if (!res.ok) throw new Error('No se pudo cargar el historial.');
          
          const data = await res.json();
          
          if (!data || !data.length) {
              tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Sin movimientos registrados.</td></tr>';
              return;
          }

          tbody.innerHTML = data.map(r => {
            const nombreEmpleado = (r.Usuarios && r.Usuarios.nombre) 
                ? `${r.Usuarios.nombre} ${r.Usuarios.apellido}` 
                : 'Sistema';

            return `
                <tr>
                    <td>${formatFechaVisual(r.fecha)}</td>
                    <td>${r.detalle}</td>
                    <td>${nombreEmpleado}</td>
                </tr>
            `;
          }).join('');
          
      } catch (e) {
          tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red; padding:20px;">${e.message}</td></tr>`;
      }
  }

  function initDomAlquileres() {
    injectModalInfo();
    injectModalRegistro();
    tbody         = document.getElementById('tbodyAlquileres');
    txtBuscar     = document.getElementById('buscarAlquiler');
    form          = document.getElementById('formAlquiler');
    btnNuevoAlquiler = document.getElementById('btnNuevoAlquiler');

    if (!tbody || !form) return false;

    // Transformar el SELECT de clientes en un INPUT + DATALIST
    const originalSel = document.getElementById('alqCliente');
    if (originalSel && originalSel.tagName === 'SELECT') {
      const container = document.createElement('div');
      
      inpClienteNombre = document.createElement('input');
      inpClienteNombre.id = 'alqClienteInput';
      inpClienteNombre.type = 'text';
      inpClienteNombre.className = 'input';
      inpClienteNombre.setAttribute('list', 'dlClientes');
      inpClienteNombre.placeholder = 'Buscar cliente...';
      inpClienteNombre.autocomplete = 'off';

      const dl = document.createElement('datalist');
      dl.id = 'dlClientes';

      const hid = document.createElement('input');
      hid.type = 'hidden';
      hid.id = 'alqCliente'; // Mismo ID para mantener compatibilidad

      originalSel.parentNode.replaceChild(container, originalSel);
      container.appendChild(inpClienteNombre);
      container.appendChild(dl);
      container.appendChild(hid);

      selCliente = hid; // selCliente ahora apunta al hidden input (guarda el ID)

      // Al escribir, buscamos el ID correspondiente en el cache
      inpClienteNombre.addEventListener('input', () => {
        const val = inpClienteNombre.value;
        const found = CLIENTES_CACHE.find(c => getClienteLabel(c) === val);
        selCliente.value = found ? found.idCliente : '';
      });
    } else {
      // Fallback por si ya se transformó
      selCliente = document.getElementById('alqCliente');
      inpClienteNombre = document.getElementById('alqClienteInput');
    }

    inpUbicacion  = document.getElementById('alqUbicacion');
    setupAutocomplete(inpUbicacion); // Activar autocompletado
    inpDesde      = document.getElementById('fechaDesde');
    inpHasta      = document.getElementById('fechaHasta');

    inpDesde.addEventListener('change', fillUnidadesSelect);
    inpHasta.addEventListener('change', fillUnidadesSelect);

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
    const table = tbody.closest('table');
    if (table) {
        const ths = table.querySelectorAll('thead th');
        // Mapeo de índices a claves de ordenamiento
        // 1: Cliente, 3: Fecha, 5: Estado, 6: Pendiente
        const mapSort = {
            1: 'nombreCliente',
            3: 'fechaDesde',
            5: 'estado',
            6: 'saldo'
        };

        ths.forEach((th, idx) => {
            if (th.textContent.trim() === 'Saldo') th.textContent = 'Pendiente';
            
            if (mapSort[idx]) {
                th.style.cursor = 'pointer';
                th.title = 'Ordenar';
                th.addEventListener('click', () => {
                    const key = mapSort[idx];
                    sortState.asc = (sortState.col === key) ? !sortState.asc : true;
                    sortState.col = key;
                    renderTablaAlquileres(txtBuscar.value);
                });
            }
        });
    }

    return true;
  }

  // ------ Render tabla principal ------
  function renderTablaAlquileres(filtro = '') {
    const q = String(filtro || '').trim().toLowerCase();

    // 1. Pre-procesar datos (Enriquecer)
    let data = ALQUILERES.map(a => {
        // Mapear idCliente a Nombre usando la caché
        const c = CLIENTES_CACHE.find(x => String(x.idCliente) === String(a.idCliente));
        const nombreCliente = c 
          ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) 
          : 'Cliente desconocido';
        
        // Normalizar ID por si viene en minúsculas desde el backend
        const idAlquiler = a.idAlquiler || a.idalquiler;

        const dias = diffDias(a.fechaDesde, a.fechaHasta);
        // Usar precioTotal de la BD si existe, sino calcularlo de las líneas
        const totalLineas = (a.lineas || []).reduce((acc, l) => acc + l.cantidad * (l.precioUnit || l.precioUnitario || 0), 0);
        const total = a.precioTotal !== undefined ? Number(a.precioTotal) : (totalLineas * dias);
        const pagado = (a.pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);
        const saldo = total - pagado;

        return { ...a, idAlquiler, nombreCliente, saldo, total, pagado, dias };
    });

    // 2. Filtrar
    data = data.filter(a =>
        [String(a.idAlquiler), a.nombreCliente, a.ubicacion].some(v =>
          String(v || '').toLowerCase().includes(q)
        )
    );

    // 3. Ordenar
    if (sortState.col) {
        data.sort((a, b) => {
            let valA = a[sortState.col];
            let valB = b[sortState.col];

            // Manejo de strings case-insensitive y nulos
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA == null) valA = '';
            if (valB == null) valB = '';

            if (valA < valB) return sortState.asc ? -1 : 1;
            if (valA > valB) return sortState.asc ? 1 : -1;
            return 0;
        });
    }

    // 4. Renderizar HTML
    tbody.innerHTML = data.map(a => {
        const unidadesTexto = (a.lineas || [])
          .map(l => `${l.cantidad} ${(l.unidad || '').toLowerCase()}`)
          .join(', ') || '-';

        const fDesde = a.fechaDesde ? formatFechaVisual(a.fechaDesde) : '';
        const fHasta = a.fechaHasta ? formatFechaVisual(a.fechaHasta) : '';
        const fechaRango = (fDesde && fHasta) ? `${fDesde} - ${fHasta} (${a.dias} días)` : (fDesde || fHasta || '-');

        // Acortar visualmente el ID si es muy largo (ej. UUID)
        const idRaw = String(a.idAlquiler);
        const idDisplay = idRaw.length > 8 ? idRaw.slice(0, 8) + '...' : idRaw.padStart(3, '0');

        // --- LÓGICA DE ESTADOS RESALTADOS ---
        const estadoRaw = a.estado || 'PENDIENTE';
        const estadoClase = estadoRaw.toLowerCase().replace(/ /g, '-');

        return `
        <tr>
          <td title="${idRaw}">${idDisplay}</td>
          <td>${a.nombreCliente}</td>
          <td>${a.ubicacion}</td>
          <td>${fechaRango}</td>
          <td>${unidadesTexto}</td>
          <td><span class="status-badge ${estadoClase}">${estadoRaw}</span></td>
          <td>${formatMoneda(a.saldo)}</td>
          <td>
            <button class="action info" data-info="${a.idAlquiler}" title="Ver detalles">ℹ</button>
            <button class="action" data-edit="${a.idAlquiler}">Editar</button>
            <button class="action danger" data-del="${a.idAlquiler}">🗑</button>
          </td>
        </tr>`;
      })
      .join('');

    updateSortIcons();
  }

  function updateSortIcons() {
      const table = tbody.closest('table');
      if (!table) return;
      const ths = table.querySelectorAll('thead th');
      const mapSort = { 1: 'nombreCliente', 3: 'fechaDesde', 5: 'estado', 6: 'saldo' };

      ths.forEach((th, idx) => {
          if (mapSort[idx]) {
              // Limpiar iconos previos
              let text = th.textContent.replace(/ [▲▼]$/, '');
              if (sortState.col === mapSort[idx]) {
                  text += sortState.asc ? ' ▲' : ' ▼';
              }
              th.textContent = text;
          }
      });
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
    
    const idReal = a.idAlquiler || a.idalquiler;
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
    
    const estadoPago = estadoDesdeSaldo({ total, pagado, saldo });
    const estadoAlquiler = a.estado || 'PENDIENTE';

    // Llenar DOM
    document.getElementById('infoIdHidden').value = idReal;
    document.getElementById('infoId').textContent = idReal || '-';
    document.getElementById('infoCliente').textContent = nombreCliente;
    document.getElementById('infoUbicacion').textContent = a.ubicacion || '-';
    document.getElementById('infoEstadoSelect').value = estadoAlquiler; // Seteamos el select
    document.getElementById('infoEstadoPago').textContent = estadoPago;

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

    if (selCliente) selCliente.value = '';
    if (inpClienteNombre) inpClienteNombre.value = '';

    inpUbicacion.value = '';
    ubicacionValida = false; // Resetear validación
    if (inpUbicacion._errorMsgElement) inpUbicacion._errorMsgElement.style.display = 'none';
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
    currentId = a.idAlquiler || a.idalquiler;

    selCliente.value = a.idCliente || '';
    
    if (inpClienteNombre) {
      const c = CLIENTES_CACHE.find(x => String(x.idCliente) === String(a.idCliente));
      inpClienteNombre.value = c ? getClienteLabel(c) : '';
    }

    inpUbicacion.value = a.ubicacion || '';
    ubicacionValida = true; 
    if (inpUbicacion._errorMsgElement) inpUbicacion._errorMsgElement.style.display = 'none';
    inpDesde.value     = a.fechaDesde || '';
    inpHasta.value     = a.fechaHasta || '';

    // Mapeamos para normalizar precioUnitario (BD) a precioUnit (Front)
    lineas = (a.lineas || []).map(l => ({
      ...l,
      idTipo: l.idTipo || l.idUnidad || l.idunidad, 
      precioUnit: l.precioUnit !== undefined ? l.precioUnit : l.precioUnitario,
      unidad: l.unidad || 'Unidad'
    }));

    pagos = (a.pagos || []).map(p => ({ 
      ...p,
      fecha: p.fecha || p.fechaPago,
      monto: Number(p.monto || 0)
    }));

    renderLineas();
    renderPagos();
  }

  function getClienteLabel(c) {
    const nombre = (c.tipo === 'PERSONA' || c.tipo === 'persona')
      ? `${c.nombre} ${c.apellido}`.trim()
      : (c.razonSocial || '');
    const doc = c.cuit || c.dni || '';
    return `${nombre} (${doc})`;
  }

  // ------ Carga de combo clientes desde storage ------
  function fillClientesSelect() {
    const dl = document.getElementById('dlClientes');
    if (!dl) return;
    dl.innerHTML = '';

    CLIENTES_CACHE.forEach(c => {
      const label = getClienteLabel(c);
      const opt = document.createElement('option');
      opt.value = label;
      dl.appendChild(opt);
    });
  }

  // ------ Carga de combo unidades desde BD ------
async function fillUnidadesSelect() {
    const desde = inpDesde.value;
    const hasta = inpHasta.value;

    if (!desde || !hasta) {
        if (UNIDADES_CACHE.length > 0) {
            renderizarOpcionesUnidad(UNIDADES_CACHE);
        }
        return;
    }

    try {
        const res = await fetch(`/api/unidades/disponibilidad?desde=${desde}&hasta=${hasta}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('ap_token')}` }
        });
        const unidades = await res.ok ? await res.json() : [];
        UNIDADES_DISPONIBLES_RANGO = unidades;
        renderizarOpcionesUnidad(unidades);
    } catch (e) { console.error("Error stock dinámico:", e); }
}

function renderizarOpcionesUnidad(lista) {
    selUnidad.innerHTML = '<option value="" disabled selected>Seleccionar unidad</option>';
    lista.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.nombre;
        const disp = u.disponibles ?? u.stock ?? 0; 
        const precio = u.precio ?? u.precioUnitario ?? 0;

        opt.textContent = `${u.nombre} - ${formatMoneda(precio)}`;
        opt.dataset.precio = precio;
        opt.dataset.idTipo = u.idTipo;
        opt.dataset.disponibles = disp;
        selUnidad.appendChild(opt);
    });
}

  // ------ Init ------
  document.addEventListener('DOMContentLoaded', async () => {
    if (!initDomAlquileres()) return;

    CLIENTES_CACHE = await loadClientes();
    UNIDADES_CACHE = await loadUnidades(); 
    fillClientesSelect();
    fillUnidadesSelect(); // <--- Llamada inmediata al iniciar el módulo
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
        const alq = ALQUILERES.find(a => String(a.idAlquiler || a.idalquiler) === String(id));
        if (alq) showModalInfo(alq);
      }

      if (btnEdit) {
        const id = btnEdit; // ID como string (por si es UUID)
        const alq = ALQUILERES.find(a => String(a.idAlquiler || a.idalquiler) === String(id));
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
      const sel = selUnidad.options[selUnidad.selectedIndex];
      if (!sel || !sel.value) return window.showAlert('Atención', 'Seleccioná una unidad.', 'warning');

      const idTipo = sel.dataset.idTipo;
      const cantNueva = Number(inpCantidad.value);

      // Sumar lo que el usuario ya puso en la grilla actual (antes de guardar)
      const yaEnGrillaTemporal = lineas
          .filter(l => String(l.idTipo) === String(idTipo))
          .reduce((acc, curr) => acc + curr.cantidad, 0);

      const disponibleEnServer = Number(sel.dataset.disponibles);

      // NUEVO MENSAJE Y LÓGICA
      if ((yaEnGrillaTemporal + cantNueva) > disponibleEnServer) {
          let msg = `No hay stock suficiente. `;
          if (yaEnGrillaTemporal > 0) {
              msg += `Ya agregaste ${yaEnGrillaTemporal} a este pedido y solo quedan ${disponibleEnServer} en total.`;
          } else {
              msg += `Solo hay ${disponibleEnServer} unidades disponibles para estas fechas.`;
          }
          return window.showAlert('Sin Stock', msg, 'error');
      }

      lineas.push({ 
          unidad: sel.value, 
          cantidad: cantNueva, 
          precioUnit: Number(sel.dataset.precio), 
          idTipo: idTipo
      });
      
      renderLineas();
      inpCantidad.value = '';
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

      // Normalizar: Mayúsculas y sin acentos (ej: "Crédito" -> "CREDITO")
      const metodoNorm = metodo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      pagos.push({ fecha, monto, metodo: metodoNorm });
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

      // 1. CAPTURA INICIAL DE VARIABLES
      const idCliente = selCliente.value; 
      const fDesde = inpDesde.value;
      const fHasta = inpHasta.value;
      const ubicacion = inpUbicacion.value.trim();

      // --- NUEVAS VALIDACIONES DE FECHA ---
      const fDesdeDate = new Date(fDesde);
      const fHastaDate = new Date(fHasta);
      const hoy = new Date();
      const añoActual = hoy.getFullYear();

      console.log("ID del Cliente a enviar:", idCliente); 
      if (!idCliente) {
          return window.showAlert('Error', 'Selecciona un cliente de la lista desplegable', 'error');
      }

      // A. Validar campos básicos
      if (!idCliente || !lineas.length || !fDesde || !fHasta) {
          return window.showAlert('Atención', 'Completa cliente, fechas y al menos una unidad.', 'warning');
      }

      // B. Validar que no sea un año muy viejo 
      if (fDesdeDate.getFullYear() < (añoActual - 1)) {
          return window.showAlert('Fecha Inválida', `La fecha de inicio no puede ser anterior a ${añoActual - 1}.`, 'error');
      }

      // C. Validar que la duración no sea eterna 
      const limiteFuturo = new Date();
      limiteFuturo.setFullYear(añoActual + 2);
      if (fHastaDate > limiteFuturo) {
          return window.showAlert('Rango Excesivo', 'El periodo de alquiler no puede superar los 2 años a futuro.', 'error');
      }

      // D. Validar coherencia (ya lo hace el navegador, pero por seguridad)
      if (fHastaDate < fDesdeDate) {
          return window.showAlert('Error', 'La fecha de fin no puede ser anterior a la de inicio.', 'error');
      }

      try {

        const resCheck = await fetch(`/api/unidades/disponibilidad?desde=${fDesde}&hasta=${fHasta}&excluir=${currentId || ''}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ap_token')}` }
        });
        const disponibilidadFresca = await resCheck.json();

        for (const linea of lineas) {
            const infoServer = disponibilidadFresca.find(u => String(u.idTipo) === String(linea.idTipo));
            
            if (infoServer) {
                let unidadesQueYaTeniaEstePedido = 0;
                // Si estoy EDITANDO, le sumo al disponible lo que este pedido ya ocupaba
                if (currentId) {
                    const alqOriginal = ALQUILERES.find(a => String(a.idAlquiler || a.idalquiler) === String(currentId));
                    const lineaOriginal = alqOriginal?.lineas?.find(l => String(l.idTipo || l.idUnidad) === String(linea.idTipo));
                    unidadesQueYaTeniaEstePedido = lineaOriginal ? (Number(lineaOriginal.cantidad) || 0) : 0;
                }

                const cupoMaximoParaEsteCliente = Number(infoServer.disponibles) + unidadesQueYaTeniaEstePedido;

                if (Number(linea.cantidad) > cupoMaximoParaEsteCliente) {
                    // SI NO HAY STOCK, CORTAMOS TODO AQUÍ
                    return window.showAlert(
                        'Stock Insuficiente', 
                        `No se puede guardar. Para estas fechas solo quedan ${cupoMaximoParaEsteCliente} unidades de "${linea.unidad}".`, 
                        'error'
                    );
                }
            }
        }

          // 4. DEFINICIÓN DE ESTADO (Soluciona el ReferenceError)
          let estadoFinal = 'PENDIENTE'; 
          if (currentId) {
              const actual = ALQUILERES.find(a => String(a.idAlquiler || a.idalquiler) === String(currentId));
              if (actual) estadoFinal = actual.estado;
          }

          // 5. PREPARAR PAYLOAD Y GUARDAR
          const dias = diffDias(fDesde, fHasta);
          const totalesActuales = calcTotales(lineas, pagos, dias);

          const payload = {
              idCliente,
              ubicacion,
              fechaDesde: fDesde,
              fechaHasta: fHasta,
              precioTotal: totalesActuales.total,
              estado: estadoFinal,
              lineas: lineas, 
              pagos: pagos,
              idUsuarioEjecutor: JSON.parse(localStorage.getItem('ap_current'))?.idUsuarios
          };

          const method = currentId ? 'PUT' : 'POST';
          const url = currentId ? `${API_URL}/${currentId}` : API_URL;
          const user = JSON.parse(localStorage.getItem('ap_current'));
          console.log("DEBUG ENVÍO:", {
              cliente: idCliente,
              usuario: user?.idUsuarios || user?.id,
              precio: totalesActuales.total
          });

          const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar');

          window.showAlert('Éxito', 'Alquiler guardado correctamente', 'success');
          clearFormAlquiler();
          ALQUILERES = await loadAlquileres();
          renderTablaAlquileres();

      } catch (err) { 
          console.error("Error en submit:", err);
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
