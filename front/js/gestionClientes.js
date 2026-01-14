(() => {
  'use strict';

  const API_URL = '/api/clientes';
  let CLIENTES = [];
  let tbody, txtBuscar, btnNuevo, form, f;

  // --------- Helpers API ---------
  async function loadClientes() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Error al cargar clientes');
      return await res.json();
    } catch (err) { return []; }
  }

  function normalize(s) { return String(s || '').trim().toLowerCase(); }

  // --------- Manejo de Errores Visuales ---------
  function mostrarError(elemento, mensaje) {
    elemento.classList.add('is-invalid');
    let errorPrevio = elemento.parentElement.querySelector('.error-message');
    if (errorPrevio) errorPrevio.remove();
    const span = document.createElement('span');
    span.className = 'error-message';
    span.innerText = mensaje;
    elemento.parentElement.appendChild(span);
  }

  function limpiarErrores() {
    form.querySelectorAll('.is-invalid').forEach(i => i.classList.remove('is-invalid'));
    form.querySelectorAll('.error-message').forEach(m => m.remove());
  }

  function validarFormulario() {
    let esValido = true;
    const tipo = selectedTipo();
    if (tipo === 'persona') {
      if (!f.nombre.value.trim()) { mostrarError(f.nombre, "Nombre obligatorio"); esValido = false; }
      if (!f.apellido.value.trim()) { mostrarError(f.apellido, "Apellido obligatorio"); esValido = false; }
      if (f.dni.value.length < 7) { mostrarError(f.dni, "DNI inválido"); esValido = false; }
    } else {
      if (!f.razonSocial.value.trim()) { mostrarError(f.razonSocial, "Razón social obligatoria"); esValido = false; }
    }
    if (f.cuit.value.length < 11) { mostrarError(f.cuit, "CUIT debe tener 11 dígitos"); esValido = false; }
    if (!f.ubicacion.value.trim()) { mostrarError(f.ubicacion, "Ubicación obligatoria"); esValido = false; }
    return esValido;
  }

  // --------- DOM Refs ---------
  function initDomRefs() {
    tbody = document.getElementById('tbodyClientes');
    txtBuscar = document.getElementById('buscarCliente');
    btnNuevo = document.getElementById('btnNuevoCliente');
    form = document.getElementById('formCliente');
    if (!tbody || !form) return false;
    f = {
      id: document.getElementById('clienteId'),
      tipoRadios: document.querySelectorAll('input[name="tipoCliente"]'),
      nombre: document.getElementById('nombre'),
      apellido: document.getElementById('apellido'),
      dni: document.getElementById('dni'),
      razonSocial: document.getElementById('razonSocial'),
      cuit: document.getElementById('cuit'),
      tel1: document.getElementById('tel1'),
      tel2: document.getElementById('tel2'),
      ubicacion: document.getElementById('ubicacion'),
      contribuyente: document.getElementById('contribuyente'),
      formPersona: document.getElementById('formPersona'),
      formEmpresa: document.getElementById('formEmpresa'),
      btnCancelar: document.getElementById('btnCancelarCliente')
    };
    return true;
  }

  function renderTabla(filtro = '') {
    const q = normalize(filtro);
    const data = CLIENTES.filter(c =>
      [c.nombre, c.apellido, c.razonSocial, c.cuit, c.dni].some(v => normalize(v).includes(q))
    );
    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial}</td>
        <td>${c.cuit}</td>
        <td>${c.dni || '-'}</td>
        <td>${c.tel1}</td>
        <td>${c.tel2 || '-'}</td>
        <td>${c.ubicacion}</td>
        <td>${c.contribuyente}</td>
        <td>
          <button class="action" data-edit="${c.idCliente}">Editar</button>
          <button class="action danger" data-del="${c.idCliente}">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  function selectedTipo() {
    let tipo = 'persona';
    f.tipoRadios.forEach(r => { if (r.checked) tipo = r.value; });
    return tipo;
  }

  function toggleTipo(tipo) {
    const labelCuit = document.getElementById('labelCuit');
    if (tipo === 'empresa') {
      f.formPersona.classList.add('hidden');
      f.formEmpresa.classList.remove('hidden');
      if (labelCuit) labelCuit.firstChild.textContent = 'CUIT Empresa ';
    } else {
      f.formPersona.classList.remove('hidden');
      f.formEmpresa.classList.add('hidden');
      if (labelCuit) labelCuit.firstChild.textContent = 'CUIT Persona ';
    }
  }

  function clearForm() {
    f.id.value = '';
    limpiarErrores();
    f.tipoRadios.forEach(r => r.checked = (r.value === 'persona'));
    toggleTipo('persona');
    form.querySelectorAll('.input').forEach(i => i.value = '');
    f.contribuyente.value = 'Consumidor final';
  }

  function fillForm(c) {
    f.id.value = c.idCliente;
    limpiarErrores();
    const tipoNorm = c.tipo.toLowerCase();
    f.tipoRadios.forEach(r => r.checked = (r.value === tipoNorm));
    toggleTipo(tipoNorm);
    f.nombre.value = c.nombre || '';
    f.apellido.value = c.apellido || '';
    f.dni.value = c.dni || '';
    f.razonSocial.value = c.razonSocial || '';
    f.cuit.value = c.cuit;
    f.tel1.value = c.tel1;
    f.tel2.value = c.tel2 || '';
    f.ubicacion.value = c.ubicacion;
    f.contribuyente.value = c.contribuyente;
    form.scrollIntoView({ behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!initDomRefs()) return;
    CLIENTES = await loadClientes();
    renderTabla();

    [f.cuit, f.tel1, f.tel2, f.dni].forEach(input => {
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
    });

    form.addEventListener('input', (e) => {
      if (e.target.classList.contains('is-invalid')) {
        e.target.classList.remove('is-invalid');
        const m = e.target.parentElement.querySelector('.error-message');
        if (m) m.remove();
      }
    });

    f.tipoRadios.forEach(r => r.addEventListener('change', () => toggleTipo(r.value)));
    if (txtBuscar) txtBuscar.addEventListener('input', () => renderTabla(txtBuscar.value));
    btnNuevo.addEventListener('click', clearForm);
    f.btnCancelar.addEventListener('click', clearForm);

    tbody.addEventListener('click', async (e) => {
      const idEdit = e.target.closest('[data-edit]')?.dataset.edit;
      const idDel = e.target.closest('[data-del]')?.dataset.del;
      if (idEdit) {
        const c = CLIENTES.find(x => x.idCliente === idEdit);
        if (c) fillForm(c);
      }
      if (idDel && confirm('¿Eliminar cliente?')) {
        await fetch(`${API_URL}/${idDel}`, { method: 'DELETE' });
        CLIENTES = await loadClientes();
        renderTabla();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limpiarErrores();
      if (!validarFormulario()) return;

      const tipo = selectedTipo();
      const id = f.id.value || null;
      const payload = {
        tipo: tipo.toUpperCase(),
        nombre: tipo === 'persona' ? f.nombre.value : '',
        apellido: tipo === 'persona' ? f.apellido.value : '',
        dni: tipo === 'persona' ? f.dni.value : '',
        razonSocial: tipo === 'empresa' ? f.razonSocial.value : '',
        cuit: f.cuit.value,
        tel1: f.tel1.value,
        tel2: f.tel2.value,
        ubicacion: f.ubicacion.value,
        contribuyente: f.contribuyente.value
      };

      const res = await fetch(id ? `${API_URL}/${id}` : API_URL, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 409) {
        const data = await res.json();
        if (confirm(data.mensaje)) {
          await fetch(`${API_URL}/${data.idCliente}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          CLIENTES = await loadClientes();
          renderTabla();
          clearForm();
        }
      } else if (res.ok) {
        CLIENTES = await loadClientes();
        renderTabla();
        clearForm();
        alert('Guardado con éxito');
      } else {
        const err = await res.json();
        if (err.error.includes('unique')) mostrarError(f.cuit, "CUIT ya activo");
      }
    });
  });
})();