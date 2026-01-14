const express = require('express');
const router = express.Router();
const unidadController = require('../controllers/unidadController');

router.get('/tipos', unidadController.getTipos);
router.post('/tipos', unidadController.crearTipo);
router.get('/resumen', unidadController.getResumenStock);
router.post('/gestion', unidadController.gestionarStock);

module.exports = router;