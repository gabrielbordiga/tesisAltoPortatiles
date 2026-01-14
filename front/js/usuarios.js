(() => {
  'use strict';

  // ---- Storage helpers (mock persistente) ----
  const LS_CURRENT = 'ap_current';
  const API_URL    = '/api/usuarios';
  const API_AREAS  = '/api/usuarios/areas';

  // ➜ Carga desde el Backend
  async function loadUsuarios() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Error al cargar usuarios');
      const data = await res.json();
      
      // DEBUG: Ver en consola del navegador qué columnas llegan realmente
      console.log("Usuarios cargados:", data);

      // Mapeamos los campos de la BD (backend) a los que usa este archivo
      return data.map(u => {
        // 1. Estrategia robusta: probamos nombres conocidos
        let uid = u.idUsuarios ?? u.idusuarios ?? u.IDUsuario ?? u.id_usuario ?? u.id ?? u.IdUsuarios ?? u.IDUsuarios;

        // 2. Fallback dinámico: si sigue siendo nulo, buscamos cualquier propiedad que empiece con 'id'
        if (uid === undefined || uid === null) {
            const key = Object.keys(u).find(k => /^(id|id_)/i.test(k) && (typeof u[k] === 'number' || typeof u[k] === 'string'));
            if (key) uid = u[key];
        }
      
        return {
            id: uid,
            usuario: u.usuario || u.nombre || u.Nombre,
            correo: u.email || u.correo || u.CorreoElectronico,
            pass: u.contrasena || u.contrasenia || u.Contrasena || u.password || u.Password || u.clave || u.pass || '', 
            rol: u.rol || u.permisos || u.Permisos,
            estado: (u.activo === true || u.activo === 'true' || u.activo === 'Activo') ? 'Activo' : 'Inactivo',
            area: u.idArea || u.idarea || u.IDArea || u.id_area
        };
      });
    } catch (error) {
      console.error(error);
      window.showAlert('Error', 'No se pudo conectar con el servidor.', 'error');
      return [];
    }
  }

  // ➜ Cargar Áreas para el Select
  async function loadAreas() {
    try {
      const res = await fetch(API_AREAS);
      if (!res.ok) throw new Error('Error al cargar áreas');
      const areas = await res.json();
      
      console.log("Áreas recibidas del backend:", areas);

      // Llenar el select
      let options = '<option value="">Seleccionar área...</option>';
      areas.forEach(a => {
        if (a.id && a.nombre) {
            options += `<option value="${a.id}">${a.nombre}</option>`;
        }
      });
      f.area.innerHTML = options;
    } catch (error) {
      console.error("No se pudieron cargar las áreas:", error);
      f.area.innerHTML = '<option value="">Error al cargar áreas (ver consola)</option>';
    }
  }

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
    chkPass: document.getElementById('chkCambiarPass'),
    lblPass: document.getElementById('lblCambiarPass'),
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
      .sort((a,b) => {
        // Ordenamiento alfabético por usuario
        return String(a.usuario || '').localeCompare(String(b.usuario || ''));
      });

    tbody.innerHTML = data.map((u)=>`
      <tr>
        <td>${u.usuario}</td>
        <td>${u.correo}</td>
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
    f.pass.disabled = false;
    f.pass2.disabled = false;
    f.pass.required = true;
    f.pass2.required = true;
    f.rol.value = 'Empleado';
    f.estado.value = 'Activo';
    f.area.value = '';
    if (f.chkPass) f.chkPass.checked = false;
    if (f.lblPass) f.lblPass.classList.add('hidden');
    f.usuario.focus();
  }

  function fillForm(user){
    f.id.value = user.id;
    f.usuario.value = user.usuario;
    f.correo.value = user.correo;
    f.pass.value = '';
    f.pass2.value = '';
    f.pass.disabled = true;
    f.pass2.disabled = true;
    f.pass.required = false;
    f.pass2.required = false;
    f.rol.value = user.rol;
    f.estado.value = user.estado;
    f.area.value = user.area || '';
    if (f.chkPass) f.chkPass.checked = false;
    if (f.lblPass) f.lblPass.classList.remove('hidden');
  }

  // ---- Eventos ----
  document.addEventListener('DOMContentLoaded', async () => {
    // Cargamos desde la API
    await loadAreas(); // Cargar áreas primero
    USUARIOS = await loadUsuarios();
    renderTabla(); // Render inicial

    // Buscar
    txtBuscar.addEventListener('input', () => renderTabla(txtBuscar.value));

    // Nuevo
    btnNuevo.addEventListener('click', clearForm);

    // Checkbox cambiar contraseña
    if (f.chkPass) {
      f.chkPass.addEventListener('change', () => {
        const habilitar = f.chkPass.checked;
        f.pass.disabled = !habilitar;
        f.pass2.disabled = !habilitar;
        if (habilitar) {
          f.pass.required = true;
          f.pass2.required = true;
          f.pass.focus();
        } else {
          f.pass.required = false;
          f.pass2.required = false;
          f.pass.value = '';
          f.pass2.value = '';
        }
      });
    }

    // Click en acciones de la tabla
    tbody.addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('[data-edit]');
      const btnDel  = e.target.closest('[data-del]');

      if (btnEdit) {
        // Comparamos como String para soportar UUIDs
        const editId = btnEdit.dataset.edit;
        const u = USUARIOS.find(x => String(x.id) === editId);
        if (u) fillForm(u);
      }

      if (btnDel) {
        const rawId = btnDel.dataset.del;
        
        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            console.error("Fila sin ID válido (datos crudos):", btnDel.closest('tr'));
            return window.showAlert('Error', 'No se pudo leer el ID de la fila. Revisa la consola (F12) para ver los datos.', 'error');
        }

        const id = rawId; // Usamos el ID tal cual viene (puede ser UUID string)

        const me = getCurrent();
        if (me && String(me.idUsuarios) === String(id)) {
          return window.showAlert('Atención', 'No podés eliminar tu propio usuario mientras estás logueado.', 'warning');
        }
        if (await window.confirmAction('¿Eliminar usuario?', 'Esta acción no se puede deshacer.')) {
          try {
            const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || 'Error al eliminar');
            }
            
            USUARIOS = USUARIOS.filter(x => x.id !== id);
            renderTabla(txtBuscar.value);
            if (String(f.id.value) === String(id)) clearForm();
          } catch (err) {
            window.showAlert('Error', err.message, 'error');
          }
        }
      }
    });

    // Guardar (crear/editar)
    f.form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // 1. Objeto local para validaciones
      const localUser = {
        id: f.id.value ? f.id.value : null, // No forzamos Number()
        usuario: f.usuario.value.trim(),
        correo:  f.correo.value.trim(),
        pass:    f.pass.value,
        rol:     f.rol.value,
        estado:  f.estado.value,
        area:    f.area.value.trim()
      };

      // Validaciones mínimas
      if (!localUser.usuario) return window.showAlert('Error', 'Usuario requerido', 'error');
      if (!emailValido(localUser.correo)) return window.showAlert('Error', 'Correo inválido', 'error');
      if (!f.pass.disabled) {
        if (localUser.pass !== f.pass2.value) return window.showAlert('Error', 'Las contraseñas no coinciden', 'error');
        if (localUser.pass.length < 3) return window.showAlert('Error', 'Contraseña demasiado corta', 'error');
      }

      // 2. Payload mapeado para el Backend
      const backendPayload = {
        nombre: localUser.usuario,
        correo: localUser.correo,
        permisos: localUser.rol,
        estado: localUser.estado,
        id_area: localUser.area
      };

      if (!f.pass.disabled) {
        backendPayload.contrasena = localUser.pass;
      }

      const me = getCurrent();

      try {
        if (localUser.id) {
          // --- UPDATE (PUT) ---
          const res = await fetch(`${API_URL}/${localUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendPayload)
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("Error respuesta backend:", errData); // Para ver el error real en consola F12
            throw new Error(errData.error || 'Error al actualizar');
          }
          
          // Si estoy editando al usuario logueado:
          if (me && String(me.idUsuarios) === String(localUser.id)) {
            if (localUser.estado !== 'Activo') {
              await window.showAlert('Atención', 'Tu usuario fue marcado como Inactivo. Se cerrará la sesión.', 'warning');
              return logoutToLogin();
            }
            // actualizar ap_current con los nuevos datos visibles
            // Nota: mantenemos el token y idUsuarios, actualizamos el resto
            setCurrent({ ...me, usuario: localUser.usuario, rol: localUser.rol, idArea: localUser.area });
          }
        } else {
          // --- CREATE (POST) ---
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendPayload)
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al crear');
          }
        }
        
        // Recargamos la tabla desde el servidor para tener los IDs correctos
        USUARIOS = await loadUsuarios();
        renderTabla(txtBuscar.value);
        clearForm();
        window.showAlert('Éxito', 'Guardado', 'success');
      } catch (err) {
        let msg = err.message;
        if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
          if (msg.includes('usuario')) msg = 'Ese usuario ya existe.';
          else if (msg.includes('email') || msg.includes('correo')) msg = 'Ese correo ya está registrado.';
          else msg = 'Ya existe un registro con esos datos.';
          window.showAlert('Error', msg, 'warning');
        } else {
          window.showAlert('Error', 'Error al guardar: ' + msg, 'error');
        }
      }
    });

    // Cancelar
    f.cancelar.addEventListener('click', clearForm);
  });
})();
