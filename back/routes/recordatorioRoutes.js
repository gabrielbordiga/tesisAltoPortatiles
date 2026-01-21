const express = require('express');
const router = express.Router();
// Importamos el controlador donde tenés las funciones
const recordatorioController = require('../controllers/recordatoriosController');

// 1. Ruta para obtener todos los recordatorios (GET /api/recordatorios)
router.get('/', recordatorioController.obtenerRecordatorios);

// 2. Ruta para crear uno nuevo (POST /api/recordatorios)
router.post('/', recordatorioController.crearRecordatorio);

// 3. Ruta para eliminar (DELETE /api/recordatorios/:id)
// Es VITAL el '/:id' para que el servidor sepa cuál borrar
router.delete('/:id', recordatorioController.eliminarRecordatorio);

module.exports = router;