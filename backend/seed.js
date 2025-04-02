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
  // 🧠 MOTORES
  // ===========================
  const motores = [
    ['inducción', 15.2, 'Motor trifásico de inducción 10HP', 10, 'trifásico', 0.85, 220],
    ['sincrónico', 10.5, 'Motor sincrónico monofásico 5HP', 5, 'monofásico', 0.90, 127],
    ['inducción', 18.4, 'Motor de inducción 15HP industrial', 15, 'trifásico', 0.86, 440]
  ];

  connection.query(`
    INSERT INTO motores (tipo, ipc, descripcion, potencia_hp, fases, factor_potencia, voltaje)
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
    ['4/0 AWG', 230, 'cobre', 'THW', 107.2, 170, 600, 0.05]
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
