// Importamos la conexión a la base de datos
const db = require('../db/connection');

// Factores de ajuste según normas internacionales
const FACTORES_AJUSTE = {
  motor: 1.25,       // Factor de ajuste para motores (NEC 430.22)
  noMotor: 1.1,      // Factor general para cargas no motor
  temperatura: 0.88, // Factor de ajuste por temperatura (40°C)
  agrupamiento: {    // Factores de agrupamiento según NEC 310.15(B)(3)(a)
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
    const { calculationType, currentResult } = req.body; // Extraemos el tipo de cálculo y resultados previos
    console.log('Request body:', req.body);

    // Determinamos el tipo de cálculo a realizar
    if (calculationType === 'corriente') {
      return await calcularCorriente(req, res); // Cálculo de corriente
    } else if (calculationType === 'caida') {
      return await calcularCaida(req, res); // Cálculo de caída de tensión
    } else {
      return res.status(400).json({ error: 'Tipo de cálculo inválido.' }); // Error si el tipo no es válido
    }
  } catch (error) {
    console.error('Error en el cálculo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' }); // Manejo de errores generales
  }
};

// Función para calcular la corriente
const calcularCorriente = async (req, res) => {
  const { voltaje, potencia, fp, fases, esMotor, tipoMotor, numConductores, distancia, porcentajeCaidaMax } = req.body;

  console.log('Datos recibidos:', { 
    voltaje, potencia, fp, fases, 
    esMotor, tipoMotor, numConductores: numConductores || 1,
    distancia: distancia || 'No especificada'
  });

  // Validaciones básicas de los datos requeridos
  if (!voltaje || !potencia || !fases) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (voltaje, potencia, fases).' });
  }

  // Estructura inicial del resultado
  let resultado = {
    parametros: { voltaje, potencia, fp, fases, esMotor, tipoMotor },
    calculos: {}
  };

  // Guardar el número de conductores en los parámetros
  resultado.parametros.numConductores = numConductores || 1;

  try {
    // 1. Cálculo de corriente nominal según el tipo de carga
    if (esMotor) {
      await calcularCorrienteMotor(req, res, resultado); // Cálculo para motores
    } else {
      await calcularCorrienteNoMotor(req, res, resultado); // Cálculo para cargas no motor
    }

    // 2. Aplicar factores de ajuste (temperatura, agrupamiento, etc.)
    aplicarFactoresAjuste(resultado, numConductores);

    // 3. Selección de conductores considerando criterios como corriente y caída de tensión
    await seleccionarConductores(resultado, distancia, porcentajeCaidaMax, numConductores);

    // 4. Guardar la consulta en el historial de la base de datos
    await guardarConsulta(resultado);

    // 5. Enviar la respuesta estructurada al cliente
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

  // Consultamos en la base de datos los datos del motor según tipo, voltaje y potencia
  const [motores] = await db.query(
    `SELECT ipc, corriente_arranque, factor_potencia 
     FROM motores 
     WHERE tipo = ? AND voltaje = ? AND potencia_hp = ? LIMIT 1`,
    [tipoMotor, voltaje, potencia]
  );

  if (motores.length === 0) {
    throw new Error('Motor no encontrado en la base de datos.'); // Error si no se encuentra el motor
  }

  const motor = motores[0];
  resultado.calculos = {
    corrienteNominal: motor.ipc, // Corriente nominal del motor
    corrienteAjustada: motor.ipc * FACTORES_AJUSTE.motor, // Corriente ajustada con factor de motor
    corrienteArranque: motor.corriente_arranque, // Corriente de arranque
    factorPotencia: motor.factor_potencia // Factor de potencia del motor
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

// Cálculo de caída de tensión mejorado y corregido
const calcularCaida = async (req, res) => {
  const { 
    voltaje, 
    longitud, 
    porcentajeMaxAV, 
    phi, 
    currentResult,
    numConductores = 1 
  } = req.body;

  // Validaciones básicas
  if (!currentResult) {
    return res.status(400).json({ error: 'Se requiere el cálculo de corriente previo.' });
  }

  if (!voltaje || !longitud || !porcentajeMaxAV) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (voltaje, longitud, porcentajeMaxAV).' });
  }

  // Convertir ángulo a radianes
  const phiRadians = (phi * Math.PI) / 180;
  const cosenoPhi = Math.cos(phiRadians);
  const senoPhi = Math.sin(phiRadians);

  // Obtener valores del cálculo previo
  const corrienteTotal = parseFloat(currentResult.calculos.inc); // inc = corriente corregida total
  const corrientePorConductor = corrienteTotal / numConductores;
  const L = longitud / 1000; // Convertir a km
  const T = 40; // Temperatura de referencia

  // Obtener todos los conductores ordenados por capacidad
  const [conductores] = await db.query(`
    SELECT id, calibre, material, capacidad_corriente, aislamiento, 
           diametro_mm2, resistencia_ohm_km, reactancia_inductiva 
    FROM conductores 
    WHERE capacidad_corriente >= ?
    ORDER BY capacidad_corriente ASC
  `, [corrientePorConductor]);

  if (!conductores || conductores.length === 0) {
    return res.status(404).json({ 
      error: 'No se encontraron conductores adecuados para la corriente requerida.' 
    });
  }

  // Analizar cada conductor
  let mejorOpcion = null;
  const opcionesValidas = [];

  for (const conductor of conductores) {
    // Ajustar resistencia por temperatura
    const R = conductor.resistencia_ohm_km * ((234.5 + T) / 254.5);
    const X = conductor.reactancia_inductiva || 0;

    // Calcular caída de tensión según sistema
    const AV = currentResult.parametros.fases === 'trifásico'
      ? 1.73 * corrientePorConductor * L * (R * cosenoPhi + X * senoPhi) // Trifásico
      : 2 * corrientePorConductor * L * (R * cosenoPhi + X * senoPhi);   // Monofásico

    const porcentajeAV = (AV / voltaje) * 100;

    // Si cumple con el porcentaje máximo
    if (porcentajeAV <= porcentajeMaxAV) {
      const opcion = {
        conductor: {
          id: conductor.id,
          calibre: conductor.calibre,
          material: conductor.material,
          capacidadCorriente: Number(conductor.capacidad_corriente),
          aislamiento: conductor.aislamiento,
          diametro_mm2: conductor.diametro_mm2,
          resistencia: R,
          reactancia: X
        },
        AV: AV.toFixed(2),
        porcentajeAV: porcentajeAV.toFixed(2)
      };

      opcionesValidas.push(opcion);

      // Seleccionar el primer conductor que cumple (el más pequeño)
      if (!mejorOpcion) {
        mejorOpcion = opcion;
      }
    }
  }

  // Si no hay conductores que cumplan
  if (!mejorOpcion) {
    return res.status(404).json({
      error: 'Ningún conductor cumple con el porcentaje de caída permitido.',
      sugerencia: 'Considere: 1) Aumentar el % de caída permitida, 2) Usar más conductores en paralelo, 3) Revisar los parámetros de cálculo',
      corrienteRequerida: corrientePorConductor,
      conductoresEvaluados: conductores.length
    });
  }

  // Preparar respuesta final
  const response = {
    ...currentResult,
    analisisCaida: {
      mejorOpcion,
      opcionesValidas, // Todas las opciones que cumplen
      parametros: {
        longitud,
        porcentajeMaxAV,
        corrientePorConductor,
        numConductores
      }
    },
    conductoresSugeridos: [mejorOpcion.conductor] // Compatibilidad con versión anterior
  };

  // Guardar en historial
  await guardarConsulta(response);

  return res.json(response);
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