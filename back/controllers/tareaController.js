const supabase = require('../config/supabase');

// Obtener tareas por fecha
exports.obtenerTareasPorFecha = async (req, res) => {
    const { fecha } = req.params;
    try {
        // Traemos la tarea y el alquiler asociado (para mostrar ubicación, cliente, etc.)
        const { data, error } = await supabase
            .from('Tareas')
            .select('*, alquiler:Alquileres(*, lineas:DetalleAlquiler(*))')
            .eq('fecha', fecha);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Crear nueva tarea
exports.crearTarea = async (req, res) => {
    const { idUsuario, idAlquiler, fecha, detalle } = req.body;
    try {
        const { data, error } = await supabase
            .from('Tareas')
            .insert([{ 
                idUsuarios: idUsuario, 
                idAlquiler, 
                fecha, 
                detalle, // Guardamos el detalle
                completada: false 
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Actualizar estado (completada sí/no)
exports.actualizarEstadoTarea = async (req, res) => {
    const { id } = req.params;
    const { completada } = req.body;
    try {
        const { data, error } = await supabase
            .from('Tareas')
            .update({ completada })
            .eq('idTarea', id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Eliminar tarea
exports.eliminarTarea = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('Tareas')
            .delete()
            .eq('idTarea', id);

        if (error) throw error;
        res.json({ mensaje: 'Tarea eliminada' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};