import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Formulario.css';

const Formulario = ({ onResultado }) => {
  // Estados principales
  const [calculationType, setCalculationType] = useState('corriente');
  const [currentResult, setCurrentResult] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [motores, setMotores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [materialesConductor, setMaterialesConductor] = useState([]);

  // Estado del formulario con valores iniciales
  const [form, setForm] = useState({
    esMotor: false,
    tipoMotor: '',
    voltaje: '220',
    potencia: '',
    fp: '0.9',
    fases: 'trifásico',
    numConductores: 1,
    distancia: '1000',
    porcentajeMaxCaida: '3',
    phi: '90',
    materialConductor: '',
    motorSeleccionado: ''
  });

  // Efectos secundarios
  useEffect(() => {
    // Configuración automática de voltaje según tipo de fase
    setForm(prev => ({
      ...prev,
      voltaje: prev.fases === 'trifásico' ? '220' : '127'
    }));
  }, [form.fases]);

  useEffect(() => {
    // Carga inicial de motores y materiales
    const fetchInitialData = async () => {
      try {
        if (form.esMotor) {
          const [motoresRes, materialesRes] = await Promise.all([
            axios.get('http://localhost:3001/api/motores'),
            axios.get('http://localhost:3001/api/materiales-conductor')
          ]);
          setMotores(motoresRes.data);
          setMaterialesConductor(materialesRes.data);
        }
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setErrorMessage('Error al cargar datos iniciales');
      }
    };
    
    fetchInitialData();
  }, [form.esMotor]);

  useEffect(() => {
    // Carga del historial con paginación
    const fetchHistorial = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/historial');
        setHistorial(res.data);
      } catch (error) {
        console.error('Error al obtener historial:', error);
      }
    };
    
    fetchHistorial();
    const intervalId = setInterval(fetchHistorial, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Manejadores de eventos
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? (value === '' ? '' : Number(value)) : 
              value
    }));
    
    setErrorMessage(null);
  };

  const handleMotorChange = (e) => {
    const motorId = e.target.value;
    const motorSeleccionado = motores.find(m => m.id === Number(motorId));
    
    if (motorSeleccionado) {
      setForm(prev => ({
        ...prev,
        motorSeleccionado: motorId,
        voltaje: motorSeleccionado.voltaje,
        potencia: motorSeleccionado.potencia_hp,
        fp: motorSeleccionado.factor_potencia,
        fases: motorSeleccionado.fases,
        tipoMotor: motorSeleccionado.tipo
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // Validación de campos obligatorios
      if (!form.voltaje || !form.potencia || !form.fases) {
        throw new Error('Faltan datos obligatorios: voltaje, potencia y tipo de fases');
      }

      if (calculationType === 'caida' && (!form.distancia || !form.porcentajeMaxCaida || !form.phi)) {
        throw new Error('Para cálculo de caída, complete: distancia, % máximo de caída y ángulo φ');
      }

      // Preparación de datos para enviar
      const payload = {
        ...form,
        calculationType,
        currentResult: calculationType === 'caida' ? currentResult : null
      };

      if (calculationType === 'caida') {
        // Eliminar materialConductor para que se devuelvan los mejores conductores
        delete payload.materialConductor;
        // Mapear el campo para que coincida con lo esperado en el backend
        payload.longitud = form.distancia;
        payload.porcentajeMaxAV = form.porcentajeMaxCaida;
        delete payload.distancia;
        delete payload.porcentajeMaxCaida;
      }

      // Llamada al backend
      const { data } = await axios.post('http://localhost:3001/api/calcular', payload);
      
      setCurrentResult(data);
      onResultado(data);
      
    } catch (error) {
      console.error('Error en el cálculo:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrorMessage(errorMsg);
      onResultado({ error: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      esMotor: false,
      tipoMotor: '',
      voltaje: '220',
      potencia: '',
      fp: '0.9',
      fases: 'trifásico',
      numConductores: 1,
      distancia: '100',
      porcentajeMaxCaida: '3',
      phi: '90',
      materialConductor: 'cobre',
      motorSeleccionado: ''
    });
    setCurrentResult(null);
    onResultado(null);
  };

  const toggleItemDetails = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Renderizado
  return (
    <div className="form-container">
      {errorMessage && (
        <div className="alert alert-danger">
          <p>{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="calculation-form">
        <div className="form-section">
          <h3>Tipo de Cálculo</h3>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="calculationType"
                value="corriente"
                checked={calculationType === 'corriente'}
                onChange={() => setCalculationType('corriente')}
              />
              Cálculo de Corriente
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="calculationType"
                value="caida"
                checked={calculationType === 'caida'}
                onChange={() => setCalculationType('caida')}
                disabled={!currentResult && calculationType !== 'caida'}
              />
              Cálculo de Caída de Tensión
            </label>
          </div>
        </div>

        {calculationType === 'corriente' ? (
          <div className="form-section">
            <h3>Datos del Circuito</h3>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="esMotor"
                  checked={form.esMotor}
                  onChange={handleChange}
                />
                ¿Es un motor?
              </label>
            </div>

            {form.esMotor ? (
              <div className="motor-selection">
                <div className="form-group">
                  <label>Seleccione un motor:</label>
                  <select
                    name="motorSeleccionado"
                    value={form.motorSeleccionado}
                    onChange={handleMotorChange}
                    required
                  >
                    <option value="">-- Seleccione un motor --</option>
                    {motores.map(motor => (
                      <option key={motor.id} value={motor.id}>
                        {motor.descripcion} ({motor.potencia_hp} HP, {motor.voltaje} V)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Tipo de Fases:</label>
                  <select
                    name="fases"
                    value={form.fases}
                    onChange={handleChange}
                    required
                  >
                    <option value="trifásico">Trifásico</option>
                    <option value="monofásico">Monofásico</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Voltaje (V):</label>
                  <input
                    type="number"
                    name="voltaje"
                    value={form.voltaje}
                    onChange={handleChange}
                    required
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Potencia ({form.esMotor ? 'HP' : 'kW'}):</label>
                  <input
                    type="number"
                    name="potencia"
                    value={form.potencia}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0.1"
                  />
                </div>

                <div className="form-group">
                  <label>Factor de Potencia:</label>
                  <input
                    type="number"
                    name="fp"
                    value={form.fp}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0.1"
                    max="1"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Número de Conductores por Fase:</label>
              <input
                type="number"
                name="numConductores"
                value={form.numConductores}
                onChange={handleChange}
                required
                min="1"
                max="6"
              />
            </div>
          </div>
        ) : (
          <div className="form-section">
            <h3>Cálculo de Caída de Tensión</h3>
            
            {!currentResult && (
              <div className="alert alert-warning">
                Primero debe realizar el cálculo de corriente
              </div>
            )}

            <div className="form-group">
              <label>Longitud del Tramo (metros):</label>
              <input
                type="number"
                name="distancia"
                value={form.distancia}
                onChange={handleChange}
                required
                min="1"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>% Máximo de Caída Permitida:</label>
              <input
                type="number"
                name="porcentajeMaxCaida"
                value={form.porcentajeMaxCaida}
                onChange={handleChange}
                required
                min="0.1"
                max="10"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>Ángulo φ (grados):</label>
              <input
                type="number"
                name="phi"
                value={form.phi}
                onChange={handleChange}
                required
                min="0"
                max="90"
                step="1"
              />
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn-calculate"
            disabled={loading || (calculationType === 'caida' && !currentResult)}
          >
            {loading ? 'Calculando...' : 'Calcular'}
          </button>

          <button
            type="button"
            className="btn-reset"
            onClick={resetForm}
          >
            Limpiar
          </button>
        </div>
      </form>

      {currentResult && (
        <div className="result-section">
          <h3>Resultados del Cálculo</h3>
          
          <div className="result-grid">
            <div className="result-item">
              <span className="result-label">Corriente Nominal:</span>
              <span className="result-value"> {currentResult.calculos.corrienteNominal} A</span>
            </div>
            
            <div className="result-item">
              <span className="result-label">Corriente Ajustada (Inm/Ipc):</span>
              <span className="result-value"> {currentResult.calculos.corrienteAjustada} A</span>
            </div>
            
            {/* Mostrar siempre los nuevos campos */}
            <div className="result-item">
              <span className="result-label">Factor de Agrupamiento:</span>
              <span className="result-value"> {currentResult.calculos.factorAgrupamiento}</span>
            </div>
            
            <div className="result-item">
              <span className="result-label">Corriente Agrupada (Inc):</span>
              <span className="result-value"> {currentResult.calculos.inc} A</span>
            </div>
            
            {currentResult.calculos.corrienteArranque && (
              <div className="result-item">
                <span className="result-label">Corriente de Arranque:</span>
                <span className="result-value"> {currentResult.calculos.corrienteArranque} A</span>
              </div>
            )}
            
            {currentResult.analisisCaida && currentResult.analisisCaida.mejorOpcion && (
              <div className="result-item">
                <span className="result-label">Caída de Tensión:</span>
                <span className="result-value">
                  {` ${currentResult.analisisCaida.mejorOpcion.AV} V (${currentResult.analisisCaida.mejorOpcion.porcentajeAV}%)`}
                </span>
              </div>
            )}
          </div>

          {(currentResult.conductoresSugeridos || currentResult.conductores) && (
            <div className="conductores-sugeridos">
              <h4>Conductor Sugerido</h4>
              
              <div className="conductores-grid">
                {(() => {
                  const conductor = (currentResult.conductoresSugeridos || currentResult.conductores)[0];
                  return (
                    <div className="conductor-card">
                      <h5> </h5>
                      <ul>
                        <li><strong>Calibre:</strong> {conductor.calibre}</li>
                        <li><strong>Material:</strong> {conductor.material}</li>
                        <li><strong>Capacidad:</strong> {conductor.capacidadCorriente} A</li> {/* Mostrar correctamente la capacidad */}
                        <li><strong>Aislamiento:</strong> {conductor.aislamiento}</li>
                        <li><strong>Sección:</strong> {conductor.diametro_mm2} mm²</li>
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="historial-section">
        <h3>Historial de Cálculos</h3>
        
        {historial.length === 0 ? (
          <p>No hay cálculos registrados</p>
        ) : (
          <div className="historial-list">
            {historial.map(item => (
              <div key={item.id} className={`historial-item ${expandedItems[item.id] ? 'expanded' : ''}`}>
                <div className="historial-header" onClick={() => toggleItemDetails(item.id)}>
                  <span className="historial-date">
                    {new Date(item.fecha).toLocaleString()}
                  </span>
                  <span className="historial-summary">
                    {item.es_motor ? 'Motor' : 'Circuito'} {item.potencia}{item.es_motor ? 'HP' : 'kW'} - {item.voltaje}V {item.fases}
                  </span>
                  <span className="historial-toggle">
                    {expandedItems[item.id] ? '▲' : '▼'}
                  </span>
                </div>
                
                {expandedItems[item.id] && (
                  <div className="historial-details">
                    <div className="detail-row">
                      <span>Corriente Nominal:</span>
                      <span>{item.corriente_nominal} A</span>
                    </div>
                    <div className="detail-row">
                      <span>Corriente Ajustada:</span>
                      <span>{item.corriente_ajustada} A</span>
                    </div>
                    {item.corriente_arranque && (
                      <div className="detail-row">
                        <span>Corriente de Arranque:</span>
                        <span>{item.corriente_arranque} A</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span>Conductor Seleccionado:</span>
                      <span>{item.calibre} {item.material} ({item.aislamiento})</span>
                    </div>
                    {item.av && (
                      <div className="detail-row">
                        <span>Caída de Tensión:</span>
                        <span>{item.av} V ({item.porcentaje_caida}%)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Formulario;