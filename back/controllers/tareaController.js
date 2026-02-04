const supabase = require('../config/supabase');

// Obtener tareas por fecha
exports.obtenerTareasPorFecha = async (req, res) => {
    const { fecha } = req.params;
    const { idUsuario } = req.query; // Capturar el id de la URL

    try {
        let query = supabase
            .from('Tareas')
            .select('*, alquiler:Alquileres(*, lineas:DetalleAlquiler(*))')
            .eq('fecha', fecha);

        // Si viene el ID por la URL, filtramos
        if (idUsuario && idUsuario !== "null" && idUsuario !== "undefined") {
            query = query.eq('idUsuarios', idUsuario);
        }

        const { data, error } = await query;
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


exports.actualizarEstadoTarea = async (req, res) => {
    const { id } = req.params;
    const { completada } = req.body;

    try {
        // 1. Obtenemos datos de la tarea y del alquiler vinculado 
        const { data: tarea, error: errT } = await supabase
            .from('Tareas')
            .select(`
                detalle, 
                idAlquiler,
                idUsuarios,
                alquiler:Alquileres(precioTotal, pagos:Pagos(monto))
            `)
            .eq('id', id)
            .single();

        if (errT) throw errT;

        // 2. Actualizamos la tarea en sí
        const { data: tareaActualizada, error: errUpdate } = await supabase
            .from('Tareas')
            .update({ completada })
            .eq('id', id)
            .select()
            .single();

        if (errUpdate) throw errUpdate;

        // 3. Lógica Automática de Estados del Alquiler
        if (completada && tarea.idAlquiler) {
            let nuevoEstado = null;
            const detalleTarea = String(tarea.detalle || "").toUpperCase();

            if (detalleTarea.includes("ENTREGAR")) {
                nuevoEstado = "ENTREGADO";
            } 
            else if (detalleTarea.includes("SERVICIO")) {
                nuevoEstado = "SERVICIO PENDIENTE";
            }
            else if (detalleTarea.includes("RETIRAR")) {
                const precioTotal = Number(tarea.alquiler?.precioTotal) || 0;
                const totalPagado = (tarea.alquiler?.pagos || []).reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
                nuevoEstado = (totalPagado >= precioTotal) ? "FINALIZADO" : "RETIRADO";
            }

            if (nuevoEstado) {
                // Actualizamos el estado del alquiler
                await supabase.from('Alquileres').update({ estado: nuevoEstado }).eq('idAlquiler', tarea.idAlquiler);

                // --- INTEGRACIÓN CON HISTORIAL ---
                await supabase.from('HistorialAlquileres').insert([{
                    idAlquiler: tarea.idAlquiler,
                    detalle: `Tarea finalizada: ${detalleTarea} (Estado: ${nuevoEstado})`,
                    idUsuarios: tarea.idUsuarios, 
                    fecha: new Date().toISOString()
                }]);
            }
        }

        res.json(tareaActualizada);
    } catch (err) {
        console.error("Error en automatización de estados:", err.message);
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
            .eq('id', id); 

        if (error) throw error;
        res.json({ mensaje: 'Tarea eliminada' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};