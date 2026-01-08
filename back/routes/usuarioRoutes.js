const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

router.get('/', usuarioController.obtenerUsuarios);
router.get('/areas', usuarioController.obtenerAreas); // Nueva ruta para el select
router.post('/', usuarioController.crearUsuario);
router.put('/:id', usuarioController.editarUsuario);
router.delete('/:id', usuarioController.eliminarUsuario);

// ¡Esta es la ruta importante para el login!
router.post('/login', usuarioController.login);

module.exports = router;