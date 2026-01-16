const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

// Helper para validar formato UUID
const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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

//Crear usuario
exports.crearUsuario = async (req, res) => {
    // Aceptamos 'usuario' O 'nombre', y 'rol' O 'permisos'
    const { usuario, nombre, apellido, dni, correo, contrasena, rol, permisos, estado, id_area } = req.body;

    try {
        // 1. Crear en Auth (Seguridad)
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: correo,
            password: contrasena,
            email_confirm: true
        });

        if (authError) return res.status(400).json({ error: authError.message });

        // 2. Insertar en Tabla con los nombres CORRECTOS de tu DB
        const { error: dbError } = await supabase
            .from('Usuarios')
            .insert([{ 
                usuario: usuario, 
                nombre: nombre,
                apellido: apellido,
                dni: dni,
                email: correo, 
                rol: rol || permisos, 
                activo: estado === 'Activo', 
                idArea: id_area || null,
                auth_id: authUser.user.id 
            }]);
        
        if (dbError) {
            await supabase.auth.admin.deleteUser(authUser.user.id);
            throw dbError;
        }

        res.status(201).json({ mensaje: "Usuario creado con éxito" });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 3. Editar un usuario 
exports.editarUsuario = async (req, res) => {
    const { id } = req.params;
    const { usuario, nombre, apellido, dni, correo, contrasena, rol, estado, id_area } = req.body;

    try {
        // 1. Buscamos el auth_id del usuario para poder actualizar su seguridad si es necesario
        const { data: userExist } = await supabase
            .from('Usuarios')
            .select('auth_id, email')
            .eq('idUsuarios', id)
            .single();

        // 2. Si hay una nueva contraseña, la actualizamos en el motor de Auth
        if (contrasena && contrasena.trim() !== "") {
            const { error: authErr } = await supabase.auth.admin.updateUserById(
                userExist.auth_id,
                { password: contrasena }
            );
            if (authErr) throw authErr;
        }

        // 3. Actualizamos la tabla Usuarios
        // NOTA: Solo mandamos el correo si es distinto al que ya tiene, para evitar el error de "duplicado"
        const updateData = {
            usuario: usuario, 
            nombre: nombre,
            apellido: apellido,
            dni: dni,
            rol: rol,
            activo: estado === 'Activo',
            idArea: id_area || null
        };

        if (correo !== userExist.email) {
            updateData.email = correo;
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
        // 1. Buscamos el perfil
        const { data: perfil, error: pError } = await supabase
            .from('Usuarios')
            .select('idUsuarios, usuario, email, rol, activo, idArea') 
            .or(`usuario.eq.${correo},email.eq.${correo}`)
            .maybeSingle();

        if (!perfil || !perfil.activo) {
            return res.status(401).json({ error: "Credenciales inválidas o usuario inactivo" });
        }

        // 2. Autenticamos en el motor de seguridad
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: perfil.email,
            password: contrasena
        });

        if (authError) return res.status(401).json({ error: "Contraseña incorrecta" });

        // 3. Generamos el Token
        const secreto = process.env.JWT_SECRET || 'secreto_super_seguro_temporal';
        const token = jwt.sign({ id: perfil.idUsuarios, rol: perfil.rol }, secreto, { expiresIn: '8h' });
        
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