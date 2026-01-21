const supabase = require('../config/supabase');

exports.obtenerRecordatorios = async (req, res) => {
    const { data, error } = await supabase
        .from('Recordatorios')
        .select('*')
        .order('fecha', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};

exports.crearRecordatorio = async (req, res) => {
    const { fecha, descripcion, idUsuarios } = req.body;
    const { data, error } = await supabase
        .from('Recordatorios')
        .insert([{ fecha, descripcion, idUsuarios }])
        .select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data[0]);
};

exports.eliminarRecordatorio = async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('Recordatorios').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: "Eliminado" });
};