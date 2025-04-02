const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    // Crear la base de datos si no existe
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    console.log(`✅ Base de datos '${process.env.DB_NAME}' verificada/creada.`);
    await connection.end();

    // Conectar a la base de datos
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Crear tabla motores
    await db.query(`
      CREATE TABLE IF NOT EXISTS motores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(50),
        ipc FLOAT,
        descripcion TEXT,
        potencia_hp FLOAT,
        fases VARCHAR(10),
        factor_potencia FLOAT,
        voltaje INT
      );
    `);
    console.log('✅ Tabla motores creada/verificada.');

    // Crear tabla conductores
    await db.query(`
      CREATE TABLE IF NOT EXISTS conductores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        calibre VARCHAR(10),
        capacidad_corriente FLOAT,
        material VARCHAR(20),
        aislamiento VARCHAR(50),
        diametro_mm2 FLOAT,
        resistencia_ohm_km FLOAT,
        voltaje_max INT,
        reactancia_inductiva FLOAT
      );
    `);
    console.log('✅ Tabla conductores creada/verificada.');

    // Crear tabla factores de agrupamiento
    await db.query(`
      CREATE TABLE IF NOT EXISTS factores_agrupamiento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cantidad_conductores INT,
        factor FLOAT
      );
    `);
    console.log('✅ Tabla factores_agrupamiento creada/verificada.');

    // Crear tabla consultas
    await db.query(`
      CREATE TABLE IF NOT EXISTS consultas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        voltaje FLOAT,
        potencia FLOAT,
        fp FLOAT,
        fases VARCHAR(20),
        es_motor BOOLEAN,
        tipo_motor VARCHAR(30),
        inm FLOAT,
        fa FLOAT,
        inc FLOAT,
        conductor_id INT,
        caida_tension FLOAT,
        porcentaje_caida FLOAT,
        FOREIGN KEY (conductor_id) REFERENCES conductores(id)
      );
    `);
    console.log('✅ Tabla consultas creada/verificada.');

    await db.end();
    console.log('🚀 Setup completo.');

  } catch (error) {
    console.error('❌ Error durante el setup:', error);
  }
})();
