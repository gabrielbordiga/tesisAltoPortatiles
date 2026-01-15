const supabase = require('../config/supabase');

// Helper para resolver nombres de unidades (Tipo o Unidad Física)
async function enriquecerConNombres(data) {
    if (!data) return;
    const list = Array.isArray(data) ? data : [data];
    
    // Verificar si hay líneas para procesar
    const tieneLineas = list.some(a => a.lineas && a.lineas.length > 0);
    if (!tieneLineas) return;

    let tipos = [], unidades = [];
    try {
        const { data: t } = await supabase.from('Tipo_Unidades').select('idTipo, nombre');
        if (t) tipos = t;
        const { data: u } = await supabase.from('Unidades').select('idUnidad, idTipo');
        if (u) unidades = u;
    } catch (e) { }

    const getNombre = (id) => {
        if (!id) return 'Sin ID';
        // Lógica en cadena: Detalle -> Unidades -> Tipo
        const u = unidades.find(x => String(x.idUnidad) === String(id));
        if (u) {
            const t = tipos.find(x => String(x.idTipo) === String(u.idTipo));
            if (t) return t.nombre;
        }
        // Fallback: ID directo de tipo (por si acaso)
        const tDirect = tipos.find(x => String(x.idTipo) === String(id));
        if (tDirect) return tDirect.nombre;
        return 'Desconocido';
    };

    list.forEach(a => {
        if (a.lineas && Array.isArray(a.lineas)) {
            a.lineas = a.lineas.map(l => {
                if (l.unidad) return l; // Ya tiene nombre
                const id = l.idUnidad || l.idunidad;
                return { ...l, unidad: getNombre(id) };
            });
        }
    });
}

// Helper para parsear pagos (compatibilidad con monto en metodo)
function parsearPagos(listaPagos) {
    if (!listaPagos) return [];
    return listaPagos.map(p => {
        // Si no tiene monto pero el método tiene el formato "Metodo | Monto"
        if ((p.monto === null || p.monto === undefined) && p.metodo && String(p.metodo).includes(' | ')) {
            const parts = p.metodo.split(' | ');
            const posibleMonto = parseFloat(parts[parts.length - 1]);
            if (!isNaN(posibleMonto)) {
                return { ...p, metodo: parts.slice(0, -1).join(' | '), monto: posibleMonto };
            }
        }
        return p;
    });
}

// Obtener todos los alquileres
exports.obtenerAlquileres = async (req, res) => {
    // Intentamos traer todo con las relaciones
    let { data, error } = await supabase
        .from('Alquileres')
        .select('*, lineas:DetalleAlquiler(*), pagos:Pagos(*)') // Nombres exactos según tu esquema
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Error al obtener alquileres con detalles:", error.message);
        console.warn("⚠️ Intentando carga manual de relaciones (Manual Join)...");
        
        // 1. Cargar Cabeceras
        const { data: alqs, error: errAlq } = await supabase
            .from('Alquileres')
            .select('*')
            .order('created_at', { ascending: false });

        if (errAlq) return res.status(400).json({ error: errAlq.message });

        // 2. Cargar Detalles y Pagos por separado
        let detalles = [], pagosList = [];
        
        // Cargar DetalleAlquiler
        let resD = await supabase.from('DetalleAlquiler').select('*');
        if (resD.data) detalles = resD.data;

        // Cargar Pagos
        let resP = await supabase.from('Pagos').select('*');
        if (resP.data) pagosList = resP.data;

        // 3. Unificar en memoria
        const pagosParseados = parsearPagos(pagosList);
        data = alqs.map(a => {
            const id = a.idAlquiler || a.idalquiler; // Normalizamos ID
            return {
                ...a,
                lineas: detalles.filter(d => (d.idAlquiler || d.idalquiler) == id),
                pagos: pagosParseados.filter(p => (p.idAlquiler || p.idalquiler) == id)
            };
        });
    }
    await enriquecerConNombres(data);
    res.json(data);
};

