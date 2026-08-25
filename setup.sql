-- Pet store grooming application schema for Supabase PostgreSQL.
-- DESTRUCTIVE AND IDEMPOTENT: every execution deletes and recreates only
-- the application-owned objects listed below. It does not modify auth, storage,
-- the petstore bucket, or unrelated objects in public.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Destructive reset of application-owned objects
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.recordatorios_citas CASCADE;
DROP TABLE IF EXISTS public.pagos CASCADE;
DROP TABLE IF EXISTS public.calificaciones_groomer CASCADE;
DROP TABLE IF EXISTS public.registros_servicio CASCADE;
DROP TABLE IF EXISTS public.registros_servicio_adicionales CASCADE;
DROP TABLE IF EXISTS public.citas CASCADE;
DROP TABLE IF EXISTS public.cupones CASCADE;
DROP TABLE IF EXISTS public.configuracion_sistema CASCADE;
DROP TABLE IF EXISTS public.precios_shampoo CASCADE;
DROP TABLE IF EXISTS public.opciones_shampoo CASCADE;
DROP TABLE IF EXISTS public.precios_servicios CASCADE;
DROP TABLE IF EXISTS public.servicios CASCADE;
DROP TABLE IF EXISTS public.peluqueros CASCADE;
DROP TABLE IF EXISTS public.mascotas CASCADE;
DROP TABLE IF EXISTS public.tamanos CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.usuarios_sucursales CASCADE;
DROP TABLE IF EXISTS public.sucursales CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.metodos_pago CASCADE;
DROP TABLE IF EXISTS public.auditorias CASCADE;

