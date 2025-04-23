// Importamos las dependencias necesarias
import React, { useState, useEffect } from 'react'; // React y hooks para manejar estados y efectos
import axios from 'axios'; // Axios para realizar peticiones HTTP
import './Formulario.css'; // Estilos específicos para este componente

// Componente principal Formulario
const Formulario = ({ onResultado }) => {
  // Estado para el tipo de cálculo seleccionado (corriente o caída de tensión)
  const [calculationType, setCalculationType] = useState('corriente');
  // Estado para almacenar el resultado actual del cálculo
  const [currentResult, setCurrentResult] = useState(null);
  // Estado para los valores del formulario
  const [form, setForm] = useState({
    esMotor: false, // Indica si es un motor
    tipoMotor: 'inducción', // Tipo de motor (por defecto, inducción)
    voltaje: '220', // Voltaje inicial (220V para trifásico)
    potencia: '', // Potencia ingresada por el usuario
    fp: '', // Factor de potencia
    fases: 'trifásico', // Tipo de fases (trifásico o monofásico)
    numConductores: 1, // Número de conductores por fase
    longitud: '', // Longitud del tramo (para cálculo de caída)
    porcentajeMaxAV: '', // Porcentaje máximo permitido de caída de tensión
    phi: '', // Ángulo φ en grados
  });
  // Estado para almacenar el historial de cálculos
  const [historial, setHistorial] = useState([]);
  // Estado para controlar qué elementos del historial están expandidos
  const [expandedItems, setExpandedItems] = useState({});
  // Estado para manejar mensajes de error
  const [errorMessage, setErrorMessage] = useState(null);

  // useEffect para actualizar el voltaje automáticamente al cambiar las fases
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      voltaje: prev.fases === 'trifásico' ? '220' : '127' // 220V para trifásico, 127V para monofásico
    }));
  }, [form.fases]);

  // useEffect para obtener el historial de cálculos al montar el componente y cada segundo
  useEffect(() => {
    async function fetchHistorial() {
      try {
        const res = await axios.get('http://localhost:3001/api/historial'); // Petición GET al backend
        setHistorial(res.data); // Actualizamos el estado con los datos recibidos
      } catch (error) {
        console.error('Error al obtener historial:', error); // Log de error en caso de fallo
      }
    }
    fetchHistorial(); // Llamamos a la función al montar el componente
    const intervalId = setInterval(fetchHistorial, 1000); // Intervalo para actualizar el historial cada segundo
    return () => clearInterval(intervalId); // Limpiamos el intervalo al desmontar el componente
  }, []);

  // Función para alternar la expansión de los detalles de un elemento del historial
  const toggleItem = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] })); // Cambiamos el estado de expansión
  };

  // Función para manejar cambios en los campos del formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target; // Extraemos propiedades del evento
    let newValue;
    if (type === 'checkbox') {
      newValue = checked; // Para checkboxes, usamos el valor booleano
    } else if (type === 'number') {
      newValue = value === '' ? '' : Number(value); // Convertimos a número si es un campo numérico
    } else {
      newValue = value; // Para otros tipos, usamos el valor directamente
    }

    if (name === 'phi') {
      // Si el campo es phi, convertimos de grados a radianes y calculamos seno y coseno
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
    setErrorMessage(null); // Limpiamos el mensaje de error al realizar otra acción
  };

  // Función para manejar el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevenimos el comportamiento por defecto del formulario
    try {
      const dataToSend = {
        ...form,
        potencia: form.esMotor ? form.potencia : form.potencia / 1.341, // Convertimos kW a HP si no es motor
        calculationType,
        currentResult: calculationType === 'caida' ? currentResult : null
      };

      // Validamos que los campos obligatorios estén completos
      if (!dataToSend.voltaje || !dataToSend.potencia || !dataToSend.fp || !dataToSend.fases || 
          (calculationType === 'caida' && (!dataToSend.longitud || !dataToSend.porcentajeMaxAV || !dataToSend.phi))) {
        throw new Error('Faltan datos obligatorios.');
      }

      const res = await axios.post('http://localhost:3001/api/calcular', dataToSend); // Petición POST al backend

      setCurrentResult(res.data); // Actualizamos el resultado actual
      onResultado(res.data); // Pasamos el resultado al componente padre
      setErrorMessage(null); // Limpiamos el mensaje de error
    } catch (error) {
      console.error('Error en la consulta:', error.response?.data || error.message); // Log de error

      // Mostramos un mensaje de error específico si no se encuentra un conductor adecuado
      if (error.response?.data?.error) {
        setErrorMessage('No se encontró un conductor que cumpla con el porcentaje de caída permitido. Por favor, revise los datos ingresados o intente con un porcentaje de caída mayor.');
        setTimeout(() => setErrorMessage(null), 10000); // Ocultamos el mensaje después de 10 segundos
        onResultado({ error: error.response.data.error, message: error.response.data.message });
      } else {
        onResultado({ error: 'No se pudo calcular. Revisa los datos.' });
      }
    }
  };

  return (
    <>
      {/* Mostramos un mensaje de error si existe */}
      {errorMessage && (
        <div className="error-message">
          <p>{errorMessage}</p>
        </div>
      )}
      {/* Formulario principal */}
      <form onSubmit={handleSubmit}>
        {/* Selección del tipo de cálculo */}
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

        {/* Renderizamos el formulario según el tipo de cálculo */}
        {calculationType === 'corriente' ? (
          // Formulario para cálculo de corriente
          <>
            {/* Campos específicos para cálculo de corriente */}
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
          // Formulario para cálculo de caída de tensión
          <>
            {/* Campos específicos para cálculo de caída */}
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

        {/* Botón para enviar el formulario */}
        <button type="submit" disabled={calculationType === 'caida' && !currentResult}>
          Calcular
        </button>
        
        {/* Botón para limpiar el formulario */}
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

      {/* Mostramos el resultado del cálculo si existe */}
      {currentResult && (
        <div className="resultado">
          <h2>Resultado</h2>
          <p>Corriente nominal: {currentResult.corriente} A</p>
          <p>Corriente ajustada (Inm/Ipc): {currentResult.corriente_ajustada} A</p>
          <p>Factor de agrupamiento: {currentResult.factor_agrupamiento}</p>
          <p>Corriente agrupada (Inc): {currentResult.corriente_agrupada} A</p>
          {currentResult.corrienteArranque && (
            <p>Corriente de Arranque: {currentResult.corrienteArranque} A</p>
          )}
          {currentResult.av && (
            <p><strong>Caída de tensión (AV):</strong> {currentResult.av} V</p>
          )}
          {currentResult.caida_tension && (
            <p><strong>Porcentaje de caída:</strong> {currentResult.caida_tension} %</p>
          )}
          <h3>Conductor sugerido</h3>
          <p>Calibre: {currentResult.conductor_sugerido.calibre}</p>
          <p>Capacidad: {currentResult.conductor_sugerido.capacidad_corriente} A</p>
          <p>Material: {currentResult.conductor_sugerido.material}</p>
          <p>Aislamiento: {currentResult.conductor_sugerido.aislamiento}</p>
          <p>Diámetro: {currentResult.conductor_sugerido.diametro_mm2} mm²</p>
        </div>
      )}
      {currentResult && currentResult.error && (
        <div className="error">
          <p>{currentResult.error}</p>
        </div>
      )}
      
      {/* Mostramos el historial de cálculos */}
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
                  <p>Voltaje: {item.voltaje} V</p>
                  <p>Potencia: {item.potencia} {item.es_motor ? "HP" : "kW"}</p>
                  <p>Factor de Potencia: {item.fp}</p>
                  <p>Fases: {item.fases}</p>
                  <p>Es motor: {item.es_motor ? 'Sí' : 'No'}</p>
                  <p>Tipo de Motor: {item.tipo_motor}</p>
                  {item.corriente && <p>Corriente nominal: {item.corriente} A</p>}
                  {item.inm && <p>Corriente ajustada (Inm/Ipc): {item.inm} A</p>}
                  {item.fa && <p>Factor de agrupamiento: {item.fa}</p>}
                  {item.inc && <p>Corriente agrupada (Inc): {item.inc} A</p>}
                  {item.corrienteArranque && <p>Corriente de Arranque: {item.corrienteArranque} A</p>}
                  {item.av && <p><strong>Caída de tensión (AV):</strong> {item.av} V</p>}
                  {item.porcentaje_caida && <p><strong>Porcentaje de caída:</strong> {item.porcentaje_caida} %</p>}
                  <p>Calibre: {item.calibre} mm²</p>
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

// Exportamos el componente
export default Formulario;
