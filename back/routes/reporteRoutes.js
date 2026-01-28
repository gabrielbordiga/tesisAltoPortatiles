const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');

router.get('/', reporteController.obtenerDatosReporte);

module.exports = router;