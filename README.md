# MoveShare 🚗

> **Plataforma universitaria de movilidad compartida en Lima Metropolitana**

MoveShare conecta estudiantes universitarios que comparten rutas frecuentes en Lima, ayudándoles a reducir costos de transporte y optimizar sus viajes diarios mediante carpooling.

Proyecto del **Grupo 3 de Ingeniería de Software II**, desarrollado en equipo por Camila Mendoza, Luciano Moscoso, Eduardo Pantoja, Fabrizio Curo y Rodrigo Borja.

---

## ✨ Características

- **Registro con verificación de correo** (código OTP de 6 dígitos vía Nodemailer/Gmail)
- **Login seguro** con bcrypt y sesiones Express
- **Selección dinámica de rol**: Pasajero o Conductor (no permanente, cambiable)
- **Vista Pasajero**: mapa interactivo Leaflet.js con ruta real en Lima
- **Vista Conductor**: formulario para publicar rutas con validación
- **Switch PC / Mobile**: simula la app en una pantalla de smartphone (375×812px)
- **Persistencia local** con archivos JSON (sin base de datos)
- **UI moderna** con Syne + DM Sans, paleta azul marino, diseño responsive

---

## 🛠 Tecnologías

| Capa       | Tecnología |
|------------|-----------|
| Backend    | Node.js · Express.js · express-session |
| Frontend   | HTML5 · CSS3 · JavaScript Vanilla |
| Mapas      | Leaflet.js + OpenStreetMap |
| Email      | Nodemailer (Gmail) |
| Seguridad  | bcryptjs · uuid |
| Storage    | fs · JSON files |
| Config     | dotenv |

---

## 🚀 Instalación y ejecución

### 1. Clona el repositorio

```bash
git clone https://github.com/Edupc2510/Proyecto-de-Ing-de-Software-II.git
cd Proyecto-de-Ing-de-Software-II
```

### 2. Instala las dependencias

```bash
npm ci
```

### 3. Configura las variables de entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
PORT=3000
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=una_cadena_secreta_larga_y_aleatoria
EMAIL_USER=tuemail@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion_google
```

### 4. Inicia el servidor

```bash
npm start
```

Abre en tu navegador: **http://localhost:3000**

### 5. Ejecuta las pruebas

Las pruebas unitarias usan el runner incluido en Node.js (`node:test`), no requieren dependencias extra y no modifican los datos de `/data`.

```bash
npm test                # ejecuta todas las pruebas de la carpeta tests/
npm run test:coverage   # además muestra el porcentaje de cobertura por archivo
```

---

## 🔐 Configurar Gmail App Password

MoveShare usa Gmail para enviar correos de verificación. **No uses tu contraseña normal de Gmail**. Necesitas una "Contraseña de Aplicación":

1. Ve a **https://myaccount.google.com/security**
2. Activa la **Verificación en dos pasos** si no está activa
3. En el buscador de la página escribe: `Contraseñas de aplicación`
4. Selecciona **"Otra (nombre personalizado)"** → escribe `MoveShare`
5. Google genera un código de **16 caracteres** (ej: `abcd efgh ijkl mnop`)
6. Cópialo **sin espacios** y pégalo en `EMAIL_PASS` del `.env`

> **Modo desarrollo heredado de registro**: el registro puede mostrar su código de verificación si falla el correo. Esto no aplica a recuperar contraseña: US20 no imprime el enlace ni lo devuelve al navegador. Para probar ese flujo sin SMTP, ejecutar las pruebas automatizadas.

---

## 📁 Estructura del proyecto

```
moveshare/
├── app.js                     # Punto de entrada del servidor
├── package.json               # Dependencias y scripts
├── .env.example               # Plantilla de variables de entorno
├── README.md                  # Este archivo
│
├── src/
│   ├── auth/                  # Registro, login, recuperación, usuarios y correo
│   ├── dashboards/            # Vista principal y perfil
│   ├── trips/                 # Rutas, detalles, filtros y vínculos de viaje
│   ├── reports/               # Registro de incidencias y persistencia de reclamos
│   └── shared/middleware/     # Middleware compartido
├── tests/                     # Pruebas unitarias y de integración de Rodrigo
│
├── data/
│   ├── users.json             # Usuarios (JSON local)
│   └── routes.json            # Rutas; bookings.json y claims.json se crean al usar sus flujos
│
├── views/
│   ├── index.html             # Página de login y registro
│   └── dashboard.html         # Dashboard principal
│
└── public/
    ├── css/
    │   ├── main.css           # Design system: variables, reset, botones, formularios
    │   ├── auth.css           # Estilos de la página de autenticación
    │   └── dashboard.css      # Estilos del dashboard, navbar, mapas, roles
    └── js/
        ├── auth.js            # Lógica frontend: tabs, registro, login, verificación
        └── dashboard.js       # Lógica frontend: roles, Leaflet, formulario conductor, PC/Mobile
