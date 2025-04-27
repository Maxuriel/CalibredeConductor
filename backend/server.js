// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connection = require('./db/connection');
const calculoRoutes = require('./routes/calculo');
const historialRoutes = require('./routes/historial');
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/calcular', calculoRoutes);
app.use('/api/historial', historialRoutes);

// New endpoints for motores and materiales-conductor
app.get('/api/motores', async (req, res) => {
  try {
    const [rows] = await connection.query('SELECT * FROM motores');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching motores' });
  }
});

app.get('/api/materiales-conductor', async (req, res) => {
  try {
    const [rows] = await connection.query('SELECT DISTINCT material FROM conductores');
    res.json(rows.map(row => row.material));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching materiales-conductor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
