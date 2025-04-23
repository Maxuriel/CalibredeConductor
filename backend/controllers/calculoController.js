// Importamos la conexión a la base de datos
const db = require('../db/connection');

// Controlador principal para calcular el conductor adecuado
exports.calcularConductor = async (req, res) => {
  try {
    // Extraemos el tipo de cálculo y el resultado actual del cuerpo de la solicitud
    const { calculationType, currentResult } = req.body;

    // Registramos los datos de la solicitud para depuración
    console.log('Request body:', req.body);

    // Verificamos el tipo de cálculo solicitado
    if (calculationType === 'corriente') {
      // Si es cálculo de corriente, llamamos a la función correspondiente
      return await calcularCorriente(req, res);
    } else if (calculationType === 'caida') {
      // Si es cálculo de caída de tensión, llamamos a la función correspondiente
      return await calcularCaida(req, res);
    } else {
      // Si el tipo de cálculo no es válido, devolvemos un error
      return res.status(400).json({ error: 'Tipo de cálculo inválido.' });
    }
  } catch (error) {
    // Capturamos errores inesperados y devolvemos un error interno del servidor
    console.error('Error en el cálculo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// Función para calcular la corriente
const calcularCorriente = async (req, res) => {
  // Extraemos los datos necesarios del cuerpo de la solicitud
  const { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores } = req.body;

  // Registramos los datos recibidos para depuración
  console.log('Datos recibidos para cálculo de corriente:', { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores });

  // Validamos que los datos obligatorios estén presentes
  if (!voltaje || !potencia || !fp || !fases) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  // Inicializamos variables para la corriente y sus ajustes
  let corriente = 0;
  let inm = 0; // Corriente ajustada
  let corrienteArranque = 0; // Corriente de arranque para motores

  // Si es un motor de inducción, buscamos datos en la base de datos
  if (esMotor && tipoMotor === 'inducción') {
    const [motores] = await db.query(
      `SELECT ipc, corriente_arranque FROM motores WHERE tipo = 'inducción' AND voltaje = ? AND potencia_hp = ? LIMIT 1`,
      [voltaje, potencia]
    );

    // Si no encontramos el motor, devolvemos un error
    if (motores.length === 0) {
      return res.status(404).json({ error: 'Motor no encontrado en la base de datos.' });
    }

    // Calculamos la corriente ajustada para motores
    corriente = motores[0].ipc; // Corriente nominal
    inm = 1.25 * corriente; // Corriente ajustada (factor de seguridad)
    corrienteArranque = motores[0].corriente_arranque; // Corriente de arranque
  } else {
    // Si no es un motor, calculamos la corriente usando fórmulas estándar
    corriente = fases === 'monofásico'
      ? potencia / (voltaje * fp) // Fórmula para sistemas monofásicos
      : potencia / (Math.sqrt(3) * voltaje * fp); // Fórmula para sistemas trifásicos

    // Ajustamos la corriente con un factor del 10%
    inm = 1.1 * corriente;
  }

  // Aplicamos el factor de agrupamiento si hay más de un conductor por fase
  let fa = 1.0; // Factor de agrupamiento inicial
  let inc = inm; // Corriente agrupada inicial

  if (numConductores && numConductores > 1) {
    const [factores] = await db.query(
      `SELECT factor FROM factores_agrupamiento WHERE cantidad_conductores = ? LIMIT 1`,
      [numConductores]
    );

    // Si no encontramos el factor de agrupamiento, devolvemos un error
    if (factores.length === 0) {
      return res.status(404).json({ error: 'No se encontró el factor de agrupamiento.' });
    }

    // Ajustamos la corriente agrupada
    fa = factores[0].factor;
    inc = inm * fa;
  }

  // Obtenemos los conductores que soporten al menos la corriente agrupada
  const [conductores] = await db.query(
    `SELECT * FROM conductores WHERE capacidad_corriente >= ? ORDER BY capacidad_corriente ASC`,
    [Math.max(inc, corrienteArranque / 6)] // Consideramos también la corriente de arranque
  );

  // Si no encontramos conductores adecuados, devolvemos un error
  if (!conductores || conductores.length === 0) {
    return res.status(404).json({ error: 'No se encontró un conductor adecuado para la corriente agrupada.' });
  }

  // Seleccionamos el primer conductor que cumpla con los requisitos
  const T = 40; // Temperatura de referencia en °C
  let conductorSugerido = null;

  for (const c of conductores) {
    const R1 = c.resistencia_ohm_km; // Resistencia base
    const X = c.reactancia_inductiva || 0; // Reactancia inductiva
    const R = R1 * ((234.5 + T) / 254.5); // Ajuste de resistencia por temperatura

    conductorSugerido = c; // Seleccionamos el conductor
    break; // Salimos del bucle
  }

  // Guardamos la consulta en la base de datos
  await db.query(`
    INSERT INTO consultas (
      voltaje, potencia, fp, fases, es_motor, tipo_motor, inm, fa, inc, conductor_id, corriente_arranque
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [voltaje, potencia, fp, fases, esMotor, tipoMotor, inm, fa, inc, conductorSugerido.id, esMotor ? corrienteArranque : null]
  );

  // Enviamos los resultados al frontend
  return res.json({
    corriente: corriente.toFixed(2),
    corriente_ajustada: inm.toFixed(2),
    factor_agrupamiento: fa,
    corriente_agrupada: inc.toFixed(2),
    conductor_sugerido: conductorSugerido,
    corrienteArranque: esMotor ? corrienteArranque : null
  });
};

// Función para calcular la caída de tensión
const calcularCaida = async (req, res) => {
  // Extraemos los datos necesarios del cuerpo de la solicitud
  const { voltaje, longitud, porcentajeMaxAV, phi, currentResult } = req.body;

  // Validamos que el cálculo de corriente previo esté presente
  if (!currentResult) {
    return res.status(400).json({ error: 'Se requiere el cálculo de corriente previo.' });
  }

  // Convertimos el ángulo phi a radianes
  const phiRadians = (phi * Math.PI) / 180;
  const cosenoPhi = Math.cos(phiRadians);
  const senoPhi = Math.sin(phiRadians);
  const inm = parseFloat(currentResult.corriente_ajustada); // Corriente ajustada

  // Obtenemos todos los conductores de la base de datos
  const [conductores] = await db.query(`SELECT * FROM conductores ORDER BY capacidad_corriente ASC`);

  // Si no encontramos conductores, devolvemos un error
  if (!conductores || conductores.length === 0) {
    return res.status(404).json({ error: 'No se encontraron conductores en la base de datos.' });
  }

  // Convertimos la longitud a kilómetros
  const L = longitud / 1000;
  const T = 40; // Temperatura de referencia en °C
  let conductorSugerido = null;

  // Iteramos sobre los conductores para calcular la caída de tensión
  for (const c of conductores) {
    const R1 = c.resistencia_ohm_km; // Resistencia base
    const X = c.reactancia_inductiva || 0; // Reactancia inductiva
    const R = R1 * ((234.5 + T) / 254.5); // Ajuste de resistencia por temperatura

    // Calculamos la caída de tensión
    const AV = 1.73 * inm * L * (R * cosenoPhi + X * senoPhi);
    const porcentajeAV = (AV / voltaje) * 100;

    // Registramos los datos para depuración
    console.log(`Conductor ${c.calibre}: AV=${AV.toFixed(2)} V (${porcentajeAV.toFixed(2)}%)`);

    // Si cumple con el porcentaje máximo permitido, seleccionamos el conductor
    if (porcentajeAV <= porcentajeMaxAV) {
      conductorSugerido = c;
      currentResult.av = AV.toFixed(2);
      currentResult.caida_tension = porcentajeAV.toFixed(2);
      currentResult.cumple_caida = true;
      break;
    }
  }

  // Si no encontramos un conductor adecuado, devolvemos un error
  if (!conductorSugerido) {
    return res.status(404).json({
      error: 'No se encontró un conductor que cumpla con el porcentaje de caída permitido.',
      message: 'Por favor, revise los datos ingresados o intente con un porcentaje de caída mayor.'
    });
  }

  // Enviamos los resultados al frontend
  return res.json({
    ...currentResult,
    conductor_sugerido: conductorSugerido,
    caida_tension: currentResult.caida_tension,
    av: currentResult.av,
    cumple_caida: true
  });
};
