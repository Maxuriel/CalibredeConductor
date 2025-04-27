// Importamos la conexión a la base de datos
const db = require('../db/connection');

// Factores de ajuste según normas internacionales
const FACTORES_AJUSTE = {
  motor: 1.25,       // NEC 430.22 para motores
  noMotor: 1.1,      // Factor general para cargas no motor
  temperatura: 0.88, // Factor para 40°C (ajustable según ambiente)
  agrupamiento: {    // Factores típicos de agrupamiento NEC 310.15(B)(3)(a)
    1: 1.0,
    2: 0.8,
    3: 0.7,
    4: 0.65,
    5: 0.6,
    6: 0.57
  }
};

// Controlador principal para calcular el conductor adecuado
exports.calcularConductor = async (req, res) => {
  try {
    const { calculationType, currentResult } = req.body;
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

// Función mejorada para calcular la corriente
const calcularCorriente = async (req, res) => {
  const { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores, distancia, porcentajeCaidaMax } = req.body;

  console.log('Datos recibidos:', { 
    voltaje, potencia, fp, fases, 
    esMotor, tipoMotor, numConductores: numConductores || 1,
    distancia: distancia || 'No especificada'
  });

  // Validaciones básicas
  if (!voltaje || !potencia || !fases) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (voltaje, potencia, fases).' });
  }

  // Cálculos iniciales
  let resultado = {
    parametros: { voltaje, potencia, fp, fases, esMotor, tipoMotor },
    calculos: {}
  };

  // Guardar el número de conductores en los parámetros
  resultado.parametros.numConductores = numConductores || 1;

  try {
    // 1. Cálculo de corriente nominal
    if (esMotor) {
      await calcularCorrienteMotor(req, res, resultado);
    } else {
      await calcularCorrienteNoMotor(req, res, resultado);
    }

    // 2. Aplicar factores de ajuste
    aplicarFactoresAjuste(resultado, numConductores);

    // 3. Selección de conductores considerando múltiples criterios
    await seleccionarConductores(resultado, distancia, porcentajeCaidaMax, numConductores);

    // 4. Guardar consulta en historial
    await guardarConsulta(resultado);

    // 5. Enviar respuesta estructurada
    return res.json(estructurarRespuesta(resultado));

  } catch (error) {
    console.error('Error en cálculo detallado:', error);
    return res.status(500).json({ 
      error: 'Error en el cálculo', 
      detalles: error.message 
    });
  }
};

// Cálculo específico para motores
async function calcularCorrienteMotor(req, res, resultado) {
  const { tipoMotor, voltaje, potencia } = req.body;

  const [motores] = await db.query(
    `SELECT ipc, corriente_arranque, factor_potencia 
     FROM motores 
     WHERE tipo = ? AND voltaje = ? AND potencia_hp = ? LIMIT 1`,
    [tipoMotor, voltaje, potencia]
  );

  if (motores.length === 0) {
    throw new Error('Motor no encontrado en la base de datos.');
  }

  const motor = motores[0];
  resultado.calculos = {
    corrienteNominal: motor.ipc,
    corrienteAjustada: motor.ipc * FACTORES_AJUSTE.motor,
    corrienteArranque: motor.corriente_arranque,
    factorPotencia: motor.factor_potencia
  };
}

// Cálculo para cargas no motor
async function calcularCorrienteNoMotor(req, res, resultado) {
  const { voltaje, potencia, fp = 0.9, fases } = req.body;
  // Convertir potencia de kW a W, ya que la potencia ingresada es en kW
  const power = Number(potencia);
  const corriente = fases === 'monofásico'
    ? (power * 1000) / (voltaje * fp)
    : (power * 1000) / (Math.sqrt(3) * voltaje * fp);

  resultado.calculos = {
    corrienteNominal: corriente,
    corrienteAjustada: corriente * FACTORES_AJUSTE.noMotor,
    factorPotencia: fp
  };
}

// Aplicar factores de ajuste
function aplicarFactoresAjuste(resultado, numConductores = 1) {
  const factores = {
    agrupamiento: FACTORES_AJUSTE.agrupamiento[numConductores] || 1,
    temperatura: FACTORES_AJUSTE.temperatura
  };

  resultado.calculos.factorAgrupamiento = factores.agrupamiento;
  resultado.calculos.factorTemperatura = factores.temperatura;
  
  resultado.calculos.corrienteCorregida = 
    resultado.calculos.corrienteAjustada * 
    factores.agrupamiento * 
    factores.temperatura;
}

// Selección optimizada de conductores
async function seleccionarConductores(resultado, distancia, porcentajeCaidaMax, numConductores) {
  const { corrienteCorregida, corrienteArranque } = resultado.calculos;
  const esMotor = resultado.parametros.esMotor;
  
  // Se calcula la corriente total requerida y se divide entre los conductores en paralelo
  const corrienteMinimaTotal = esMotor 
    ? Math.max(corrienteCorregida, corrienteArranque * 0.3) // Considera que el arranque es momentáneo
    : corrienteCorregida;
  const corrienteMinima = corrienteMinimaTotal / numConductores;
  
  // Consulta optimizada para conductores utilizando la corriente mínima por conductor
  const [conductores] = await db.query(
    `SELECT id, calibre, material, capacidad_corriente, aislamiento, diametro_mm2, resistencia_ohm_km, reactancia_inductiva 
     FROM conductores 
     WHERE capacidad_corriente >= ? 
     ORDER BY capacidad_corriente ASC, 
     CASE material WHEN 'cobre' THEN 1 ELSE 2 END`,
    [corrienteMinima]
  );

  if (conductores.length === 0) {
    throw new Error('No se encontraron conductores adecuados para la corriente requerida.');
  }

  // Si hay distancia, pre-filtrar por caída de tensión usando corriente por conductor
  if (distancia && porcentajeCaidaMax) {
    resultado.calculos.distancia = distancia;
    resultado.calculos.porcentajeCaidaMax = porcentajeCaidaMax;
    
    const conductoresFiltrados = await filtrarPorCaidaTension(
      conductores, 
      resultado, 
      distancia, 
      porcentajeCaidaMax,
      numConductores
    );
    
    resultado.conductores = conductoresFiltrados.length > 0 
      ? conductoresFiltrados 
      : conductores.slice(0, 3); // Si ninguno cumple, mostrar los 3 primeros
  } else {
    // Mostrar los 3 conductores más pequeños que cumplen
    resultado.conductores = conductores.slice(0, 3);
  }
}

// Cálculo de caída de tensión mejorado
const calcularCaida = async (req, res) => {
  const { voltaje, longitud, porcentajeMaxAV, phi, currentResult } = req.body;

  if (!currentResult) {
    return res.status(400).json({ error: 'Se requiere el cálculo de corriente previo.' });
  }

  const phiRadians = (phi * Math.PI) / 180;
  const cosenoPhi = Math.cos(phiRadians);
  const senoPhi = Math.sin(phiRadians);
  const inm = parseFloat(currentResult.calculos.corrienteAjustada);

  const [conductores] = await db.query(`
    SELECT id, calibre, material, capacidad_corriente, aislamiento, diametro_mm2, resistencia_ohm_km, reactancia_inductiva 
    FROM conductores 
    ORDER BY capacidad_corriente ASC
  `);

  if (!conductores || conductores.length === 0) {
    return res.status(404).json({ error: 'No se encontraron conductores en la base de datos.' });
  }

  const L = longitud / 1000; // Convertir longitud a kilómetros
  const T = 40; // Temperatura de referencia en °C
  let conductorSugerido = null;

  for (const c of conductores) {
    const R1 = c.resistencia_ohm_km;
    const X = c.reactancia_inductiva || 0;
    const R = R1 * ((234.5 + T) / 254.5); // Ajuste de resistencia por temperatura

    const AV = voltaje > 127
      ? 1.73 * inm * L * (R * cosenoPhi + X * senoPhi) // Trifásico
      : 2 * inm * L * (R * cosenoPhi + X * senoPhi);  // Monofásico

    const porcentajeAV = (AV / voltaje) * 100;

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

  currentResult.calculos.av = currentResult.av;
  currentResult.calculos.caida_tension = currentResult.caida_tension;
  currentResult.conductoresSugeridos = [conductorSugerido];
  currentResult.analisisCaida = {
    mejorOpcion: {
      AV: currentResult.av,
      porcentajeAV: currentResult.caida_tension,
      conductor: {
        id: conductorSugerido.id,
        calibre: conductorSugerido.calibre,
        material: conductorSugerido.material,
        capacidadCorriente: Number(conductorSugerido.capacidad_corriente),
        aislamiento: conductorSugerido.aislamiento,
        diametro_mm2: conductorSugerido.diametro_mm2
      }
    }
  };

  return res.json(currentResult);
};

// Función para filtrar conductores por caída de tensión
async function filtrarPorCaidaTension(conductores, resultado, distancia, porcentajeMax, numConductores) {
  const { voltaje, fases } = resultado.parametros;
  // Se utiliza la corriente por conductor en lugar de la corriente total
  const corrientePorConductor = resultado.calculos.corrienteCorregida / numConductores;
  const phiRadians = Math.acos(resultado.calculos.factorPotencia);
  const cosenoPhi = Math.cos(phiRadians);
  const senoPhi = Math.sin(phiRadians);
  const L = distancia / 1000;
  
  return conductores.filter(c => {
    const R = c.resistencia_ohm_km * ((234.5 + 40) / 254.5); // Ajuste por temperatura
    const X = c.reactancia_inductiva || 0;
    
    const AV = fases === 'trifásico'
      ? 1.73 * corrientePorConductor * L * (R * cosenoPhi + X * senoPhi)
      : 2 * corrientePorConductor * L * (R * cosenoPhi + X * senoPhi);
    
    const porcentajeAV = (AV / voltaje) * 100;
    return porcentajeAV <= porcentajeMax;
  });
}

// Guardar consulta en historial
async function guardarConsulta(resultado) {
  const { parametros, calculos, conductores } = resultado;
  const conductorId = conductores.length > 0 ? conductores[0].id : null;
  
  await db.query(`
    INSERT INTO consultas (
      voltaje, potencia, fp, fases, es_motor, tipo_motor, 
      corriente_nominal, corriente_ajustada, factor_agrupamiento,
      corriente_corregida, conductor_id, corriente_arranque,
      distancia, porcentaje_caida
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    parametros.voltaje, parametros.potencia, parametros.fp, parametros.fases,
    parametros.esMotor, parametros.tipoMotor, calculos.corrienteNominal,
    calculos.corrienteAjustada, calculos.factorAgrupamiento,
    calculos.corrienteCorregida, conductorId, calculos.corrienteArranque,
    calculos.distancia, calculos.porcentajeCaidaMax
  ]);
}

// Estructurar respuesta consistente
function estructurarRespuesta(resultado) {
  return {
    parametros: resultado.parametros,
    calculos: {
      corrienteNominal: resultado.calculos.corrienteNominal.toFixed(2),
      corrienteAjustada: resultado.calculos.corrienteAjustada.toFixed(2),
      factorAgrupamiento: resultado.calculos.factorAgrupamiento,
      factorTemperatura: resultado.calculos.factorTemperatura,
      // Se calcula la corriente agrupada como corriente corregida × número de conductores
      inc: (resultado.calculos.corrienteCorregida * resultado.parametros.numConductores).toFixed(2),
      ...(resultado.calculos.corrienteArranque && {
        corrienteArranque: resultado.calculos.corrienteArranque.toFixed(2)
      })
    },
    conductores: resultado.conductores.map(c => ({
      id: c.id,
      calibre: c.calibre,
      material: c.material,
      capacidadCorriente: parseFloat(c.capacidad_corriente).toFixed(2), // Convertir a número con 2 decimales
      aislamiento: c.aislamiento,
      diametro: c.diametro_mm2,
      resistencia: c.resistencia_ohm_km,
      reactancia: c.reactancia_inductiva
    })),
    ...(resultado.calculos.distancia && {
      analisisDistancia: {
        distancia: resultado.calculos.distancia,
        porcentajeMaxCaida: resultado.calculos.porcentajeCaidaMax
      }
    }),
    metadata: {
      fechaCalculo: new Date().toISOString(),
      version: '1.1.0'
    }
  };
}

// Controlador para obtener motores (mejorado con paginación)
exports.obtenerMotores = async (req, res) => {
  try {
    const { pagina = 1, porPagina = 20, filtro } = req.query;
    const offset = (pagina - 1) * porPagina;
    
    let query = `SELECT id, tipo, descripcion, potencia_hp, voltaje, factor_potencia, fases 
                 FROM motores`;
    let params = [];
    
    if (filtro) {
      query += ` WHERE tipo LIKE ? OR descripcion LIKE ?`;
      params = [`%${filtro}%`, `%${filtro}%`];
    }
    
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(porPagina), parseInt(offset));
    
    // Consulta principal
    const [motores] = await db.query(query, params);
    
    // Consulta para total
    const [total] = await db.query(`SELECT COUNT(*) as total FROM motores`);
    
    res.json({
      motores,
      paginacion: {
        pagina: parseInt(pagina),
        porPagina: parseInt(porPagina),
        total: total[0].total
      }
    });
    
  } catch (error) {
    console.error('Error al obtener motores:', error);
    res.status(500).json({ error: 'Error al consultar los motores.' });
  }
};