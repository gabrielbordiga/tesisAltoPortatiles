const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

// 1. Obtener todos los usuarios
exports.obtenerUsuarios = async (req, res) => {
    const { data, error } = await supabase
        .from('Usuarios')
        .select('*')
        .order('idUsuarios', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};

// 1.5. Obtener todas las áreas 
exports.obtenerAreas = async (req, res) => {
    let { data, error } = await supabase.from('Areas').select('*');
    if (error) return res.status(400).json({ error: error.message });
    
    const areas = data.map(a => ({
        id: a.idArea || a.id || a.ID,
        nombre: a.nombre || a.Nombre
    })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    res.json(areas);
};

// Crear usuario (CORREGIDO)
exports.crearUsuario = async (req, res) => {
    // Desestructuración única para evitar errores de referencia
    const { usuario, nombre, apellido, dni, email, correo, contrasena, rol, permisos, estado, id_area } = req.body;

    console.log("DATOS RECIBIDOS EN EL BACKEND:", { usuario, email, correo, dni });

    const emailFinal = email || correo; // Asegura capturar el email sin importar el nombre del campo
    const rolFinal = rol || permisos;

    if (!emailFinal) {
        return res.status(400).json({ error: "No se puede crear un usuario sin email." });
    }

    try {
        // 1. Crear en Auth de Supabase
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: emailFinal,
            password: contrasena,
            email_confirm: true
        });

        if (authError) return res.status(400).json({ error: authError.message });

        // 2. Insertar en Tabla Usuarios de la base de datos
        const { error: dbError } = await supabase
            .from('Usuarios')
            .upsert([{ 
                usuario: usuario, 
                nombre: nombre,
                apellido: apellido,
                dni: dni,
                email: emailFinal, 
                rol: rolFinal, 
                activo: estado === 'Activo', 
                idArea: id_area || null,
                auth_id: authUser.user.id 
            }], { onConflict: 'email' });
        
        if (dbError) {
            console.error("ERROR REAL DE BASE DE DATOS:", dbError);
            // Si la base de datos falla, se elimina de Auth para mantener consistencia
            await supabase.auth.admin.deleteUser(authUser.user.id);
            throw dbError;
        }

        res.status(201).json({ mensaje: "Usuario procesado con éxito" });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 3. Editar un usuario 
exports.editarUsuario = async (req, res) => {
    const { id } = req.params;
    const { usuario, nombre, apellido, dni, email, correo, contrasena, rol, estado, id_area } = req.body;
    const emailFinal = email || correo;

    try {
        const { data: userExist } = await supabase
            .from('Usuarios')
            .select('auth_id, email')
            .eq('idUsuarios', id)
            .single();

        if (contrasena && contrasena.trim() !== "") {
            const { error: authErr } = await supabase.auth.admin.updateUserById(
                userExist.auth_id,
                { password: contrasena }
            );
            if (authErr) throw authErr;
        }

        const updateData = {
            usuario, nombre, apellido, dni,
            rol,
            activo: estado === 'Activo',
            idArea: id_area || null
        };

        if (emailFinal && emailFinal !== userExist.email) {
            updateData.email = emailFinal;
        }

        const { error: dbError } = await supabase
            .from('Usuarios')
            .update(updateData)
            .eq('idUsuarios', id);

        if (dbError) throw dbError;

        res.json({ mensaje: "Usuario actualizado correctamente" });
    } catch (error) {
        console.error("Error al editar:", error.message);
        res.status(400).json({ error: error.message });
    }
};

// 4. Eliminar un usuario 
exports.eliminarUsuario = async (req, res) => {
    const { id } = req.params; // Este es el idUsuarios de tu tabla

    try {
        // 1. Buscamos el auth_id del usuario antes de borrarlo de la tabla
        const { data: usuario, error: errorBusq } = await supabase
            .from('Usuarios')
            .select('auth_id')
            .eq('idUsuarios', id)
            .single();

        if (errorBusq) throw new Error("No se encontró el usuario");

        // 2. Primero borramos el usuario del motor de SEGURIDAD (Auth)
        // Esto libera el email para que pueda ser usado nuevamente
        const { error: authError } = await supabase.auth.admin.deleteUser(usuario.auth_id);
        if (authError) throw authError;

        // 3. Limpiamos las tareas asociadas (opcional, para evitar errores de FK)
        await supabase.from('Tareas').delete().eq('idUsuarios', id);

        // 4. Finalmente borramos el perfil de la tabla Usuarios
        const { error: dbError } = await supabase
            .from('Usuarios')
            .delete()
            .eq('idUsuarios', id);

        if (dbError) throw dbError;

        res.json({ mensaje: "Usuario eliminado completamente del sistema" });

    } catch (err) {
        console.error("Error al eliminar:", err.message);
        res.status(400).json({ error: err.message });
    }
};

// 5. Login 
exports.login = async (req, res) => {
    const { correo, contrasena } = req.body; 

    try {
        const { data: perfil, error: pError } = await supabase
            .from('Usuarios')
            .select('idUsuarios, usuario, nombre, apellido, dni, email, rol, activo, idArea') 
            .or(`usuario.eq.${correo},email.eq.${correo}`)
            .maybeSingle();

        if (!perfil || !perfil.activo) {
            return res.status(401).json({ error: "Credenciales inválidas o usuario inactivo" });
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: perfil.email,
            password: contrasena
        });

        if (authError) return res.status(401).json({ error: "Contraseña incorrecta" });

        const secreto = process.env.JWT_SECRET || 'secreto_super_seguro_temporal';
        // Incluimos el ROL real en el token
        const token = jwt.sign({ id: perfil.idUsuarios, rol: perfil.rol.toLowerCase() }, secreto, { expiresIn: '8h' });
        
        res.json({ token, usuario: perfil });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

// 6. Nueva función para Recuperar Password 
exports.recuperarPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Verificamos si el usuario existe en nuestra tabla primero
        const { data: usuario, error: errorBusq } = await supabase
            .from('Usuarios')
            .select('email')
            .eq('email', email)
            .maybeSingle();

        if (!usuario) {
            return res.status(404).json({ error: "El correo no está registrado en el sistema." });
        }

        // 2. Pedimos a Supabase que envíe el mail de recuperación
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            // Esta es la página donde el usuario escribirá su nueva clave
            redirectTo: 'http://localhost:3000/html/nuevo-password.html', 
        });

        if (error) throw error;

        res.json({ mensaje: "Se ha enviado un enlace de recuperación a tu correo." });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.cambiarPasswordPropia = async (req, res) => {
    const { idUsuarios, nuevaContrasena } = req.body;

    try {
        // 1. Buscamos el auth_id del usuario
        const { data: user } = await supabase
            .from('Usuarios')
            .select('auth_id')
            .eq('idUsuarios', idUsuarios)
            .single();

        // 2. Actualizamos la contraseña en el motor de seguridad
        const { error } = await supabase.auth.admin.updateUserById(
            user.auth_id,
            { password: nuevaContrasena }
        );

        if (error) throw error;
        res.json({ mensaje: "Contraseña actualizada correctamente" });
    } catch (err) {
        res.status(400).json({ error: "Error al actualizar seguridad: " + err.message });
    }
};

// 7. Procesar el cambio final de contraseña desde el enlace del mail
exports.actualizarPasswordOlvidada = async (req, res) => {
    const { nuevaContrasena } = req.body;
    
    // El token de recuperación lo maneja Supabase automáticamente 
    // a través de la sesión que se crea al hacer clic en el enlace del mail.
    try {
        const { error } = await supabase.auth.updateUser({
            password: nuevaContrasena
        });

        if (error) throw error;

        res.json({ mensaje: "Tu contraseña ha sido actualizada con éxito." });
    } catch (err) {
        console.error("Error al actualizar password:", err.message);
        res.status(400).json({ error: "No se pudo actualizar la contraseña. El enlace puede haber expirado." });
    }
};