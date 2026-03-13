const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

router.get('/', usuarioController.obtenerUsuarios);
router.get('/areas', usuarioController.obtenerAreas); 
router.post('/', usuarioController.crearUsuario);
router.put('/:id', usuarioController.editarUsuario);
router.delete('/:id', usuarioController.eliminarUsuario);

router.post('/login', usuarioController.login);
router.post('/recuperar-password', usuarioController.recuperarPassword);
router.post('/actualizar-password-olvidada', usuarioController.actualizarPasswordOlvidada);

module.exports = router;