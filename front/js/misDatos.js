(() => {
    'use strict';
  
    const API_USUARIOS = '/api/usuarios';
    const API_AREAS    = '/api/usuarios/areas';
    const LS_CURRENT   = 'ap_current';
  
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
  
    let currentUserFull = null;

    // Helper para obtener el token y armar los headers
    function getHeaders() {
        const token = localStorage.getItem('ap_token'); // O 'token', según uses en login.js
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
  
    function getCurrentLocal() {
      const r = localStorage.getItem(LS_CURRENT);
      return r ? JSON.parse(r) : null;
    }
  
    async function init() {
      const localUser = getCurrentLocal();
      if (!localUser) return;

      try {
        // Agregamos headers para que la lista de usuarios no venga vacía
        const resU = await fetch(API_USUARIOS, { headers: getHeaders() });
        if (!resU.ok) throw new Error('Error al cargar datos de usuario');
        const usuarios = await resU.json();
        
        const miUsuario = usuarios.find(u => 
            String(u.idUsuarios || u.id) === String(localUser.idUsuarios || localUser.id)
        );
  
        if (!miUsuario) throw new Error('Usuario no encontrado');
        currentUserFull = miUsuario;
  
        let nombreArea = 'Sin área';
        const idAreaUser = miUsuario.idArea || miUsuario.id_area;
        
        if (idAreaUser) {
            // Agregamos headers para cargar las áreas
            const resA = await fetch(API_AREAS, { headers: getHeaders() });
            if (resA.ok) {
                const areas = await resA.json();
                const areaObj = areas.find(a => String(a.id) === String(idAreaUser));
                if (areaObj) nombreArea = areaObj.nombre;
            }
        }
  
        f.usuario.value = miUsuario.usuario || miUsuario.nombre || '';
        f.correo.value  = miUsuario.email || miUsuario.correo || '';
        f.rol.value     = miUsuario.rol || '';
        f.estado.value  = (miUsuario.activo) ? 'Activo' : 'Inactivo';
        f.area.value    = nombreArea;
  
      } catch (error) {
        console.error(error);
        window.showAlert('Error', 'Error al cargar tus datos: ' + error.message, 'error');
      }
    }
  
    f.form.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const p1 = f.pass.value;
      const p2 = f.pass2.value;
  
      if (!currentUserFull) return window.showAlert('Error', 'No se cargaron los datos.', 'error');
      if (!p1) return window.showAlert('Atención', 'Ingresá una nueva contraseña.', 'warning');
      if (p1 !== p2) return window.showAlert('Error', 'Las contraseñas no coinciden.', 'error');
      if (p1.length < 6) return window.showAlert('Error', 'Mínimo 6 caracteres para seguridad.', 'error');
  
      const id = currentUserFull.idUsuarios || currentUserFull.id;
      
      try {
        // ENVIAMOS EL PUT: Ahora el backend debe usar supabase.auth.admin.updateUserById
        const res = await fetch(`${API_USUARIOS}/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                nombre: f.usuario.value,
                correo: f.correo.value,
                contrasena: p1, // El controlador ahora usará esto para Auth
                permisos: f.rol.value,
                estado: f.estado.value,
                id_area: currentUserFull.idArea || currentUserFull.id_area
            })
        });
  
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Error al actualizar');
        }
        
        window.showAlert('Éxito', 'Contraseña actualizada correctamente en el sistema.', 'success');
        f.pass.value = '';
        f.pass2.value = '';
      } catch (error) {
        window.showAlert('Error', error.message, 'error');
      }
    });
  
    document.addEventListener('DOMContentLoaded', init);
  })();