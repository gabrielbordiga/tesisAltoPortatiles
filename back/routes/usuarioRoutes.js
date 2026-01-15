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

// PASO 1: Solicitar el correo 
router.post('/recuperar-password', usuarioController.recuperarPassword);
// PASO 2: Guardar la nueva contraseña
router.post('/actualizar-password-olvidada', usuarioController.actualizarPasswordOlvidada);

module.exports = router;