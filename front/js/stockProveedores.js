(() => {
  'use strict';

  const API_URL = '/api/stock/proveedores';
  let PROVEEDORES = [];

  // DOM
  const tbody = document.getElementById('tbodyProveedores');
  const form = document.getElementById('formProveedor');
  const inpBuscar = document.getElementById('provBuscar');
  const btnCancelar = document.getElementById('provCancelar');

  // Inputs Form
  const inpId = document.getElementById('provId');
  const inpNombre = document.getElementById('provNombre');
  const inpTel = document.getElementById('provTelefono');
  const inpDir = document.getElementById('provDireccion');
  const inpEmail = document.getElementById('provEmail');

  async function loadProveedores() {
    try {
      const res = await fetch(API_URL);
      PROVEEDORES = res.ok ? await res.json() : [];
      render();
    } catch (e) { console.error(e); }
  }

  function render() {
    const q = (inpBuscar.value || '').toLowerCase();
    const filtrados = PROVEEDORES.filter(p => 
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.tel || '').includes(q) ||
      (p.direccion || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );

    tbody.innerHTML = filtrados.map(p => `
      <tr>
        <td data-label="Nombre">${p.nombre}</td>
        <td data-label="Teléfono">${p.tel || '-'}</td>
        <td data-label="Dirección">${p.direccion || '-'}</td>
        <td data-label="Email">${p.email || '-'}</td>
        <td class="acciones">
          <button class="action" onclick="window.editProveedor('${p.idProveedor}')">Editar</button>
          <button class="action danger" onclick="window.deleteProveedor('${p.idProveedor}')">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  function clearForm() {
    inpId.value = '';
    inpNombre.value = '';
    inpTel.value = '';
    if(inpDir) inpDir.value = '';
    if(inpEmail) inpEmail.value = '';
  }

  // Exponer funciones globales para onclick
  window.editProveedor = (id) => {
    const p = PROVEEDORES.find(x => x.idProveedor == id);
    if (!p) return;
    inpId.value = p.idProveedor;
    inpNombre.value = p.nombre;
    inpTel.value = p.tel || '';
    if(inpDir) inpDir.value = p.direccion || '';
    if(inpEmail) inpEmail.value = p.email || '';
  };

  window.deleteProveedor = async (id) => {
    if (!await window.confirmAction('¿Eliminar proveedor?', 'Se dará de baja.')) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadProveedores();
        window.showAlert('Éxito', 'Proveedor eliminado', 'success');
      }
    } catch (e) { window.showAlert('Error', 'No se pudo eliminar', 'error'); }
  };

  // Eventos
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = inpId.value;
    const payload = {
      nombre: inpNombre.value,
      tel: inpTel.value,
      direccion: inpDir ? inpDir.value : '',
      email: inpEmail ? inpEmail.value : ''
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_URL}/${id}` : API_URL;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al guardar');
      
      loadProveedores();
      clearForm();
      window.showAlert('Éxito', 'Proveedor guardado', 'success');
    } catch (err) { window.showAlert('Error', err.message, 'error'); }
  });

  btnCancelar.addEventListener('click', clearForm);
  inpBuscar.addEventListener('input', render);

  // Init
  loadProveedores();
})();