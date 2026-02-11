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
        const hoy = new Date().toISOString().split('T')[0];

        const { data: stockFisico, error: errStock } = await supabase
            .from('Unidades')
            .select('stock, esatdo, precio, idTipo, Tipo_Unidades(nombre, idTipo)');
        
        if (errStock) throw errStock;

        const { data: ocupacionHoy, error: errOcup } = await supabase
            .from('DetalleAlquiler')
            .select('cantidad, Unidades!inner(idTipo), Alquileres!inner(estado, fechaDesde, fechaHasta)')
            .lte('Alquileres.fechaDesde', hoy)
            .gte('Alquileres.fechaHasta', hoy)
            .not('Alquileres.estado', 'in', '("FINALIZADO", "CANCELADO", "PARA RETIRAR")');

        if (errOcup) throw errOcup;

        const resumen = {};

        stockFisico.forEach(curr => {
            const tipo = curr.Tipo_Unidades;
            if (!tipo) return;

            if (!resumen[tipo.idTipo]) {
                resumen[tipo.idTipo] = { 
                    idTipo: tipo.idTipo,
                    nombre: tipo.nombre, 
                    disponibles: 0, 
                    alquiladas: 0, 
                    servicio: 0, 
                    precio: 0,
                    totalFisico: 0 
                };
            }

            if (curr.esatdo === 'Disponible') resumen[tipo.idTipo].totalFisico += (curr.stock || 0);
            if (curr.esatdo === 'En servicio') resumen[tipo.idTipo].servicio += (curr.stock || 0);
            
            if (curr.precio > 0) {
                resumen[tipo.idTipo].precio = curr.precio;
            }
        });

        ocupacionHoy.forEach(det => {
            const idTipo = det.Unidades?.idTipo;
            if (resumen[idTipo]) {
                resumen[idTipo].alquiladas += det.cantidad;
            }
        });

        const resultadoFinal = Object.values(resumen).map(r => ({
            ...r,
            disponibles: Math.max(0, r.totalFisico - r.alquiladas)
        }));

        res.json(resultadoFinal);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.gestionarStock = async (req, res) => {
    try {
        const { idTipo, stock, estado, precio, accion, origen, destino } = req.body;

        // 1. PRIMERO PROCESAMOS EL PRECIO (Si la acción es precio, no validamos cantidad)
        if (accion === 'precio') {
            const nuevoPrecio = parseFloat(precio);
            if (isNaN(nuevoPrecio)) return res.status(400).json({ error: "Precio inválido" });

            const { error } = await supabase
                .from('Unidades')
                .update({ precio: nuevoPrecio })
                .eq('idTipo', idTipo);

            if (error) throw error;
            return res.json({ mensaje: "Precio actualizado correctamente" });
        }

        // 2. PARA EL RESTO DE ACCIONES (mover, baja, alta), SÍ VALIDAMOS CANTIDAD
        const cantidad = parseInt(stock);
        if (isNaN(cantidad) || cantidad <= 0) {
            return res.status(400).json({ error: "La cantidad debe ser mayor a 0 para esta acción." });
        }

        // 3. Acción: Baja
        if (accion === 'baja') {
            const { data: row } = await supabase.from('Unidades')
                .select('*').eq('idTipo', idTipo).eq('esatdo', estado).maybeSingle();
            
            if (!row || row.stock < cantidad) {
                return res.status(400).json({ error: "Stock insuficiente en ese estado." });
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

        // 4. Acción: Mover
        if (accion === 'mover') {
            if (!origen || !destino) return res.status(400).json({ error: "Faltan origen o destino" });
            
            const { data: rowOrigen } = await supabase.from('Unidades')
                .select('*').eq('idTipo', idTipo).eq('esatdo', origen).maybeSingle();
            
            if (!rowOrigen || rowOrigen.stock < cantidad) {
                return res.status(400).json({ error: `Stock insuficiente en ${origen}` });
            }
            await supabase.from('Unidades').update({ stock: rowOrigen.stock - cantidad }).eq('idUnidad', rowOrigen.idUnidad);

            const { data: rowDestino } = await supabase.from('Unidades')
                .select('*').eq('idTipo', idTipo).eq('esatdo', destino).maybeSingle();
            
            if (rowDestino) {
                await supabase.from('Unidades').update({ stock: rowDestino.stock + cantidad }).eq('idUnidad', rowDestino.idUnidad);
            } else {
                await supabase.from('Unidades').insert([{ idTipo, stock: cantidad, esatdo: destino, precio: rowOrigen.precio }]);
            }
            return res.json({ mensaje: "Movimiento realizado" });
        }

        // 5. Lógica por defecto (Alta/Descuento de stock disponible)
        if (estado === 'Alquilada' || estado === 'En servicio') {
            const { data: disp } = await supabase
                .from('Unidades').select('idUnidad, stock').eq('idTipo', idTipo).eq('esatdo', 'Disponible').maybeSingle();

            if (!disp || disp.stock < cantidad) {
                return res.status(400).json({ error: `Stock insuficiente en Disponible` });
            }
            await supabase.from('Unidades').update({ stock: disp.stock - cantidad }).eq('idUnidad', disp.idUnidad);
        }

        const { data: existente } = await supabase
            .from('Unidades').select('idUnidad, stock, precio').eq('idTipo', idTipo).eq('esatdo', estado).maybeSingle();

        const precioAGuardar = (precio !== undefined && precio !== null) ? parseFloat(precio) : (existente?.precio || 0);

        if (existente) {
            await supabase.from('Unidades').update({ stock: existente.stock + cantidad, precio: precioAGuardar }).eq('idUnidad', existente.idUnidad);
        } else {
            await supabase.from('Unidades').insert([{ idTipo, stock: cantidad, esatdo: estado, precio: precioAGuardar }]);
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
    const { desde, hasta, excluir } = req.query; // Capturamos 'excluir'

    if (!desde || !hasta || desde.includes('object')) {
        return res.status(400).json({ error: "Fechas inválidas" });
    }

    try {
        const { data: stockFisico } = await supabase.from('Unidades').select('stock, idTipo, precio');

        let queryOcupacion = supabase
            .from('DetalleAlquiler')
            .select('cantidad, idUnidad, Unidades!inner(idTipo), Alquileres!inner(idAlquiler, fechaDesde, fechaHasta, estado)')
            .lte('Alquileres.fechaDesde', hasta)
            .gte('Alquileres.fechaHasta', desde)
            .not('Alquileres.estado', 'in', '("FINALIZADO", "RETIRADO", "CANCELADO")');

        if (excluir && excluir !== 'null' && excluir !== '') {
            queryOcupacion = queryOcupacion.neq('Alquileres.idAlquiler', excluir);
        }

        const { data: ocupadas, error: errOcup } = await queryOcupacion;
        
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

exports.getDetalleAlquiladas = async (req, res) => {
    try {
        const { idTipo } = req.params;
        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('DetalleAlquiler')
            .select(`
                cantidad,
                Unidades!inner(idTipo),
                Alquileres!inner(
                    idAlquiler,
                    ubicacion,
                    fechaHasta,
                    estado,
                    idCliente
                )
            `)
            .eq('Unidades.idTipo', idTipo)
            .lte('Alquileres.fechaDesde', hoy)
            .gte('Alquileres.fechaHasta', hoy)
            .not('Alquileres.estado', 'in', '("FINALIZADO", "CANCELADO", "PARA RETIRAR")');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};