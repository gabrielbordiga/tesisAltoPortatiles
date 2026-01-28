require('dotenv').config();
const express = require('express');
const cors = require('cors'); // 1. Importas CORS
const path = require('path');
const app = express();
const usuarioRoutes = require('./routes/usuarioRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const unidadRoutes = require('./routes/unidadRoutes');
const alquilerRoutes = require('./routes/alquilerRoutes');
const tareaRoutes = require('./routes/tareaRoutes');
const stockRoutes = require('./routes/stockRoutes');
const recordatorioRoutes = require('./routes/recordatorioRoutes');
const reporteRoutes = require('./routes/reporteRoutes');

// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json()); 

// --- FRONTEND ---
// Servir los archivos de la carpeta 'front' como estáticos
app.use(express.static(path.join(__dirname, '../front')));

// Redirigir la raíz '/' a la pantalla de login (o inicio)
app.get('/', (req, res) => {
    res.redirect('/html/login.html');
});

// --- RUTAS ---
app.use('/api/clientes', clienteRoutes);
app.use('/api/unidades', unidadRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/alquileres', alquilerRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/recordatorios', recordatorioRoutes);
app.use('/api/reportes', reporteRoutes);


// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Alto Portatiles corriendo en puerto ${PORT}`);
});