# Historias US15, US17, US30, US35 y US37: implementación y patrones

**Responsable:** Eduardo · **Rama:** `Rama_Eduardo` · **Sprints 2–4**

Estas historias se agregan al MVP **sin modificar** los módulos existentes (`auth`, `trips`, `dashboards`, `ratings`, `notifications`).
Cada dominio tiene su carpeta propia en `src/`, igual que el resto del proyecto, y usa
Controller → Service → DAO/Adapter.

**No se duplican modelos:** las solicitudes (US15) y las reservas (US17, US30, US35) son los registros de
`data/bookings.json` de la US14 (`src/trips/bookingModel.js`), leídos mediante adapters. Solo tienen
archivo propio los datos que no existen en Main: reclamos (`claims.json`), historial de participación
(`participation_log.json`) y contactos con conductores (`driver_contacts.json`).

| HU | Qué hace | Módulo | Endpoints | Patrones |
|----|----------|--------|-----------|----------|
| **US15** Visualizar estado de solicitudes | Lista las solicitudes del pasajero con su estado (pendiente, aceptada, rechazada, cancelada, expirada), su progreso y su historial. Permite cancelar una solicitud pendiente. | `src/requests/` | `GET /requests?estado=` · `GET /requests/:id` · `POST /requests/:id/cancel` | Factory Method, Adapter |
| **US17** Visualizar reservas realizadas | Reservas próximas, historial, canceladas o todas, con contadores. | `src/reservations/` | `GET /reservations?filtro=` · `GET /reservations/:id` | Strategy, Iterator, Adapter |
| **US35** Confirmar participación en el viaje | El pasajero confirma que asistirá o avisa que no irá, y puede deshacer su decisión antes de la salida. Se resaltan los viajes que salen en menos de 24 h. | `src/reservations/` | `POST /reservations/:id/participation/confirm` · `/decline` · `/undo` | Command, DAO |
| **US30** Contactar conductores frecuentes | Muestra los conductores con 2 o más viajes completados y permite contactarlos por WhatsApp, llamada, correo o mensaje interno. Guarda un historial de contactos. | `src/drivers/` | `GET /frequent-drivers` · `POST /frequent-drivers/:id/contact` · `GET /frequent-drivers/:id/contacts` | Strategy, Factory Method, DAO |
| **US37** Consultar estado del reclamo | Búsqueda con 5 campos (código, estado, categoría, desde, hasta) y plazo de respuesta (SLA). El detalle muestra línea de tiempo, respuesta de soporte y viaje asociado. | `src/claims/` | `GET /claims?codigo=&estado=&categoria=&desde=&hasta=` · `GET /claims/:codigo` | Facade, Decorator, Singleton, DAO |

**Vista:** `GET /mis-viajes`. Se entra con el botón **"Mis viajes"** del navbar del dashboard
(`views/mis_viajes.html`, `public/js/misViajes.js`, `public/css/mis_viajes.css`).

## Patrones aplicados

