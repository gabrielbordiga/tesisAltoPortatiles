const express = require('express');
const router = express.Router();
const recordatorioController = require('../controllers/recordatoriosController');

router.get('/', recordatorioController.obtenerRecordatorios);
router.post('/', recordatorioController.crearRecordatorio);
router.delete('/:id', recordatorioController.eliminarRecordatorio);

module.exports = router;