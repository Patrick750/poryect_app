# Documentación del Proyecto: CRUD Personal

Este proyecto es un sistema para gestionar información personal, que incluye una interfaz frontend en React adaptable a dispositivos móviles mediante Capacitor, y un backend basado en Django con base de datos SQLite.

## Arquitectura del Proyecto

El proyecto está dividido en dos partes principales:

1. **Frontend (`/mi-proyecto`)**: 
   - Desarrollado con **React** y empaquetado con **Vite**.
   - **Capacitor** está integrado para exportar la aplicación web a una aplicación móvil nativa (Android APK).
   - El estado del CRUD se maneja localmente por el momento.
   - Cuenta con un diseño moderno (Glassmorphism) responsivo.

2. **Backend (`/crud` y `/backend`)**:
   - Desarrollado con **Django**.
   - Base de datos **SQLite**.
   - Modelo `Persona` configurado para almacenar: `tipo_documento`, `numero_documento`, `nombres`, `correo`, y `telefono`.
   - El campo `telefono` utiliza un `JSONField` para almacenar múltiples números en formato de lista.

## Versionamiento (Semantic Versioning)

El proyecto utiliza versionamiento semántico. El formato tradicional es **MAYOR.MENOR.PARCHE** (High.Low.Patch):

- **HIGH (Mayor)**: Cambios grandes o incompatibles en la arquitectura (ej. cambiar de SQLite a PostgreSQL, o rediseño total de la app).
- **LOW (Menor)**: Nuevas funcionalidades (ej. agregar un buscador de contactos o conectar formalmente el frontend con el backend).
- **PATH (Parche)**: Corrección de errores y pequeños ajustes (ej. arreglar un botón que no funciona o un error tipográfico).

### Historial de Versiones (Changelog)

#### **v1.3.0** - *Multi-Database Nativo (Actual)*
- Integración oficial con NeonDB utilizando `psycopg2` y `dj-database-url`.
- Django usa NeonDB de forma nativa por defecto.
- Fallback configurado a nivel de ORM: si la consulta a NeonDB falla (`OperationalError`), Django automáticamente redirige la consulta a la base de datos `db.sqlite3` usando el sufijo `.using('sqlite')`.

#### **v1.2.0** - *Backend Django como Proxy Offline-First*
- Traslado de la lógica de conexión (NeonDB vs SQLite) al backend de Django.
- Django actúa ahora como un proxy HTTP: si NeonDB no responde o rechaza la conexión, guarda automáticamente los datos en la base de datos `db.sqlite3` usando el modelo `Persona`.
- Simplificación del frontend: React ahora siempre se comunica de forma transparente con `http://localhost:8000/api/personas/`.

#### **v1.1.0** - *Lógica Offline-First en Frontend*
- Integración de `localforage` (Base de datos local IndexedDB/WebSQL) simulando el comportamiento interno de SQLite para almacenar contactos sin conexión.
- Lógica de sincronización automática: cuando la aplicación recupera la conexión a internet, envía los datos locales a la API de la nube (NeonDB).
- Indicador visual de estado de red (Online / Offline / Sincronizando) en la interfaz principal.

#### **v1.0.0** - *Versión Inicial*
- Implementación de la interfaz de usuario en React.
- Lógica del CRUD en el estado del frontend.
- Integración de Capacitor para Android.
- Creación de la estructura del Backend en Django.
- Creación y migración del modelo `Persona` (SQLite) con soporte JSONB para múltiples teléfonos.
