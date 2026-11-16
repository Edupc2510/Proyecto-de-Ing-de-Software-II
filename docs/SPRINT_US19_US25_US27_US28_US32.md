# Sprint 2-4 · US19, US25, US27, US28 y US32

Documentación técnica de las historias de usuario implementadas sobre la rama `main`
(que ya incluye US14, US24, US31 y US34 del equipo). Las historias se construyeron
**sin reescribir el código existente**: cada una vive en su propio módulo y se conecta
al resto mediante adaptadores y puntos de integración mínimos.

> Los patrones se eligieron por el problema concreto de cada historia, no por
> cantidad. La sección [Qué NO se aplicó y por qué](#7-qué-no-se-aplicó-y-por-qué)
> explica los que se descartaron.

---

## 1. Resumen de lo implementado

| US | Historia | Módulo | Endpoints | Pantalla |
|---|---|---|---|---|
| **US27** | Ordenar viajes por horario | `src/tripCatalog/` | `GET /trip-catalog?orden=masProximos\|masTarde&tarifaMax=` | Selector "Ordenar por" en la lista del pasajero (`dashboard.html`) |
| **US28** | Ordenar viajes por disponibilidad de asientos | `src/tripCatalog/` | `GET /trip-catalog?orden=masAsientos\|ultimosCupos` | Mismo selector; etiqueta "Agotado" y refresco cada 5 s |
| **US19** | Editar perfil de usuario | `src/account/` | `GET/PUT /account/profile` | `/account` → pestaña "Mi perfil" |
| **US32** | Gestión avanzada de cuenta | `src/account/` | `GET/PUT /account/settings`, `GET /account/public/:userId` | `/account` → pestaña "Privacidad y ajustes"; modo oscuro global |
| **US25** | Calificar pasajero después del viaje | `src/ratings/` | `GET /ratings/driver/trips`, `POST/GET /ratings/passengers` | `/ratings/driver` |

---

## 2. Arquitectura

Capas: **Presentación** (HTML/JS) → **Controladores** (Express) → **Servicios** (lógica de negocio)
→ **Adaptadores / DAO** (acceso a datos) → archivos JSON en `/data`.
Diagrama: [`diagramas/arquitectura_us19_us25_us27_us28_us32.puml`](../diagramas/arquitectura_us19_us25_us27_us28_us32.puml)
(también `.png`).

Reglas que se respetan en todos los módulos:

- El **controlador** solo traduce HTTP ↔ servicio. No tiene reglas de negocio.
- El **servicio** no sabe de HTTP ni de archivos. Recibe sus dependencias por el constructor.
- Solo los **DAO y adaptadores** conocen archivos JSON o módulos externos.

```
src/
├── shared/
│   ├── persistence/ JsonDataSource.js (Singleton) · JsonDAO.js (DAO base)
│   ├── httpHelpers.js (DomainError, handle)
│   └── users/userRepositoryAdapter.js
├── tripCatalog/   (US27, US28)
├── account/       (US19, US32)
└── ratings/       (US25; convive con US24 en el mismo prefijo /ratings)
```

---

## 3. Patrones de diseño aplicados

Diagrama de clases: [`diagramas/patrones_us19_us25_us27_us28_us32.puml`](../diagramas/patrones_us19_us25_us27_us28_us32.puml)
(también `.png`).

| Patrón | Tipo | Dónde | Problema que resuelve |
|---|---|---|---|
| **Strategy** | Comportamiento | `tripCatalog/tripSortStrategies.js` (`OrdenamientoViajes` y 4 estrategias) | Cada criterio de orden (más próximos, más tarde, más asientos, últimos cupos) tiene su propio desempate. Un `switch` en el servicio mezclaría todo y obligaría a modificarlo por cada criterio nuevo. |
| **Factory Method** | Creacional | `FabricaOrdenamiento.crear(clave)` | Convierte el texto que llega por HTTP en la estrategia concreta y rechaza claves inválidas (400). Agregar un criterio = una clase + registrarla; el servicio no cambia. |
| **Adapter** | Estructural | `RutaFuenteAdapter` (sobre `trips/routeModel`) | El catálogo necesita viajes normalizados (hora numérica, asientos numéricos, tarifa opcional) sin acoplarse al archivo de rutas. Excluye las rutas **canceladas** (US34). |
| **Adapter** | Estructural | `CalificacionConductorAdapter` (sobre `ratings/ratingModel`, US24) | El desempate de US27 necesita la reputación del conductor, que produce US24 con funciones sueltas. |
| **Adapter** | Estructural | `ReservaViajeAdapter` (sobre `trips/bookingModel`, US14 + regla `isTripFinished`, US24) | US25 necesita reservas reales y saber si el viaje terminó. Reutiliza la misma regla de US24 en vez de redefinirla. |
| **Adapter** | Estructural | `UsuarioRepositorioAdapter` (sobre `auth/userModel`) | Cuenta, calificaciones y catálogo consultan usuarios sin depender de funciones ni de la ruta del JSON. Lo usan 3 módulos. |
| **Facade** | Estructural | `account/accountFacade.js` | Editar perfil y gestionar la cuenta involucra repositorio de usuarios, 2 DAO y un validador. El controlador habla solo con la fachada. Además expone las **políticas** que consultan otros módulos (`estaVisible`, `puedeRecibirSolicitudes`, `puedeNotificar`). |
| **DAO** | Acceso a datos | `PerfilDAO`, `AjustesDAO` (sobre `RegistroPorUsuarioDAO`), `CalificacionPasajeroDAO` | Los servicios nunca leen archivos. Migrar a una base de datos solo cambiaría estas clases. |
| **Singleton** | Creacional | `JsonDataSource` (compartido) | Una sola fuente de datos para todos los DAO. |

**Cómo se combinan (y por qué no chocan):** el servicio del catálogo orquesta
*Factory → Strategy* para ordenar, y *Adapters* para obtener los datos; el módulo de cuenta
es una *Facade* sobre *DAO* + validadores. Cada patrón resuelve un problema distinto y
ninguno envuelve a otro innecesariamente.

---

## 4. Principios aplicados

| Principio | Evidencia concreta |
|---|---|
| **Capas / separación de responsabilidades** | Controller → Service → Adapter/DAO en los 3 módulos. |
| **Modularidad** | Cada historia en su carpeta; solo 6 archivos existentes tocados (ver sección 6). |
| **Encapsulamiento** | Campos y métodos privados `#` en servicios, adaptadores y fábrica (`static #registro`). |
| **SRP** | `ValidadorPerfil` solo valida; `AccountFacade` solo coordina; cada DAO solo persiste; cada regla de validación valida un campo. |
| **OCP** | Nuevo criterio de orden, filtro (`construirFiltros`), ajuste (`settingsModel.js`) o regla de validación = agregar sin modificar lo existente. |
| **LSP** | Las 4 estrategias son intercambiables a través de `OrdenamientoViajes`; los DAO sustituyen a `JsonDAO`. |
| **ISP** | Los servicios dependen de interfaces mínimas (`{estaVisible}`, `{resumenDe}`, `{listar}`), no de módulos completos. |
| **DIP** | Los servicios reciben sus dependencias en el constructor; las pruebas inyectan falsos en memoria. |
| **DRY** | `encadenar()` y comparadores reutilizables; `RegistroPorUsuarioDAO`; regla `isTripFinished` de US24 reutilizada; `ratings.json` con formato compartido. |
| **KISS** | Refresco por *polling* cada 5 s en vez de WebSockets; comparadores como funciones simples. |
| **YAGNI** | No se creó UI para el filtro de tarifa (las rutas aún no tienen tarifa); no se agregó un sistema de chat ni de notificaciones propio. |
| **Ley de Demeter** | Los controladores solo llaman a su fachada/servicio; la fachada oculta DAOs y validadores. |
| **Duck typing** | Reglas con `validar(valor)`, filtros con `acepta(viaje)`, puertos con un solo método; sin jerarquías rígidas. |

---

## 5. Trazabilidad: criterios de aceptación → implementación → pruebas

Las pruebas unitarias están en `tests/` (`node --test`). Además, cada escenario se verificó
de punta a punta con la aplicación en ejecución (HTTP con sesiones reales y navegador).

### US27 · Ordenar viajes por horario
| Esc. | Criterio | Implementación | Prueba |
|---|---|---|---|
| 01 | "Más próximos" reorganiza por salida más cercana | `MasProximos` | `US27 esc.01` |
| 02 | "Más tarde" invierte la lista | `MasTarde` | `US27 esc.02` |
| 03 | Empate de hora → calificación del conductor | `porMejorCalificacion` + `CalificacionConductorAdapter` (promedio de US24; sin calificación = 0) | `US27 esc.03` |
| 04 | Ordenar combinado con filtro de tarifa | `FiltroTarifaMaxima` en `construirFiltros` | `US27 esc.04` |
| 05 | El criterio persiste al volver | `sessionStorage` en `tripSort.js` | Navegador: `US27 esc.05` |

### US28 · Ordenar por disponibilidad de asientos
| Esc. | Criterio | Implementación | Prueba |
|---|---|---|---|
| 01 | "Más asientos libres": arriba 3 o 4 cupos | `MasAsientosLibres` | `US28 esc.01` |
| 02 | Llenos al fondo con etiqueta "Agotado" | `mostrarAgotados` + `agotadosAlFinal`; tarjeta opaca y botón deshabilitado | `US28 esc.02` |
| 03 | "Últimos cupos": exactamente 1 asiento primero | `UltimosCupos` | `US28 esc.03` |
| 04 | Contador baja sin recargar | Refresco automático (5 s) que repinta solo si cambió el orden o los asientos | `US28 esc.04` + navegador |
| 05 | Empate → salida más próxima | `porSalidaAscendente` como criterio secundario | `US28 esc.05` |

### US19 · Editar perfil
| Esc. | Criterio | Implementación | Prueba |
|---|---|---|---|
| 01 | Edición exitosa | `AccountFacade.actualizarPerfil` (nombre/apellido → `users.json`; teléfono, foto y preferencias → `user_profiles.json`) | `US19 esc.01` |
| 02 | Campos inválidos → error | `ReglaNombre`, `ReglaTelefono`, `ReglaFoto` → 422 con detalle por campo (`CAMPO_INVALIDO`) | `US19 esc.02` |
| 03 | Campos vacíos → bloquea | `CAMPO_VACIO` (en servidor y en pantalla) | `US19 esc.03` |
| 04 | Sin cambios → no actualiza | Se compara contra lo guardado; responde `actualizado: false` y no escribe | `US19 esc.04` |
| 05 | Sesión expirada → pide iniciar sesión | `requireApiAuth` (401) y redirección a `/login` en el frontend | HTTP: 401 sin sesión |

### US32 · Gestión avanzada de cuenta
| Esc. | Criterio | Implementación | Prueba |
|---|---|---|---|
| 01 | Ocultar teléfono → solo chat interno | `perfilPublico()`: `phone: null` y `canalesContacto: ['chat_interno']` | `US32 esc.01` |
| 02 | Desactivar alertas push | `puedeNotificar()` consultado por `routeMatchingService` (US31) | `US32 esc.02` |
| 03 | Modo oscuro inmediato | `theme.js` + `theme.css`; se guarda en la cuenta | `US32 esc.03` + navegador |
| 04 | Pausar cuenta | Oculta viajes del catálogo y de `/trips`, `joinRoute` responde 409, perfil público 404 | `US32 esc.04` + HTTP |
| 05 | Error sin red → revierte y avisa | El interruptor vuelve a su estado y muestra "Error de conexión. Inténtalo más tarde." | Navegador sin conexión |

### US25 · Calificar pasajero
| Esc. | Criterio | Implementación | Prueba |
|---|---|---|---|
| 01 | Calificación exitosa se guarda | `CalificacionService.calificar` → `ratings.json` con `rateeRole: 'passenger'` | `US25 esc.01` |
| 02 | Pasajero inexistente → error | 404 "El pasajero no existe." | `US25 esc.02` |
| 03 | Valor inválido → rechaza | Entero de 1 a 5 (400); comentario ≤ 300 caracteres | `US25 esc.03` |
| 04 | Duplicidad → bloquea | Clave viaje + conductor + pasajero (igual que US24) → 409 | `US25 esc.04` |
| 05 | Fallo de conexión → no guarda | El DAO lanza si falla la escritura (no queda nada); el frontend no marca como guardado | `US25 esc.05` + navegador sin conexión |

---

## 6. Integración con el código existente

**Archivos del equipo que se modificaron (6):**

| Archivo | Cambio | Por qué |
|---|---|---|
| `app.js` | +8 líneas: 3 `require` y 3 `app.use` | Montar `/trip-catalog`, `/account` y `/ratings` (este último junto al de US24). |
| `views/dashboard.html` | +10 líneas | Enlaces "Mi cuenta" y "Calificar pasajeros", contenedor del selector de orden, "Editar perfil" en el modal, y los `<link>`/`<script>` nuevos. |
| `public/js/dashboard.js` | +26 / −5 líneas | La lista del pasajero consume `/trip-catalog` en vez de `/trips`; tarjeta "Agotado"; repintado solo si hubo cambios; arranque/parada del refresco. |
| `src/trips/routeController.js` | +12 líneas | US32: `getAllRoutes` oculta cuentas pausadas y `joinRoute` rechaza solicitudes a conductores en pausa. |
| `src/notifications/routeMatchingService.js` | +9 / −1 líneas | US32: no notificar coincidencias a quien apagó las alertas. |
| `.gitignore` | +5 líneas | Ignorar `user_profiles.json` y `user_settings.json` (datos generados). |

**Sin modificar:** `auth/`, `dashboards/`, `trips/routeModel.js`, `trips/bookingModel.js`,
`trips/routeRoutes.js`, y todo `ratings/` de US24 (`ratingModel.js`, `driverRatingController.js`,
`driverRatingRoutes.js`).

**Convivencia con US24:** ambas historias comparten `data/ratings.json` con el formato
genérico que US24 documentó (`raterId`, `rateeId`, `rateeRole`...). US24 guarda `rateeRole: 'driver'`
y US25 guarda `'passenger'`, por lo que no se pisan. Los caminos también son distintos
(`/ratings/passenger/trips` y `/ratings/drivers` de US24 frente a `/ratings/driver/trips` y
`/ratings/passengers` de US25).

**Corrección de un error preexistente:** el modal de perfil usaba `--c-navy` y `--c-lime`, variables
que no estaban definidas en ningún CSS (el encabezado quedaba invisible). `theme.css` las define
como alias de los colores de la paleta.

---

## 7. Qué NO se aplicó y por qué

| Patrón | Motivo |
|---|---|
| **Abstract Factory** | No hay familias de objetos relacionados que deban crearse juntos. La fábrica de ordenamientos es de un solo producto (Factory Method). |
| **Bridge** | No hay dos dimensiones independientes que varíen. La abstracción de persistencia ya la cubre el DAO. |
| **Iterator** | JavaScript ya itera de forma nativa (`for...of`, `map`, `filter`). Una clase iteradora solo agregaría código. |
| **Command** | No se requiere deshacer ni encolar operaciones. El requisito de "no guardar si falla" se resuelve con escritura atómica y la reversión del interruptor en la interfaz. |
| **Decorator** | Las "vistas" (perfil público, calificaciones) se arman con funciones simples; decorarlas sumaría clases sin beneficio. |

---

## 8. Supuestos y límites (importante leerlos)

1. **Tarifa (US27 esc.04):** las rutas actuales **no tienen tarifa**. El filtro `tarifaMax` está implementado
   y probado en el backend, pero no hay selector en la pantalla porque filtraría todos los viajes. Cuando una
   historia agregue `price`, el filtro funciona sin cambios. Un viaje sin tarifa no cumple una condición de precio.
2. **Calificación del conductor (US27 esc.03):** se toma el promedio que genera la US24. Un conductor sin
   calificaciones cuenta como 0 en el desempate.
3. **"Agotado" (US28 esc.02):** solo se muestra al ordenar por disponibilidad. En los órdenes por horario
   los viajes llenos no aparecen, igual que hoy en `/trips`.
4. **Tiempo real (US28 esc.04):** es refresco periódico cada 5 segundos, no un canal push.
5. **Teléfono y chat (US32 esc.01):** la aplicación aún no tiene chat. El comportamiento se expone en
   `GET /account/public/:userId` (`canalesContacto`), pero ninguna pantalla consume ese perfil público todavía.
6. **Preferencias de viaje (US19):** el documento no las detalla. Se implementaron tres (conversación, música,
   mascotas: sí / no / indistinto). Se pueden cambiar en `settingsModel.js` y `profileValidators.js`.
7. **Foto de perfil (US19):** el navegador la reduce a 256 px y se guarda como imagen en `user_profiles.json`
   (límite de ~90 KB por el tope de 100 KB de `express.json`).
8. **Viaje terminado (US25):** se usa la regla de US24: el viaje termina al pasar su hora de salida
   (más `TRIP_DURATION_MINUTES` si se define en `.env`). Para probar sin esperar, la pantalla incluye
   "Generar datos de demostración", que agrega reservas con `demo: true` en `bookings.json` y se pueden borrar
   (deshabilitado si `NODE_ENV=production`).
9. **Modo oscuro (US32 esc.03):** cubre el dashboard, "Mi cuenta" y "Calificar pasajeros". Los mapas y algunos
   elementos con estilos en línea del dashboard pueden conservar colores claros.

---

## 9. Cómo ejecutar y probar

```bash
npm install
npm start            # http://localhost:3000
node --test          # 36 pruebas unitarias (usan una carpeta temporal, no tocan /data)
```

**Demostración sugerida:**
1. Dos usuarios: uno publica 3 rutas (distinta hora y asientos) y el otro entra como *Pasajero*.
2. Cambiar "Ordenar por" y comprobar cada criterio; reservar el último cupo de una ruta y ver "Agotado".
3. `/account`: editar el perfil (probar datos inválidos y vacíos), subir foto, activar modo oscuro, pausar la cuenta.
4. `/ratings/driver` → "Generar datos de demostración" → calificar a un pasajero; intentar calificarlo de nuevo.
