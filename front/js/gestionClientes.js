(() => {
  'use strict';

  const API_URL = '/api/clientes';

  // --------- Helpers API ---------
  async function loadClientes() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Error al cargar clientes');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  function normalize(s) {
    return String(s || '').trim().toLowerCase();
  }

  // --------- Estado ---------
  let CLIENTES = [];

  // --------- DOM refs (clientes) ---------
  let tbody, txtBuscar, btnNuevo, form, f;

  function initDomRefs() {
    tbody     = document.getElementById('tbodyClientes');
    txtBuscar = document.getElementById('buscarCliente');
    btnNuevo  = document.getElementById('btnNuevoCliente');
    form      = document.getElementById('formCliente');

    if (!tbody || !form) return false;

    f = {
      id:           document.getElementById('clienteId'),
      tipoRadios:   document.querySelectorAll('input[name="tipoCliente"]'),
      nombre:       document.getElementById('nombre'),
      apellido:     document.getElementById('apellido'),
      dni:          document.getElementById('dni'),
      razonSocial:  document.getElementById('razonSocial'),
      cuitEmpresa:  document.getElementById('cuitEmpresa'),
      cuit:         document.getElementById('cuit'),
      tel1:         document.getElementById('tel1'),
      tel2:         document.getElementById('tel2'),
      ubicacion:    document.getElementById('ubicacion'),
      contribuyente:document.getElementById('contribuyente'),
      formPersona:  document.getElementById('formPersona'),
      formEmpresa:  document.getElementById('formEmpresa'),
      btnCancelar:  document.getElementById('btnCancelarCliente')
    };
    return true;
  }


  // --------- Render tabla clientes ---------
  function renderTabla(filtro = '') {
    const q = normalize(filtro);
    const data = CLIENTES.filter(c =>
      [c.nombre, c.apellido, c.razonSocial, c.cuit, c.dni, c.ubicacion]
        .some(v => normalize(v).includes(q))
    );

    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.tipo === 'persona'
          ? `${c.nombre || ''} ${c.apellido || ''}`.trim()
          : (c.razonSocial || '')}</td>
        <td>${c.cuit || '-'}</td>
        <td>${c.dni || '-'}</td>
        <td>${c.tel1 || '-'}</td>
        <td>${c.tel2 || '-'}</td>
        <td>${c.ubicacion || '-'}</td>
        <td>${c.contribuyente || '-'}</td>
        <td>
          <button class="action" data-edit="${c.id}">Editar</button>
          <button class="action danger" data-del="${c.id}">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  // --------- Helpers formulario ---------
  function selectedTipo() {
    let tipo = 'persona';
    f.tipoRadios.forEach(r => { if (r.checked) tipo = r.value; });
    return tipo;
  }

  function toggleTipo(tipo) {
    if (tipo === 'empresa') {
      f.formPersona.classList.add('hidden');
      f.formEmpresa.classList.remove('hidden');
    } else {
      f.formPersona.classList.remove('hidden');
      f.formEmpresa.classList.add('hidden');
    }
  }

  function clearForm() {
    f.id.value = '';
    f.tipoRadios.forEach(r => { r.checked = (r.value === 'persona'); });
    toggleTipo('persona');

    f.nombre.value = '';
    f.apellido.value = '';
    f.dni.value = '';
    f.razonSocial.value = '';
    f.cuitEmpresa.value = '';
    f.cuit.value = '';
    f.tel1.value = '';
    f.tel2.value = '';
    f.ubicacion.value = '';
    f.contribuyente.value = 'Consumidor final';

    f.nombre.focus();
  }

  function fillForm(c) {
    f.id.value = c.id;
    f.tipoRadios.forEach(r => { r.checked = (r.value === c.tipo); });
    toggleTipo(c.tipo);

    f.nombre.value      = c.nombre || '';
    f.apellido.value    = c.apellido || '';
    f.dni.value         = c.dni || '';
    f.razonSocial.value = c.razonSocial || '';
    f.cuitEmpresa.value = c.cuitEmpresa || '';
    f.cuit.value        = c.cuit || '';
    f.tel1.value        = c.tel1 || '';
    f.tel2.value        = c.tel2 || '';
    f.ubicacion.value   = c.ubicacion || '';
    f.contribuyente.value = c.contribuyente || 'Consumidor final';
  }

  // --------- Init ---------
  document.addEventListener('DOMContentLoaded', async () => {
    if (!initDomRefs()) return; // si no está el panel de clientes, salimos

    CLIENTES = await loadClientes();
    renderTabla();

    // cambio persona/empresa
    f.tipoRadios.forEach(radio => {
      radio.addEventListener('change', () => toggleTipo(radio.value));
    });

    // búsqueda
    if (txtBuscar) {
      txtBuscar.addEventListener('input', () => renderTabla(txtBuscar.value));
    }

    // + Nuevo
    if (btnNuevo) {
      btnNuevo.addEventListener('click', clearForm);
    }

    // Cancelar
    if (f.btnCancelar) {
      f.btnCancelar.addEventListener('click', clearForm);
    }

    // Editar / eliminar
    tbody.addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('[data-edit]');
      const btnDel  = e.target.closest('[data-del]');

      if (btnEdit) {
        const id = Number(btnEdit.dataset.edit);
        const c = CLIENTES.find(x => x.id === id);
        if (c) fillForm(c);
      }

      if (btnDel) {
        const id = Number(btnDel.dataset.del);
        if (confirm('¿Eliminar cliente?')) {
          try {
            const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error al eliminar');
            
            CLIENTES = CLIENTES.filter(c => c.id !== id);
            renderTabla(txtBuscar.value);
            if (Number(f.id.value) === id) clearForm();
          } catch (err) {
            alert('Error al eliminar: ' + err.message);
          }
        }
      }
    });

    // Guardar (alta / edición)
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const tipo = selectedTipo();
      const id   = f.id.value ? Number(f.id.value) : null;

      const payload = {
        tipo,
        nombre:       tipo === 'persona' ? f.nombre.value.trim() : '',
        apellido:     tipo === 'persona' ? f.apellido.value.trim() : '',
        dni:          tipo === 'persona' ? f.dni.value.trim() : '',
        razonSocial:  tipo === 'empresa' ? f.razonSocial.value.trim() : '',
        cuitEmpresa:  tipo === 'empresa' ? f.cuitEmpresa.value.trim() : '',
        cuit:         f.cuit.value.trim() || (tipo === 'empresa' ? f.cuitEmpresa.value.trim() : ''),
        tel1:         f.tel1.value.trim(),
        tel2:         f.tel2.value.trim(),
        ubicacion:    f.ubicacion.value.trim(),
        contribuyente:f.contribuyente.value
      };

      if (tipo === 'persona' && !payload.nombre) {
        return alert('El nombre es obligatorio.');
      }
      if (tipo === 'empresa' && !payload.razonSocial) {
        return alert('La razón social es obligatoria.');
      }

      try {
        if (id) {
          // UPDATE
          const res = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Error al actualizar');
        } else {
          // CREATE
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Error al crear');
        }

        // Recargar todo para tener IDs correctos
        CLIENTES = await loadClientes();
        renderTabla(txtBuscar.value);
        clearForm();
        alert('Cliente guardado');
      } catch (err) {
        alert('Error al guardar: ' + err.message);
      }
    });

    clearForm();
  });
  
    // Exponer refresh para tabs externas
  window.refreshClientes = async function() {
    CLIENTES = await loadClientes();
    renderTabla(txtBuscar ? txtBuscar.value : '');
  };
})();
