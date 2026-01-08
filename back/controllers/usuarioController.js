const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

// Helper para validar formato UUID
const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// 1. Obtener todos los usuarios
exports.obtenerUsuarios = async (req, res) => {
    const { data, error } = await supabase
        .from('Usuarios')
        .select('*')
        .order('idUsuarios', { ascending: true }); // Ordenamos para que la lista sea estable
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};

// 1.5. Obtener todas las áreas (para el select del frontend)
exports.obtenerAreas = async (req, res) => {
    let { data, error } = await supabase
        .from('Areas') 
        .select('*'); // Traemos todo para evitar errores si las columnas se llaman diferente

    if (error) {
        console.error("Error al obtener áreas:", error); // Ver error real en la terminal
        return res.status(400).json({ error: error.message });
    }

    // --- AUTO-SEED: Si la tabla está vacía, creamos áreas por defecto ---
    if (!data || data.length === 0) {
        console.log("⚠️ La tabla Areas está vacía. Intentando crear áreas por defecto...");
        
        // Intentamos insertar con nombres de columna estándar
        const { data: inserted, error: errInsert } = await supabase
            .from('Areas')
            .insert([
                { nombre: 'Administración' },
                { nombre: 'Logística' },
                { nombre: 'Ventas' }
            ])
            .select();

        if (errInsert) {
            console.error("Falló la inserción automática (probablemente nombres de columna distintos):", errInsert.message);
            // Intento secundario con Mayúsculas por si acaso
             const { data: inserted2, error: errInsert2 } = await supabase
                .from('Areas')
                .insert([
                    { Nombre: 'Administración' },
                    { Nombre: 'Logística' },
                    { Nombre: 'Ventas' }
                ])
                .select();
            
            if (!errInsert2 && inserted2) data = inserted2;
        } else {
            data = inserted;
        }
    }
    
    // Si sigue vacío, aseguramos array para no romper el map
    if (!data) data = [];

    // Mapeo inteligente: busca cualquier variante de nombre de columna
    const areas = data.map(a => ({
        id: a.id || a.ID || a.idArea || a.IDArea || a.id_area || a.IdArea,
        nombre: a.nombre || a.Nombre || a.descripcion || a.Descripcion || a.area || a.Area
    })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    console.log("Áreas enviadas al front:", areas);
    res.json(areas);
};

// 2. Crear un usuario (Alta)
exports.crearUsuario = async (req, res) => {
    const { nombre, correo, contrasena, permisos, estado, id_area } = req.body;
    
    // Validamos que id_area sea un UUID válido (si envías texto "Administracion" fallará en la BD)
    const areaStr = (id_area && String(id_area).trim() !== '') ? String(id_area).trim() : null;
    const areaValida = (areaStr && isUUID(areaStr)) ? areaStr : null;

    const { data, error } = await supabase
        .from('Usuarios')
        .insert([{ 
            usuario: nombre, 
            email: correo, 
            // contrasena: contrasena, // NO existe columna contraseña en tu tabla
            rol: permisos, 
            activo: estado === 'Activo', // Convertimos 'Activo' a true/false
            idArea: areaValida 
        }])
        .select();
    
    if (error) {
        console.error("Error al crear usuario:", error);
        return res.status(400).json({ error: error.message });
    }
    res.status(201).json({ mensaje: "Usuario creado exitosamente", data });
};

// 3. Editar un usuario (Modificación) - ESTA ES LA QUE FALTABA
exports.editarUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, permisos, estado, id_area } = req.body;

    // Validamos que id_area sea un UUID válido
    const areaStr = (id_area && String(id_area).trim() !== '') ? String(id_area).trim() : null;
    const areaValida = (areaStr && isUUID(areaStr)) ? areaStr : null;
    
    const { data, error } = await supabase
        .from('Usuarios')
        .update({ 
            usuario: nombre, 
            email: correo, 
            rol: permisos, 
            activo: estado === 'Activo', 
            idArea: areaValida 
        })
        .eq('idUsuarios', id)
        .select();

    if (error) {
        console.error("Error al editar usuario:", error);
        return res.status(400).json({ error: error.message });
    }
    res.json({ mensaje: "Usuario actualizado correctamente", data });
};

// 4. Eliminar un usuario (Baja) - ESTA TAMBIÉN FALTABA
exports.eliminarUsuario = async (req, res) => {
    const { id } = req.params;

    // 1. Primero eliminamos las tareas asociadas para evitar el error de Foreign Key
    // El error "violates foreign key constraint 'Tareas_idUsuarios_fkey'" indica que hay tareas ligadas.
    await supabase
        .from('Tareas')
        .delete()
        .eq('idUsuarios', id);

    // 2. Ahora sí eliminamos el usuario
    const { error } = await supabase
        .from('Usuarios')
        .delete()
        .eq('idUsuarios', id);

    if (error) {
        console.error("Error al eliminar usuario:", error);
        return res.status(400).json({ error: error.message });
    }
    res.json({ mensaje: "Usuario eliminado correctamente" });
};

// 5. Login (Validar acceso)
exports.login = async (req, res) => {
    const { correo, contrasena } = req.body;
    // console.log(`[LOGIN] Buscando usuario con email: '${correo}'`);

    try {
        const { data: usuario, error } = await supabase
            .from('Usuarios')
            .select('*')
            .ilike('email', correo)
            .maybeSingle();

        if (error) {
            console.error("[LOGIN] Error Supabase:", error.message);
            return res.status(500).json({ error: "Error de base de datos" });
        }

        if (!usuario) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Validar si está activo
        if (!usuario.activo) {
            return res.status(401).json({ error: "Usuario inactivo" });
        }

        // Usamos un secreto por defecto si no está en .env para evitar crash
        const secreto = process.env.JWT_SECRET || 'secreto_super_seguro_temporal';
        const token = jwt.sign({ id: usuario.idUsuarios, rol: usuario.rol }, secreto, { expiresIn: '8h' });
        
        res.json({ token, usuario });
    } catch (err) {
        console.error("[LOGIN] Error interno:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};