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
        const tipoRecibido = req.body.tipo || req.body.tipoCliente;
        const { nombre, apellido, dni, razonSocial, cuit, tel1, tel2, ubicacion, contribuyente } = req.body;

        console.log("[CREAR CLIENTE] Datos:", { tipo: tipoRecibido, nombre, cuit });

        // Sanitizar campos vacíos a NULL para evitar errores de constraints en BD
        const cuitLimpio = (cuit && String(cuit).trim() !== '') ? String(cuit).trim() : null;
        const tel1Limpio = (tel1 && String(tel1).trim() !== '') ? String(tel1).trim() : null;
        const tel2Limpio = (tel2 && String(tel2).trim() !== '') ? String(tel2).trim() : null;

        // Verificar si el CUIT ya existe (en cualquier estado) - SOLO SI NO ES VACÍO
        if (cuitLimpio) {
            const { data: existe, error: errBusq } = await supabase
                .from('Cliente')
                .select('idCliente, activo')
                .eq('cuit', cuitLimpio)
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
        }

        let tipoUpper = String(tipoRecibido || '').toUpperCase();
        if (tipoUpper.includes('PERSONA')) tipoUpper = 'PERSONA';
        if (tipoUpper.includes('EMPRESA')) tipoUpper = 'EMPRESA';

        // VALIDACIÓN: Coincidencia DNI en CUIT (Solo Personas)
        if (tipoUpper === 'PERSONA' && cuitLimpio && dni) {
            const cuitNumeros = cuitLimpio.replace(/\D/g, '');
            const dniNumeros = String(dni).replace(/\D/g, '');
            
            if (cuitNumeros.length === 11) {
                const dniDelCuit = cuitNumeros.substring(2, 10); // Indices 2 a 9 (8 dígitos centrales)
                if (parseInt(dniDelCuit, 10) !== parseInt(dniNumeros, 10)) {
                    return res.status(400).json({ error: "CUIT_INVALIDO", mensaje: "El CUIT no coincide con el DNI ingresado." });
                }
            }
        }

        const nuevo = {
            tipo: tipoUpper,
            nombre: tipoUpper === 'PERSONA' ? nombre : null,
            apellido: tipoUpper === 'PERSONA' ? apellido : null,
            dni: tipoUpper === 'PERSONA' ? dni : null,
            razonSocial: tipoUpper === 'EMPRESA' ? razonSocial : null,
            cuit: cuitLimpio, 
            tel1: tel1Limpio, 
            tel2: tel2Limpio, 
            ubicacion, contribuyente,
            activo: true
        };

        const { data, error } = await supabase.from('Cliente').insert([nuevo]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        console.error("[CREAR CLIENTE] Error:", error.message);
        res.status(400).json({ error: error.message });
    }
};

// 3. EDITAR CLIENTE
exports.editarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const tipoRecibido = req.body.tipo || req.body.tipoCliente;
        const { nombre, apellido, dni, razonSocial, cuit, tel1, tel2, ubicacion, contribuyente } = req.body;
        
        console.log(`[EDITAR CLIENTE] ID: ${id}`, { tipo: tipoRecibido, nombre, cuit });

        let tipoUpper = String(tipoRecibido || '').toUpperCase();
        if (tipoUpper.includes('PERSONA')) tipoUpper = 'PERSONA';
        if (tipoUpper.includes('EMPRESA')) tipoUpper = 'EMPRESA';
        
        const cuitLimpio = (cuit && String(cuit).trim() !== '') ? String(cuit).trim() : null;
        const tel1Limpio = (tel1 && String(tel1).trim() !== '') ? String(tel1).trim() : null;
        const tel2Limpio = (tel2 && String(tel2).trim() !== '') ? String(tel2).trim() : null;

        // VALIDACIÓN: Coincidencia DNI en CUIT (Solo Personas)
        if (tipoUpper === 'PERSONA' && cuitLimpio && dni) {
            const cuitNumeros = cuitLimpio.replace(/\D/g, '');
            const dniNumeros = String(dni).replace(/\D/g, '');
            
            if (cuitNumeros.length === 11) {
                const dniDelCuit = cuitNumeros.substring(2, 10);
                if (parseInt(dniDelCuit, 10) !== parseInt(dniNumeros, 10)) {
                    return res.status(400).json({ error: "CUIT_INVALIDO", mensaje: "El CUIT no coincide con el DNI ingresado." });
                }
            }
        }
        
        const datos = {
            tipo: tipoUpper,
            nombre: tipoUpper === 'PERSONA' ? nombre : null,
            apellido: tipoUpper === 'PERSONA' ? apellido : null,
            dni: tipoUpper === 'PERSONA' ? dni : null,
            razonSocial: tipoUpper === 'EMPRESA' ? razonSocial : null,
            cuit: cuitLimpio,
            tel1: tel1Limpio,
            tel2: tel2Limpio,
            ubicacion, contribuyente,
            activo: true // Al editar, aseguramos que quede activo
        };

        const { data, error } = await supabase.from('Cliente').update(datos).eq('idCliente', id).select();
        if (error) throw error;
        
        if (!data || data.length === 0) return res.status(404).json({ error: "Cliente no encontrado para editar" });
        
        res.json(data[0]);
    } catch (error) {
        console.error("[EDITAR CLIENTE] Error:", error.message);
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

// 5. REACTIVAR CLIENTE
exports.reactivarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('Cliente')
            .update({ activo: true })
            .eq('idCliente', id);

        if (error) throw error;
        res.json({ mensaje: "Cliente reactivado correctamente" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};