DROP FUNCTION IF EXISTS public.validar_total_pagos_registro(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.validar_total_pagos_desde_registro() CASCADE;
DROP FUNCTION IF EXISTS public.validar_total_pagos_desde_pago() CASCADE;
DROP FUNCTION IF EXISTS public.validar_consistencia_cita_registro_id(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.validar_consistencia_desde_cita() CASCADE;
DROP FUNCTION IF EXISTS public.validar_consistencia_desde_registro() CASCADE;
DROP FUNCTION IF EXISTS public.preparar_registro_servicio() CASCADE;
DROP FUNCTION IF EXISTS public.sincronizar_montos_registro_servicio() CASCADE;
DROP FUNCTION IF EXISTS public.validar_clasificacion_mascota() CASCADE;
DROP FUNCTION IF EXISTS public.validar_servicio_principal() CASCADE;
DROP FUNCTION IF EXISTS public.cancelar_citas_por_sucursal_desactivada() CASCADE;
DROP FUNCTION IF EXISTS public.cancelar_citas_por_cliente_desactivado() CASCADE;
DROP FUNCTION IF EXISTS public.cancelar_citas_por_mascota_desactivada() CASCADE;
DROP FUNCTION IF EXISTS public.desasignar_peluquero_desactivado() CASCADE;
DROP FUNCTION IF EXISTS public.obtener_usuario_actual() CASCADE;
DROP FUNCTION IF EXISTS public.establecer_actualizado_en() CASCADE;

DROP TYPE IF EXISTS public.canal_recordatorio CASCADE;
DROP TYPE IF EXISTS public.tipo_descuento_cupon CASCADE;
DROP TYPE IF EXISTS public.estado_registro_servicio CASCADE;
DROP TYPE IF EXISTS public.estado_cita CASCADE;
DROP TYPE IF EXISTS public.origen_cita CASCADE;
DROP TYPE IF EXISTS public.especie_mascota CASCADE;
DROP TYPE IF EXISTS public.alcance_acceso CASCADE;
DROP TYPE IF EXISTS public.rol_usuario CASCADE;

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------

CREATE TYPE public.rol_usuario AS ENUM (
    'administrador',
    'propietario',
    'encargado'
);

CREATE TYPE public.alcance_acceso AS ENUM (
    'todas_las_sucursales',
    'sucursales_asignadas'
);

CREATE TYPE public.especie_mascota AS ENUM (
    'perro',
    'gato',
    'otro'
);

CREATE TYPE public.origen_cita AS ENUM (
    'telefono',
    'presencial',
    'whatsapp'
);

CREATE TYPE public.estado_cita AS ENUM (
    'programada',
    'atendida',
    'cancelada',
    'no_asistio'
);

CREATE TYPE public.estado_registro_servicio AS ENUM (
    'en_progreso',
    'completado'
);

CREATE TYPE public.tipo_descuento_cupon AS ENUM (
    'monto_fijo',
    'porcentaje'
);

CREATE TYPE public.canal_recordatorio AS ENUM (
    'whatsapp',
    'sms'
);

-- -----------------------------------------------------------------------------
-- 3. Core tables
-- -----------------------------------------------------------------------------

CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE RESTRICT,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    nombre_usuario TEXT NOT NULL
        CHECK (BTRIM(nombre_usuario) <> ''),
    telefono TEXT NULL UNIQUE
        CHECK (
            telefono IS NULL
            OR telefono ~ '^\+[1-9][0-9]{7,14}$'
        ),
    rol public.rol_usuario NOT NULL,
    alcance_acceso public.alcance_acceso NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_usuarios_nombre_usuario_lower
    ON public.usuarios (LOWER(nombre_usuario));

CREATE TABLE public.sucursales (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    direccion TEXT NOT NULL
        CHECK (BTRIM(direccion) <> ''),
    telefono TEXT NOT NULL UNIQUE
        CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$'),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_sucursales_nombre_lower
    ON public.sucursales (LOWER(nombre));

CREATE TABLE public.usuarios_sucursales (
    usuario_id UUID NOT NULL
        REFERENCES public.usuarios(id) ON DELETE CASCADE,
    sucursal_id BIGINT NOT NULL
        REFERENCES public.sucursales(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, sucursal_id)
);

CREATE INDEX ix_usuarios_sucursales_sucursal
    ON public.usuarios_sucursales (sucursal_id, usuario_id);

CREATE TABLE public.clientes (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    telefono TEXT NOT NULL UNIQUE
        CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$'),
    whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    sms_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    notas TEXT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.tamanos (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    especie public.especie_mascota NOT NULL DEFAULT 'perro',
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_tamanos_especie_nombre_lower
    ON public.tamanos (especie, LOWER(nombre));

CREATE TABLE public.mascotas (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL
        REFERENCES public.clientes(id) ON DELETE RESTRICT,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    especie public.especie_mascota NOT NULL DEFAULT 'otro',
    raza TEXT NULL,
    tamano_id BIGINT NOT NULL
        REFERENCES public.tamanos(id) ON DELETE RESTRICT,
    foto_perfil_url TEXT NULL
        CHECK (foto_perfil_url IS NULL OR BTRIM(foto_perfil_url) <> ''),
    fecha_nacimiento DATE NULL
        CHECK (
            fecha_nacimiento IS NULL
            OR fecha_nacimiento <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')::DATE
        ),
    notas_salud TEXT NULL,
    notas_comportamiento TEXT NULL,
    intervalo_preferido_dias INTEGER NULL
        CHECK (intervalo_preferido_dias IS NULL OR intervalo_preferido_dias > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_mascotas_cliente
    ON public.mascotas (cliente_id);

CREATE FUNCTION public.validar_clasificacion_mascota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.tamanos t WHERE t.id = NEW.tamano_id AND t.especie = NEW.especie AND t.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CLASIFICACION_MASCOTA_INVALIDA';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_clasificacion_mascota
BEFORE INSERT OR UPDATE OF especie, tamano_id ON public.mascotas
FOR EACH ROW EXECUTE FUNCTION public.validar_clasificacion_mascota();

CREATE TABLE public.peluqueros (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    telefono TEXT NULL UNIQUE
        CHECK (
            telefono IS NULL
            OR telefono ~ '^\+[1-9][0-9]{7,14}$'
        ),
    color_calendario TEXT NOT NULL DEFAULT '#FFFF00'
        CHECK (color_calendario ~ '^#[0-9A-Fa-f]{6}$'),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.servicios (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    intervalo_recordatorio_dias INTEGER NULL
        CHECK (
            intervalo_recordatorio_dias IS NULL
            OR intervalo_recordatorio_dias > 0
    ),
    es_adicional BOOLEAN NOT NULL DEFAULT FALSE,
    precio NUMERIC(10, 2) NULL CHECK (precio IS NULL OR precio >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_servicios_nombre_lower
    ON public.servicios (LOWER(nombre));

CREATE TABLE public.precios_servicios (
    servicio_id BIGINT NOT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT,
    especie public.especie_mascota NOT NULL,
    tamano_id BIGINT NOT NULL
        REFERENCES public.tamanos(id) ON DELETE RESTRICT,
    precio NUMERIC(10, 2) NOT NULL
        CHECK (precio > 0),
    precio_promocional NUMERIC(10, 2) NULL
        CHECK (precio_promocional IS NULL OR precio_promocional >= 0),
    duracion_minutos INTEGER NOT NULL
        CHECK (duracion_minutos > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (servicio_id, especie, tamano_id)
);

CREATE TABLE public.metodos_pago (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL
        CHECK (BTRIM(nombre) <> ''),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_metodos_pago_nombre_lower
    ON public.metodos_pago (LOWER(nombre));

CREATE TABLE public.configuracion_sistema (
    id SMALLINT PRIMARY KEY DEFAULT 1
        CHECK (id = 1),
    foto_antes_requerida BOOLEAN NOT NULL DEFAULT TRUE,
    foto_despues_requerida BOOLEAN NOT NULL DEFAULT TRUE,
    dias_anticipacion_recordatorio INTEGER NOT NULL DEFAULT 7
        CHECK (dias_anticipacion_recordatorio > 0),
    metodo_pago_cupon_id BIGINT NOT NULL
        REFERENCES public.metodos_pago(id) ON DELETE RESTRICT,
    habilitar_calificaciones BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.cupones (
    id UUID PRIMARY KEY,
    cliente_id BIGINT NOT NULL
        REFERENCES public.clientes(id) ON DELETE RESTRICT,
    servicio_id BIGINT NOT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT,
    tipo_descuento public.tipo_descuento_cupon NOT NULL,
    valor NUMERIC(10, 2) NOT NULL
        CHECK (
            valor > 0
            AND (
                tipo_descuento <> 'porcentaje'
                OR valor <= 100
            )
        ),
    fecha_expiracion DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    canjeado_en TIMESTAMPTZ NULL,
    creado_por_usuario_id UUID NOT NULL
        REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_cupones_cliente_servicio_estado
    ON public.cupones (cliente_id, servicio_id, activo, fecha_expiracion);

CREATE TABLE public.citas (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    mascota_id BIGINT NOT NULL
        REFERENCES public.mascotas(id) ON DELETE RESTRICT,
    sucursal_id BIGINT NOT NULL
        REFERENCES public.sucursales(id) ON DELETE RESTRICT,
    peluquero_id BIGINT NULL
        REFERENCES public.peluqueros(id) ON DELETE RESTRICT,
    servicio_id BIGINT NOT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT,
    creada_por_usuario_id UUID NOT NULL
        REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    inicio_programado TIMESTAMPTZ NOT NULL,
    fin_programado TIMESTAMPTZ NOT NULL,
    estado public.estado_cita NOT NULL DEFAULT 'programada',
    origen public.origen_cita NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (fin_programado > inicio_programado)
);

CREATE INDEX ix_citas_sucursal_inicio
    ON public.citas (sucursal_id, inicio_programado);

CREATE INDEX ix_citas_peluquero_inicio
    ON public.citas (peluquero_id, inicio_programado);

CREATE INDEX ix_citas_mascota_inicio
    ON public.citas (mascota_id, inicio_programado);

CREATE INDEX ix_citas_estado_inicio
    ON public.citas (estado, inicio_programado);

CREATE TABLE public.registros_servicio (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cita_id BIGINT NOT NULL UNIQUE
        REFERENCES public.citas(id) ON DELETE RESTRICT,
    servicio_id BIGINT NOT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT,
    peluquero_id BIGINT NOT NULL
        REFERENCES public.peluqueros(id) ON DELETE RESTRICT,
    tamano_id BIGINT NOT NULL
        REFERENCES public.tamanos(id) ON DELETE RESTRICT,
    usar_promocion BOOLEAN NOT NULL DEFAULT FALSE,
    cupon_id UUID NULL UNIQUE
        REFERENCES public.cupones(id) ON DELETE RESTRICT,
    estado public.estado_registro_servicio NOT NULL DEFAULT 'en_progreso',
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    inicio_real TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fin_real TIMESTAMPTZ NULL,

    heridas_visibles BOOLEAN NOT NULL DEFAULT FALSE,
    raspones BOOLEAN NOT NULL DEFAULT FALSE,
    piel_irritada BOOLEAN NOT NULL DEFAULT FALSE,
    costras BOOLEAN NOT NULL DEFAULT FALSE,
    inflamacion BOOLEAN NOT NULL DEFAULT FALSE,
    cojera BOOLEAN NOT NULL DEFAULT FALSE,
    dolor_al_tocar BOOLEAN NOT NULL DEFAULT FALSE,
    pulgas BOOLEAN NOT NULL DEFAULT FALSE,
    garrapatas BOOLEAN NOT NULL DEFAULT FALSE,
    piojos BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones_ingreso TEXT NOT NULL DEFAULT '',

    firma_ingreso_url TEXT NOT NULL
        CHECK (BTRIM(firma_ingreso_url) <> ''),
    firma_ingreso_en TIMESTAMPTZ NOT NULL,
    firma_entrega_url TEXT NULL
        CHECK (firma_entrega_url IS NULL OR BTRIM(firma_entrega_url) <> ''),
    firma_entrega_en TIMESTAMPTZ NULL,

    foto_antes_url TEXT NULL
        CHECK (foto_antes_url IS NULL OR BTRIM(foto_antes_url) <> ''),
    foto_antes_subida_en TIMESTAMPTZ NULL,
    foto_despues_url TEXT NULL
        CHECK (foto_despues_url IS NULL OR BTRIM(foto_despues_url) <> ''),
    foto_despues_subida_en TIMESTAMPTZ NULL,

    notas_servicio TEXT NULL,
    calificacion_satisfaccion SMALLINT NULL
        CHECK (
            calificacion_satisfaccion IS NULL
            OR calificacion_satisfaccion BETWEEN 0 AND 5
        ),
    comentario_satisfaccion TEXT NULL,

    precio_base NUMERIC(10, 2) NULL
        CHECK (precio_base IS NULL OR precio_base >= 0),
    descuento_cupon NUMERIC(10, 2) NOT NULL DEFAULT 0.00
        CHECK (descuento_cupon >= 0),
    monto_final NUMERIC(10, 2) NULL
        CHECK (monto_final IS NULL OR monto_final >= 0),
    monto_pagado NUMERIC(10, 2) NULL
        CHECK (monto_pagado IS NULL OR monto_pagado >= 0),

    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (fin_real IS NULL OR fin_real > inicio_real),
    CHECK (cupon_id IS NOT NULL OR descuento_cupon = 0),
    CHECK (
        monto_pagado IS NULL
        OR monto_final IS NULL
        OR monto_pagado <= monto_final
    ),
    CHECK (
        estado <> 'completado'
        OR (
            fin_real IS NOT NULL
            AND firma_entrega_url IS NOT NULL
            AND firma_entrega_en IS NOT NULL
            AND precio_base IS NOT NULL
            AND monto_final IS NOT NULL
            AND monto_pagado IS NOT NULL
            AND monto_pagado = monto_final
        )
    )
);

CREATE INDEX ix_registros_servicio_estado
    ON public.registros_servicio (estado);

CREATE INDEX ix_registros_servicio_peluquero
    ON public.registros_servicio (peluquero_id);

CREATE INDEX ix_registros_servicio_servicio
    ON public.registros_servicio (servicio_id);

CREATE TABLE public.registros_servicio_adicionales (
    registro_servicio_id BIGINT NOT NULL REFERENCES public.registros_servicio(id) ON DELETE RESTRICT,
    servicio_id BIGINT NOT NULL REFERENCES public.servicios(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    duracion_minutos INTEGER NOT NULL DEFAULT 0 CHECK (duracion_minutos >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (registro_servicio_id, servicio_id)
);

CREATE INDEX ix_registros_servicio_adicionales_servicio
    ON public.registros_servicio_adicionales (servicio_id);

CREATE TABLE public.calificaciones_groomer (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    peluquero_id BIGINT NOT NULL
        REFERENCES public.peluqueros(id) ON DELETE RESTRICT,
    mascota_id BIGINT NOT NULL
        REFERENCES public.mascotas(id) ON DELETE RESTRICT,
    registro_servicio_id BIGINT NOT NULL UNIQUE
        REFERENCES public.registros_servicio(id) ON DELETE RESTRICT,
    calificacion SMALLINT NOT NULL CHECK (calificacion BETWEEN 0 AND 5),
    calificacion_notas TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_calificaciones_groomer_peluquero
    ON public.calificaciones_groomer (peluquero_id);

CREATE INDEX ix_calificaciones_groomer_mascota
    ON public.calificaciones_groomer (mascota_id);

CREATE INDEX ix_registros_servicio_tamano
    ON public.registros_servicio (tamano_id);

CREATE TABLE public.pagos (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    registro_servicio_id BIGINT NOT NULL
        REFERENCES public.registros_servicio(id) ON DELETE RESTRICT,
    metodo_pago_id BIGINT NOT NULL
        REFERENCES public.metodos_pago(id) ON DELETE RESTRICT,
    monto NUMERIC(10, 2) NOT NULL
        CHECK (monto >= 0),
    creado_por_usuario_id UUID NOT NULL
        REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_pagos_registro_servicio
    ON public.pagos (registro_servicio_id);

CREATE TABLE public.recordatorios_citas (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cita_id BIGINT NOT NULL
        REFERENCES public.citas(id) ON DELETE RESTRICT,
    canal public.canal_recordatorio NOT NULL,
    numero_destino TEXT NOT NULL
        CHECK (numero_destino ~ '^\+[1-9][0-9]{7,14}$'),
    mensaje TEXT NOT NULL
        CHECK (BTRIM(mensaje) <> ''),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    enviado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_recordatorios_citas_cita
    ON public.recordatorios_citas (cita_id, enviado_en);

CREATE TABLE public.auditorias (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tipo_entidad TEXT NOT NULL
        CHECK (BTRIM(tipo_entidad) <> ''),
    entidad_id TEXT NOT NULL
        CHECK (BTRIM(entidad_id) <> ''),
    accion TEXT NOT NULL
        CHECK (BTRIM(accion) <> ''),
    valores_anteriores JSONB NULL,
    valores_nuevos JSONB NULL,
    sucursal_id BIGINT NULL
        REFERENCES public.sucursales(id) ON DELETE RESTRICT,
    usuario_id UUID NULL
        REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    motivo TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_auditorias_entidad
    ON public.auditorias (tipo_entidad, entidad_id, creado_en);

CREATE INDEX ix_auditorias_usuario
    ON public.auditorias (usuario_id, creado_en);

CREATE INDEX ix_auditorias_sucursal
    ON public.auditorias (sucursal_id, creado_en);

-- -----------------------------------------------------------------------------
-- 4. Shared timestamp and actor helpers
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.establecer_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.validar_servicio_principal()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.servicios s
        WHERE s.id = NEW.servicio_id
          AND s.es_adicional = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_ADICIONAL_NO_PUEDE_SER_PRINCIPAL';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_citas_validar_servicio_principal
BEFORE INSERT OR UPDATE OF servicio_id ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.validar_servicio_principal();

CREATE TRIGGER trg_registros_servicio_validar_servicio_principal
BEFORE INSERT OR UPDATE OF servicio_id ON public.registros_servicio
FOR EACH ROW EXECUTE FUNCTION public.validar_servicio_principal();

CREATE FUNCTION public.obtener_usuario_actual()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id TEXT;
BEGIN
    v_usuario_id := current_setting('app.usuario_id', TRUE);

    IF v_usuario_id IS NULL OR BTRIM(v_usuario_id) = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_usuario_id::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'app.usuario_id debe contener un UUID válido';
END;
$$;

CREATE TRIGGER trg_usuarios_actualizado_en
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_sucursales_actualizado_en
BEFORE UPDATE ON public.sucursales
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_usuarios_sucursales_actualizado_en
BEFORE UPDATE ON public.usuarios_sucursales
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_clientes_actualizado_en
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_tamanos_actualizado_en
BEFORE UPDATE ON public.tamanos
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_mascotas_actualizado_en
BEFORE UPDATE ON public.mascotas
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_peluqueros_actualizado_en
BEFORE UPDATE ON public.peluqueros
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_servicios_actualizado_en
BEFORE UPDATE ON public.servicios
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_precios_servicios_actualizado_en
BEFORE UPDATE ON public.precios_servicios
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_metodos_pago_actualizado_en
BEFORE UPDATE ON public.metodos_pago
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_configuracion_sistema_actualizado_en
BEFORE UPDATE ON public.configuracion_sistema
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_cupones_actualizado_en
BEFORE UPDATE ON public.cupones
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_citas_actualizado_en
BEFORE UPDATE ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_registros_servicio_actualizado_en
BEFORE UPDATE ON public.registros_servicio
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE TRIGGER trg_pagos_actualizado_en
BEFORE UPDATE ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

-- -----------------------------------------------------------------------------
-- 5. Automatic deactivation effects and their audits
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.cancelar_citas_por_sucursal_desactivada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.activo = TRUE AND NEW.activo = FALSE THEN
        WITH citas_objetivo AS (
            SELECT c.id
            FROM public.citas c
            WHERE c.sucursal_id = NEW.id
              AND c.estado = 'programada'
              AND c.inicio_programado > CURRENT_TIMESTAMP
            FOR UPDATE
        ),
        citas_actualizadas AS (
            UPDATE public.citas c
            SET estado = 'cancelada'
            FROM citas_objetivo o
            WHERE c.id = o.id
            RETURNING c.id
        )
        INSERT INTO public.auditorias (
            tipo_entidad,
            entidad_id,
            accion,
            valores_anteriores,
            valores_nuevos,
            usuario_id,
            motivo
        )
        SELECT
            'cita',
            ca.id::TEXT,
            'cancelacion_automatica_desactivacion_sucursal',
            JSONB_BUILD_OBJECT('estado', 'programada'),
            JSONB_BUILD_OBJECT('estado', 'cancelada', 'sucursal_id', NEW.id),
            public.obtener_usuario_actual(),
            'La sucursal fue desactivada.'
        FROM citas_actualizadas ca;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION public.cancelar_citas_por_cliente_desactivado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.activo = TRUE AND NEW.activo = FALSE THEN
        WITH citas_objetivo AS (
            SELECT c.id
            FROM public.citas c
            INNER JOIN public.mascotas m ON m.id = c.mascota_id
            WHERE m.cliente_id = NEW.id
              AND c.estado = 'programada'
              AND c.inicio_programado > CURRENT_TIMESTAMP
            FOR UPDATE OF c
        ),
        citas_actualizadas AS (
            UPDATE public.citas c
            SET estado = 'cancelada'
            FROM citas_objetivo o
            WHERE c.id = o.id
            RETURNING c.id
        )
        INSERT INTO public.auditorias (
            tipo_entidad,
            entidad_id,
            accion,
            valores_anteriores,
            valores_nuevos,
            usuario_id,
            motivo
        )
        SELECT
            'cita',
            ca.id::TEXT,
            'cancelacion_automatica_desactivacion_cliente',
            JSONB_BUILD_OBJECT('estado', 'programada'),
            JSONB_BUILD_OBJECT('estado', 'cancelada', 'cliente_id', NEW.id),
            public.obtener_usuario_actual(),
            'El cliente fue desactivado.'
        FROM citas_actualizadas ca;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION public.cancelar_citas_por_mascota_desactivada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.activo = TRUE AND NEW.activo = FALSE THEN
        WITH citas_objetivo AS (
            SELECT c.id
            FROM public.citas c
            WHERE c.mascota_id = NEW.id
              AND c.estado = 'programada'
              AND c.inicio_programado > CURRENT_TIMESTAMP
            FOR UPDATE
        ),
        citas_actualizadas AS (
            UPDATE public.citas c
            SET estado = 'cancelada'
            FROM citas_objetivo o
            WHERE c.id = o.id
            RETURNING c.id
        )
        INSERT INTO public.auditorias (
            tipo_entidad,
            entidad_id,
            accion,
            valores_anteriores,
            valores_nuevos,
            usuario_id,
            motivo
        )
        SELECT
            'cita',
            ca.id::TEXT,
            'cancelacion_automatica_desactivacion_mascota',
            JSONB_BUILD_OBJECT('estado', 'programada'),
            JSONB_BUILD_OBJECT('estado', 'cancelada', 'mascota_id', NEW.id),
            public.obtener_usuario_actual(),
            'La mascota fue desactivada.'
        FROM citas_actualizadas ca;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION public.desasignar_peluquero_desactivado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.activo = TRUE AND NEW.activo = FALSE THEN
        WITH citas_objetivo AS (
            SELECT c.id, c.peluquero_id
            FROM public.citas c
            WHERE c.peluquero_id = NEW.id
              AND c.estado = 'programada'
              AND c.inicio_programado > CURRENT_TIMESTAMP
            FOR UPDATE
        ),
        citas_actualizadas AS (
            UPDATE public.citas c
            SET peluquero_id = NULL
            FROM citas_objetivo o
            WHERE c.id = o.id
            RETURNING c.id, o.peluquero_id AS peluquero_anterior_id
        )
        INSERT INTO public.auditorias (
            tipo_entidad,
            entidad_id,
            accion,
            valores_anteriores,
            valores_nuevos,
            usuario_id,
            motivo
        )
        SELECT
            'cita',
            ca.id::TEXT,
            'desasignacion_automatica_peluquero_desactivado',
            JSONB_BUILD_OBJECT('peluquero_id', ca.peluquero_anterior_id),
            JSONB_BUILD_OBJECT('peluquero_id', NULL),
            public.obtener_usuario_actual(),
            'El peluquero fue desactivado.'
        FROM citas_actualizadas ca;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sucursal_desactivada_cancelar_citas
AFTER UPDATE OF activo ON public.sucursales
FOR EACH ROW
EXECUTE FUNCTION public.cancelar_citas_por_sucursal_desactivada();

CREATE TRIGGER trg_cliente_desactivado_cancelar_citas
AFTER UPDATE OF activo ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.cancelar_citas_por_cliente_desactivado();

CREATE TRIGGER trg_mascota_desactivada_cancelar_citas
AFTER UPDATE OF activo ON public.mascotas
FOR EACH ROW
EXECUTE FUNCTION public.cancelar_citas_por_mascota_desactivada();

CREATE TRIGGER trg_peluquero_desactivado_desasignar_citas
AFTER UPDATE OF activo ON public.peluqueros
FOR EACH ROW
EXECUTE FUNCTION public.desasignar_peluquero_desactivado();

-- -----------------------------------------------------------------------------
-- 6. Service-record preparation, completion validation and coupon redemption
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.preparar_registro_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_foto_antes_requerida BOOLEAN;
    v_foto_despues_requerida BOOLEAN;
    v_cliente_id BIGINT;
    v_cupon public.cupones%ROWTYPE;
    v_cupon_ya_vinculado_al_mismo_registro BOOLEAN := FALSE;
    v_transicion_a_completado BOOLEAN;
BEGIN
    -- Each URL timestamp is assigned by PostgreSQL only the first time that URL
    -- is populated. Later replacements keep the original timestamp.
    IF TG_OP = 'INSERT' THEN
        IF NEW.firma_ingreso_url IS NOT NULL THEN
            NEW.firma_ingreso_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.firma_ingreso_en := NULL;
        END IF;

        IF NEW.firma_entrega_url IS NOT NULL THEN
            NEW.firma_entrega_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.firma_entrega_en := NULL;
        END IF;

        IF NEW.foto_antes_url IS NOT NULL THEN
            NEW.foto_antes_subida_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.foto_antes_subida_en := NULL;
        END IF;

        IF NEW.foto_despues_url IS NOT NULL THEN
            NEW.foto_despues_subida_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.foto_despues_subida_en := NULL;
        END IF;
    ELSE
        IF OLD.firma_ingreso_en IS NOT NULL THEN
            NEW.firma_ingreso_en := OLD.firma_ingreso_en;
        ELSIF NEW.firma_ingreso_url IS NOT NULL THEN
            NEW.firma_ingreso_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.firma_ingreso_en := NULL;
        END IF;

        IF OLD.firma_entrega_en IS NOT NULL THEN
            NEW.firma_entrega_en := OLD.firma_entrega_en;
        ELSIF NEW.firma_entrega_url IS NOT NULL THEN
            NEW.firma_entrega_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.firma_entrega_en := NULL;
        END IF;

        IF OLD.foto_antes_subida_en IS NOT NULL THEN
            NEW.foto_antes_subida_en := OLD.foto_antes_subida_en;
        ELSIF NEW.foto_antes_url IS NOT NULL THEN
            NEW.foto_antes_subida_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.foto_antes_subida_en := NULL;
        END IF;

        IF OLD.foto_despues_subida_en IS NOT NULL THEN
            NEW.foto_despues_subida_en := OLD.foto_despues_subida_en;
        ELSIF NEW.foto_despues_url IS NOT NULL THEN
            NEW.foto_despues_subida_en := CURRENT_TIMESTAMP;
        ELSE
            NEW.foto_despues_subida_en := NULL;
        END IF;
    END IF;

    v_transicion_a_completado :=
        NEW.estado = 'completado'
        AND (
            TG_OP = 'INSERT'
            OR OLD.estado IS DISTINCT FROM 'completado'
        );

    -- fin_real is assigned on the first completion and is never overwritten.
    IF TG_OP = 'UPDATE' AND OLD.fin_real IS NOT NULL THEN
        NEW.fin_real := OLD.fin_real;
    ELSIF v_transicion_a_completado THEN
        NEW.fin_real := CURRENT_TIMESTAMP;
    END IF;

    IF v_transicion_a_completado THEN
        SELECT
            cs.foto_antes_requerida,
            cs.foto_despues_requerida
        INTO STRICT
            v_foto_antes_requerida,
            v_foto_despues_requerida
        FROM public.configuracion_sistema cs
        WHERE cs.id = 1;

        IF v_foto_antes_requerida
           AND (NEW.foto_antes_url IS NULL OR NEW.foto_antes_subida_en IS NULL) THEN
            RAISE EXCEPTION 'La foto antes y su timestamp son obligatorios para completar el servicio';
        END IF;

        IF v_foto_despues_requerida
           AND (NEW.foto_despues_url IS NULL OR NEW.foto_despues_subida_en IS NULL) THEN
            RAISE EXCEPTION 'La foto después y su timestamp son obligatorios para completar el servicio';
        END IF;

        IF NEW.cupon_id IS NOT NULL THEN
            SELECT *
            INTO v_cupon
            FROM public.cupones c
            WHERE c.id = NEW.cupon_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'El cupón indicado no existe';
            END IF;

            SELECT m.cliente_id
            INTO v_cliente_id
            FROM public.citas c
            INNER JOIN public.mascotas m ON m.id = c.mascota_id
            WHERE c.id = NEW.cita_id;

            IF v_cupon.cliente_id <> v_cliente_id THEN
                RAISE EXCEPTION 'El cupón no pertenece al cliente de la mascota atendida';
            END IF;

            IF v_cupon.servicio_id <> NEW.servicio_id THEN
                RAISE EXCEPTION 'El cupón no corresponde al servicio realizado';
            END IF;

            v_cupon_ya_vinculado_al_mismo_registro :=
                TG_OP = 'UPDATE'
                AND OLD.cupon_id IS NOT DISTINCT FROM NEW.cupon_id
                AND OLD.cupon_id IS NOT NULL;

            IF v_cupon.canjeado_en IS NOT NULL THEN
                IF NOT v_cupon_ya_vinculado_al_mismo_registro THEN
                    RAISE EXCEPTION 'El cupón ya fue canjeado en otro servicio';
                END IF;
            ELSE
                IF v_cupon.activo = FALSE THEN
                    RAISE EXCEPTION 'El cupón está inactivo';
                END IF;

                IF v_cupon.fecha_expiracion
                   < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')::DATE THEN
                    RAISE EXCEPTION 'El cupón está vencido';
                END IF;

                UPDATE public.cupones
                SET
                    canjeado_en = CURRENT_TIMESTAMP,
                    activo = FALSE
                WHERE id = NEW.cupon_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION 'Debe existir la fila id = 1 en configuracion_sistema';
END;
$$;

CREATE TRIGGER trg_preparar_registro_servicio
BEFORE INSERT OR UPDATE ON public.registros_servicio
FOR EACH ROW
EXECUTE FUNCTION public.preparar_registro_servicio();

CREATE FUNCTION public.sincronizar_montos_registro_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_precio NUMERIC(10, 2);
BEGIN
    SELECT CASE WHEN NEW.usar_promocion THEN COALESCE(ps.precio_promocional, ps.precio) ELSE ps.precio END INTO v_precio
    FROM public.precios_servicios ps
    INNER JOIN public.citas c ON c.id = NEW.cita_id
    INNER JOIN public.mascotas m ON m.id = c.mascota_id
    WHERE ps.servicio_id = NEW.servicio_id
      AND ps.especie = m.especie
      AND ps.tamano_id = NEW.tamano_id
      AND ps.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA';
    END IF;

    NEW.precio_base := v_precio;
    NEW.monto_final := v_precio
        + COALESCE((SELECT SUM(a.precio * a.cantidad)
                    FROM public.registros_servicio_adicionales a
                    WHERE a.registro_servicio_id = NEW.id AND a.activo = TRUE), 0)
        - NEW.descuento_cupon;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sincronizar_montos_registro_servicio
BEFORE INSERT OR UPDATE ON public.registros_servicio
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_montos_registro_servicio();

-- -----------------------------------------------------------------------------
-- 7. Deferred consistency: attended appointments and service records
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.validar_consistencia_cita_registro_id(p_cita_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado public.estado_cita;
    v_cantidad_registros INTEGER;
BEGIN
    IF p_cita_id IS NULL THEN
        RETURN;
    END IF;

    SELECT c.estado
    INTO v_estado
    FROM public.citas c
    WHERE c.id = p_cita_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO v_cantidad_registros
    FROM public.registros_servicio rs
    WHERE rs.cita_id = p_cita_id;

    IF v_estado = 'atendida' AND v_cantidad_registros <> 1 THEN
        RAISE EXCEPTION
            'La cita % está atendida y debe tener exactamente un registro de servicio',
            p_cita_id;
    END IF;

    IF v_estado <> 'atendida' AND v_cantidad_registros <> 0 THEN
        RAISE EXCEPTION
            'La cita % no está atendida y no puede tener un registro de servicio',
            p_cita_id;
    END IF;
END;
$$;

CREATE FUNCTION public.validar_consistencia_desde_cita()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.validar_consistencia_cita_registro_id(NEW.id);
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.validar_consistencia_desde_registro()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.validar_consistencia_cita_registro_id(OLD.cita_id);
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.validar_consistencia_cita_registro_id(OLD.cita_id);
        IF NEW.cita_id IS DISTINCT FROM OLD.cita_id THEN
            PERFORM public.validar_consistencia_cita_registro_id(NEW.cita_id);
        END IF;
    ELSE
        PERFORM public.validar_consistencia_cita_registro_id(NEW.cita_id);
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_validar_consistencia_desde_cita
AFTER INSERT OR UPDATE ON public.citas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validar_consistencia_desde_cita();

CREATE CONSTRAINT TRIGGER trg_validar_consistencia_desde_registro
AFTER INSERT OR UPDATE OR DELETE ON public.registros_servicio
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validar_consistencia_desde_registro();

-- -----------------------------------------------------------------------------
-- 8. Deferred consistency: payments and completed service totals
-- -----------------------------------------------------------------------------

CREATE FUNCTION public.validar_total_pagos_registro(p_registro_servicio_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_estado public.estado_registro_servicio;
    v_monto_final NUMERIC(10, 2);
    v_monto_pagado NUMERIC(10, 2);
    v_suma_pagos NUMERIC(10, 2);
BEGIN
    IF p_registro_servicio_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        rs.estado,
        rs.monto_final,
        rs.monto_pagado
    INTO
        v_estado,
        v_monto_final,
        v_monto_pagado
    FROM public.registros_servicio rs
    WHERE rs.id = p_registro_servicio_id;

    IF NOT FOUND OR v_estado <> 'completado' THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(p.monto), 0)::NUMERIC(10, 2)
    INTO v_suma_pagos
    FROM public.pagos p
    WHERE p.registro_servicio_id = p_registro_servicio_id
      AND p.activo = TRUE;

    IF v_monto_final IS NULL OR v_monto_pagado IS NULL THEN
        RAISE EXCEPTION
            'El registro de servicio % completado debe tener montos finales',
            p_registro_servicio_id;
    END IF;

    IF v_monto_pagado <> v_monto_final THEN
        RAISE EXCEPTION
            'El monto pagado debe ser igual al monto final en el registro de servicio %',
            p_registro_servicio_id;
    END IF;

    IF v_suma_pagos <> v_monto_pagado THEN
        RAISE EXCEPTION
            'La suma de pagos (%) no coincide con monto_pagado (%) en el registro de servicio %',
            v_suma_pagos,
            v_monto_pagado,
            p_registro_servicio_id;
    END IF;
END;
$$;

CREATE FUNCTION public.validar_total_pagos_desde_registro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RETURN NULL;
    END IF;

    PERFORM public.validar_total_pagos_registro(NEW.id);
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.validar_total_pagos_desde_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.validar_total_pagos_registro(OLD.registro_servicio_id);
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.validar_total_pagos_registro(OLD.registro_servicio_id);
        IF NEW.registro_servicio_id IS DISTINCT FROM OLD.registro_servicio_id THEN
            PERFORM public.validar_total_pagos_registro(NEW.registro_servicio_id);
        END IF;
    ELSE
        PERFORM public.validar_total_pagos_registro(NEW.registro_servicio_id);
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_validar_total_pagos_desde_registro
AFTER INSERT OR UPDATE ON public.registros_servicio
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validar_total_pagos_desde_registro();

CREATE CONSTRAINT TRIGGER trg_validar_total_pagos_desde_pago
AFTER INSERT OR UPDATE OR DELETE ON public.pagos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validar_total_pagos_desde_pago();

-- -----------------------------------------------------------------------------
-- 9. Initial data with stable IDs
-- -----------------------------------------------------------------------------

INSERT INTO public.tamanos (id, nombre, activo)
VALUES
    (1, 'Pequeño', TRUE),
    (2, 'Mediano', TRUE),
    (3, 'Grande', TRUE),
    (4, 'Gigante', TRUE);

INSERT INTO public.tamanos (id, especie, nombre, activo)
VALUES
    (5, 'gato', 'Pelo corto', TRUE),
    (6, 'gato', 'Pelo largo', TRUE);

INSERT INTO public.servicios (id, nombre, es_adicional, activo)
VALUES
    (1, 'Baño', FALSE, FALSE),
    (2, 'Corte de uñas', FALSE, FALSE),
    (3, 'Grooming', FALSE, FALSE),
    (4, 'Shampoo estándar', TRUE, TRUE),
    (5, 'Shampoo antipulgas', TRUE, TRUE),
    (6, 'Shampoo medicado', TRUE, TRUE),
    (7, 'Rapado', TRUE, TRUE),
    (8, 'Desenredo de nudos', TRUE, TRUE);

INSERT INTO public.metodos_pago (id, nombre, activo)
VALUES
    (1, 'Efectivo', TRUE),
    (2, 'Tarjeta', TRUE),
    (3, 'Transferencia', TRUE),
    (4, 'Cupón', TRUE);

INSERT INTO public.configuracion_sistema (
    id,
    foto_antes_requerida,
    foto_despues_requerida,
    dias_anticipacion_recordatorio,
    metodo_pago_cupon_id
)
VALUES (1, TRUE, TRUE, 7, 4);

-- -----------------------------------------------------------------------------
-- 10. Identity sequence reset
-- -----------------------------------------------------------------------------

SELECT setval(
    pg_get_serial_sequence('public.sucursales', 'id'),
    COALESCE((SELECT MAX(id) FROM public.sucursales), 1),
    EXISTS (SELECT 1 FROM public.sucursales)
);

SELECT setval(
    pg_get_serial_sequence('public.clientes', 'id'),
    COALESCE((SELECT MAX(id) FROM public.clientes), 1),
    EXISTS (SELECT 1 FROM public.clientes)
);

SELECT setval(
    pg_get_serial_sequence('public.tamanos', 'id'),
    COALESCE((SELECT MAX(id) FROM public.tamanos), 1),
    EXISTS (SELECT 1 FROM public.tamanos)
);

SELECT setval(
    pg_get_serial_sequence('public.mascotas', 'id'),
    COALESCE((SELECT MAX(id) FROM public.mascotas), 1),
    EXISTS (SELECT 1 FROM public.mascotas)
);

SELECT setval(
    pg_get_serial_sequence('public.peluqueros', 'id'),
    COALESCE((SELECT MAX(id) FROM public.peluqueros), 1),
    EXISTS (SELECT 1 FROM public.peluqueros)
);

SELECT setval(
    pg_get_serial_sequence('public.servicios', 'id'),
    COALESCE((SELECT MAX(id) FROM public.servicios), 1),
    EXISTS (SELECT 1 FROM public.servicios)
);

SELECT setval(
    pg_get_serial_sequence('public.metodos_pago', 'id'),
    COALESCE((SELECT MAX(id) FROM public.metodos_pago), 1),
    EXISTS (SELECT 1 FROM public.metodos_pago)
);

SELECT setval(
    pg_get_serial_sequence('public.citas', 'id'),
    COALESCE((SELECT MAX(id) FROM public.citas), 1),
    EXISTS (SELECT 1 FROM public.citas)
);

SELECT setval(
    pg_get_serial_sequence('public.registros_servicio', 'id'),
    COALESCE((SELECT MAX(id) FROM public.registros_servicio), 1),
    EXISTS (SELECT 1 FROM public.registros_servicio)
);

SELECT setval(
    pg_get_serial_sequence('public.calificaciones_groomer', 'id'),
    COALESCE((SELECT MAX(id) FROM public.calificaciones_groomer), 1),
    EXISTS (SELECT 1 FROM public.calificaciones_groomer)
);

SELECT setval(
    pg_get_serial_sequence('public.pagos', 'id'),
    COALESCE((SELECT MAX(id) FROM public.pagos), 1),
    EXISTS (SELECT 1 FROM public.pagos)
);

SELECT setval(
    pg_get_serial_sequence('public.recordatorios_citas', 'id'),
    COALESCE((SELECT MAX(id) FROM public.recordatorios_citas), 1),
    EXISTS (SELECT 1 FROM public.recordatorios_citas)
);

SELECT setval(
    pg_get_serial_sequence('public.auditorias', 'id'),
    COALESCE((SELECT MAX(id) FROM public.auditorias), 1),
    EXISTS (SELECT 1 FROM public.auditorias)
);

-- -----------------------------------------------------------------------------
-- 11. RLS and backend-only access
-- -----------------------------------------------------------------------------

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tamanos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peluqueros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_servicio_adicionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones_groomer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordatorios_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.usuarios,
    public.sucursales,
    public.usuarios_sucursales,
    public.clientes,
    public.tamanos,
    public.mascotas,
    public.peluqueros,
    public.servicios,
    public.precios_servicios,
    public.metodos_pago,
    public.configuracion_sistema,
    public.cupones,
    public.citas,
    public.registros_servicio,
    public.registros_servicio_adicionales,
    public.calificaciones_groomer,
    public.pagos,
    public.recordatorios_citas,
    public.auditorias
FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
    public.usuarios,
    public.sucursales,
    public.usuarios_sucursales,
    public.clientes,
    public.tamanos,
    public.mascotas,
    public.peluqueros,
    public.servicios,
    public.precios_servicios,
    public.metodos_pago,
    public.configuracion_sistema,
    public.cupones,
    public.citas,
    public.registros_servicio,
    public.registros_servicio_adicionales,
    public.calificaciones_groomer,
    public.pagos,
    public.recordatorios_citas,
    public.auditorias
TO service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE
    public.sucursales_id_seq,
    public.clientes_id_seq,
    public.tamanos_id_seq,
    public.mascotas_id_seq,
    public.peluqueros_id_seq,
    public.servicios_id_seq,
    public.metodos_pago_id_seq,
    public.citas_id_seq,
    public.registros_servicio_id_seq,
    public.calificaciones_groomer_id_seq,
    public.pagos_id_seq,
    public.recordatorios_citas_id_seq,
    public.auditorias_id_seq
FROM anon, authenticated;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE
    public.sucursales_id_seq,
    public.clientes_id_seq,
    public.tamanos_id_seq,
    public.mascotas_id_seq,
    public.peluqueros_id_seq,
    public.servicios_id_seq,
    public.metodos_pago_id_seq,
    public.citas_id_seq,
    public.registros_servicio_id_seq,
    public.calificaciones_groomer_id_seq,
    public.pagos_id_seq,
    public.recordatorios_citas_id_seq,
    public.auditorias_id_seq
TO service_role;

REVOKE ALL ON FUNCTION public.establecer_actualizado_en() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.obtener_usuario_actual() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_citas_por_sucursal_desactivada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_citas_por_cliente_desactivado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_citas_por_mascota_desactivada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desasignar_peluquero_desactivado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_registro_servicio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_montos_registro_servicio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_servicio_principal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_consistencia_cita_registro_id(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_consistencia_desde_cita() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_consistencia_desde_registro() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_total_pagos_registro(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_total_pagos_desde_registro() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_total_pagos_desde_pago() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.establecer_actualizado_en() TO service_role;
GRANT EXECUTE ON FUNCTION public.obtener_usuario_actual() TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_citas_por_sucursal_desactivada() TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_citas_por_cliente_desactivado() TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_citas_por_mascota_desactivada() TO service_role;
GRANT EXECUTE ON FUNCTION public.desasignar_peluquero_desactivado() TO service_role;
GRANT EXECUTE ON FUNCTION public.preparar_registro_servicio() TO service_role;
GRANT EXECUTE ON FUNCTION public.sincronizar_montos_registro_servicio() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_servicio_principal() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_cita_registro_id(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_cita_registro_id(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_desde_cita() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_desde_registro() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_total_pagos_registro(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_total_pagos_desde_registro() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_total_pagos_desde_pago() TO service_role;

COMMIT;
