const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

// Obtener todos los usuarios
exports.obtenerUsuarios = async (req, res) => {
    const { data, error } = await supabase
        .from('Usuarios')
        .select(`
            *,
            Areas (nombre)
        `)
        .order('idUsuarios', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const usuariosFormateados = data.map(u => ({
        ...u,
        nombreArea: u.Areas ? u.Areas.nombre : 'Sin Área',
        permisos: u.rol 
    }));

    res.json(usuariosFormateados);
};

// Obtener todas las áreas 
exports.obtenerAreas = async (req, res) => {
    let { data, error } = await supabase.from('Areas').select('*');
    if (error) return res.status(400).json({ error: error.message });
    
    const areas = data.map(a => ({
        id: a.idArea || a.id || a.ID,
        nombre: a.nombre || a.Nombre
    })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    res.json(areas);
};


// Crear usuario 
exports.crearUsuario = async (req, res) => {
    const { usuario, nombre, apellido, dni, email, correo, contrasena, rol, permisos, estado, id_area } = req.body;
    const emailFinal = (email || correo || "").trim();
    const rolFinal = rol || permisos;
    const dniFinal = (dni || "").trim();
    const usuarioFinal = (usuario || "").trim();

    if (!emailFinal) return res.status(400).json({ error: "El email es obligatorio." });

    try {
        const { data: existente } = await supabase
            .from('Usuarios')
            .select('*')
            .eq('email', emailFinal)
            .maybeSingle();

        if (existente && (existente.rol === 'Borrados' || !existente.activo)) {
            console.log("Reactivando usuario detectado...");
            const { error: errUpd } = await supabase
                .from('Usuarios')
                .update({
                    usuario: usuarioFinal,
                    nombre: nombre,
                    apellido: apellido,
                    dni: dniFinal,
                    rol: rolFinal,
                    activo: true,
                    idArea: id_area || null
                })
                .eq('idUsuarios', existente.idUsuarios);

            if (errUpd) throw new Error("Error al reactivar en DB: " + errUpd.message);
            
            await supabase.auth.admin.updateUserById(existente.auth_id, { password: contrasena });
            return res.status(200).json({ mensaje: "Usuario re-activado con éxito" });
        }

        const { data: checkDni } = await supabase.from('Usuarios').select('dni').eq('dni', dniFinal).maybeSingle();
        if (checkDni) return res.status(400).json({ error: "Ese DNI ya pertenece a otro usuario." });
        const { data: checkUser } = await supabase.from('Usuarios').select('usuario').eq('usuario', usuarioFinal).maybeSingle();
        if (checkUser) return res.status(400).json({ error: "Ese nombre de usuario ya está en uso." });

        console.log("Intentando crear en Auth...");
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: emailFinal,
            password: contrasena,
            email_confirm: true,
            user_metadata: { 
                creado_por: 'sistema_tesis',
                nombre_completo: `${nombre} ${apellido}`
            }
        });

        if (authError) {
            console.error("ERROR CRÍTICO EN AUTH:", authError);
            if (authError.message.includes("already registered")) {
                return res.status(400).json({ error: "Este email ya está registrado en el motor de autenticación." });
            }
            throw new Error(`Error del motor de seguridad (Auth): ${authError.message}`);
        }

        console.log("Insertando en tabla Usuarios...");
        const { error: dbError } = await supabase
            .from('Usuarios')
            .insert([{ 
                usuario: usuarioFinal, 
                nombre: nombre,
                apellido: apellido,
                dni: dniFinal,
                email: emailFinal, 
                rol: rolFinal, 
                activo: estado === 'Activo', 
                idArea: id_area || null,
                auth_id: authUser.user.id 
            }]);
        
        if (dbError) {
            await supabase.auth.admin.deleteUser(authUser.user.id);
            throw new Error("Error en tabla Usuarios: " + dbError.message);
        }

        res.status(201).json({ mensaje: "Usuario creado con éxito" });

    } catch (error) {
        console.error("LOG DETALLADO DEL ERROR:", error);
        res.status(400).json({ error: error.message || "Error desconocido al crear usuario" });
    }
};

// Editar un usuario 
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

// Eliminar un usuario 
exports.eliminarUsuario = async (req, res) => {
    const { id } = req.params;

    try {
        const { error: dbError } = await supabase
            .from('Usuarios')
            .update({ 
                activo: false, 
                rol: 'Borrados'
            }) 
            .eq('idUsuarios', id);

        if (dbError) throw dbError;

        res.json({ mensaje: "Usuario eliminado de la vista" });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Login 
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
        const token = jwt.sign({ id: perfil.idUsuarios, rol: perfil.rol.toLowerCase() }, secreto, { expiresIn: '8h' });
        
        res.json({ token, usuario: perfil });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

//Recuperar Contraseña
exports.recuperarPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const { data: usuario, error: errorBusq } = await supabase
            .from('Usuarios')
            .select('email')
            .eq('email', email)
            .maybeSingle();

        if (!usuario) {
            return res.status(404).json({ error: "El correo no está registrado en el sistema." });
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
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

        // 2. Actualizamos la contraseña 
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

// Procesar el cambio final de contraseña desde el enlace del mail
exports.actualizarPasswordOlvidada = async (req, res) => {
    const { nuevaContrasena } = req.body;
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