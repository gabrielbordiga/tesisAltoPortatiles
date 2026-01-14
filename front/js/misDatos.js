(() => {
    'use strict';
  
    const API_USUARIOS = '/api/usuarios';
    const API_AREAS    = '/api/usuarios/areas';
    const LS_CURRENT   = 'ap_current';
  
    // Referencias DOM
    const f = {
      usuario: document.getElementById('mdUsuario'),
      correo:  document.getElementById('mdCorreo'),
      rol:     document.getElementById('mdRol'),
      area:    document.getElementById('mdArea'),
      estado:  document.getElementById('mdEstado'),
      pass:    document.getElementById('mdPass'),
      pass2:   document.getElementById('mdPass2'),
      form:    document.getElementById('formMisDatos')
    };
  
    let currentUserFull = null; // Guardará el objeto completo traído de la BD
  
    function getCurrentLocal() {
      const r = localStorage.getItem(LS_CURRENT);
      return r ? JSON.parse(r) : null;
    }
  
    async function init() {
      const localUser = getCurrentLocal();
      if (!localUser) return; // app.js redirigirá si no hay sesión
  
      try {
        // 1. Traer todos los usuarios para encontrar el mío (ya que no tenemos endpoint GET /:id)
        const resU = await fetch(API_USUARIOS);
        if (!resU.ok) throw new Error('Error al cargar datos de usuario');
        const usuarios = await resU.json();
        
        // Buscamos por ID
        // Normalizamos IDs a string para comparar
        const miUsuario = usuarios.find(u => 
            String(u.idUsuarios || u.id || u.id_usuario) === String(localUser.idUsuarios || localUser.id)
        );
  
        if (!miUsuario) throw new Error('Usuario no encontrado en la base de datos');
        currentUserFull = miUsuario;
  
        // 2. Traer áreas para mostrar el nombre del área
        let nombreArea = 'Sin área';
        const idAreaUser = miUsuario.idArea || miUsuario.id_area;
        
        if (idAreaUser) {
            try {
                const resA = await fetch(API_AREAS);
                if (resA.ok) {
                    const areas = await resA.json();
                    const areaObj = areas.find(a => String(a.id) === String(idAreaUser));
                    if (areaObj) nombreArea = areaObj.nombre;
                }
            } catch (e) { console.error(e); }
        }
  
        // 3. Llenar formulario
        f.usuario.value = miUsuario.usuario || miUsuario.nombre || '';
        f.correo.value  = miUsuario.email || miUsuario.correo || '';
        f.rol.value     = miUsuario.rol || miUsuario.permisos || '';
        f.estado.value  = (miUsuario.activo) ? 'Activo' : 'Inactivo';
        f.area.value    = nombreArea;
  
      } catch (error) {
        console.error(error);
        window.showAlert('Error', 'Error al cargar tus datos: ' + error.message, 'error');
      }
    }
  
    // Manejo del submit
    f.form.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const p1 = f.pass.value;
      const p2 = f.pass2.value;
  
      if (!currentUserFull) return window.showAlert('Error', 'No se cargaron los datos del usuario.', 'error');
      if (!p1) return window.showAlert('Atención', 'Por favor ingresá una nueva contraseña.', 'warning');
      if (p1 !== p2) return window.showAlert('Error', 'Las contraseñas no coinciden.', 'error');
      if (p1.length < 3) return window.showAlert('Error', 'La contraseña es muy corta.', 'error');
  
      // Preparamos el payload. Debemos enviar TODOS los datos requeridos por editarUsuario
      // ya que es un PUT completo en el backend actual.
      const id = currentUserFull.idUsuarios || currentUserFull.id;
      
      const payload = {
        nombre: currentUserFull.usuario || currentUserFull.nombre,
        correo: currentUserFull.email || currentUserFull.correo,
        contrasena: p1, // La nueva contraseña
        permisos: currentUserFull.rol || currentUserFull.permisos,
        estado: (currentUserFull.activo) ? 'Activo' : 'Inactivo',
        id_area: currentUserFull.idArea || currentUserFull.id_area
      };
  
      try {
        const res = await fetch(`${API_USUARIOS}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
  
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("Error respuesta backend:", errData);
            throw new Error(errData.error || 'Error al actualizar contraseña');
        }
        
        window.showAlert('Éxito', 'Contraseña actualizada correctamente.', 'success');
        f.pass.value = '';
        f.pass2.value = '';
      } catch (error) {
        window.showAlert('Error', error.message, 'error');
      }
    });
  
    // Iniciar
    document.addEventListener('DOMContentLoaded', init);
  })();