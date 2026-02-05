const supabase = require('../config/supabase');

// --- TIPOS DE UNIDADES ---

exports.getTipos = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Tipo_Unidades')
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.crearTipo = async (req, res) => {
    try {
        const { nombre } = req.body;

        // VALIDACIÓN: Nombre único de tipo de unidad
        const { data: existe } = await supabase
            .from('Tipo_Unidades')
            .select('idTipo')
            .ilike('nombre', nombre.trim())
            .maybeSingle();

        if (existe) {
            return res.status(400).json({ error: "Ese tipo de unidad ya existe." });
        }

        const { data, error } = await supabase
            .from('Tipo_Unidades')
            .insert([{ nombre: nombre.trim() }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// --- UNIDADES (STOCK) ---

exports.getResumenStock = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Unidades')
            .select('stock, esatdo, precio, Tipo_Unidades(nombre, idTipo)');
        
        if (error) throw error;
        if (!Array.isArray(data)) return res.json([]);

        const resumen = data.reduce((acc, curr) => {
            const nombre = curr.Tipo_Unidades?.nombre || 'Sin nombre';
            if (!acc[nombre]) {
                acc[nombre] = { nombre, idTipo: curr.Tipo_Unidades?.idTipo, disponibles: 0, alquiladas: 0, servicio: 0, precio: 0 };
            }
            if (curr.esatdo === 'Disponible') acc[nombre].disponibles += (curr.stock || 0);
            if (curr.esatdo === 'Alquilada') acc[nombre].alquiladas += (curr.stock || 0);
            if (curr.esatdo === 'En servicio') acc[nombre].servicio += (curr.stock || 0);
            
            if (curr.precio) acc[nombre].precio = curr.precio;
            
            return acc;
        }, {});

        res.json(Object.values(resumen));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.gestionarStock = async (req, res) => {
    try {
        const { idTipo, stock, estado, precio, accion, origen, destino } = req.body;
        const cantidad = parseInt(stock);

        if (isNaN(cantidad) || cantidad <= 0) return res.status(400).json({ error: "La cantidad debe ser mayor a 0" });

        // --- NUEVA LÓGICA CON ACCIONES EXPLÍCITAS ---
        if (accion) {
            // 1. Actualizar Precio
            if (accion === 'precio') {
                const { error } = await supabase.from('Unidades')
                    .update({ precio: parseFloat(precio) })
                    .eq('idTipo', idTipo);
                if (error) throw error;
                return res.json({ mensaje: "Precio actualizado" });
            }

            // 2. Baja (Eliminar stock)
            if (accion === 'baja') {
                // Buscamos la fila del estado correspondiente (usando 'esatdo' como en tu BD)
                const { data: row } = await supabase.from('Unidades')
                    .select('*').eq('idTipo', idTipo).eq('esatdo', estado).maybeSingle();
                
                if (!row || row.stock < cantidad) {
                    return res.status(400).json({ error: "Stock insuficiente en ese estado para dar de baja." });
                }
                
                const nuevoStock = row.stock - cantidad;
                let error;
                if (nuevoStock === 0) {
                    ({ error } = await supabase.from('Unidades').delete().eq('idUnidad', row.idUnidad));
                } else {
                    ({ error } = await supabase.from('Unidades').update({ stock: nuevoStock }).eq('idUnidad', row.idUnidad));
                }

                if (error) throw error;
                return res.json({ mensaje: "Baja realizada correctamente" });
            }

            // 3. Mover (Cambiar estado)
            if (accion === 'mover') {
                if (!origen || !destino) return res.status(400).json({ error: "Faltan origen o destino" });
                
                // Restar de origen
                const { data: rowOrigen } = await supabase.from('Unidades')
                    .select('*').eq('idTipo', idTipo).eq('esatdo', origen).maybeSingle();
                
                if (!rowOrigen || rowOrigen.stock < cantidad) {
                    return res.status(400).json({ error: `Stock insuficiente en ${origen}` });
                }
                await supabase.from('Unidades').update({ stock: rowOrigen.stock - cantidad }).eq('idUnidad', rowOrigen.idUnidad);

                // Sumar a destino
                const { data: rowDestino } = await supabase.from('Unidades')
                    .select('*').eq('idTipo', idTipo).eq('esatdo', destino).maybeSingle();
                
                if (rowDestino) {
                    await supabase.from('Unidades').update({ stock: rowDestino.stock + cantidad }).eq('idUnidad', rowDestino.idUnidad);
                } else {
                    // Crear fila destino (heredando precio)
                    await supabase.from('Unidades').insert([{ idTipo, stock: cantidad, esatdo: destino, precio: rowOrigen.precio }]);
                }
                return res.json({ mensaje: "Movimiento realizado" });
            }
            
            // 4. Agregar (Nuevo stock) - Reutiliza lógica legacy o simplificada
        }

        // LÓGICA DE DESCUENTO: Si se alquila o va a servicio, resta de Disponibles
        if (estado === 'Alquilada' || estado === 'En servicio') {
            const { data: disp } = await supabase
                .from('Unidades')
                .select('idUnidad, stock')
                .eq('idTipo', idTipo)
                .eq('esatdo', 'Disponible')
                .maybeSingle();

            if (!disp || disp.stock < cantidad) {
                return res.status(400).json({ 
                    error: `Stock insuficiente. Disponibles: ${disp ? disp.stock : 0}` 
                });
            }
            // Descontar del lote disponible
            await supabase.from('Unidades').update({ stock: disp.stock - cantidad }).eq('idUnidad', disp.idUnidad);
        }

        // SUMAR O CREAR LOTE DESTINO
        const { data: existente } = await supabase
            .from('Unidades')
            .select('idUnidad, stock')
            .eq('idTipo', idTipo)
            .eq('esatdo', estado)
            .maybeSingle();

        if (existente) {
            await supabase.from('Unidades')
                .update({ stock: existente.stock + cantidad, precio: parseFloat(precio) })
                .eq('idUnidad', existente.idUnidad);
        } else {
            await supabase.from('Unidades')
                .insert([{ idTipo, stock: cantidad, esatdo: estado, precio: parseFloat(precio) }]);
        }

        res.json({ mensaje: "Stock actualizado correctamente" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ENDPOINT: Listar unidades por estado 
exports.getUnidadesPorEstado = async (req, res) => {
    try {
        const { estado } = req.params;
        const { data, error } = await supabase
            .from('Unidades')
            .select('*, Tipo_Unidades(nombre)')
            .eq('esatdo', estado);
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

//Busca disponibilidades de las unidades en las fechas q se piden
exports.getDisponibilidadPorRango = async (req, res) => {
    const { desde, hasta } = req.query;

    if (!desde || !hasta || desde.includes('object')) {
        return res.status(400).json({ error: "Fechas inválidas" });
    }

    try {
        // 1. Capacidad TOTAL de la empresa (Stock físico)
        const { data: stockFisico } = await supabase.from('Unidades').select('stock, idTipo, precio');

        // 2. SOLAPAMIENTO REAL: Buscamos cualquier pedido que pise estas fechas
        const { data: ocupadas, error: errOcup } = await supabase
            .from('DetalleAlquiler')
            .select('cantidad, idUnidad, Unidades!inner(idTipo), Alquileres!inner(idAlquiler, fechaDesde, fechaHasta, estado)')
            .lte('Alquileres.fechaDesde', hasta)
            .gte('Alquileres.fechaHasta', desde)
            .not('Alquileres.estado', 'in', '("FINALIZADO", "RETIRADO", "CANCELADO")');

        if (errOcup) throw errOcup;

        const { data: tipos } = await supabase.from('Tipo_Unidades').select('*');
        
        const disponibilidad = tipos.map(tipo => {
            // Unidades totales que tenemos de este modelo
            const total = (stockFisico || [])
                .filter(s => String(s.idTipo) === String(tipo.idTipo))
                .reduce((acc, curr) => acc + (curr.stock || 0), 0);

            // Unidades que ya están comprometidas en esas fechas en la DB
            const reservadas = (ocupadas || [])
                .filter(o => String(o.Unidades?.idTipo) === String(tipo.idTipo)) 
                .reduce((acc, curr) => acc + curr.cantidad, 0);

            return {
                idTipo: tipo.idTipo,
                nombre: tipo.nombre,
                disponibles: Math.max(0, total - reservadas), // Esto es lo que queda libre
                precio: stockFisico?.find(s => String(s.idTipo) === String(tipo.idTipo))?.precio || 0
            };
        });

        res.json(disponibilidad);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};