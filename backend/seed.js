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

  // Añadir modificación de schema para capacidad_corriente
  connection.query(
    `ALTER TABLE conductores MODIFY capacidad_corriente DECIMAL(10,2) NOT NULL`,
    (err) => {
      if (err) console.warn('No se pudo modificar la columna capacidad_corriente, puede que ya tenga el tipo correcto.');

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
        ['22 AWG', 4, 'cobre', 'THW', 0.326, 52.0, 600, 0.15],
        ['24 AWG', 3.5, 'cobre', 'THHN', 0.205, 84.2, 600, 0.18],
        ['26 AWG', 2.8, 'cobre', 'THW', 0.129, 133.0, 600, 0.22],
        ['28 AWG', 2.2, 'cobre', 'THHN', 0.081, 211.0, 600, 0.28],
        ['30 AWG', 1.8, 'cobre', 'THW', 0.051, 336.0, 600, 0.35],
        ['32 AWG', 1.5, 'cobre', 'THHN', 0.032, 533.0, 600, 0.44],
        ['34 AWG', 1.2, 'cobre', 'THW', 0.020, 847.0, 600, 0.56],
        ['36 AWG', 1.0, 'cobre', 'THHN', 0.013, 1347.0, 600, 0.71],
        ['38 AWG', 0.8, 'cobre', 'THW', 0.008, 2140.0, 600, 0.89],
        ['40 AWG', 0.6, 'cobre', 'THHN', 0.005, 3400.0, 600, 1.12],
        ['42 AWG', 0.5, 'cobre', 'THW', 0.003, 5400.0, 600, 1.41],
        ['44 AWG', 0.4, 'cobre', 'THHN', 0.002, 8600.0, 600, 1.78],
        ['46 AWG', 0.3, 'cobre', 'THW', 0.001, 13700.0, 600, 2.24],
        ['48 AWG', 0.25, 'cobre', 'THHN', 0.0007, 22000.0, 600, 2.82],
        ['50 AWG', 0.2, 'cobre', 'THW', 0.0005, 35000.0, 600, 3.55],
        ['52 AWG', 0.15, 'cobre', 'THHN', 0.0003, 56000.0, 600, 4.47],
        ['54 AWG', 0.12, 'cobre', 'THW', 0.0002, 90000.0, 600, 5.63],
        ['56 AWG', 0.1, 'cobre', 'THHN', 0.0001, 140000.0, 600, 7.10],
        ['58 AWG', 0.08, 'cobre', 'THW', 0.00007, 220000.0, 600, 8.94],
        ['60 AWG', 0.06, 'cobre', 'THHN', 0.00005, 350000.0, 600, 11.24],
        ['18 AWG', 6, 'cobre', 'THW', 0.823, 13.2, 600, 0.12],
        ['16 AWG', 8, 'cobre', 'THHN', 1.31, 21.0, 600, 0.11],
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
        ['1000 MCM', 545, 'cobre', 'THW', 506.7, 804, 600, 0.04],
        ['1250 MCM', 590, 'cobre', 'THHN', 633.0, 1005, 600, 0.03],
        ['1500 MCM', 625, 'cobre', 'THW', 760.0, 1206, 600, 0.03],
        ['1750 MCM', 660, 'aluminio', 'XHHW', 887.0, 1407, 600, 0.03],
        ['2000 MCM', 700, 'cobre', 'THHN', 1014.0, 1608, 600, 0.03],
        ['2250 MCM', 735, 'cobre', 'THW', 1141.0, 1809, 600, 0.03],
        ['2500 MCM', 770, 'aluminio', 'XHHW', 1268.0, 2010, 600, 0.03],
        ['2750 MCM', 800, 'cobre', 'THHN', 1395.0, 2211, 600, 0.02],
        ['3000 MCM', 830, 'cobre', 'THW', 1522.0, 2412, 600, 0.02],
        ['3250 MCM', 860, 'aluminio', 'XHHW', 1649.0, 2613, 600, 0.02],
        ['3500 MCM', 890, 'cobre', 'THHN', 1776.0, 2814, 600, 0.02],
        ['3750 MCM', 920, 'cobre', 'THW', 1903.0, 3015, 600, 0.02],
        ['4000 MCM', 950, 'aluminio', 'XHHW', 2030.0, 3216, 600, 0.02],
        ['4250 MCM', 980, 'cobre', 'THHN', 2157.0, 3417, 600, 0.02],
        ['4500 MCM', 1010, 'cobre', 'THW', 2284.0, 3618, 600, 0.02],
        ['4750 MCM', 1040, 'aluminio', 'XHHW', 2411.0, 3819, 600, 0.02],
        ['5000 MCM', 1070, 'cobre', 'THHN', 2538.0, 4020, 600, 0.02],
        ['5250 MCM', 1100, 'cobre', 'THW', 2665.0, 4221, 600, 0.02],
        ['5500 MCM', 1130, 'aluminio', 'XHHW', 2792.0, 4422, 600, 0.02],
        ['5750 MCM', 1160, 'cobre', 'THHN', 2919.0, 4623, 600, 0.02],
        ['6000 MCM', 1190, 'cobre', 'THW', 3046.0, 4824, 600, 0.02],
        ['6250 MCM', 1220, 'aluminio', 'XHHW', 3173.0, 5025, 600, 0.02],
        ['6500 MCM', 1250, 'cobre', 'THHN', 3300.0, 5226, 600, 0.02],
        ['6750 MCM', 1280, 'cobre', 'THW', 3427.0, 5427, 600, 0.02],
        ['7000 MCM', 1310, 'aluminio', 'XHHW', 3554.0, 5628, 600, 0.02],
        ['7250 MCM', 1340, 'cobre', 'THHN', 3681.0, 5829, 600, 0.02],
        ['7500 MCM', 1370, 'cobre', 'THW', 3808.0, 6030, 600, 0.02],
        ['7750 MCM', 1400, 'aluminio', 'XHHW', 3935.0, 6231, 600, 0.02],
        ['8000 MCM', 1430, 'cobre', 'THHN', 4062.0, 6432, 600, 0.02],
        ['8250 MCM', 1460, 'cobre', 'THW', 4189.0, 6633, 600, 0.02],
        ['8500 MCM', 1490, 'aluminio', 'XHHW', 4316.0, 6834, 600, 0.02],
        ['8750 MCM', 1520, 'cobre', 'THHN', 4443.0, 7035, 600, 0.02],
        ['9000 MCM', 1550, 'cobre', 'THW', 4570.0, 7236, 600, 0.02],
        ['9250 MCM', 1580, 'aluminio', 'XHHW', 4697.0, 7437, 600, 0.02],
        ['9500 MCM', 1610, 'cobre', 'THHN', 4824.0, 7638, 600, 0.02],
        ['9750 MCM', 1640, 'cobre', 'THW', 4951.0, 7839, 600, 0.02],
        ['10000 MCM', 1670, 'aluminio', 'XHHW', 5078.0, 8040, 600, 0.02],
        ['1 AWG', 130, 'cobre', 'THHN', 42.4, 65.3, 600, 0.06], // Para motores de 125A
        ['3/0 AWG', 200, 'cobre', 'THHN', 85.0, 107.2, 600, 0.05], // Para motores de 175A
        ['500 MCM', 380, 'cobre', 'THHN', 253.8, 402.0, 600, 0.04], // Para motores de 350A
        ['750 MCM', 475, 'cobre', 'THHN', 380.0, 603.0, 600, 0.04], // Para motores de 450A
        ['1000 MCM', 545, 'cobre', 'THHN', 506.7, 804.0, 600, 0.04] // Para motores de 500A
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
    }
  );
});
