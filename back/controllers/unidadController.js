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
            .select('stock, esatdo, Tipo_Unidades(nombre)');
        
        if (error) throw error;
        if (!Array.isArray(data)) return res.json([]);

        const resumen = data.reduce((acc, curr) => {
            const nombre = curr.Tipo_Unidades?.nombre || 'Sin nombre';
            if (!acc[nombre]) {
                acc[nombre] = { nombre, disponibles: 0, alquiladas: 0, servicio: 0 };
            }
            if (curr.esatdo === 'Disponible') acc[nombre].disponibles += (curr.stock || 0);
            if (curr.esatdo === 'Alquilada') acc[nombre].alquiladas += (curr.stock || 0);
            if (curr.esatdo === 'En servicio') acc[nombre].servicio += (curr.stock || 0);
            return acc;
        }, {});

        res.json(Object.values(resumen));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.gestionarStock = async (req, res) => {
    try {
        const { idTipo, stock, estado, precio } = req.body;
        const cantidad = parseInt(stock);

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