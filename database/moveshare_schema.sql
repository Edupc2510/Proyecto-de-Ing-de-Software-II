-- ============================================================================
-- MoveShare – Modelo relacional (diseño para la siguiente versión)
-- ============================================================================
-- Estado actual: la versión entregada persiste los datos en archivos JSON
-- dentro de /data (un archivo por colección) mediante JsonDataSource (Singleton)
-- y createJsonStore (Adapter). Este script es el DISEÑO RELACIONAL equivalente:
-- cada tabla corresponde a una colección JSON y cada columna a un campo que el
-- código ya usa. Gracias a los DAO/Adapter, migrar solo cambia la capa de datos.
--
-- Dialecto: PostgreSQL 15+. Ejecutar: psql -U <usuario> -d moveshare -f moveshare_schema.sql
-- ============================================================================

BEGIN;

-- ── Usuarios y cuenta (US01, US19, US32, US36) ───────────────────────────────
-- users.json
CREATE TABLE usuario (
    id              UUID PRIMARY KEY,
    nombre          VARCHAR(80)  NOT NULL,
    apellido        VARCHAR(80)  NOT NULL,
    correo          VARCHAR(120) NOT NULL UNIQUE CHECK (correo LIKE '%@%'),
    dni             CHAR(8)      NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,            -- bcrypt
    verificado      BOOLEAN      NOT NULL DEFAULT FALSE,
    password_cambiado_en TIMESTAMPTZ,                  -- US36: invalida sesiones antiguas
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- user_profiles.json (US19)
CREATE TABLE perfil_usuario (
    usuario_id      UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    telefono        VARCHAR(20),
    foto_url        TEXT,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_settings.json (US32)
CREATE TABLE ajustes_cuenta (
    usuario_id              UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    cuenta_pausada          BOOLEAN NOT NULL DEFAULT FALSE,
    alertas_coincidencia    BOOLEAN NOT NULL DEFAULT TRUE,   -- usado por CriterioPreferenciaCuenta (US31)
    mostrar_telefono        BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Rutas publicadas (US13, US20, US22, US33, US34) ──────────────────────────
-- routes.json
CREATE TABLE ruta (
    id                  BIGINT PRIMARY KEY,
    conductor_id        UUID NOT NULL REFERENCES usuario(id),
    origen              VARCHAR(200) NOT NULL,
    origen_lat          NUMERIC(9,6) NOT NULL CHECK (origen_lat BETWEEN -90 AND 90),
    origen_lng          NUMERIC(9,6) NOT NULL CHECK (origen_lng BETWEEN -180 AND 180),
    destino             VARCHAR(200) NOT NULL,
    destino_lat         NUMERIC(9,6) NOT NULL CHECK (destino_lat BETWEEN -90 AND 90),
    destino_lng         NUMERIC(9,6) NOT NULL CHECK (destino_lng BETWEEN -180 AND 180),
    hora_salida         TIME         NOT NULL,
    salida_en           TIMESTAMPTZ  NOT NULL,          -- expiresAtTimestamp
    asientos_totales    SMALLINT     NOT NULL CHECK (asientos_totales BETWEEN 1 AND 4),
    asientos_libres     SMALLINT     NOT NULL CHECK (asientos_libres BETWEEN 0 AND 4),
    notas               VARCHAR(500),                   -- US22
    estado              VARCHAR(10)  NOT NULL DEFAULT 'activa'
                        CHECK (estado IN ('activa', 'cancelada')),
    motivo_cancelacion  VARCHAR(200),                   -- US34
    cancelada_en        TIMESTAMPTZ,
    creada_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizada_en      TIMESTAMPTZ,
    CHECK (asientos_libres <= asientos_totales),
    CHECK (origen <> destino)
);
CREATE INDEX idx_ruta_conductor ON ruta(conductor_id);
CREATE INDEX idx_ruta_disponible ON ruta(estado, salida_en);

-- ── Reservas / solicitudes (US14, US15, US16, US17, US21, US35) ──────────────
-- bookings.json (modelo único de reservas del equipo)
CREATE TABLE reserva (
    id                  UUID PRIMARY KEY,
    ruta_id             BIGINT NOT NULL REFERENCES ruta(id),
    pasajero_id         UUID   NOT NULL REFERENCES usuario(id),
    conductor_id        UUID   NOT NULL REFERENCES usuario(id),
    estado              VARCHAR(12) NOT NULL DEFAULT 'confirmada'
                        CHECK (estado IN ('confirmada', 'cancelada')),
    recojo_direccion    VARCHAR(200),                   -- US21 pickupPoint
    recojo_lat          NUMERIC(9,6),
    recojo_lng          NUMERIC(9,6),
    motivo_cancelacion  VARCHAR(200),
    creada_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelada_en        TIMESTAMPTZ,
    CHECK (pasajero_id <> conductor_id)
);
-- Un pasajero no puede tener dos reservas confirmadas en la misma ruta (US14)
CREATE UNIQUE INDEX uq_reserva_activa ON reserva(ruta_id, pasajero_id) WHERE estado = 'confirmada';

-- participation_log.json (US35, patrón Command)
CREATE TABLE historial_participacion (
    id              UUID PRIMARY KEY,
    reserva_id      UUID NOT NULL REFERENCES reserva(id),
    pasajero_id     UUID NOT NULL REFERENCES usuario(id),
    tipo            VARCHAR(20) NOT NULL,
    estado_previo   VARCHAR(20),
    descripcion     VARCHAR(200),
    ejecutado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deshecho        BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Calificaciones (US24 conductor, US25 pasajero) ───────────────────────────
-- ratings.json (formato compartido)
CREATE TABLE calificacion (
    id              UUID PRIMARY KEY,
    ruta_id         BIGINT NOT NULL REFERENCES ruta(id),
    reserva_id      UUID   NOT NULL REFERENCES reserva(id),
    calificador_id  UUID   NOT NULL REFERENCES usuario(id),
    calificado_id   UUID   NOT NULL REFERENCES usuario(id),
    rol_calificado  VARCHAR(10) NOT NULL CHECK (rol_calificado IN ('driver', 'passenger')),
    puntaje         SMALLINT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario      VARCHAR(300),
    creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reserva_id, calificador_id, rol_calificado)   -- sin calificaciones duplicadas
);
CREATE INDEX idx_calificacion_calificado ON calificacion(calificado_id, rol_calificado);

-- ── Rutas habituales y notificaciones (US31, US14, US33, US34) ───────────────
-- routeAlerts.json
CREATE TABLE ruta_habitual (
    id              UUID PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    origen          VARCHAR(200) NOT NULL,
    origen_lat      NUMERIC(9,6) NOT NULL,
    origen_lng      NUMERIC(9,6) NOT NULL,
    destino         VARCHAR(200) NOT NULL,
    destino_lat     NUMERIC(9,6) NOT NULL,
    destino_lng     NUMERIC(9,6) NOT NULL,
    hora_desde      TIME,
    hora_hasta      TIME,
    activa          BOOLEAN NOT NULL DEFAULT TRUE,      -- "Recibir alertas"
    creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((hora_desde IS NULL) = (hora_hasta IS NULL))
);
-- Máximo 5 rutas habituales por usuario: regla de negocio validada en la aplicación.

-- notifications.json
CREATE TABLE notificacion (
    id                  UUID PRIMARY KEY,
    usuario_id          UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tipo                VARCHAR(20) NOT NULL
                        CHECK (tipo IN ('route_match', 'route_cancelled', 'route_updated', 'new_request')),
    prioridad           VARCHAR(6)  NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal', 'alta')),
    titulo              VARCHAR(120) NOT NULL,
    mensaje             VARCHAR(500) NOT NULL,
    ruta_habitual_id    UUID REFERENCES ruta_habitual(id) ON DELETE SET NULL,
    leida               BOOLEAN NOT NULL DEFAULT FALSE,
    creada_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizada_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificacion_usuario ON notificacion(usuario_id, leida);

-- Un aviso puede agrupar varias rutas (routeIds: "Hay N nuevos viajes...")
CREATE TABLE notificacion_ruta (
    notificacion_id UUID   NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    ruta_id         BIGINT NOT NULL REFERENCES ruta(id),
    PRIMARY KEY (notificacion_id, ruta_id)
);

-- driverStrikes.json (US34, cancelación tardía)
CREATE TABLE strike_conductor (
    id                      UUID PRIMARY KEY,
    conductor_id            UUID   NOT NULL REFERENCES usuario(id),
    ruta_id                 BIGINT NOT NULL REFERENCES ruta(id),
    tipo                    VARCHAR(30) NOT NULL DEFAULT 'cancelacion_tardia',
    pasajeros_afectados     SMALLINT NOT NULL CHECK (pasajeros_afectados > 0),
    minutos_antes_salida    INTEGER NOT NULL,
    motivo                  VARCHAR(200),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Red de confianza (US29, US30) ────────────────────────────────────────────
-- favoriteDrivers.json (US29)
CREATE TABLE conductor_favorito (
    pasajero_id     UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    conductor_id    UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    guardado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (pasajero_id, conductor_id),
    CHECK (pasajero_id <> conductor_id)
);

-- driver_contacts.json (US30)
CREATE TABLE contacto_conductor (
    id              UUID PRIMARY KEY,
    pasajero_id     UUID NOT NULL REFERENCES usuario(id),
    conductor_id    UUID NOT NULL REFERENCES usuario(id),
    canal           VARCHAR(20) NOT NULL CHECK (canal IN ('telefono', 'chat_interno')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Reclamos (US36 registro, US37 seguimiento) ───────────────────────────────
-- claims.json
CREATE TABLE reclamo (
    id                  UUID PRIMARY KEY,
    codigo              VARCHAR(30) NOT NULL UNIQUE,            -- REC-AAAA-XXXX
    usuario_id          UUID NOT NULL REFERENCES usuario(id),
    rol_reportante      VARCHAR(10) NOT NULL CHECK (rol_reportante IN ('passenger', 'driver')),
    ruta_id             BIGINT REFERENCES ruta(id),
    reserva_id          UUID REFERENCES reserva(id),
    categoria           VARCHAR(40) NOT NULL,
    prioridad           VARCHAR(10) NOT NULL,
    asunto              VARCHAR(120) NOT NULL,
    descripcion         VARCHAR(1000) NOT NULL,
    estado              VARCHAR(20) NOT NULL DEFAULT 'registrado',
    agente_asignado     VARCHAR(80),
    respuesta           TEXT,
    estado_correo       VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reclamo_historial (
    id          BIGSERIAL PRIMARY KEY,
    reclamo_id  UUID NOT NULL REFERENCES reclamo(id) ON DELETE CASCADE,
    estado      VARCHAR(20) NOT NULL,
    nota        VARCHAR(300),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

-- Nota: los tokens de recuperación de contraseña (US36) viven solo en memoria
-- del servidor por seguridad (expiran a los pocos minutos) y no se persisten.
