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
