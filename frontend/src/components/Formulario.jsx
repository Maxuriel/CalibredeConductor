import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Formulario.css';

const Formulario = ({ onResultado }) => {
  const [calculationType, setCalculationType] = useState('corriente');
  const [currentResult, setCurrentResult] = useState(null);
  const [form, setForm] = useState({
    esMotor: false,
    tipoMotor: 'inducción',
    voltaje: '220',
    potencia: '',
    fp: '',
    fases: 'trifásico',
    numConductores: 1,
    longitud: '',
    porcentajeMaxAV: '',
    phi: '',
  });
  // Nuevos estados para historial y para controlar detalles expandidos
  const [historial, setHistorial] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});

  // Actualizar voltaje cuando cambian las fases
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      voltaje: prev.fases === 'trifásico' ? '220' : '127'
    }));
  }, [form.fases]);

  // useEffect para obtener historial al montar el componente
  useEffect(() => {
    async function fetchHistorial() {
      try {
        const res = await axios.get('http://localhost:3001/api/historial');
        setHistorial(res.data);
      } catch (error) {
        console.error('Error al obtener historial:', error);
      }
    }
    fetchHistorial();
  }, []);

  // Función para toggle de detalles en historial
  const toggleItem = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue;
    if (type === 'checkbox') {
      newValue = checked;
    } else if (type === 'number') {
      newValue = value === '' ? '' : Number(value);
    } else {
      newValue = value;
    }

    if (name === 'phi') {
      // Convertir phi de grados a radianes y calcular seno y coseno
      const phiRadians = (Number(value) * Math.PI) / 180;
      setForm(prev => ({
        ...prev,
        [name]: value,
        cosenoPhi: Math.cos(phiRadians),
        senoPhi: Math.sin(phiRadians)
      }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: newValue
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...form,
        potencia: form.esMotor ? form.potencia : form.potencia / 1.341, // Convert kW to HP for non-motors
        calculationType,
        currentResult: calculationType === 'caida' ? currentResult : null
      };

      // Log the data being sent for debugging
      console.log('Data to send:', dataToSend);

      // Validate required fields before sending
      if (!dataToSend.voltaje || !dataToSend.potencia || !dataToSend.fp || !dataToSend.fases || 
          (calculationType === 'caida' && (!dataToSend.longitud || !dataToSend.porcentajeMaxAV || !dataToSend.phi))) {
        throw new Error('Faltan datos obligatorios.');
      }

      const res = await axios.post('http://localhost:3001/api/calcular', dataToSend);

      if (calculationType === 'corriente') {
        setCurrentResult(res.data);
      }
      onResultado(res.data);
    } catch (error) {
      console.error('Error en la consulta:', error.response?.data || error.message);
      onResultado({ error: 'No se pudo calcular. Revisa los datos.' });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="calculation-type">
          <label>
            <input
              type="radio"
              name="calculationType"
              value="corriente"
              checked={calculationType === 'corriente'}
              onChange={(e) => setCalculationType(e.target.value)}
            />
            Cálculo de Corriente
          </label>
          <label>
            <input
              type="radio"
              name="calculationType"
              value="caida"
              checked={calculationType === 'caida'}
              onChange={(e) => setCalculationType(e.target.value)}
            />
            Cálculo de Caída de Tensión
          </label>
        </div>

        {calculationType === 'corriente' ? (
          // Formulario para cálculo de corriente
          <>
            <label>
              <input type="checkbox" name="esMotor" checked={form.esMotor} onChange={handleChange} />
              ¿Es motor?
            </label>
            
            <label>Tipo de Motor:
              <select name="tipoMotor" value={form.tipoMotor} onChange={handleChange}>
                <option value="inducción">Inducción</option>
                <option value="otro">Otro</option>
              </select>
            </label><br />

            <label>Fases:
              <select name="fases" value={form.fases} onChange={handleChange}>
                <option value="trifásico">Trifásico</option>
                <option value="monofásico">Monofásico</option>
              </select>
            </label><br />

            <label>Voltaje:
              <input 
                type="number" 
                name="voltaje" 
                value={form.voltaje} 
                onChange={handleChange}
                readOnly
              />
            </label><br />

            <label>
              Potencia ({form.esMotor ? 'HP' : 'kW'}):
              <input 
                type="number" 
                name="potencia" 
                value={form.potencia} 
                onChange={handleChange} 
                required 
              />
            </label><br />

            <label>Factor de Potencia: <input type="number" step="0.01" name="fp" value={form.fp} onChange={handleChange} required /></label><br />
            <label>
              ¿Cuántos conductores por fase?:
              <input
                type="number"
                name="numConductores"
                min="1"
                value={form.numConductores}
                onChange={handleChange}
                required
              />
            </label><br />
          </>
        ) : (
          // Formulario para cálculo de caída
          <>
            {!currentResult && (
              <div className="alert">
                Primero debe realizar el cálculo de corriente
              </div>
            )}
            
            <label>
              Longitud del tramo (metros):
              <input type="number" name="longitud" value={form.longitud} onChange={handleChange} required />
            </label>
            
            <label>
              % máximo permitido de caída:
              <input type="number" step="0.01" name="porcentajeMaxAV" value={form.porcentajeMaxAV} onChange={handleChange} required />
            </label>
            
            <label>
              Ángulo φ (grados):
              <input type="number" step="0.01" name="phi" value={form.phi} onChange={handleChange} required />
            </label>
          </>
        )}

        <button type="submit" disabled={calculationType === 'caida' && !currentResult}>
          Calcular
        </button>
        
        <button
          type="button"
          onClick={() => {
            setForm({
              esMotor: false,
              tipoMotor: 'inducción',
              voltaje: '220',
              potencia: '',
              fp: '',
              fases: 'trifásico',
              numConductores: 1,
              longitud: '',
              porcentajeMaxAV: '',
              phi: '',
            });
            onResultado(null);
          }}
          style={{ backgroundColor: '#6c757d', marginTop: '10px' }}
        >
          Limpiar
        </button>
      </form>
      
      {/* Nueva sección para visualizar el historial con detalles expandibles */}
      <div className="historial">
        <h2>Historial de Cálculos</h2>
        {historial.map(item => {
          const formattedDate = new Date(item.fecha).toLocaleString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          return (
            <div key={item.id} className={`historial-item ${expandedItems[item.id] ? 'expanded' : ''}`}>
              <div className="historial-summary">
                {/* Se muestra la fecha y hora formateada: dd/mm/aaaa hh:mm:ss */}
                <span>{formattedDate}</span>
                <button onClick={() => toggleItem(item.id)}>
                  {expandedItems[item.id] ? 'Ocultar Detalles' : 'Ver Detalles'}
                </button>
              </div>
              {expandedItems[item.id] && (
                <div className="historial-details">
                  <p>Fecha: {formattedDate}</p>
                  <p>Voltaje: {item.voltaje}</p>
                  <p>Potencia: {item.potencia}</p>
                  <p>Factor de Potencia: {item.fp}</p>
                  <p>Fases: {item.fases}</p>
                  <p>Es motor: {item.es_motor ? 'Sí' : 'No'}</p>
                  <p>Tipo de Motor: {item.tipo_motor}</p>
                  <p>Corriente Ajustada: {item.inm}</p>
                  <p>Factor de Agrupamiento: {item.fa}</p>
                  <p>Corriente Agrupada: {item.inc}</p>
                  {item.caida_tension && <p>Caída de Tensión: {item.caida_tension}</p>}
                  {item.av && <p>AV: {item.av}</p>}
                  {item.cumple_caida !== undefined && <p>Cumple Caída: {item.cumple_caida ? 'Sí' : 'No'}</p>}
                  {item.corrienteArranque && <p>Corriente de Arranque: {item.corrienteArranque}</p>}
                  <p>Calibre: {item.calibre}</p>
                  <p>Material: {item.material}</p>
                  <p>Aislamiento: {item.aislamiento}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  );
};

export default Formulario;
