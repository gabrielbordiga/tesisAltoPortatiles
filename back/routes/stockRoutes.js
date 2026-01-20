const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Proveedores
router.get('/proveedores', stockController.getProveedores);
router.post('/proveedores', stockController.crearProveedor);
router.put('/proveedores/:id', stockController.editarProveedor);
router.delete('/proveedores/:id', stockController.eliminarProveedor);

// Productos
router.get('/productos', stockController.getProductos);
router.post('/productos', stockController.crearProducto);
router.delete('/productos/:id', stockController.eliminarProducto);

// Compras
router.get('/compras', stockController.getCompras);
router.post('/compras', stockController.crearCompra);
router.put('/compras/:id', stockController.editarCompra);
router.delete('/compras/:id', stockController.eliminarCompra);

module.exports = router;