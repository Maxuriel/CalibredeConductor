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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
