const express = require('express');
const router = express.Router();
const db = require('../db/connection');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, d.calibre, d.material, d.aislamiento
      FROM consultas c
      JOIN conductores d ON c.conductor_id = d.id
      ORDER BY c.fecha DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al consultar historial.' });
  }
});

module.exports = router;