// Obtener un alquiler por ID
exports.obtenerAlquilerPorId = async (req, res) => {
    const { id } = req.params;
    let { data, error } = await supabase
        .from('Alquileres')
        .select('*, lineas:DetalleAlquiler(*), pagos:Pagos(*)')
        .eq('idAlquiler', id)
        .single();

    if (error) {
        console.error("❌ Error al obtener alquiler por ID con detalles:", error.message);
        
        // Fallback manual
        const { data: alq, error: errAlq } = await supabase
            .from('Alquileres')
            .select('*')
            .eq('idAlquiler', id)
            .single();
            
        if (errAlq) return res.status(400).json({ error: errAlq.message });

        // Cargar detalles específicos
        // Intentamos con 'idAlquiler' y si no trae nada, probamos 'idalquiler' (minúsculas)
        let d = [];
        let resD = await supabase.from('DetalleAlquiler').select('*').eq('idAlquiler', id);
        if (resD.error || !resD.data?.length) resD = await supabase.from('DetalleAlquiler').select('*').eq('idalquiler', id);
        if (resD.data) d = resD.data;

        let p = [];
        let resP = await supabase.from('Pagos').select('*').eq('idAlquiler', id);
        if (resP.error || !resP.data?.length) resP = await supabase.from('Pagos').select('*').eq('idalquiler', id);
        if (resP.data) p = resP.data;
        
        p = parsearPagos(p);
        data = { ...alq, lineas: d || [], pagos: p || [] };
    }
    await enriquecerConNombres(data);
    res.json(data);
};

// Crear nuevo alquiler
exports.crearAlquiler = async (req, res) => {
    const { idCliente, ubicacion, fechaDesde, fechaHasta, precioTotal, estado, lineas, pagos } = req.body;

    console.log("📝 Intentando crear alquiler:", req.body);

    // Validar fechas vacías para evitar error de formato 'date' en PostgreSQL
    // Si llega un string vacío "", lo convertimos a null
    const fDesde = (fechaDesde && String(fechaDesde).trim() !== '') ? fechaDesde : null;
    const fHasta = (fechaHasta && String(fechaHasta).trim() !== '') ? fechaHasta : null;

    const { data, error } = await supabase
        .from('Alquileres')
        .insert([{
            idCliente,
            ubicacion,
            fechaDesde: fDesde,
            fechaHasta: fHasta,
            precioTotal,
            estado
        }])
        .select();

    if (error) {
        console.error("❌ Error Supabase:", error.message);
        return res.status(400).json({ error: error.message });
    }

    const nuevoAlquiler = data[0];
    const idAlquiler = nuevoAlquiler.idAlquiler;

    // 2. Insertar Líneas (Detalle)
    if (lineas && lineas.length > 0) {
        // Resolver idUnidad real desde Unidades usando idTipo
        const tiposIds = [...new Set(lineas.map(l => l.idTipo).filter(Boolean))];
        let mapaUnidades = {};
        
        if (tiposIds.length > 0) {
            const { data: uData } = await supabase
                .from('Unidades')
                .select('idUnidad, idTipo')
                .in('idTipo', tiposIds);
            
            if (uData) {
                uData.forEach(u => {
                    if (!mapaUnidades[u.idTipo]) mapaUnidades[u.idTipo] = u.idUnidad;
                });
            }
        }

        const lineasInsert = lineas.map(l => ({
            idAlquiler,
            idUnidad: mapaUnidades[l.idTipo] || l.idTipo, 
            cantidad: l.cantidad,
            precioUnitario: l.precioUnit
        }));
        // Insertar en DetalleAlquiler
        await supabase.from('DetalleAlquiler').insert(lineasInsert);
    }

    // 3. Insertar Pagos
    if (pagos && pagos.length > 0) {
        const pagosInsert = pagos.map(p => ({
            idAlquiler,
            fechaPago: p.fecha, // Ajustado a nombre de columna en BD
            metodo: p.metodo,
            monto: p.monto, 
            estado: 'pagado' // Campo requerido según esquema
        }));
        
        const { error: errP } = await supabase.from('Pagos').insert(pagosInsert);
        if (errP) {
            console.warn("⚠️ Fallo insert Pagos con monto, intentando modo compatibilidad (guardar monto en metodo)...", errP.message);
            // Modo compatibilidad: Guardar monto dentro de metodo "Metodo | Monto"
            const pagosCompat = pagos.map(p => ({
                idAlquiler,
                fechaPago: p.fecha,
                metodo: `${p.metodo} | ${p.monto}`,
                estado: 'pagado'
            }));
            const { error: errP2 } = await supabase.from('Pagos').insert(pagosCompat);
            if (errP2) {
                console.error("❌ Fallo insert Pagos (compatibilidad):", errP2.message);
                return res.status(400).json({ error: "Error guardando pagos: " + errP2.message });
            }
        }
    }

    res.status(201).json({ mensaje: 'Alquiler creado', data: nuevoAlquiler });
};