| Patrón | Tipo | Dónde | Problema que resuelve |
|--------|------|-------|-----------------------|
| **Singleton** | Creacional | `shared/persistence/JsonDataSource.js` | Un único punto de acceso a la carpeta `/data` para todos los DAO. |
| **Singleton** | Creacional | `claims/claimCodeGenerator.js` | Códigos de reclamo correlativos y sin duplicados (igual que el `GeneradorNumeroComprobante` visto en clase). |
| **Factory Method** | Creacional | `requests/requestStatusFactory.js` | Crea el `EstadoSolicitud` concreto (etiqueta, color, reglas como `puedeCancelar()`) sin usar `switch` en el servicio. |
| **Factory Method** | Creacional | `drivers/contactChannels.js` (`FabricaCanalContacto`) | Decide qué canal de contacto instanciar. |
| **Adapter** | Estructural | `reservations/bookingAdapter.js` | Presenta los bookings de la US14 (`trips/bookingModel.js`) como reservas, sin crear un segundo modelo. La participación (US35) se guarda como campo extra del mismo booking. |
| **Adapter** | Estructural | `requests/bookingRequestAdapter.js` | Presenta los mismos bookings como solicitudes para US15: `confirmada` → aceptada, `cancelada` → cancelada. |
| **Facade** | Estructural | `claims/claimFacade.js` | El controlador solo llama a `consultarReclamo()`. La Facade coordina el DAO, el generador, las reservas y los decoradores. |
| **Decorator** | Estructural | `claims/claimViewDecorators.js` | Agrega a la vista del reclamo el SLA, la línea de tiempo, la respuesta de soporte o el viaje asociado, sin crear una subclase por cada combinación. |
| **Strategy** | Comportamiento | `reservations/reservationFilters.js` | Un filtro por vista: próximas, historial, canceladas o todas. |
| **Strategy** | Comportamiento | `drivers/contactChannels.js` | Cada canal (WhatsApp, llamada, correo, mensaje) contacta a su manera, con la misma interfaz. |
| **Iterator** | Comportamiento | `reservations/reservationCollection.js` | Recorre las reservas filtradas y ordenadas, que vienen de `bookings.json`, con `hasNext()` / `next()`. Es el caso "colección filtrada" visto en clase. |
| **Command** | Comportamiento | `reservations/participationCommands.js` | Confirmar y declinar son comandos con `ejecutar()` y `deshacer()`. El Invoker guarda el historial (auditoría) y permite deshacer. |
| **DAO** | Acceso a datos | `ReclamoDAO`, `ContactoConductorDAO`, `HistorialParticipacionDAO` + `shared/persistence/JsonDAO.js` | Los servicios no conocen archivos ni JSON. Si se migra a una BD, solo cambian los DAO. |

Diagrama de clases: `diagramas/patrones_us15_us17_us30_us35_us37.puml`.

## Integración con las HU del equipo

- **US14 (unirse a una ruta):** cada `POST /trips/join` crea un booking que aparece automáticamente como
  solicitud aceptada (US15) y como reserva próxima (US17/US35). Si el conductor cancela la ruta
  (`cancelBookingsByRoute`), se ve como cancelada con su motivo.
- **Aprobación manual del conductor (futuro):** si un booking se guarda con estado `pendiente` o `rechazada`
  (con `responseNote`), US15 ya sabe mostrarlo, y solo los confirmados pasan a ser reservas.
- **Punto de recojo:** US15 lee `booking.pickupPoint.address`, el mismo campo que usa la vista de solicitudes del conductor.
- **Registrar reclamo:** `ReclamoFacade.registrarReclamo()` y `actualizarEstado()` ya existen para la HU
  de registro o atención de reclamos.
- **Datos de demostración:** el botón "Cargar datos de demostración" (`POST /mis-viajes/demo`, deshabilitado
  en producción) genera bookings y reclamos de ejemplo para el usuario en sesión, marcados con `demo: true`, con
  conductores ficticios y rutas `demo-route-*` que no existen. Al volver a generarlos se reemplazan, y
  `DELETE /mis-viajes/demo` los elimina.

## Pruebas

```bash
node --test                                  # todas las pruebas
node --test --experimental-test-coverage     # con reporte de cobertura
```

Las pruebas usan una carpeta de datos temporal (`MOVESHARE_DATA_DIR`) y un `bookingModel` en memoria
(`tests/helpers/fakeBookingModel.js`), así que no modifican `/data`.

| Tipo (rúbrica) | Archivo | Objeto de prueba | Casos |
|---|---|---|---|
| **Caja blanca** | `tests/cajaBlanca.contactarConductor.test.js` | `ConductorFrecuenteService.contactar()` (US30), complejidad ciclomática **V(G) = 7** | 7 caminos básicos (CB-01 a CB-07) |
| **Caja negra** | `tests/cajaNegra.busquedaReclamos.test.js` | Búsqueda de reclamos con **5 campos**: código, estado, categoría, desde, hasta (US37) | 16 casos por clases de equivalencia y valores límite (CN-01 a CN-16) |
| **Unitaria** | `tests/unitaria.confirmarParticipacion.test.js` | `ReservaService.confirmarParticipacion()` (US35) | 6 casos (UT-01 a UT-06) |
| Patrones / HU | `requests`, `reservations`, `frequentDrivers`, `claims` `.test.js` | Factory Method, Singleton, Adapter, Iterator, Strategy, Command, Facade, Decorator | 11 casos |
