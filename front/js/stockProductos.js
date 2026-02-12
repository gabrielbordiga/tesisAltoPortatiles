(() => {
  'use strict';

  const API_PROD = '/api/stock/productos';
  const API_COMPRAS = '/api/stock/compras';
  const API_PROV = '/api/stock/proveedores';

  let MOVIMIENTOS = [];
  let PRODUCTOS = [];
  let PROVEEDORES = [];

  // DOM
  const tbody = document.getElementById('tbodyMovimientos');
  const tbodyStock = document.getElementById('tbodyStock'); // Nueva tabla Stock
  const inpBuscar = document.getElementById('movBuscar');
  const inpStkBuscar = document.getElementById('stkBuscar'); // Buscador Stock
  const inpStkFiltroCant = document.getElementById('stkFiltroCant'); // Filtro Cantidad Stock
  const formMov = document.getElementById('formMovimiento');
  const btnCancelar = document.getElementById('movCancelar');

  // Inputs Movimiento
  let selProv = document.getElementById('movProveedor');
  let selProd = document.getElementById('movProducto');
  const inpFecha = document.getElementById('movFecha');
  const inpCant = document.getElementById('movCantidad');
  const inpPrecio = document.getElementById('movPrecio');
  const selMetodo = document.getElementById('movMetodo');

  // Modal Nuevo Producto
  const btnNuevoProd = document.getElementById('btnNuevoProducto');
  const modalProd = document.getElementById('modalNuevoProducto');
  const formNuevoProd = document.getElementById('formNuevoProducto');
  const btnCerrarModal = document.getElementById('btnCerrarNuevoProducto');
  const inpProdNombre = document.getElementById('prodNombre');
  const inpProdUnidad = document.getElementById('prodUnidad');

  //Modal Nueva unidad
  const selUnidad = document.getElementById('prodUnidadSelect');
  const inpNuevaUnidad = document.getElementById('prodUnidadNueva');
  const labelCombo = document.getElementById('labelComboUnidad');
  const labelNueva = document.getElementById('labelNuevaUnidad');

  // Modal Editar Stock
  const modalEditStock = document.getElementById('modalEditarStock');
  const formEditStock = document.getElementById('formEditarStock');
  const inpStkId = document.getElementById('stkIdProducto');
  const lblStkNombre = document.getElementById('stkNombreProducto');
  const inpStkActual = document.getElementById('stkCantidadActual');
  const inpStkNuevo = document.getElementById('stkNuevaCantidad');
  const btnCancelStock = document.getElementById('btnCancelarStock');

  // Estado de ordenamiento Stock
  let stkSort = { col: 'nombre', asc: true };

  // --- INYECCIÓN DE BOTÓN "EDITAR PRODUCTOS" ---
  (function injectGestionBtn() {
    if (!btnNuevoProd || document.getElementById('btnGestionProductos')) return;
    
    const btnEdit = document.createElement('button');
    btnEdit.id = 'btnGestionProductos';
    btnEdit.type = 'button';
    btnEdit.className = 'btn-plus'; // Reutilizamos estilo de botón cuadrado
    btnEdit.innerHTML = '✎'; // Icono de lápiz
    btnEdit.title = 'Gestionar Productos';
    btnEdit.style.marginLeft = '5px';
    btnEdit.style.fontSize = '16px';
    
    // Insertar después del botón "+"
    btnNuevoProd.parentNode.insertBefore(btnEdit, btnNuevoProd.nextSibling);

    btnEdit.addEventListener('click', () => {
        injectGestionModal();
        renderGestionProductos();
        document.getElementById('modalGestionProductos').classList.remove('hidden');
    });
  })();

  // --- MODAL GESTIÓN PRODUCTOS ---
  function injectGestionModal() {
    if (document.getElementById('modalGestionProductos')) return;
    const div = document.createElement('div');
    div.id = 'modalGestionProductos';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">Gestionar Productos</div>
        <div class="modal-body">
          <div class="tabla-wrap" style="max-height:300px; overflow-y:auto; margin-bottom:15px;">
            <table class="tabla-mini">
                <thead><tr><th>Nombre</th><th>Unidad</th><th style="text-align:right">Acción</th></tr></thead>
                <tbody id="tbodyGestionProductos"></tbody>
            </table>
          </div>
          <div class="form-actions right">
            <button type="button" class="btn outline" id="btnCerrarGestionProd">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    document.getElementById('btnCerrarGestionProd').addEventListener('click', () => div.classList.add('hidden'));
  }

  function renderGestionProductos() {
    const tbody = document.getElementById('tbodyGestionProductos');
    if (!tbody) return;
    tbody.innerHTML = PRODUCTOS.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td>${p.unidadMedida || '-'}</td>
            <td style="text-align:right"><button class="btn-icon-delete" onclick="window.deleteProducto('${p.idProducto}')" title="Eliminar">🗑</button></td>
        </tr>
    `).join('');
  }

  window.deleteProducto = async (id) => {
    if (!await window.confirmAction('¿Eliminar producto?', 'Se borrará de la lista.')) return;
    try {
        const res = await fetch(`${API_PROD}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('No se puede eliminar (posiblemente tenga compras asociadas).');
        
        window.showAlert('Éxito', 'Producto eliminado', 'success');
        await loadData(); // Recarga PRODUCTOS y MOVIMIENTOS
        renderGestionProductos(); // Actualiza la grilla del modal
    } catch (e) { window.showAlert('Error', e.message, 'error'); }
  };

  // --- MODAL EDICIÓN (Inyectado dinámicamente) ---
  function injectEditModal() {
    if (document.getElementById('modalEditCompra')) return;
    const div = document.createElement('div');
    div.id = 'modalEditCompra';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal modal-small">
        <div class="modal-header">Editar Cantidad</div>
        <div class="modal-body">
          <form id="formEditCompra" class="form-vertical">
            <input type="hidden" id="editCompraId">
            <label>
              Cantidad
              <input type="number" id="editCompraCantidad" class="input" step="1" required>
            </label>
            <div class="form-actions">
              <button type="button" class="btn outline" id="btnCancelEditCompra">Cancelar</button>
              <button type="submit" class="btn primary">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // Eventos del modal
    document.getElementById('btnCancelEditCompra').addEventListener('click', () => div.classList.add('hidden'));
    
    document.getElementById('formEditCompra').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editCompraId').value;
        const cant = document.getElementById('editCompraCantidad').value;
        
        try {
            const res = await fetch(`${API_COMPRAS}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cantidad: cant })
            });
            if (!res.ok) throw new Error('Error al actualizar');
            
            window.showAlert('Éxito', 'Cantidad actualizada', 'success');
            div.classList.add('hidden');
            loadData();
        } catch(err) { window.showAlert('Error', err.message, 'error'); }
    });
  }

  window.deleteMovimiento = async (id) => {
      if (!await window.confirmAction('¿Eliminar movimiento?', 'Se eliminará el registro de compra.')) return;
      try {
          const res = await fetch(`${API_COMPRAS}/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Error al eliminar');
          
          window.showAlert('Éxito', 'Movimiento eliminado', 'success');
          loadData();
      } catch (e) { window.showAlert('Error', e.message, 'error'); }
  };

  window.editMovimiento = (id) => {
      const m = MOVIMIENTOS.find(x => x.idCompra == id);
      if (!m) return;
      
      injectEditModal(); // Asegurar que existe
      const modal = document.getElementById('modalEditCompra');
      document.getElementById('editCompraId').value = m.idCompra;
      document.getElementById('editCompraCantidad').value = m.cantidad;
      modal.classList.remove('hidden');
  };

  function formatFecha(f) {
    if (!f) return '-';
    const [y, m, d] = f.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  async function loadData() {
    injectEditModal();
    try {
      const [resMov, resProd, resProv] = await Promise.all([
        fetch(API_COMPRAS),
        fetch(API_PROD),
        fetch(API_PROV)
      ]);
      
      if (resMov.ok) MOVIMIENTOS = await resMov.json();
      if (resProd.ok) {
            PRODUCTOS = await resProd.json();
            actualizarComboUnidades();
        }
      if (resProv.ok) PROVEEDORES = await resProv.json();
      
      fillSelects();
      renderTabla();
      renderStockTable();
    } catch (e) { console.error(e); }
  }

  function transformToSearchable(el, data, idKey, labelFn, placeholder) {
    if (el.tagName === 'INPUT' && el.type === 'hidden') {
      const container = el.parentNode;
      const dl = container.querySelector('datalist');
      dl.innerHTML = '';
      data.forEach(d => {
        const opt = document.createElement('option');
        opt.value = labelFn(d);
        dl.appendChild(opt);
      });
      return el;
    }

    // Transformación inicial
    const container = document.createElement('div');
    container.style.position = 'relative';

    const txt = document.createElement('input');
    txt.type = 'text';
    txt.className = 'input';
    txt.placeholder = placeholder;
    txt.setAttribute('list', 'dl-' + el.id);
    txt.autocomplete = 'off';

    const dl = document.createElement('datalist');
    dl.id = 'dl-' + el.id;
    data.forEach(d => {
      const opt = document.createElement('option');
      opt.value = labelFn(d);
      dl.appendChild(opt);
    });

    const hid = document.createElement('input');
    hid.type = 'hidden';
    hid.id = el.id; 
    hid.value = '';

    txt.addEventListener('input', () => {
      const val = txt.value;
      const found = data.find(d => labelFn(d) === val);
      hid.value = found ? found[idKey] : '';
    });
    
    txt.addEventListener('change', () => {
        const val = txt.value;
        const found = data.find(d => labelFn(d) === val);
        if (!found) { txt.value = ''; hid.value = ''; }
    });

    el.parentNode.replaceChild(container, el);
    container.appendChild(txt);
    container.appendChild(dl);
    container.appendChild(hid);
    return hid;
  }

  function fillSelects() {
    // Proveedores
    selProv = transformToSearchable(selProv, PROVEEDORES, 'idProveedor', p => p.nombre, 'Buscar proveedor...');

    // Productos
    selProd = transformToSearchable(selProd, PRODUCTOS, 'idProducto', p => `${p.nombre} (${p.unidadMedida || 'u'})`, 'Buscar producto...');
  }

  function renderTabla() {
    const q = (inpBuscar.value || '').toLowerCase();
    const filtrados = MOVIMIENTOS.filter(m => {
      const prov = m.Proveedores?.nombre || '';
      const prod = m.Productos?.nombre || '';
      const metodo = m.metodoPago || '';
      const texto = `${prov} ${prod} ${metodo} ${m.fecha}`.toLowerCase();
      return texto.includes(q);
    });

    // Ordenar por fecha descendente (más reciente primero)
    filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    tbody.innerHTML = filtrados.map(m => `
      <tr>
        <td data-label="Fecha">${formatFecha(m.fecha)}</td>
        <td data-label="Proveedor">${m.Proveedores?.nombre || 'Desconocido'}</td>
        <td data-label="Producto">${m.Productos?.nombre || 'Desconocido'}</td>
        <td data-label="Cantidad">${m.cantidad} ${m.Productos?.unidadMedida || ''}</td>
        <td data-label="Precio">$${Number(m.precio).toLocaleString('es-AR')}</td>
        <td data-label="Método">${m.metodoPago || '-'}</td>
        <td class="acciones">
          <button class="action" onclick="window.editMovimiento('${m.idCompra}')">Editar</button>
          <button class="action danger" onclick="window.deleteMovimiento('${m.idCompra}')">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  // --- RENDER TABLA STOCK (AGREGADO) ---
  function renderStockTable() {
    if (!tbodyStock) return;

    const q = (inpStkBuscar ? inpStkBuscar.value : '').toLowerCase().trim();
    const maxCant = inpStkFiltroCant ? parseFloat(inpStkFiltroCant.value) : NaN;
    
    // Calcular stock por producto sumando movimientos
    const stockMap = {};
    PRODUCTOS.forEach(p => stockMap[p.idProducto] = 0);
    
    MOVIMIENTOS.forEach(m => {
      if (stockMap[m.idProducto] !== undefined) {
        stockMap[m.idProducto] += Number(m.cantidad || 0);
      }
    });

    // Crear lista enriquecida
    let lista = PRODUCTOS.map(p => ({
      ...p,
      total: stockMap[p.idProducto] || 0
    }));

    // Filtrar
    lista = lista.filter(item => {
      const matchText = item.nombre.toLowerCase().includes(q);
      const matchCant = isNaN(maxCant) || item.total <= maxCant;
      return matchText && matchCant;
    });

    // Ordenar
    lista.sort((a, b) => {
      let valA = stkSort.col === 'cantidad' ? a.total : a.nombre.toLowerCase();
      let valB = stkSort.col === 'cantidad' ? b.total : b.nombre.toLowerCase();
      
      if (valA < valB) return stkSort.asc ? -1 : 1;
      if (valA > valB) return stkSort.asc ? 1 : -1;
      return 0;
    });

    // Renderizar
    tbodyStock.innerHTML = lista.map(p => {
        return `
            <tr>
                <td data-label="Producto">${p.nombre}</td>
                <td data-label="Unidad">${p.unidadMedida || '-'}</td>
                <td data-label="Cantidad Total" style="font-weight:bold; font-size:1.1em;">${p.total}</td>
                <td class="acciones">
                    <button class="action" onclick="window.openEditStock('${p.idProducto}', ${p.total}, '${p.nombre}')">✎ Editar</button>
                </td>
            </tr>
        `;
    }).join('');

    // Actualizar iconos de ordenamiento
    updateSortIcons();
  }

  function updateSortIcons() {
    const iconNombre = document.getElementById('sortIconNombre');
    const iconCant = document.getElementById('sortIconCantidad');
    if (iconNombre) iconNombre.textContent = stkSort.col === 'nombre' ? (stkSort.asc ? '▲' : '▼') : '↕';
    if (iconCant) iconCant.textContent = stkSort.col === 'cantidad' ? (stkSort.asc ? '▲' : '▼') : '↕';
  }

  // --- ABRIR MODAL AJUSTE STOCK ---
  window.openEditStock = (id, current, nombre) => {
      inpStkId.value = id;
      lblStkNombre.textContent = nombre;
      inpStkActual.value = current;
      inpStkNuevo.value = current;
      if (modalEditStock) modalEditStock.classList.remove('hidden');
  };

  // --- GUARDAR AJUSTE STOCK ---
  if (formEditStock) {
      formEditStock.addEventListener('submit', async (e) => {
          e.preventDefault();
          const idProd = inpStkId.value;
          const current = Number(inpStkActual.value);
          const target = Number(inpStkNuevo.value);
          
          if (current === target) {
              modalEditStock.classList.add('hidden');
              return;
          }

          const diff = target - current;
          
          // Creamos un movimiento de ajuste
          const payload = {
              idProducto: idProd,
              cantidad: diff,
              fecha: new Date().toISOString().split('T')[0],
              precio: 0,
              metodoPago: 'AJUSTE_STOCK',
              idProveedor: null // Ajuste interno
          };
          
          try {
               const res = await fetch(API_COMPRAS, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Error al ajustar stock');
                
                window.showAlert('Éxito', 'Stock ajustado', 'success');
                modalEditStock.classList.add('hidden');
                loadData();
          } catch (err) {
              window.showAlert('Error', err.message, 'error');
          }
      });
  }
  
  if (btnCancelStock) btnCancelStock.addEventListener('click', () => modalEditStock.classList.add('hidden'));

  // Guardar Compra
  formMov.addEventListener('submit', async (e) => {
    e.preventDefault();

    // VALIDACIÓN DE FECHA
    const fechaSeleccionada = new Date(inpFecha.value);
    const año = fechaSeleccionada.getFullYear();
    const hoy = new Date();

    if (año < 2020 || fechaSeleccionada > hoy) {
        return window.showAlert('Error', 'Por favor, ingrese una fecha válida y reciente.', 'error');
    }

    const payload = {
      idProveedor: selProv.value,
      idProducto: selProd.value,
      fecha: inpFecha.value,
      cantidad: inpCant.value,
      precio: inpPrecio.value,
      metodoPago: selMetodo.value ? selMetodo.value.toUpperCase() : null
    };

    if (!payload.idProveedor || !payload.idProducto) return window.showAlert('Atención', 'Complete todos los campos', 'warning');

    try {
      const res = await fetch(API_COMPRAS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al registrar compra');
      
      window.showAlert('Éxito', 'Compra registrada', 'success');
      formMov.reset();
      loadData(); // Recargar tabla
    } catch (err) { window.showAlert('Error', err.message, 'error'); }
  });

  // Nuevo Producto Modal
  btnNuevoProd.addEventListener('click', () => modalProd.classList.remove('hidden'));
  btnCerrarModal.addEventListener('click', () => modalProd.classList.add('hidden'));

  formNuevoProd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nombre: inpProdNombre.value,
      unidadMedida: selUnidad.value
    };
    try {
      const res = await fetch(API_PROD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al crear producto');
      
      window.showAlert('Éxito', 'Producto creado', 'success');
      modalProd.classList.add('hidden');
      formNuevoProd.reset();
      loadData(); // Recargar selects
    } catch (err) { window.showAlert('Error', err.message, 'error'); }
  });

  inpBuscar.addEventListener('input', renderTabla);
  btnCancelar.addEventListener('click', () => formMov.reset());

  // Listeners Stock (Búsqueda y Ordenamiento)
  if (inpStkBuscar) inpStkBuscar.addEventListener('input', renderStockTable);
  if (inpStkFiltroCant) inpStkFiltroCant.addEventListener('input', renderStockTable);

  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (stkSort.col === col) {
        stkSort.asc = !stkSort.asc;
      } else {
        stkSort.col = col;
        stkSort.asc = true;
      }
      renderStockTable();
    });
  });

  // 1. Llenar el combo con lo que ya existe en PRODUCTOS
  function actualizarComboUnidades() {
    if (!selUnidad) return;
    const unidadesExistentes = [...new Set(PRODUCTOS.map(p => p.unidadMedida).filter(u => u))];
    if (unidadesExistentes.length === 0) unidadesExistentes.push("unidades");
    selUnidad.innerHTML = unidadesExistentes.map(u => `<option value="${u}">${u}</option>`).join('');
  }

  // 2. Eventos para el intercambio
  document.addEventListener('click', (e) => {
      // Botón Lápiz (Habilitar edición)
      if (e.target && e.target.id === 'btnHabilitarNuevaUnidad') {
          labelCombo.classList.add('hidden');
          labelNueva.classList.remove('hidden');
          inpNuevaUnidad.focus();
      }
      
      // Botón Cancelar (Volver al combo)
      if (e.target && e.target.id === 'btnCancelarNuevaUnidad') {
          labelCombo.classList.remove('hidden');
          labelNueva.classList.add('hidden');
          inpNuevaUnidad.value = '';
      }

      // Botón OK (Guardar nueva unidad en el combo)
      if (e.target && e.target.id === 'btnGuardarNuevaUnidad') {
          const valor = inpNuevaUnidad.value.trim();
          if (valor === "") return;

          const existe = Array.from(selUnidad.options).some(opt => opt.value === valor);
          
          if (!existe) {
              const opt = document.createElement('option');
              opt.value = valor;
              opt.textContent = valor;
              selUnidad.appendChild(opt);
          }
          
          selUnidad.value = valor; 

          // Volver al modo combo
          labelCombo.classList.remove('hidden');
          labelNueva.classList.add('hidden');
          inpNuevaUnidad.value = '';
      }
  });

  document.getElementById('btnCancelarNuevaUnidad').addEventListener('click', () => {
      labelCombo.classList.remove('hidden');
      labelNueva.classList.add('hidden');
      inpNuevaUnidad.value = '';
  });

  // 3. Al tocar "OK", añadimos la unidad al combo y volvemos
  document.getElementById('btnGuardarNuevaUnidad').addEventListener('click', () => {
      const valor = inpNuevaUnidad.value.trim();
      if (valor === "") return;

      // Crear la nueva opción y seleccionarla
      const opt = document.createElement('option');
      opt.value = valor;
      opt.textContent = valor;
      opt.selected = true;
      
      selUnidad.appendChild(opt);

      // Volver al modo combo
      labelCombo.classList.remove('hidden');
      labelNueva.classList.add('hidden');
      inpNuevaUnidad.value = '';
  });

  // Init
  loadData();
})();