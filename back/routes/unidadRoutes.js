const express = require('express');
const router = express.Router();
const unidadController = require('../controllers/unidadController');

router.get('/tipos', unidadController.getTipos);
router.get('/resumen', unidadController.getResumenStock);
router.get('/disponibilidad', unidadController.getDisponibilidadPorRango);
router.post('/tipos', unidadController.crearTipo);
router.post('/gestion', unidadController.gestionarStock);

module.exports = router;