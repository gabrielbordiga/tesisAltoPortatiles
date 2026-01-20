(() => {
  'use strict';

  const LS_CURRENT = 'ap_current';
  const API_URL = '/api/usuarios';
  const API_AREAS = '/api/usuarios/areas';

  function getHeaders() {
    const token = localStorage.getItem('ap_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async function loadUsuarios() {
    try {
      const res = await fetch(API_URL, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar usuarios');
      const data = await res.json();

      return data.map(u => ({
        id: u.idUsuarios ?? u.id ?? u.auth_id,
        usuario: u.usuario,
        nombre: u.nombre,
        apellido: u.apellido,
        dni: u.dni,
        correo: u.email || u.correo,
        rol: u.rol || u.permisos,
        estado: (u.activo === true || u.activo === 'Activo') ? 'Activo' : 'Inactivo',
        area: u.idArea || u.id_area
      }));
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async function loadAreas() {
    try {
      const res = await fetch(API_AREAS, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar áreas');
      const areas = await res.json();
      let options = '<option value="">Seleccionar área...</option>';
      areas.forEach(a => { options += `<option value="${a.id}">${a.nombre}</option>`; });
      document.getElementById('area').innerHTML = options;
    } catch (error) { console.error("Error áreas:", error); }
  }

  function getCurrent() {
    const r = localStorage.getItem(LS_CURRENT);
    return r ? JSON.parse(r) : null;
  }
  function setCurrent(u) { localStorage.setItem(LS_CURRENT, JSON.stringify(u)); }
  function logoutToLogin() { localStorage.removeItem(LS_CURRENT); location.href = './login.html'; }

  let USUARIOS = [];
  const tbody = document.getElementById('tbodyUsuarios');
  const txtBuscar = document.getElementById('txtBuscar');
  const btnNuevo = document.getElementById('btnNuevo');

  const f = {
    id: document.getElementById('id'),
    nombre: document.getElementById('nombre'),
    apellido: document.getElementById('apellido'),
    dni: document.getElementById('dni'),
    usuario: document.getElementById('usuario'),
    correo: document.getElementById('correo'),
    pass: document.getElementById('pass'),
    pass2: document.getElementById('pass2'),
    chkPass: document.getElementById('chkCambiarPass'),
    lblPass: document.getElementById('lblCambiarPass'),
    rol: document.getElementById('rol'),
    estado: document.getElementById('estado'),
    area: document.getElementById('area'),
    form: document.getElementById('formUsuario'),
    cancelar: document.getElementById('btnCancelar')
  };

  // Referencias Modal Info
  const modalInfo = document.getElementById('modalInfoUsuario');
  const btnCerrarInfo = document.getElementById('btnCerrarInfo');

  function emailValido(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function normalize(s) { return String(s || '').trim().toLowerCase(); }

  function renderTabla(filtro = '') {
    const q = normalize(filtro);
    const data = USUARIOS.filter(u =>
      [u.usuario, u.nombre, u.apellido, u.dni, u.correo, u.rol, u.estado].some(val => normalize(val).includes(q))
    ).sort((a, b) => String(a.usuario).localeCompare(String(b.usuario)));

    tbody.innerHTML = data.map((u) => `
      <tr>
        <td>
          <div style="font-weight:500;">${u.nombre || ''} ${u.apellido || ''}</div>
          <div style="font-size:12px; color:#666;">${u.dni || ''}</div>
        </td>
        <td>${u.usuario}</td>
        <td>${u.correo}</td>
        <td><span class="tag">${u.rol}</span></td>
        <td><span class="tag">${u.estado}</span></td>
        <td>
          <button class="action info" data-info="${u.id}" title="Ver detalles">ℹ</button>
          <button class="action" data-edit="${u.id}">Editar</button>
          <button class="action danger" data-del="${u.id}">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  function clearForm() {
    f.form.reset();
    f.id.value = '';
    f.pass.disabled = false; f.pass2.disabled = false;
    f.pass.required = true; f.pass2.required = true;
    if (f.chkPass) f.chkPass.checked = false;
    if (f.lblPass) f.lblPass.classList.add('hidden');
  }

  function fillForm(user) {
    f.id.value = user.id;
    if(f.nombre) f.nombre.value = user.nombre || '';
    if(f.apellido) f.apellido.value = user.apellido || '';
    if(f.dni) f.dni.value = user.dni || '';
    f.usuario.value = user.usuario;
    f.correo.value = user.correo;
    f.pass.value = ''; f.pass2.value = '';
    f.pass.disabled = true; f.pass2.disabled = true;
    f.pass.required = false; f.pass2.required = false;
    f.rol.value = user.rol;
    f.estado.value = user.estado;
    f.area.value = user.area || '';
    if (f.chkPass) f.chkPass.checked = false;
    if (f.lblPass) f.lblPass.classList.remove('hidden');
  }

  function showInfo(u) {
    if (!modalInfo) return;
    document.getElementById('infoNombre').textContent = u.nombre || '-';
    document.getElementById('infoApellido').textContent = u.apellido || '-';
    document.getElementById('infoDni').textContent = u.dni || '-';
    document.getElementById('infoUsuario').textContent = u.usuario || '-';
    document.getElementById('infoCorreo').textContent = u.correo || '-';
    document.getElementById('infoRol').textContent = u.rol || '-';
    
    // Intentar buscar nombre del área en el select, sino mostrar ID
    let areaNombre = u.area;
    const areaOpt = document.querySelector(`#area option[value="${u.area}"]`);
    if(areaOpt) areaNombre = areaOpt.textContent;
    
    document.getElementById('infoArea').textContent = areaNombre || 'Sin área';
    document.getElementById('infoEstado').textContent = u.estado;
    modalInfo.classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadAreas();
    USUARIOS = await loadUsuarios();
    renderTabla();

    txtBuscar.addEventListener('input', () => renderTabla(txtBuscar.value));
    btnNuevo.addEventListener('click', clearForm);

    if (btnCerrarInfo) {
      btnCerrarInfo.addEventListener('click', () => modalInfo.classList.add('hidden'));
    }

    if (f.chkPass) {
      f.chkPass.addEventListener('change', () => {
        const h = f.chkPass.checked;
        f.pass.disabled = !h; f.pass2.disabled = !h;
        f.pass.required = h; f.pass2.required = h;
      });
    }

    tbody.addEventListener('click', async (e) => {
      const bInfo = e.target.closest('[data-info]');
      const bE = e.target.closest('[data-edit]');
      const bD = e.target.closest('[data-del]');
      if (bInfo) {
        const u = USUARIOS.find(x => String(x.id) === bInfo.dataset.info);
        if (u) showInfo(u);
      }
      if (bE) {
        const u = USUARIOS.find(x => String(x.id) === bE.dataset.edit);
        if (u) fillForm(u);
      }
      if (bD) {
        const id = bD.dataset.del;
        if (await window.confirmAction('¿Eliminar?', 'Esta acción es permanente.')) {
          try {
            const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: getHeaders() });
            if (!res.ok) throw new Error('Error al eliminar');
            USUARIOS = await loadUsuarios();
            renderTabla();
          } catch (err) { window.showAlert('Error', err.message, 'error'); }
        }
      }
    });

    // --- SUBMIT CORREGIDO  ---
    f.form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = f.id.value || null;
      const passVal = f.pass.value;

      if (!f.usuario.value.trim()) return window.showAlert('Error', 'Nombre requerido', 'error');
      if (!emailValido(f.correo.value)) return window.showAlert('Error', 'Correo inválido', 'error');
      
      if (!f.pass.disabled) {
        if (passVal !== f.pass2.value) return window.showAlert('Error', 'Las contraseñas no coinciden', 'error');
        if (passVal.length < 6) return window.showAlert('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
      }

      const payload = {
        nombre: f.nombre ? f.nombre.value.trim() : null,
        apellido: f.apellido ? f.apellido.value.trim() : null,
        dni: f.dni ? f.dni.value.trim() : null,
        usuario: f.usuario.value.trim(),
        correo: f.correo.value.trim(),
        rol: f.rol.value,
        estado: f.estado.value,
        id_area: f.area.value || null
      };

      if (!f.pass.disabled && passVal) {
        payload.contrasena = passVal;
      }

      try {
        const url = id ? `${API_URL}/${id}` : API_URL;
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(), 
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) { 
          window.showAlert('Éxito', id ? 'Usuario actualizado' : 'Usuario creado', 'success');
          USUARIOS = await loadUsuarios();
          renderTabla(txtBuscar.value);
          clearForm();
        } else {
          throw new Error(data.error || 'Error al guardar');
        }
      } catch (err) {
        window.showAlert('Error', err.message, 'error');
      }
    });

    f.cancelar.addEventListener('click', clearForm);
  });
})();