const express = require('express');
const router = express.Router();
const tareaController = require('../controllers/tareaController');

router.get('/:fecha', tareaController.obtenerTareasPorFecha);
router.post('/', tareaController.crearTarea);
router.patch('/:id', tareaController.actualizarEstadoTarea);
router.delete('/:id', tareaController.eliminarTarea);

module.exports = router;