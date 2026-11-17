# MoveShare 🚗

> **Plataforma universitaria de movilidad compartida en Lima Metropolitana**

MoveShare conecta a estudiantes que comparten trayectos para coordinar viajes en auto (carpooling): los conductores publican rutas, los pasajeros reservan asientos, reciben avisos y califican la experiencia.

Proyecto final del **Grupo 3 de Ingeniería de Software II** (Universidad de Lima): Camila Mendoza, Luciano Moscoso, Eduardo Pantoja, Fabrizio Curo y Rodrigo Borja.

---

## ✨ Funcionalidades (Release 1 y Release 2)

| Módulo | Historias | Qué permite |
|---|---|---|
| Cuenta y acceso | US01–US06, US18, US19, US20, US32 | Registro con verificación por correo, login, roles pasajero/conductor, perfil, recuperación de contraseña, gestión de cuenta |
| Rutas del conductor | US10, US11, US12, US22, US33, US34 | Publicar, editar y cancelar rutas (confirmación "CANCELAR", aviso a pasajeros, historial de canceladas) |
| Búsqueda y reservas | US07, US08, US09, US16, US21, US26, US27, US28 | Buscar, filtrar y ordenar viajes; ver el detalle; reservar con punto de recojo en el mapa |
| Solicitudes y viajes | US14, US15, US17, US23, US35 | Solicitudes del conductor, estado de solicitudes y reservas del pasajero, historial, confirmar participación |
| Notificaciones | US31 (+ avisos de US14, US33, US34) | Ruta habitual con alertas de coincidencia, campana de avisos y avisos emergentes |
| Reputación y confianza | US24, US25, US29, US30 | Calificar conductor y pasajero, conductores frecuentes/favoritos y contacto |
| Soporte | US36, US37 | Reportar incidencias y consultar el estado del reclamo |

---

## 🛠 Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | Node.js 24 · Express 4 · express-session |
| Frontend | HTML5 · CSS3 · JavaScript (sin framework) · Leaflet + OpenStreetMap |
| Correo | Nodemailer (Gmail SMTP) |
| Seguridad | bcryptjs · uuid |
| Persistencia | Archivos JSON en `data/` mediante `JsonDataSource` (Singleton), `JsonDAO` y `createJsonStore` (Adapter) |
| Pruebas | `node:test` + `node:assert` (incluidos en Node.js) |

---

## 🚀 Instalación y ejecución

**Requisito:** Node.js 20 o superior (probado con Node.js 24).

```bash
git clone https://github.com/Edupc2510/Proyecto-de-Ing-de-Software-II.git
cd Proyecto-de-Ing-de-Software-II
npm install
```

**Variables de entorno:** copia `.env.example` como `.env` y completa tus valores. Nunca subas el `.env` al repositorio.

```bash
cp .env.example .env
```

| Variable | Uso |
|---|---|
| `PORT` | Puerto del servidor (por defecto 3000) |
| `APP_BASE_URL` | URL base para los enlaces de recuperación de contraseña |
| `SESSION_SECRET` | Secreto de la sesión (cadena larga y aleatoria) |
| `EMAIL_USER` / `EMAIL_PASS` | Cuenta de Gmail y su **contraseña de aplicación** (ver abajo). Solo son necesarias para enviar correos. |

**Iniciar:**

```bash
npm start
```

Abre **http://localhost:3000**.

---

## 🔑 Cuentas de prueba

Para probar sin configurar el correo, crea dos cuentas ya verificadas:

```bash
npm run seed:demo
```

| Rol sugerido | Correo | Contraseña |
|---|---|---|
| Conductor | `conductor.demo@ulima.edu.pe` | `Test1234!` |
| Pasajera | `pasajera.demo@ulima.edu.pe` | `Test1234!` |

Son datos ficticios solo para entorno local. Usa una ventana normal para el conductor y una de incógnito para la pasajera.

---

## 🧪 Pruebas

```bash
npm test                # ejecuta todas las pruebas de tests/ (252 casos)
npm run test:coverage   # además muestra la cobertura por archivo
```

Incluyen pruebas unitarias, de caja blanca y de caja negra de cada integrante. Usan una carpeta temporal (`MOVESHARE_DATA_DIR`), por lo que **no modifican** los archivos de `data/`.

---

## 📁 Estructura

```
├── app.js                  # Express, sesión, rutas y registro de observadores
├── src/
│   ├── auth/ · account/    # Registro, login, recuperación, perfil, ajustes de cuenta
│   ├── trips/              # Rutas, reservas, solicitudes, edición, cancelación, historial
│   ├── tripCatalog/ · myTrips/   # Catálogo ordenable y "Mis viajes"
│   ├── notifications/      # Rutas habituales, coincidencias (Strategy), avisos (Factory)
│   ├── ratings/            # Calificaciones de conductor (US24) y pasajero (US25)
│   ├── requests/ · reservations/ · drivers/   # Solicitudes, reservas, participación, conductores
│   ├── claims/ · reports/  # Reclamos e incidencias
│   ├── dashboards/
│   └── shared/             # persistence (JsonDataSource, JsonDAO), events (TripEventBus), middleware
├── public/                 # Frontend: js/ (un módulo por historia), css/, assets/
├── views/                  # Páginas HTML
├── tests/                  # 252 pruebas automatizadas
├── data/                   # Persistencia actual en JSON
├── database/               # moveshare_schema.sql: modelo relacional diseñado (PostgreSQL)
├── diagramas/              # Diagramas UML editables (PlantUML)
└── scripts/                # crear_usuarios_prueba.js (cuentas demo)
```

---

## 🧩 Arquitectura y diseño

- **Capas:** presentación → rutas/controladores → servicios de dominio → modelos/DAO → `JsonDataSource` → `data/*.json`.
- **Patrones aplicados:** Singleton (`JsonDataSource`), Factory (`NotificationFactory`), Adapter (`createJsonStore` y adapters de reservas/usuarios), Facade (`AccountFacade`, `ReclamoFacade`), Decorator (vistas de reclamo), Observer (`TripEventBus`), Strategy (criterios de coincidencia y orden del catálogo), Command (participación con deshacer), DAO/Repository.
- **Base de datos:** la versión actual usa archivos JSON. El modelo relacional equivalente (16 tablas, con claves y restricciones) está en `database/moveshare_schema.sql` y `diagramas/modelo_entidad_relacion.puml`. Por la capa DAO/Adapter, migrar solo cambia la persistencia.
- **Diagramas:** en `diagramas/` (componentes, despliegue, entidad-relación, secuencia y clases por integrante). Se abren con la extensión PlantUML de VS Code o en plantuml.com.

---

## 🔐 Contraseña de aplicación de Gmail

Solo se necesita para enviar correos reales (verificación, recuperación y reclamos):

1. Entra a https://myaccount.google.com/security y activa la **verificación en dos pasos**.
2. Busca **Contraseñas de aplicación**, crea una llamada `MoveShare`.
3. Copia el código de 16 caracteres sin espacios en `EMAIL_PASS` del `.env`.

Sin correo configurado, el registro puede mostrar el código de verificación en modo desarrollo; la recuperación de contraseña no expone el enlace (se valida con las pruebas automatizadas).

---

## 🤝 Flujo de trabajo del equipo

Cada integrante trabaja en su rama (`Rama_Luciano`, `Rama-Rodrigo`, `RamaCamila`, `Rama-Fabrizio`, `Rama_Eduardo`) y la integra a `Main` mediante pull request revisado, después de traer `Main` a su rama y ejecutar `npm test`.

© 2026 MoveShare · Grupo 3 · Universidad de Lima
