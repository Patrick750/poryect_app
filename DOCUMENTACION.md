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

#### **v1.9.0** - *Detección de Red Dinámica (Actual)*
- Añadida lógica nativa en React para escuchar eventos del navegador (`window.addEventListener('offline')`).
- El indicador de servidor ahora cambia en vivo a "Offline" (color rojo) en el momento exacto en que tu dispositivo (PC/Móvil) pierde acceso a internet.
- Cuando el internet vuelve, el indicador dice "Conectando al servidor..." y procede a recargar todos los datos automáticamente sin tener que refrescar la página.

#### **v1.8.0** - *Sincronización Manual Local a Nube*
- Añadido un botón de "Sincronizar" en la interfaz gráfica del directorio.
- Creada la ruta `/api/personas/sync/` en Django, la cual procesa todos los registros guardados en SQLite sin conexión, busca discrepancias en NeonDB (utilizando el número de documento como clave) y sube los datos offline al servidor.
- Notificaciones Toast implementadas para informar cuántos registros fueron sincronizados con éxito.

#### **v1.7.0** - *Sincronización Transaccional en Caliente (Mirroring)*
- Implementación de Caché de Espejo: `SQLite` ahora es un clon en tiempo real de `NeonDB`.
- **En Lectura (GET):** Al traer los datos de la nube, se elimina la caché local y se inserta una copia fresca de todo el directorio automáticamente.
- **En Escritura (POST/PATCH/DELETE):** Arquitectura `Write-Through`. Cada cambio exitoso en NeonDB se replica exactamente igual en `SQLite` al milisegundo. Esto garantiza que si el internet falla abruptamente, la base local jamás estará desactualizada.

#### **v1.6.0** - *Sistema de Alertas Personalizadas (Toasts)*
- Reemplazo de las aburridas alertas del navegador (`alert()`) por un sistema moderno de "Toasts" (alertas flotantes temporales) integradas nativamente en React.
- Diseñé animaciones CSS fluidas (`slideIn` y `slideOut`) y colores contextuales: Rojo para errores (ej. DNI repetido), Verde para éxitos (ej. Usuario registrado) y Azul para informativos.
- Las notificaciones desaparecen automáticamente en 4 segundos, mejorando la experiencia de usuario (UX) considerablemente y dándole un look súper premium.

#### **v1.5.0** - *Validaciones de Datos y Unicidad*
- Añadida limpieza (`sanitization`) al campo número de documento para evitar guardar letras o espacios, preservando únicamente los números usando expresiones regulares (Regex).
- Se ha incorporado la validación de unicidad en el serializador: si ya existe un usuario con el mismo número de documento en NeonDB (o SQLite en su defecto), Django rechazará la inserción y retornará un error 400.
- El frontend (App.jsx) ahora atrapa estos errores HTTP 400 devueltos por el DRF y los muestra al usuario de manera amigable mediante una alerta, informando por qué fue rechazado.

#### **v1.4.0** - *Refactorización con Serializadores DRF*
- Implementación de Django REST Framework (DRF).
- Creación de `PersonaSerializer` para validar, limpiar y mapear la data entrante y saliente, separando limpiamente la capa de red del frontend con la base de datos.
- Las vistas ahora usan el decorador `@api_view`, devolviendo respuestas estándar de API.
- Se mantiene 100% intacta la lógica inteligente de fallo (NeonDB -> SQLite) dentro de la arquitectura DRF.

#### **v1.3.0** - *Multi-Database Nativo*
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
