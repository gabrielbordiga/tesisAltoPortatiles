const supabase = require('../config/supabase');

// 1. Obtener todos los clientes
exports.obtenerClientes = async (req, res) => {
    const { data, error } = await supabase
        .from('Clientes') // Asegúrate de que la tabla en Supabase se llame 'Clientes'
        .select('*')
        .order('id', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};

// 2. Crear cliente
exports.crearCliente = async (req, res) => {
    // Recibimos todos los campos del formulario
    const { tipo, nombre, apellido, dni, razonSocial, cuitEmpresa, cuit, tel1, tel2, ubicacion, contribuyente } = req.body;

    const { data, error } = await supabase
        .from('Clientes')
        .insert([{ 
            tipo, nombre, apellido, dni, razonSocial, cuitEmpresa, cuit, tel1, tel2, ubicacion, contribuyente 
        }])
        .select();

    if (error) {
        console.error("Error al crear cliente:", error);
        return res.status(400).json({ error: error.message });
    }
    res.status(201).json({ mensaje: "Cliente creado exitosamente", data });
};

// 3. Editar cliente
exports.editarCliente = async (req, res) => {
    const { id } = req.params;
    const { tipo, nombre, apellido, dni, razonSocial, cuitEmpresa, cuit, tel1, tel2, ubicacion, contribuyente } = req.body;

    const { data, error } = await supabase
        .from('Clientes')
        .update({ tipo, nombre, apellido, dni, razonSocial, cuitEmpresa, cuit, tel1, tel2, ubicacion, contribuyente })
        .eq('id', id)
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: "Cliente actualizado correctamente", data });
};

// 4. Eliminar cliente
exports.eliminarCliente = async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('Clientes').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: "Cliente eliminado correctamente" });
};