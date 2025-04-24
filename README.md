
---

# ⚡ Calculadora de Calibre de Conductor y Caída de Tensión

Interfaz intuitiva y profesional para el cálculo de calibres de conductores eléctricos y análisis de caída de tensión en instalaciones industriales y comerciales.

---

## 📝 Descripción

Herramienta profesional diseñada para ingenieros eléctricos y técnicos especializados. Permite calcular de manera precisa el calibre de conductores eléctricos y analizar la caída de tensión conforme a normas técnicas, optimizando la seguridad y eficiencia de las instalaciones.

---

## ✨ Características

- Cálculos precisos para motores y cargas generales.
- Base de datos integrada con más de 50 tipos de conductores y 10 motores estándar.
- Doble modo de cálculo:
  - Selección por corriente nominal.
  - Verificación por caída de tensión.
- Historial inteligente con detalles expandibles.
- Validación en tiempo real de parámetros eléctricos.

---

## 🛠️ Tecnologías

| Área        | Tecnologías                        |
|-------------|------------------------------------|
| Frontend    | React.js, Axios, CSS3              |
| Backend     | Node.js, Express.js                |
| Base de datos | MySQL                            |
| Herramientas| Dotenv, MySQL2                     |

---

## 💻 Instalación

Clona el repositorio:

```bash
git clone https://github.com/Maxuriel/CalibredeConductor.git
cd CalibredeConductor
```

Configura el entorno:

```bash
cp .env.example .env
# Edita el archivo .env con tus credenciales de MySQL
```

Instala las dependencias:

```bash
npm install
```

Inicializa la base de datos:

```bash
node setup.js
node seed.js
```

Ejecuta la aplicación:

```bash
node server.js
```

La aplicación estará disponible en: [http://localhost:3001](http://localhost:3001)

---

## 🖱️ Uso

### Flujo de trabajo típico:

1. Selecciona el tipo de cálculo:
   - [x] Cálculo por Corriente Nominal
   - [ ] Cálculo por Caída de Tensión

2. Ingresa los parámetros eléctricos:
   - Voltaje (automático según número de fases)
   - Potencia (HP/kW, según tipo de carga)
   - Factor de potencia (recomendado: 0.8–0.95)

3. Obtén los resultados:
   - Corriente nominal y ajustada
   - Calibre sugerido con especificaciones técnicas
   - Porcentaje de caída de tensión (si aplica)

---

## 🤝 Contribución

¡Las contribuciones son bienvenidas!

- Reporta errores mediante [Issues](https://github.com/Maxuriel/CalibredeConductor/issues)
- Propón mejoras mediante Pull Requests
- Sugiere nuevas funcionalidades

### Guía rápida:

```bash
# 1. Haz un fork del proyecto
# 2. Crea una nueva rama
git checkout -b feature/mi-mejora

# 3. Realiza tus cambios y haz commit
git commit -m "Agrega nueva mejora"

# 4. Sube tu rama
git push origin feature/mi-mejora

# 5. Abre un Pull Request
```

---

## 📜 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

## 📧 Contacto

**Autor:** Maxuriel  
**GitHub:** [github.com/Maxuriel](https://github.com/Maxuriel)

---

