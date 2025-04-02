import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Formulario from './components/Formulario';

function App() {
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]); // nuevo estado para historial

  useEffect(() => {
    axios.get('http://localhost:3001/api/historial')
      .then(res => setHistorial(res.data))
      .catch(err => console.error(err));
  }, [resultado]); // se actualiza al hacer un nuevo cálculo

  return (
    <div className="App">
      <header className="App-header">
        <h1>Selección de Calibre de Conductor</h1>
        <Formulario onResultado={setResultado} />
      </header>

      {resultado && (
        <div className="resultado">
          {resultado.error ? (
            <p style={{ color: 'red' }}>{resultado.error}</p>
          ) : (
            <>
              <h2>Resultado</h2>
              <p><strong>Corriente nominal:</strong> {resultado.corriente} A</p>
              <p><strong>Corriente ajustada (Inm/Ipc):</strong> {resultado.corriente_ajustada} A</p>
              <p><strong>Factor de agrupamiento:</strong> {resultado.factor_agrupamiento}</p>
              <p><strong>Corriente agrupada (Inc):</strong> {resultado.corriente_agrupada} A</p>
              <p><strong>Caída de tensión (AV):</strong> {resultado.av} V</p>
              <p><strong>Porcentaje de caída:</strong> {resultado.caida_tension} %</p>

              <h3>Conductor sugerido</h3>
              <ul>
                <li><strong>Calibre:</strong> {resultado.conductor_sugerido.calibre}</li>
                <li><strong>Capacidad:</strong> {resultado.conductor_sugerido.capacidad_corriente} A</li>
                <li><strong>Material:</strong> {resultado.conductor_sugerido.material}</li>
                <li><strong>Aislamiento:</strong> {resultado.conductor_sugerido.aislamiento}</li>
                <li><strong>Diámetro:</strong> {resultado.conductor_sugerido.diametro_mm2} mm²</li>
              </ul>
            </>
          )}
        </div>
      )}

      {historial.length > 0 && (  // Nuevo bloque para historial
        <div className="resultado">
          <h2>Últimos cálculos</h2>
          <ul>
            {historial.map(h => (
              <li key={h.id}>
                {h.fecha.slice(0, 19).replace('T', ' ')} - {h.voltaje}V / {h.potencia}HP → {h.calibre} ({h.material}, {h.aislamiento})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
