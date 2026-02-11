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

// Helper para normalizar texto (Mayúsculas y sin acentos)
const normalizeMetodo = (m) => {
    if (!m) return null;
    return String(m).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};


exports.obtenerAlquileres = async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        // 1. IDENTIFICAR CAMBIOS AUTOMÁTICOS
        const { data: aCambiar, error: errCheck } = await supabase
            .from('Alquileres')
            .select('idAlquiler, estado')
            .in('estado', ['ENTREGADO', 'PENDIENTE'])
            .lte('fechaHasta', hoy);

        if (errCheck) console.error("Error al verificar vencimientos:", errCheck.message);

        // 2. PROCESAR ACTUALIZACIÓN E HISTORIAL GRUPAL
        if (aCambiar && aCambiar.length > 0) {
            const ids = aCambiar.map(a => a.idAlquiler);

            // Actualización masiva de estado
            await supabase
                .from('Alquileres')
                .update({ estado: 'PARA RETIRAR' })
                .in('idAlquiler', ids);

            // Creación masiva de registros en el historial
            const entradasHistorial = aCambiar.map(a => ({
                idAlquiler: a.idAlquiler,
                detalle: `Estado actualizado automáticamente de ${a.estado} a PARA RETIRAR (Vencimiento: ${hoy})`,
                fecha: new Date().toISOString(),
                idUsuarios: null 
            }));

            const { error: errHist } = await supabase
                .from('HistorialAlquileres')
                .insert(entradasHistorial);

            if (errHist) console.error("Error al registrar historial automático:", errHist.message);
        }

        // 3. CARGA DE DATOS PRINCIPAL 
        let { data, error } = await supabase
            .from('Alquileres')
            .select('*, lineas:DetalleAlquiler(*), pagos:Pagos(*)')
            .order('created_at', { ascending: false });

        // 4. FALLBACK: Carga manual si falla la relación de Supabase
        if (error) {
            console.error("❌ Error al obtener alquileres con detalles:", error.message);
            console.warn("⚠️ Ejecutando carga manual de relaciones (Manual Join)...");

            const { data: alqs, error: errAlq } = await supabase
                .from('Alquileres')
                .select('*')
                .order('created_at', { ascending: false });

            if (errAlq) return res.status(400).json({ error: errAlq.message });

            let detalles = [], pagosList = [];
            
            const resD = await supabase.from('DetalleAlquiler').select('*');
            if (resD.data) detalles = resD.data;

            const resP = await supabase.from('Pagos').select('*');
            if (resP.data) pagosList = resP.data;

            const pagosParseados = parsearPagos(pagosList);
            data = alqs.map(a => {
                const id = a.idAlquiler || a.idalquiler;
                return {
                    ...a,
                    lineas: detalles.filter(d => (d.idAlquiler || d.idalquiler) == id),
                    pagos: pagosParseados.filter(p => (p.idAlquiler || p.idalquiler) == id)
                };
            });
        }

        // 5. ENRIQUECER Y ENVIAR RESPUESTA
        await enriquecerConNombres(data);
        res.json(data);

    } catch (err) {
        console.error("Error crítico en obtenerAlquileres:", err.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
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
    const { idCliente, ubicacion, fechaDesde, fechaHasta, precioTotal, lineas, pagos, estado } = req.body; 

    // --- BLOQUE DE SEGURIDAD DE FECHAS ---
    if (fechaDesde && fechaHasta) {
        const fDesdeDate = new Date(fechaDesde);
        const fHastaDate = new Date(fechaHasta);
        const anioActual = new Date().getFullYear();

        // 1. Evitar años absurdos hacia atrás 
        if (fDesdeDate.getFullYear() < anioActual) {
            return res.status(400).json({ error: `La fecha de inicio no puede ser anterior al año ${anioActual}.` });
        }

        // 2. Evitar alquileres eternos 
        if (fHastaDate.getFullYear() > (anioActual + 2)) {
            return res.status(400).json({ error: "El periodo de alquiler no puede superar los 2 años a futuro." });
        }

        // 3. Coherencia (Desde <= Hasta) 
        if (fHastaDate < fDesdeDate) {
            return res.status(400).json({ error: "La fecha 'Hasta' debe ser posterior a la fecha 'Desde'." });
        }
    }

    const v = await validarDisponibilidadReal(lineas, fechaDesde, fechaHasta);
    if (!v.ok) {
        return res.status(400).json({ error: v.msg });
    }
    
    // Obtenemos la fecha de hoy en formato YYYY-MM-DD para comparar
    const hoy = new Date().toISOString().split('T')[0];

    console.log("📝 Intentando crear alquiler:", req.body);

    // 1. VALIDACIÓN Y NORMALIZACIÓN DE DATOS
    const fDesde = (fechaDesde && String(fechaDesde).trim() !== '') ? fechaDesde : null;
    const fHasta = (fechaHasta && String(fechaHasta).trim() !== '') ? fechaHasta : null;

    // LÓGICA DE ESTADO DINÁMICO:
    let estadoInicial = estado || 'PENDIENTE';
    if (fHasta && fHasta <= hoy) {
        estadoInicial = 'PARA RETIRAR';
    }

    // 2. INSERCIÓN DE CABECERA
    const { data, error } = await supabase
        .from('Alquileres')
        .insert([{
            idCliente,
            ubicacion,
            fechaDesde: fDesde,
            fechaHasta: fHasta,
            precioTotal,
            estado: estadoInicial
        }])
        .select();

    if (error) {
        console.error("❌ Error Supabase:", error.message);
        if (error.message && error.message.includes('alquileres_fechas_check')) {
            return res.status(400).json({ error: "Fechas inválidas: La fecha 'Desde' debe ser anterior o igual a la fecha 'Hasta'." });
        }
        return res.status(400).json({ error: error.message });
    }

    const nuevoAlquiler = data[0];
    const idAlquiler = nuevoAlquiler.idAlquiler;

    // 3. INSERTAR LÍNEAS (Detalle)
    if (lineas && lineas.length > 0) {
        const lineasParaInsertar = [];

        for (const l of lineas) {
            const { data: unidadFisica } = await supabase
                .from('Unidades')
                .select('idUnidad')
                .eq('idTipo', l.idTipo)
                .limit(1)
                .single();

            if (unidadFisica) {
                lineasParaInsertar.push({
                    idAlquiler,
                    idUnidad: unidadFisica.idUnidad, 
                    cantidad: Number(l.cantidad),
                    precioUnitario: Number(l.precioUnit)
                });
            } else {
                console.error(`No hay unidades físicas registradas para el tipo: ${l.idTipo}`);
            }
        }

        if (lineasParaInsertar.length > 0) {
            const { error: errLineas } = await supabase.from('DetalleAlquiler').insert(lineasParaInsertar);
            if (errLineas) console.error("Error final al insertar líneas:", errLineas.message);
        }
    }

    // 4. INSERTAR PAGOS
    if (pagos && pagos.length > 0) {
        const pagosInsert = pagos.map(p => ({
            idAlquiler,
            fechaPago: p.fecha,
            metodo: normalizeMetodo(p.metodo),
            monto: p.monto, 
            estado: 'PAGADO' 
        }));
        
        const { error: errP } = await supabase.from('Pagos').insert(pagosInsert);
        if (errP) {
            console.error("❌ Error guardando pagos:", errP.message);
            return res.status(400).json({ error: "Error guardando pagos: " + errP.message });
        }
    }

    await registrarHistorial(idAlquiler, `Alquiler creado - Estado inicial: ${estadoInicial}`, null);
    res.status(201).json({ mensaje: 'Alquiler creado', data: nuevoAlquiler });
};

// Actualizar alquiler
exports.actualizarAlquiler = async (req, res) => {
    const { id } = req.params;
    const { idCliente, ubicacion, fechaDesde, fechaHasta, lineas, pagos, estado, precioTotal, idUsuarioEjecutor } = req.body;

    // 1. Validar disponibilidad
    const v = await validarDisponibilidadReal(lineas, fechaDesde, fechaHasta, id);
    if (!v.ok) return res.status(400).json({ error: v.msg });

    // 2. Actualizar cabecera
    await supabase.from('Alquileres').update({
        idCliente, ubicacion,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        precioTotal: precioTotal,
        estado: estado ? estado.toUpperCase() : 'PENDIENTE',
        updated_at: new Date()
    }).eq('idAlquiler', id);

    // 3. ACTUALIZAR LÍNEAS 
    if (lineas && Array.isArray(lineas) && lineas.length > 0) {
        const lineasInsert = [];
        for (const l of lineas) {
            const idTipoBusqueda = l.idTipo || l.idUnidad || l.idunidad;
            
            if (!idTipoBusqueda) continue;

            const { data: u } = await supabase.from('Unidades')
                .select('idUnidad')
                .eq('idTipo', idTipoBusqueda) 
                .limit(1).single();

            if (u) {
                lineasInsert.push({
                    idAlquiler: id,
                    idUnidad: u.idUnidad,
                    cantidad: Number(l.cantidad),
                    precioUnitario: Number(l.precioUnit || l.precioUnitario || 0)
                });
            }
        }

        if (lineasInsert.length > 0) {
            await supabase.from('DetalleAlquiler').delete().eq('idAlquiler', id);
            await supabase.from('DetalleAlquiler').insert(lineasInsert);
        }
    }

    // 4. Actualizar Pagos 
    if (pagos) {
        await supabase.from('Pagos').delete().eq('idAlquiler', id);
        if (pagos.length > 0) {
            const pagosInsert = pagos.map(p => ({
                idAlquiler: id,
                fechaPago: p.fecha || p.fechaPago,
                metodo: normalizeMetodo(p.metodo),
                monto: Number(p.monto),
                estado: 'PAGADO'
            }));
            await supabase.from('Pagos').insert(pagosInsert);
        }
    }

    await registrarHistorial(id, `Alquiler actualizado`, idUsuarioEjecutor);
    res.json({ mensaje: 'Actualizado correctamente' });
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


// Función auxiliar para registrar en el historial
const registrarHistorial = async (idAlquiler, detalle, idUsuarios = null) => {
    try {
        const dataToInsert = {
            idAlquiler,
            detalle,
            fecha: new Date().toISOString()
        };

        if (idUsuarios) {
            dataToInsert.idUsuarios = idUsuarios;
        }

        const { error } = await supabase
            .from('HistorialAlquileres')
            .insert([dataToInsert]);

        if (error) console.error("❌ Error Supabase al insertar historial:", error.message);
    } catch (err) { 
        console.error("❌ Error crítico registrarHistorial:", err.message); 
    }
};

// Nueva ruta para obtener el historial 
exports.obtenerHistorial = async (req, res) => {

    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('HistorialAlquileres')
            .select(`
                id,
                fecha,
                detalle,
                idUsuarios,
                Usuarios (
                    nombre,
                    apellido
                )
            `) 
            .eq('idAlquiler', id)
            .order('fecha', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// FUNCIÓN MAESTRA DE VALIDACIÓN DE STOCK
async function validarDisponibilidadReal(lineas, fDesde, fHasta, idAlquilerExcluir = null) {
    if (!lineas || !Array.isArray(lineas) || lineas.length === 0) return { ok: true };

    const { data: stockFisico } = await supabase.from('Unidades').select('stock, idTipo');

    const { data: ocupacion } = await supabase
        .from('DetalleAlquiler')
        .select('cantidad, idUnidad, Unidades!inner(idTipo), Alquileres!inner(idAlquiler, fechaDesde, fechaHasta, estado)')
        .lte('Alquileres.fechaDesde', fHasta)
        .gte('Alquileres.fechaHasta', fDesde)
        .not('Alquileres.estado', 'in', '("FINALIZADO", "RETIRADO", "CANCELADO")');

    for (const linea of lineas) {
        const idModeloBuscado = String(linea.idTipo || linea.idUnidad || '').trim();
        if (!idModeloBuscado || idModeloBuscado === 'undefined') continue;

        const totalEmpresa = (stockFisico || [])
            .filter(s => String(s.idTipo).trim() === idModeloBuscado)
            .reduce((acc, c) => acc + (Number(c.stock) || 0), 0);

        // Si es un producto de prueba o no tiene stock cargado, evitamos el bloqueo si no hay ocupación
        const yaReservado = (ocupacion || [])
            .filter(o => {
                const idModeloEnDB = String(o.Unidades?.idTipo).trim();
                const idAlquilerOcupante = String(o.Alquileres.idAlquiler);
                return idModeloEnDB === idModeloBuscado && idAlquilerOcupante !== String(idAlquilerExcluir);
            })
            .reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);

        console.log(`VALIDANDO: Modelo ${idModeloBuscado.substring(0,5)} | Total: ${totalEmpresa} | Ocupado: ${yaReservado} | Pide: ${linea.cantidad}`);

        // Si el total es 0 pero no hay nadie más ocupándolo, permitimos la edición/creación 
        if (totalEmpresa > 0 && (yaReservado + Number(linea.cantidad)) > totalEmpresa) {
            const realesLibres = totalEmpresa - yaReservado;
            return { ok: false, msg: `Stock insuficiente. Libres: ${realesLibres}` };
        }
    }
    return { ok: true };
}