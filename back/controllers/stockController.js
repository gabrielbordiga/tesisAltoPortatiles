const supabase = require('../config/supabase');

// --- PROVEEDORES ---

exports.getProveedores = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Proveedores')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.crearProveedor = async (req, res) => {
    try {
        const { nombre, tel, direccion, email } = req.body;
        const { data, error } = await supabase
            .from('Proveedores')
            .insert([{ nombre, tel, direccion, email, activo: true }])
            .select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.editarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, tel, direccion, email } = req.body;
        const { data, error } = await supabase
            .from('Proveedores')
            .update({ nombre, tel, direccion, email, updated_at: new Date() })
            .eq('idProveedor', id)
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.eliminarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('Proveedores')
            .update({ activo: false, updated_at: new Date() })
            .eq('idProveedor', id);
        if (error) throw error;
        res.json({ mensaje: 'Proveedor eliminado' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// --- PRODUCTOS ---

exports.getProductos = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Productos')
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.crearProducto = async (req, res) => {
    try {
        const { nombre, unidadMedida } = req.body;
        const { data, error } = await supabase
            .from('Productos')
            .insert([{ nombre, unidadMedida }])
            .select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('Productos')
            .delete()
            .eq('idProducto', id);
        if (error) throw error;
        res.json({ mensaje: 'Producto eliminado' });
    } catch (err) {
        res.status(400).json({ error: 'No se pudo eliminar. Verifique que no tenga compras asociadas.' });
    }
};

// --- COMPRAS (MOVIMIENTOS) ---

exports.getCompras = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('CompraInsumos')
            .select('*, Proveedores(nombre), Productos(nombre, unidadMedida)')
            .order('fecha', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.crearCompra = async (req, res) => {
    try {
        const { idProveedor, idProducto, fecha, cantidad, precio, metodoPago } = req.body;
        const { data, error } = await supabase
            .from('CompraInsumos')
            .insert([{ idProveedor, idProducto, fecha, cantidad, precio, metodoPago }])
            .select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.editarCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad } = req.body;
        const { data, error } = await supabase
            .from('CompraInsumos')
            .update({ cantidad, updated_at: new Date() })
            .eq('idCompra', id)
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.eliminarCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('CompraInsumos')
            .delete()
            .eq('idCompra', id);
        if (error) throw error;
        res.json({ mensaje: 'Compra eliminada' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};