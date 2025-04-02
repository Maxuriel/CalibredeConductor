const express = require('express');
const router = express.Router();
const { calcularConductor } = require('../controllers/calculoController');

router.post('/', calcularConductor);

module.exports = router;
