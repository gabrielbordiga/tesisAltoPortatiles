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

// --- MIDDLEWARES ---
app.use(cors()); // 2. Habilitas CORS para que el frontend pueda conectarse
app.use(express.json()); 
app.use('/api/clientes', clienteRoutes);
app.use('/api/unidades', unidadRoutes);

// --- FRONTEND ---
// Servir los archivos de la carpeta 'front' como estáticos
app.use(express.static(path.join(__dirname, '../front')));

// Redirigir la raíz '/' a la pantalla de login (o inicio)
app.get('/', (req, res) => {
    res.redirect('/html/login.html');
});

// --- RUTAS ---
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/alquileres', alquilerRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/stock', stockRoutes);

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Alto Portatiles corriendo en puerto ${PORT}`);
});