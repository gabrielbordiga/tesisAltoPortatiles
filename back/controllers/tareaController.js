const supabase = require('../config/supabase');

// 0. Obtener TODAS las tareas (para calendario)
exports.obtenerTodasLasTareas = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Tareas')
            .select(`
                *,
                alquiler:Alquileres ( *, lineas:DetalleAlquiler(*) ),
                usuario:Usuarios ( * )
            `)
            .order('fecha', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// 1. Obtener tareas por fecha
exports.obtenerTareasPorFecha = async (req, res) => {
    const { fecha } = req.params;

    try {
        // Traemos la tarea y los datos relacionados (Alquiler y Usuario)
        const { data, error } = await supabase
            .from('Tareas')
            .select(`
                *,
                alquiler:Alquileres ( *, lineas:DetalleAlquiler(*) ),
                usuario:Usuarios ( * )
            `)
            .eq('fecha', fecha)
            .order('id', { ascending: true });

        if (error) throw error;
        console.log(`[GET TAREAS] Fecha: ${fecha} - Encontradas: ${data.length}`);
        res.json(data);
    } catch (err) {
        console.error("[GET TAREAS] Error:", err.message);
        res.status(400).json({ error: err.message });
    }
};

// 2. Crear nueva tarea
exports.crearTarea = async (req, res) => {
    const { idUsuario, idAlquiler, fecha } = req.body;

    try {
        // Validación: Verificar que el alquiler existe
        const { data: alquiler, error: errAlq } = await supabase
            .from('Alquileres')
            .select('idAlquiler')
            .eq('idAlquiler', idAlquiler)
            .single();

        if (errAlq || !alquiler) {
            return res.status(404).json({ error: "El número de pedido (Alquiler) no existe." });
        }

        // Insertar tarea
        const { data, error } = await supabase
            .from('Tareas')
            .insert([{
                idUsuarios: idUsuario,
                idAlquiler,
                fecha,
                completada: false
            }])
            .select();

        if (error) throw error;
        res.status(201).json({ mensaje: "Tarea asignada correctamente", data: data[0] });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// 3. Actualizar estado (Pendiente <-> Completada)
exports.actualizarEstadoTarea = async (req, res) => {
    const { id } = req.params;
    const { completada } = req.body; // Boolean

    const { error } = await supabase
        .from('Tareas')
        .update({ completada })
        .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: "Estado actualizado" });
};

// 4. Eliminar tarea
exports.eliminarTarea = async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('Tareas').delete().eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: "Tarea eliminada" });
};