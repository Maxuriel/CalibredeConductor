import React, { useState } from 'react';
import axios from 'axios';

const Formulario = ({ onResultado }) => {
  const [form, setForm] = useState({
    voltaje: '',
    potencia: '',
    fp: '',
    fases: 'trifásico',
    esMotor: false,
    tipoMotor: 'inducción',
    numConductores: 1,
    longitud: '',
    porcentajeMaxAV: '',
    cosenoPhi: '',
    senoPhi: ''
  });

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
    setForm({
      ...form,
      [name]: newValue
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/api/calcular', form);
      onResultado(res.data);
    } catch (error) {
      console.error('Error en la consulta:', error);
      onResultado({ error: 'No se pudo calcular. Revisa los datos.' });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Voltaje: <input type="number" name="voltaje" value={form.voltaje} onChange={handleChange} required /></label><br />
      <label>Potencia (HP): <input type="number" name="potencia" value={form.potencia} onChange={handleChange} required /></label><br />
      <label>Factor de Potencia: <input type="number" step="0.01" name="fp" value={form.fp} onChange={handleChange} required /></label><br />
      <label>Fases:
        <select name="fases" value={form.fases} onChange={handleChange}>
          <option value="monofásico">Monofásico</option>
          <option value="trifásico">Trifásico</option>
        </select>
      </label><br />
      <label>
        <input type="checkbox" name="esMotor" checked={form.esMotor} onChange={handleChange} />
        ¿Es motor?
      </label><br />
      {form.esMotor && (
        <label>Tipo de Motor:
          <select name="tipoMotor" value={form.tipoMotor} onChange={handleChange}>
            <option value="inducción">Inducción</option>
            <option value="otro">Otro</option>
          </select>
        </label>
      )}<br />
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
      <input type="number" name="longitud" value={form.longitud || ''} onChange={handleChange} placeholder="Longitud del tramo (L) en metros" required /><br />
      <input type="number" step="0.01" name="porcentajeMaxAV" value={form.porcentajeMaxAV || ''} onChange={handleChange} placeholder="% máximo permitido de caída de tensión" required /><br />
      <input type="number" step="0.01" name="cosenoPhi" value={form.cosenoPhi || ''} onChange={handleChange} placeholder="Cos φ" required /><br />
      <input type="number" step="0.01" name="senoPhi" value={form.senoPhi || ''} onChange={handleChange} placeholder="Sen φ" required /><br />
      <button type="submit">Calcular</button>
      <button
        type="button"
        onClick={() => {
          setForm({
            voltaje: '',
            potencia: '',
            fp: '',
            fases: 'trifásico',
            esMotor: false,
            tipoMotor: 'inducción',
            numConductores: 1,
            longitud: '',
            porcentajeMaxAV: '',
            cosenoPhi: '',
            senoPhi: ''
          });
          onResultado(null);
        }}
        style={{ backgroundColor: '#6c757d', marginTop: '10px' }}
      >
        Limpiar
      </button>
    </form>
  );
};

export default Formulario;