// Actualizar alquiler
exports.actualizarAlquiler = async (req, res) => {
    const { id } = req.params;
    const { idCliente, ubicacion, fechaDesde, fechaHasta, precioTotal, estado, lineas, pagos } = req.body;

    // Validar fechas vacías
    const fDesde = (fechaDesde && String(fechaDesde).trim() !== '') ? fechaDesde : null;
    const fHasta = (fechaHasta && String(fechaHasta).trim() !== '') ? fechaHasta : null;

    const { data, error } = await supabase
        .from('Alquileres')
        .update({
            idCliente,
            ubicacion,
            fechaDesde: fDesde,
            fechaHasta: fHasta,
            precioTotal,
            estado,
            updated_at: new Date()
        })
        .eq('idAlquiler', id)
        .select();

    if (error) return res.status(400).json({ error: error.message });

    // --- ACTUALIZAR LÍNEAS (Borrar anteriores e insertar nuevas) ---
    if (lineas) {
        // 1. Borrar anteriores (intentamos en ambas tablas por seguridad)
        await supabase.from('DetalleAlquiler').delete().eq('idAlquiler', id);

        // 2. Insertar nuevas
        if (lineas.length > 0) {
             // Resolver idUnidad real desde Unidades usando idTipo (mismo que en crear)
            const tiposIds = [...new Set(lineas.map(l => l.idTipo).filter(Boolean))];
            let mapaUnidades = {};
            
            if (tiposIds.length > 0) {
                const { data: uData } = await supabase
                    .from('Unidades')
                    .select('idUnidad, idTipo')
                    .in('idTipo', tiposIds);
                
                if (uData) {
                    uData.forEach(u => {
                        if (!mapaUnidades[u.idTipo]) mapaUnidades[u.idTipo] = u.idUnidad;
                    });
                }
            }

            const lineasInsert = lineas.map(l => ({
                idAlquiler: id,
                idUnidad: mapaUnidades[l.idTipo] || l.idTipo, 
                cantidad: l.cantidad,
                precioUnitario: l.precioUnit
            }));

            await supabase.from('DetalleAlquiler').insert(lineasInsert);
        }
    }

    // --- ACTUALIZAR PAGOS (Borrar anteriores e insertar nuevos) ---
    if (pagos) {
        // 1. Borrar anteriores
        await supabase.from('Pagos').delete().eq('idAlquiler', id);

        // 2. Insertar nuevos
        if (pagos.length > 0) {
            const pagosInsert = pagos.map(p => ({
                idAlquiler: id,
                fechaPago: p.fecha,
                metodo: p.metodo,
                monto: p.monto,
                estado: 'pagado'
            }));
            
            const { error: errP } = await supabase.from('Pagos').insert(pagosInsert);
            if (errP) {
                console.warn("⚠️ Fallo insert Pagos (update), intentando modo compatibilidad...", errP.message);
                const pagosCompat = pagos.map(p => ({
                    idAlquiler: id,
                    fechaPago: p.fecha,
                    metodo: `${p.metodo} | ${p.monto}`,
                    estado: 'pagado'
                }));
                const { error: errP2 } = await supabase.from('Pagos').insert(pagosCompat);
                if (errP2) {
                    console.error("❌ Fallo insert Pagos (compatibilidad):", errP2.message);
                    return res.status(400).json({ error: "Error guardando pagos: " + errP2.message });
                }
            }
        }
    }

    res.json({ mensaje: 'Alquiler actualizado', data });
};

// Eliminar alquiler
exports.eliminarAlquiler = async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('Alquileres')
        .delete()
        .eq('idAlquiler', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: 'Alquiler eliminado' });
};