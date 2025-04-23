const db = require('../db/connection');

// Controlador para calcular el conductor adecuado
exports.calcularConductor = async (req, res) => {
  try {
    const { calculationType, currentResult } = req.body;

    // Log incoming request data for debugging
    console.log('Request body:', req.body);

    if (calculationType === 'corriente') {
      return await calcularCorriente(req, res);
    } else if (calculationType === 'caida') {
      return await calcularCaida(req, res);
    } else {
      return res.status(400).json({ error: 'Tipo de cálculo inválido.' });
    }
  } catch (error) {
    console.error('Error en el cálculo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const calcularCorriente = async (req, res) => {
  const { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores /*, longitud */ } = req.body;

  // Log required fields for debugging
  console.log('Datos recibidos para cálculo de corriente:', { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores });

  // La potencia ya viene convertida a HP desde el frontend

  // 🛡️ Validamos que haya datos obligatorios
  if (!voltaje || !potencia || !fp || !fases) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  // 🔢 Variables para corriente y corriente ajustada
  let corriente = 0;
  let inm = 0;
  let corrienteArranque = 0;

  // 🔌 Si es motor de inducción, buscamos el IPC en la base de datos
  if (esMotor && tipoMotor === 'inducción') {
    const [motores] = await db.query(
      `SELECT ipc, corriente_arranque FROM motores WHERE tipo = 'inducción' AND voltaje = ? AND potencia_hp = ? LIMIT 1`,
      [voltaje, potencia]
    );

    // ❌ Si no hay coincidencia, mandamos error
    if (motores.length === 0) {
      return res.status(404).json({ error: 'Motor no encontrado en la base de datos.' });
    }

    // ✅ Calculamos corriente ajustada para motores: Ipcm = 1.25 × IPC
    corriente = motores[0].ipc;
    inm = 1.25 * corriente;
    corrienteArranque = motores[0].corriente_arranque; // Ensure this is retrieved and used
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
    [Math.max(inc, corrienteArranque / 6)]
  );

  if (!conductores || conductores.length === 0) {
    return res.status(404).json({ error: 'No se encontró un conductor adecuado para la corriente agrupada.' });
  }

  // 🔁 Vamos a recorrer los conductores para verificar AV
  const T = 40; // Temperatura de referencia en °C
  // Removed unused variable conversion since "longitud" is not provided in corriente
  // const L = longitud / 1000; // ...existing code removed...

  let conductorSugerido = null;

  for (const c of conductores) {
    const R1 = c.resistencia_ohm_km;              // Resistencia base
    const X = c.reactancia_inductiva || 0;        // Reactancia inductiva
    const R = R1 * ((234.5 + T) / 254.5);          // Resistencia ajustada a 40°C

    conductorSugerido = c;
    break;
  }

  // 🗃️ Guardamos la consulta en la base de datos con la nueva columna
  await db.query(`
    INSERT INTO consultas (
      voltaje, potencia, fp, fases, es_motor, tipo_motor, inm, fa, inc, conductor_id, corriente_arranque
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [voltaje, potencia, fp, fases, esMotor, tipoMotor, inm, fa, inc, conductorSugerido.id, esMotor ? corrienteArranque : null]
  );

  // 📤 Enviamos los datos al frontend
  return res.json({
    corriente: corriente.toFixed(2),
    corriente_ajustada: inm.toFixed(2),
    factor_agrupamiento: fa,
    corriente_agrupada: inc.toFixed(2),
    conductor_sugerido: conductorSugerido,
    corrienteArranque: esMotor ? corrienteArranque : null // Ensure this is included in the response
  });
};

const calcularCaida = async (req, res) => {
  const { voltaje, longitud, porcentajeMaxAV, phi, currentResult } = req.body;

  if (!currentResult) {
    return res.status(400).json({ error: 'Se requiere el cálculo de corriente previo.' });
  }

  const phiRadians = (phi * Math.PI) / 180;
  const cosenoPhi = Math.cos(phiRadians);
  const senoPhi = Math.sin(phiRadians);
  const inm = parseFloat(currentResult.corriente_ajustada);

  // Obtener todos los conductores de la base de datos
  const [conductores] = await db.query(`SELECT * FROM conductores ORDER BY capacidad_corriente ASC`);

  if (!conductores || conductores.length === 0) {
    return res.status(404).json({ error: 'No se encontraron conductores en la base de datos.' });
  }

  const L = longitud / 1000; // Convertir longitud a kilómetros
  const T = 40; // Temperatura de referencia en °C
  let conductorSugerido = null;

  for (const c of conductores) {
    const R1 = c.resistencia_ohm_km;
    const X = c.reactancia_inductiva || 0;
    const R = R1 * ((234.5 + T) / 254.5);

    const AV = 1.73 * inm * L * (R * cosenoPhi + X * senoPhi);
    const porcentajeAV = (AV / voltaje) * 100;

    // Log para depuración
    console.log(`Conductor ${c.calibre}: AV=${AV.toFixed(2)} V (${porcentajeAV.toFixed(2)}%)`);

    if (porcentajeAV <= porcentajeMaxAV) {
      conductorSugerido = c;
      currentResult.av = AV.toFixed(2);
      currentResult.caida_tension = porcentajeAV.toFixed(2);
      currentResult.cumple_caida = true;
      break;
    }
  }

  if (!conductorSugerido) {
    return res.status(404).json({
      error: 'No se encontró un conductor que cumpla con el porcentaje de caída permitido.',
      message: 'Por favor, revise los datos ingresados o intente con un porcentaje de caída mayor.'
    });
  }

  return res.json({
    ...currentResult,
    conductor_sugerido: conductorSugerido,
    caida_tension: currentResult.caida_tension,
    av: currentResult.av,
    cumple_caida: true
  });
};
