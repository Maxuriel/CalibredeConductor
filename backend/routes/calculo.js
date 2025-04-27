const express = require('express');
const router = express.Router();
const { calcularConductor, obtenerMotores } = require('../controllers/calculoController');

router.post('/', calcularConductor);
router.get('/motores', obtenerMotores); // Nueva ruta para obtener motores

module.exports = router;
