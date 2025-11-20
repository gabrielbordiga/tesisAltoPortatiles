(() => {
  'use strict';

  // ---- Storage helpers (mock persistente) ----
  const LS_USERS   = 'ap_usuarios';
  const LS_CURRENT = 'ap_current';

  // ➜ No sembramos acá. El seed vive en app.js.
  function loadUsuarios() {
    const raw = localStorage.getItem(LS_USERS);
    return raw ? JSON.parse(raw) : [];
  }
  function saveUsuarios(list) { localStorage.setItem(LS_USERS, JSON.stringify(list)); }
  function getCurrent() {
    const r = localStorage.getItem(LS_CURRENT);
    return r ? JSON.parse(r) : null;
  }
  function setCurrent(u) { localStorage.setItem(LS_CURRENT, JSON.stringify(u)); }
  function logoutToLogin() { localStorage.removeItem(LS_CURRENT); location.href = './login.html'; }

  // ➜ Declaramos, pero asignamos cuando el DOM está listo
  let USUARIOS = [];

  // ---- DOM refs ----
  const tbody     = document.getElementById('tbodyUsuarios');
  const txtBuscar = document.getElementById('txtBuscar');
  const btnNuevo  = document.getElementById('btnNuevo');

  // Form
  const f = {
    id:     document.getElementById('id'),
    usuario:document.getElementById('usuario'),
    correo: document.getElementById('correo'),
    pass:   document.getElementById('pass'),
    pass2:  document.getElementById('pass2'),
    rol:    document.getElementById('rol'),
    estado: document.getElementById('estado'),
    area:   document.getElementById('area'),
    form:   document.getElementById('formUsuario'),
    cancelar: document.getElementById('btnCancelar')
  };

  // ---- Utils / Validaciones ----
  function maskPass(p){ return p ? '•'.repeat(Math.max(6, p.length)) : ''; }
  function emailValido(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function normalize(s){ return String(s||'').trim().toLowerCase(); }

  // ---- Render tabla ----
  function renderTabla(filtro='') {
    const q = normalize(filtro);
    const data = USUARIOS
      .filter(u =>
        [u.usuario,u.correo,u.rol,u.estado].some(val => normalize(val).includes(q))
      )
      .sort((a,b) => a.id - b.id);

    tbody.innerHTML = data.map((u)=>`
      <tr>
        <td>${u.id}</td>
        <td>${u.usuario}</td>
        <td>${u.correo}</td>
        <td>${maskPass(u.pass)}</td>
        <td><span class="tag">${u.rol}</span></td>
        <td><span class="tag">${u.estado}</span></td>
        <td>
          <button class="action" data-edit="${u.id}">Editar</button>
          <button class="action danger" data-del="${u.id}">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  // ---- Form helpers ----
  function clearForm() {
    f.id.value = '';
    f.usuario.value = '';
    f.correo.value = '';
    f.pass.value = '';
    f.pass2.value = '';
    f.rol.value = 'Empleado';
    f.estado.value = 'Activo';
    f.area.value = '';
    f.usuario.focus();
  }

  function fillForm(user){
    f.id.value = user.id;
    f.usuario.value = user.usuario;
    f.correo.value = user.correo;
    f.pass.value = user.pass;
    f.pass2.value = user.pass;
    f.rol.value = user.rol;
    f.estado.value = user.estado;
    f.area.value = user.area || '';
  }

  // ---- Eventos ----
  document.addEventListener('DOMContentLoaded', () => {
    // Cargamos después de que app.js ya sembró
    USUARIOS = loadUsuarios();
    renderTabla();

    // Buscar
    txtBuscar.addEventListener('input', () => renderTabla(txtBuscar.value));

    // Nuevo
    btnNuevo.addEventListener('click', clearForm);

    // Click en acciones de la tabla
    tbody.addEventListener('click', (e) => {
      const idEdit = e.target.getAttribute('data-edit');
      const idDel  = e.target.getAttribute('data-del');

      if (idEdit) {
        const u = USUARIOS.find(x => x.id === Number(idEdit));
        if (u) fillForm(u);
      }

      if (idDel) {
        const id = Number(idDel);
        const me = getCurrent();
        if (me && me.id === id) {
          return alert('No podés eliminar tu propio usuario mientras estás logueado.');
        }
        if (confirm('¿Eliminar usuario?')) {
          USUARIOS = USUARIOS.filter(x => x.id !== id);
          saveUsuarios(USUARIOS);
          renderTabla(txtBuscar.value);
          if (Number(f.id.value) === id) clearForm();
        }
      }
    });

    // Guardar (crear/editar)
    f.form.addEventListener('submit', (e) => {
      e.preventDefault();

      const payload = {
        id: f.id.value ? Number(f.id.value) : (Math.max(0,...USUARIOS.map(u=>u.id))+1),
        usuario: f.usuario.value.trim(),
        correo:  f.correo.value.trim(),
        pass:    f.pass.value,
        rol:     f.rol.value,
        estado:  f.estado.value,
        area:    f.area.value.trim()
      };

      // Validaciones mínimas
      if (!payload.usuario) return alert('Usuario requerido');
      if (!emailValido(payload.correo)) return alert('Correo inválido');
      if (payload.pass !== f.pass2.value) return alert('Las contraseñas no coinciden');
      if (payload.pass.length < 3) return alert('Contraseña demasiado corta');

      // Unicidad usuario/correo (case-insensitive)
      const idActual = payload.id;
      const dupUser = USUARIOS.some(u => normalize(u.usuario) === normalize(payload.usuario) && u.id !== idActual);
      if (dupUser) return alert('Ese nombre de usuario ya existe.');
      const dupMail = USUARIOS.some(u => normalize(u.correo) === normalize(payload.correo) && u.id !== idActual);
      if (dupMail) return alert('Ese correo ya está en uso.');

      const idx = USUARIOS.findIndex(u => u.id === payload.id);
      const me = getCurrent();

      if (idx >= 0) {
        // --- UPDATE ---
        USUARIOS[idx] = payload;

        // Si estoy editando al usuario logueado:
        if (me && me.id === payload.id) {
          if (payload.estado !== 'Activo') {
            alert('Tu usuario fue marcado como Inactivo. Se cerrará la sesión.');
            saveUsuarios(USUARIOS);
            return logoutToLogin();
          }
          // actualizar ap_current con los nuevos datos visibles
          setCurrent({ id: payload.id, usuario: payload.usuario, rol: payload.rol, area: payload.area });
        }
      } else {
        // --- CREATE ---
        USUARIOS.push(payload);
      }

      saveUsuarios(USUARIOS);
      renderTabla(txtBuscar.value);
      clearForm();
      alert('Guardado');
    });

    // Cancelar
    f.cancelar.addEventListener('click', clearForm);
  });
})();
