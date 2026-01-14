const supabase = require('../config/supabase');

// 1. OBTENER CLIENTES (Solo los activos para la grilla principal)
exports.obtenerClientes = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Cliente')
            .select('*')
            .eq('activo', true)
            .order('idCliente', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 2. CREAR / REACTIVAR CLIENTE
exports.crearCliente = async (req, res) => {
    try {
        const { tipo, nombre, apellido, dni, razonSocial, cuit, tel1, tel2, ubicacion, contribuyente } = req.body;

        // Verificar si el CUIT ya existe (en cualquier estado)
        const { data: existe, error: errBusq } = await supabase
            .from('Cliente')
            .select('idCliente, activo')
            .eq('cuit', cuit)
            .maybeSingle();

        if (existe) {
            if (existe.activo) {
                return res.status(400).json({ error: "EXISTE_ACTIVO", mensaje: "El CUIT ya pertenece a un cliente activo." });
            } else {
                // Existe pero está inactivo: Enviamos 409 para que el front pregunte
                return res.status(409).json({ 
                    error: "INACTIVO", 
                    idCliente: existe.idCliente,
                    mensaje: "Este cliente ya existe pero está inactivo (borrado). ¿Desea reactivarlo?" 
                });
            }
        }

        const tipoUpper = String(tipo || '').toUpperCase();
        const nuevo = {
            tipo: tipoUpper,
            nombre: tipoUpper === 'PERSONA' ? nombre : null,
            apellido: tipoUpper === 'PERSONA' ? apellido : null,
            dni: tipoUpper === 'PERSONA' ? dni : null,
            razonSocial: tipoUpper === 'EMPRESA' ? razonSocial : null,
            cuit, tel1, tel2, ubicacion, contribuyente,
            activo: true
        };

        const { data, error } = await supabase.from('Cliente').insert([nuevo]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 3. EDITAR CLIENTE
exports.editarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const tipoUpper = String(req.body.tipo || '').toUpperCase();
        
        const datos = {
            ...req.body,
            tipo: tipoUpper,
            nombre: tipoUpper === 'PERSONA' ? req.body.nombre : null,
            apellido: tipoUpper === 'PERSONA' ? req.body.apellido : null,
            dni: tipoUpper === 'PERSONA' ? req.body.dni : null,
            razonSocial: tipoUpper === 'EMPRESA' ? req.body.razonSocial : null,
            activo: true // Al editar, aseguramos que quede activo
        };

        const { data, error } = await supabase.from('Cliente').update(datos).eq('idCliente', id).select();
        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 4. ELIMINAR (Baja lógica)
exports.eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('Cliente').update({ activo: false }).eq('idCliente', id);
        if (error) throw error;
        res.json({ mensaje: "Baja exitosa" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};