```

---

## 🗂 Explicación de archivos clave

### `app.js`
Configura Express, middlewares (JSON, sesiones, static), monta las rutas y arranca el servidor en el puerto definido en `.env`.

### `src/auth/authController.js`
- `register()`: valida, hashea contraseña, crea usuario en JSON, genera código OTP, envía email.
- `verifyCode()`: valida código OTP en memoria, marca usuario como `verified: true`.
- `login()`: valida credenciales, verifica que la cuenta esté verificada, crea sesión.
- `logout()`: destruye la sesión.
- `getMe()`: retorna datos del usuario de la sesión activa.

### `src/auth/userModel.js`
Funciones de acceso al archivo `data/users.json`:
- `readUsers()` / `writeUsers()`
- `findUserByEmail()` / `findUserById()`
- `createUser()` / `updateUser()`

### `src/auth/emailService.js`
Crea el transporte SMTP con credenciales de `process.env` y envía verificación, enlace de recuperación y confirmación de reclamo.

### `public/js/auth.js`
Maneja el frontend de autenticación: cambio entre tabs (login/registro/verificación), llamadas `fetch` a la API, inputs de código OTP con navegación automática entre celdas.

### `public/js/dashboard.js`
- Carga el perfil del usuario al iniciar.
- `selectRole()`: navega entre pantallas según el rol elegido.
- `initPassengerMap()`: inicializa Leaflet con marcadores y polyline azul en Lima.
- `handlePublishRoute()`: valida y envía la ruta a `POST /trips`; el servidor la guarda en JSON.
- `setViewMode()`: alterna entre modo PC y simulación de smartphone.

---

## 🔄 Flujo completo de autenticación

```
1. Usuario llena formulario de registro
        ↓
2. Frontend valida campos (email, DNI, contraseña)
        ↓
3. POST /auth/register
        ↓
4. Backend valida, hashea contraseña, guarda en users.json (verified: false)
        ↓
5. Genera código OTP de 6 dígitos, lo guarda en memoria con expiración 15 min
        ↓
6. Nodemailer envía código al correo del usuario
        ↓
7. Usuario ve pantalla de verificación con 6 inputs
        ↓
8. Ingresa el código → POST /auth/verify
        ↓
9. Backend valida código y actualiza users.json (verified: true)
        ↓
10. Usuario inicia sesión → POST /auth/login
        ↓
11. Backend valida credenciales y que verified === true
        ↓
12. Crea sesión Express → redirige a /dashboard
        ↓
13. Dashboard muestra selección de rol (Pasajero / Conductor)
```

---

## 📱 Switch PC / Mobile

En el navbar hay dos botones (🖥 / 📱) que alternan entre:

- **Modo PC**: el dashboard ocupa el ancho completo (máx. 960px), con diseño desktop moderno.
- **Modo Mobile**: la aplicación se renderiza dentro de un contenedor de `375×812px` con bordes redondeados, sombra profunda y decoraciones de notch, simulando un smartphone real.

La transición usa CSS `transition` y el mapa Leaflet es invalidado con `invalidateSize()` para recalcular sus dimensiones tras el cambio.

---

## 🗺 Rutas en el mapa

La vista de pasajero carga rutas publicadas mediante `GET /trip-catalog`, combinando filtros y ordenamiento. El modal representa las coordenadas de la ruta seleccionada con Leaflet y mapas de OpenStreetMap. Los mapas, búsqueda de direcciones y cálculo de recorrido dependen de servicios externos y de conectividad.

---

## 📦 Dependencias

```json
{
  "express": "servidor web",
  "express-session": "manejo de sesiones",
  "bcryptjs": "hash de contraseñas",
  "nodemailer": "envío de correos",
  "uuid": "generación de IDs únicos",
  "dotenv": "variables de entorno",
  "body-parser": "parsing de requests"
}
```

---

## 🤝 Contribuir

1. Fork del repositorio
2. Crea una rama: `git checkout -b feature/nueva-feature`
3. Commit: `git commit -m 'Agrega nueva feature'`
4. Push: `git push origin feature/nueva-feature`
5. Abre un Pull Request

---

© 2024 MoveShare · Lima, Perú
