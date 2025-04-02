const db = require('../db/connection');

// Controlador para calcular el conductor adecuado
exports.calcularConductor = async (req, res) => {
  try {
    // 📥 Extraemos los datos del frontend
    const { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores } = req.body;
    const { longitud, porcentajeMaxAV, cosenoPhi, senoPhi } = req.body;

    // 🛡️ Validamos que haya datos obligatorios
    if (!voltaje || !potencia || !fp || !fases) {
      return res.status(400).json({ error: 'Faltan datos obligatorios.' });
    }

    // 🔢 Variables para corriente y corriente ajustada
    let corriente = 0;
    let inm = 0;

    // 🔌 Si es motor de inducción, buscamos el IPC en la base de datos
    if (esMotor && tipoMotor === 'inducción') {
      const [motores] = await db.query(
        `SELECT ipc FROM motores WHERE tipo = 'inducción' AND voltaje = ? AND potencia_hp = ? LIMIT 1`,
        [voltaje, potencia]
      );

      // ❌ Si no hay coincidencia, mandamos error
      if (motores.length === 0) {
        return res.status(404).json({ error: 'Motor no encontrado en la base de datos.' });
      }

      // ✅ Calculamos corriente ajustada para motores: Ipcm = 1.25 × IPC
      corriente = motores[0].ipc;
      inm = 1.25 * corriente;
    } else {
      // ⚡ Si no es motor, usamos fórmula estándar para corriente
      corriente = fases === 'monofásico'
        ? potencia / (voltaje * fp)
        : potencia / (Math.sqrt(3) * voltaje * fp);

      // Corriente ajustada: Inm = 1.1 × I
      inm = 1.1 * corriente;
    }

    // 🧮 Aplicamos factor de agrupamiento si hay más de 1 conductor por fase
    let fa = 1.0;
    let inc = inm;

    if (numConductores && numConductores > 1) {
      const [factores] = await db.query(
        `SELECT factor FROM factores_agrupamiento WHERE cantidad_conductores = ? LIMIT 1`,
        [numConductores]
      );

      if (factores.length === 0) {
        return res.status(404).json({ error: 'No se encontró el factor de agrupamiento.' });
      }

      fa = factores[0].factor;
      inc = inm * fa; // Corriente agrupada
    }

    // 🔎 Obtenemos todos los conductores con capacidad ≥ Inc
    const [conductores] = await db.query(
      `SELECT * FROM conductores WHERE capacidad_corriente >= ? ORDER BY capacidad_corriente ASC`,
      [inc]
    );

    if (!conductores || conductores.length === 0) {
      return res.status(404).json({ error: 'No se encontró un conductor adecuado para la corriente agrupada.' });
    }

    // 🔁 Vamos a recorrer los conductores para verificar AV
    const T = 40; // Temperatura de referencia en °C
    const L = longitud / 1000; // Convertir longitud a km

    let conductorSugerido = null;
    let AV = 0;
    let porcentajeAV = 0;

    for (const c of conductores) {
      const R1 = c.resistencia_ohm_km;              // Resistencia base
      const X = c.reactancia_inductiva || 0;        // Reactancia inductiva
      const R = R1 * ((234.5 + T) / 254.5);          // Resistencia ajustada a 40°C

      // 💡 Cálculo de caída de tensión (AV)
      AV = 1.73 * inm * L * (R * cosenoPhi + X * senoPhi);

      // % caída de tensión
      porcentajeAV = (AV / voltaje) * 100;

      // ✅ Si cumple con el % máximo permitido, lo aceptamos
      if (porcentajeAV <= porcentajeMaxAV) {
        conductorSugerido = c;
        break;
      }
    }

    // ❌ Si ningún conductor cumple con AV, mandamos error
    if (!conductorSugerido) {
      return res.status(400).json({
        error: `Ningún conductor cumple con la caída de tensión máxima permitida (${porcentajeMaxAV}%).`,
        caida_tension: porcentajeAV.toFixed(2)
      });
    }

    // 🗃️ Guardamos la consulta en la base de datos
    await db.query(`
      INSERT INTO consultas (
        voltaje, potencia, fp, fases, es_motor, tipo_motor, inm, fa, inc, conductor_id, caida_tension, porcentaje_caida
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [voltaje, potencia, fp, fases, esMotor, tipoMotor, inm, fa, inc, conductorSugerido.id, AV.toFixed(2), porcentajeAV.toFixed(2)]
    );

    // 📤 Enviamos los datos al frontend
    return res.json({
      corriente: corriente.toFixed(2),
      corriente_ajustada: inm.toFixed(2),
      factor_agrupamiento: fa,
      corriente_agrupada: inc.toFixed(2),
      caida_tension: porcentajeAV.toFixed(2),
      av: AV.toFixed(2),
      conductor_sugerido: conductorSugerido
    });

  } catch (error) {
    console.error('Error en el cálculo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
