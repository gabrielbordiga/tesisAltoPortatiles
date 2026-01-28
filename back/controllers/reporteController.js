
const supabase = require('../config/supabase');

exports.obtenerDatosReporte = async (req, res) => {
    const { desde, hasta } = req.query;

    try {
        // 1. INGRESOS
        const { data: ingresos, error: errIng } = await supabase
            .from('Alquileres')
            .select(`
                *,
                cliente:Cliente(nombre, apellido, razonSocial),
                pagos:Pagos(metodo, monto),
                lineas:DetalleAlquiler(
                    cantidad, 
                    unidades:Unidades(tipo:Tipo_Unidades(nombre))
                )
            `) 
            .gte('fechaDesde', desde) 
            .lte('fechaDesde', hasta);

        if (errIng) throw errIng;

        // 2. GASTOS
        const { data: gastos, error: errGas } = await supabase
            .from('CompraInsumos')
            .select(`
                *,
                proveedor:Proveedores(nombre),
                productoRef:Productos(nombre)
            `)
            .gte('fecha', desde)
            .lte('fecha', hasta);

        if (errGas) throw errGas;

        res.json({ ingresos, gastos });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};