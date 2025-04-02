// controllers/calculoController.js
const db = require('../db/connection');

exports.calcularConductor = async (req, res) => {
  try {
    const { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores } = req.body;
    // Agregado: nuevos parámetros de req.body para el cálculo de caída de tensión
    const { longitud, porcentajeMaxAV, cosenoPhi, senoPhi } = req.body;

    if (!voltaje || !potencia || !fp || !fases) {
      return res.status(400).json({ error: 'Faltan datos obligatorios.' });
    }

    let corriente = 0;
    let inm = 0;

    if (esMotor && tipoMotor === 'inducción') {
      const [motores] = await db.query(
        `SELECT ipc FROM motores WHERE tipo = 'inducción' AND voltaje = ? AND potencia_hp = ? LIMIT 1`,
        [voltaje, potencia]
      );

      if (motores.length === 0) {
        return res.status(404).json({ error: 'Motor no encontrado en la base de datos.' });
      }

      corriente = motores[0].ipc;
      inm = 1.25 * corriente;
    } else {
      corriente = fases === 'monofásico'
        ? potencia / (voltaje * fp)
        : potencia / (Math.sqrt(3) * voltaje * fp);
      inm = 1.1 * corriente;
    }

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
      inc = inm * fa;
    }

    const [conductor] = await db.query(
      `SELECT * FROM conductores WHERE capacidad_corriente >= ? ORDER BY capacidad_corriente ASC LIMIT 1`,
      [inc]
    );

    if (!conductor || conductor.length === 0) {
      return res.status(404).json({ error: 'No se encontró un conductor adecuado para la corriente agrupada.' });
    }

    // Nuevo: calcular resistencia alterna y caída de tensión
    const T = 40;
    const R1 = conductor[0].resistencia_ohm_km;
    const X = conductor[0].reactancia_inductiva || 0; // se asigna 0 si no existe
    const R = R1 * ((234.5 + T) / 254.5);
    const L = longitud / 1000; // convertir a km
    const AV = 1.73 * inm * L * (R * cosenoPhi + X * senoPhi);
    const porcentajeAV = (AV / voltaje) * 100;

    if (porcentajeAV > porcentajeMaxAV) {
      return res.status(400).json({
        error: `La caída de tensión (${porcentajeAV.toFixed(2)}%) excede el máximo permitido (${porcentajeMaxAV}%).`,
        caida_tension: porcentajeAV.toFixed(2)
      });
    }

    // Insertar consulta en base de datos
    await db.query(`
      INSERT INTO consultas (
        voltaje, potencia, fp, fases, es_motor, tipo_motor, inm, fa, inc, conductor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      voltaje, potencia, fp, fases, esMotor, tipoMotor, inm, fa, inc, conductor[0].id
    ]);

    return res.json({
      corriente: corriente.toFixed(2),
      corriente_ajustada: inm.toFixed(2),
      factor_agrupamiento: fa,
      corriente_agrupada: inc.toFixed(2),
      caida_tension: porcentajeAV.toFixed(2),
      av: AV.toFixed(2),
      conductor_sugerido: conductor[0]
    });

  } catch (error) {
    console.error('Error en el cálculo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
