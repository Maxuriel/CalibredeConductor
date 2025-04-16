// seed.js
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Conectado para insertar datos de prueba.\n');

  // ===========================
  // 🧠 MOTORES - Columna Corriente de Arranque,  meter más motores.
  // ===========================
  const motores = [
    ['inducción', 15.2, 'Motor trifásico de inducción 10HP', 10, 'trifásico', 0.85, 220, 91.2],
    ['sincrónico', 10.5, 'Motor sincrónico monofásico 5HP', 5, 'monofásico', 0.90, 127, 63.0],
    ['inducción', 18.4, 'Motor de inducción 15HP industrial', 15, 'trifásico', 0.86, 440, 110.4],
    ['inducción', 22.1, 'Motor trifásico de inducción 20HP', 20, 'trifásico', 0.88, 440, 132.6],
    ['sincrónico', 8.3, 'Motor sincrónico monofásico 3HP', 3, 'monofásico', 0.89, 127, 49.8],
    ['inducción', 12.7, 'Motor de inducción 7.5HP', 7.5, 'trifásico', 0.84, 220, 76.2],
    ['sincrónico', 25.6, 'Motor sincrónico trifásico 25HP', 25, 'trifásico', 0.92, 440, 153.6],
    ['inducción', 30.2, 'Motor de inducción 30HP industrial', 30, 'trifásico', 0.87, 440, 181.2],
    ['sincrónico', 16.8, 'Motor sincrónico monofásico 7.5HP', 7.5, 'monofásico', 0.91, 220, 100.8],
    ['inducción', 35.5, 'Motor de inducción 40HP', 40, 'trifásico', 0.89, 440, 213.0]
  ];

  connection.query(`
    INSERT INTO motores (tipo, ipc, descripcion, potencia_hp, fases, factor_potencia, voltaje, corriente_arranque)
    VALUES ?
  `, [motores], (err) => {
    if (err) throw err;
    console.log('✅ Datos insertados en la tabla motores');
  });

  // ===========================
  // ⚡ CONDUCTORES (ahora con reactancia_inductiva)
  // ===========================
  const conductores = [
    ['14 AWG', 15, 'cobre', 'THW', 2.08, 3.1, 600, 0.08],
    ['12 AWG', 20, 'cobre', 'THHN', 3.31, 5.2, 600, 0.08],
    ['10 AWG', 30, 'cobre', 'THHN', 5.26, 8.4, 600, 0.08],
    ['8 AWG', 50, 'aluminio', 'XHHW', 8.37, 13.2, 600, 0.09],
    ['6 AWG', 65, 'cobre', 'THW', 13.3, 21.2, 600, 0.07],
    ['4 AWG', 85, 'cobre', 'THHN', 21.2, 33.6, 600, 0.07],
    ['2 AWG', 115, 'aluminio', 'XHHW', 33.6, 53.5, 600, 0.09],
    ['1/0 AWG', 150, 'cobre', 'THW', 53.5, 85, 600, 0.06],
    ['2/0 AWG', 175, 'cobre', 'THHN', 67.4, 107, 600, 0.06],
    ['4/0 AWG', 230, 'cobre', 'THW', 107.2, 170, 600, 0.05],
    ['250 MCM', 255, 'cobre', 'THHN', 126.7, 201, 600, 0.05],
    ['300 MCM', 285, 'cobre', 'THW', 152.0, 241, 600, 0.05],
    ['350 MCM', 310, 'aluminio', 'XHHW', 177.3, 282, 600, 0.05],
    ['400 MCM', 335, 'cobre', 'THHN', 202.7, 322, 600, 0.04],
    ['500 MCM', 380, 'cobre', 'THW', 253.4, 402, 600, 0.04],
    ['600 MCM', 420, 'aluminio', 'XHHW', 304.0, 483, 600, 0.04],
    ['750 MCM', 475, 'cobre', 'THHN', 380.0, 603, 600, 0.04],
    ['1000 MCM', 545, 'cobre', 'THW', 506.7, 804, 600, 0.04]
  ];

  connection.query(`
    INSERT INTO conductores 
    (calibre, capacidad_corriente, material, aislamiento, diametro_mm2, resistencia_ohm_km, voltaje_max, reactancia_inductiva)
    VALUES ?
  `, [conductores], (err) => {
    if (err) throw err;
    console.log('✅ Datos insertados en la tabla conductores');
  });

  // ===========================
  // 🧮 FACTORES DE AGRUPAMIENTO
  // ===========================
  const factores = [
    [1, 1.00],
    [2, 0.80],
    [3, 0.70],
    [4, 0.65],
    [5, 0.60],
    [6, 0.57],
    [7, 0.54],
    [8, 0.52],
    [9, 0.50]
  ];

  connection.query(`
    INSERT INTO factores_agrupamiento (cantidad_conductores, factor)
    VALUES ?
  `, [factores], (err) => {
    if (err) throw err;
    console.log('✅ Datos insertados en la tabla factores_agrupamiento');
    connection.end();
  });
});
