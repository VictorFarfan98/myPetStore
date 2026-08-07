-- VERIFIED BUILD: rpc_verified_v2_20260731.sql
-- Fixes PostgreSQL composite-record INTO assignments by selecting composite rows separately.
-- Generated from the corrected rpc_fixed.sql source.

-- RPC, RLS and permission layer for the pet store grooming application.
-- IDEMPOTENT FOR ITS OWN OBJECTS: it recreates application RPC functions,
-- internal authorization helpers, policies and grants without deleting tables or data.
--
-- Execute setup.sql first.

BEGIN;

-- =============================================================================
-- 1. Remove existing application policies, RPC functions and private helpers
-- =============================================================================

DO $$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY (ARRAY[
              'usuarios', 'sucursales', 'usuarios_sucursales', 'clientes',
              'tamanos', 'mascotas', 'peluqueros', 'servicios',
              'precios_servicios', 'opciones_shampoo', 'precios_shampoo',
              'metodos_pago', 'configuracion_sistema', 'cupones', 'citas',
              'registros_servicio', 'pagos', 'recordatorios_citas', 'auditorias'
          ])
    LOOP
        EXECUTE FORMAT(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            v_policy.policyname,
            v_policy.schemaname,
            v_policy.tablename
        );
    END LOOP;
END;
$$;

DO $$
DECLARE
    v_funcion RECORD;
BEGIN
    FOR v_funcion IN
        SELECT
            n.nspname AS esquema,
            p.proname AS nombre,
            PG_GET_FUNCTION_IDENTITY_ARGUMENTS(p.oid) AS argumentos
        FROM pg_proc p
        INNER JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname ~ '^(usuarios|sucursales|usuarios_sucursales|clientes|tamanos|mascotas|peluqueros|servicios|precios_servicios|opciones_shampoo|precios_shampoo|metodos_pago|configuracion_sistema|cupones|citas|registros_servicio|pagos|recordatorios_citas|auditorias)_'
    LOOP
        EXECUTE FORMAT(
            'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
            v_funcion.esquema,
            v_funcion.nombre,
            v_funcion.argumentos
        );
    END LOOP;
END;
$$;

DROP SCHEMA IF EXISTS petstore_private CASCADE;
CREATE SCHEMA petstore_private;

-- =============================================================================
-- 2. Internal authorization, validation and audit helpers
-- =============================================================================

CREATE FUNCTION petstore_private.es_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT
        CURRENT_USER = 'service_role'
        OR COALESCE(CURRENT_SETTING('request.jwt.claim.role', TRUE), '') = 'service_role';
$$;

CREATE FUNCTION petstore_private.usuario_activo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        petstore_private.es_service_role()
        OR EXISTS (
            SELECT 1
            FROM public.usuarios u
            WHERE u.id = auth.uid()
              AND u.activo = TRUE
        );
$$;

CREATE FUNCTION petstore_private.es_admin_propietario()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        petstore_private.es_service_role()
        OR EXISTS (
            SELECT 1
            FROM public.usuarios u
            WHERE u.id = auth.uid()
              AND u.activo = TRUE
              AND u.rol IN ('administrador', 'propietario')
        );
$$;

CREATE FUNCTION petstore_private.tiene_acceso_sucursal(p_sucursal_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        petstore_private.es_service_role()
        OR EXISTS (
            SELECT 1
            FROM public.usuarios u
            WHERE u.id = auth.uid()
              AND u.activo = TRUE
              AND (
                  u.rol IN ('administrador', 'propietario')
                  OR u.alcance_acceso = 'todas_las_sucursales'
                  OR EXISTS (
                      SELECT 1
                      FROM public.usuarios_sucursales us
                      WHERE us.usuario_id = u.id
                        AND us.sucursal_id = p_sucursal_id
                        AND us.activo = TRUE
                  )
              )
        );
$$;

CREATE FUNCTION petstore_private.puede_acceder_cita(p_cita_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.citas c
        WHERE c.id = p_cita_id
          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
    );
$$;

CREATE FUNCTION petstore_private.puede_acceder_registro(p_registro_servicio_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.registros_servicio rs
        INNER JOIN public.citas c ON c.id = rs.cita_id
        WHERE rs.id = p_registro_servicio_id
          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
    );
$$;

CREATE FUNCTION petstore_private.puede_editar_pagos(p_registro_servicio_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.registros_servicio rs
        INNER JOIN public.citas c ON c.id = rs.cita_id
        WHERE rs.id = p_registro_servicio_id
          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
          AND (
              petstore_private.es_admin_propietario()
              OR rs.estado = 'en_progreso'
          )
    );
$$;

CREATE FUNCTION petstore_private.puede_acceder_pago(p_pago_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.pagos p
        INNER JOIN public.registros_servicio rs ON rs.id = p.registro_servicio_id
        INNER JOIN public.citas c ON c.id = rs.cita_id
        WHERE p.id = p_pago_id
          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
    );
$$;

CREATE FUNCTION petstore_private.puede_acceder_recordatorio(p_recordatorio_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.recordatorios_citas rc
        INNER JOIN public.citas c ON c.id = rc.cita_id
        WHERE rc.id = p_recordatorio_id
          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
    );
$$;

CREATE FUNCTION petstore_private.requerir_usuario_activo()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
BEGIN
    IF petstore_private.es_service_role() THEN
        RETURN NULL;
    END IF;

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PA001',
            MESSAGE = 'USUARIO_NO_AUTENTICADO';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = v_usuario_id
          AND u.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PA001',
            MESSAGE = 'USUARIO_INACTIVO';
    END IF;

    RETURN v_usuario_id;
END;
$$;

CREATE FUNCTION petstore_private.requerir_admin_propietario()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();

    IF NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PA001',
            MESSAGE = 'USUARIO_NO_AUTORIZADO';
    END IF;

    RETURN v_usuario_id;
END;
$$;

CREATE FUNCTION petstore_private.requerir_acceso_sucursal(p_sucursal_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();

    IF NOT petstore_private.tiene_acceso_sucursal(p_sucursal_id) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PA001',
            MESSAGE = 'SUCURSAL_NO_AUTORIZADA';
    END IF;

    RETURN v_usuario_id;
END;
$$;

CREATE FUNCTION petstore_private.establecer_actor()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
BEGIN
    PERFORM SET_CONFIG(
        'app.usuario_id',
        COALESCE(v_usuario_id::TEXT, ''),
        TRUE
    );
    RETURN v_usuario_id;
END;
$$;

CREATE FUNCTION petstore_private.validar_paginacion(
    p_limite BIGINT,
    p_offset BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_limite IS NOT NULL AND p_limite < 1 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PV001',
            MESSAGE = 'LIMITE_INVALIDO';
    END IF;

    IF p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'PV001',
            MESSAGE = 'OFFSET_INVALIDO';
    END IF;
END;
$$;

CREATE FUNCTION petstore_private.jsonb_valores_anteriores(
    p_anterior JSONB,
    p_nuevo JSONB,
    p_ignorar TEXT[] DEFAULT ARRAY['actualizado_en']::TEXT[]
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE(
        JSONB_OBJECT_AGG(k, p_anterior -> k),
        '{}'::JSONB
    )
    FROM JSONB_OBJECT_KEYS(
        COALESCE(p_anterior, '{}'::JSONB)
        || COALESCE(p_nuevo, '{}'::JSONB)
    ) AS claves(k)
    WHERE NOT (k = ANY (p_ignorar))
      AND (p_anterior -> k) IS DISTINCT FROM (p_nuevo -> k);
$$;

CREATE FUNCTION petstore_private.jsonb_valores_nuevos(
    p_anterior JSONB,
    p_nuevo JSONB,
    p_ignorar TEXT[] DEFAULT ARRAY['actualizado_en']::TEXT[]
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE(
        JSONB_OBJECT_AGG(k, p_nuevo -> k),
        '{}'::JSONB
    )
    FROM JSONB_OBJECT_KEYS(
        COALESCE(p_anterior, '{}'::JSONB)
        || COALESCE(p_nuevo, '{}'::JSONB)
    ) AS claves(k)
    WHERE NOT (k = ANY (p_ignorar))
      AND (p_anterior -> k) IS DISTINCT FROM (p_nuevo -> k);
$$;

CREATE FUNCTION petstore_private.auditar_cambio(
    p_tipo_entidad TEXT,
    p_entidad_id TEXT,
    p_accion TEXT,
    p_anterior JSONB,
    p_nuevo JSONB,
    p_sucursal_id BIGINT DEFAULT NULL,
    p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_anteriores JSONB;
    v_nuevos JSONB;
BEGIN
    IF p_anterior IS NULL THEN
        v_anteriores := NULL;
        v_nuevos := p_nuevo;
    ELSIF p_nuevo IS NULL THEN
        v_anteriores := p_anterior;
        v_nuevos := NULL;
    ELSE
        v_anteriores := petstore_private.jsonb_valores_anteriores(p_anterior, p_nuevo);
        v_nuevos := petstore_private.jsonb_valores_nuevos(p_anterior, p_nuevo);

        IF v_anteriores = '{}'::JSONB AND v_nuevos = '{}'::JSONB THEN
            RETURN;
        END IF;
    END IF;

    INSERT INTO public.auditorias (
        tipo_entidad,
        entidad_id,
        accion,
        valores_anteriores,
        valores_nuevos,
        sucursal_id,
        usuario_id,
        motivo
    )
    VALUES (
        p_tipo_entidad,
        p_entidad_id,
        p_accion,
        v_anteriores,
        v_nuevos,
        p_sucursal_id,
        public.obtener_usuario_actual(),
        p_motivo
    );
END;
$$;

-- =============================================================================
-- 3. Row Level Security policies
-- =============================================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tamanos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peluqueros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opciones_shampoo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_shampoo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordatorios_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;

-- usuarios
CREATE POLICY usuarios_select
ON public.usuarios FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.es_admin_propietario())
    OR (
        id = (SELECT auth.uid())
        AND activo = TRUE
    )
);

CREATE POLICY usuarios_insert
ON public.usuarios FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY usuarios_update
ON public.usuarios FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY usuarios_delete
ON public.usuarios FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- sucursales
CREATE POLICY sucursales_select
ON public.sucursales FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.es_admin_propietario())
    OR (
        activo = TRUE
        AND (SELECT petstore_private.tiene_acceso_sucursal(id))
    )
);

CREATE POLICY sucursales_insert
ON public.sucursales FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY sucursales_update
ON public.sucursales FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY sucursales_delete
ON public.sucursales FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- usuarios_sucursales
CREATE POLICY usuarios_sucursales_select
ON public.usuarios_sucursales FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.es_admin_propietario())
    OR (
        usuario_id = (SELECT auth.uid())
        AND activo = TRUE
    )
);

CREATE POLICY usuarios_sucursales_insert
ON public.usuarios_sucursales FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY usuarios_sucursales_update
ON public.usuarios_sucursales FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY usuarios_sucursales_delete
ON public.usuarios_sucursales FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- Shared customer and pet data
CREATE POLICY clientes_select
ON public.clientes FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY clientes_insert
ON public.clientes FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.usuario_activo()));

CREATE POLICY clientes_update
ON public.clientes FOR UPDATE TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
)
WITH CHECK ((SELECT petstore_private.usuario_activo()));

CREATE POLICY clientes_delete
ON public.clientes FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY mascotas_select
ON public.mascotas FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY mascotas_insert
ON public.mascotas FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.usuario_activo()));

CREATE POLICY mascotas_update
ON public.mascotas FOR UPDATE TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
)
WITH CHECK ((SELECT petstore_private.usuario_activo()));

CREATE POLICY mascotas_delete
ON public.mascotas FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- Catalogs: active rows are readable by staff; writes are privileged.

CREATE POLICY tamanos_select
ON public.tamanos FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY tamanos_insert
ON public.tamanos FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY tamanos_update
ON public.tamanos FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY tamanos_delete
ON public.tamanos FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY peluqueros_select
ON public.peluqueros FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY peluqueros_insert
ON public.peluqueros FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY peluqueros_update
ON public.peluqueros FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY peluqueros_delete
ON public.peluqueros FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY servicios_select
ON public.servicios FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY servicios_insert
ON public.servicios FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY servicios_update
ON public.servicios FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY servicios_delete
ON public.servicios FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY precios_servicios_select
ON public.precios_servicios FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY precios_servicios_insert
ON public.precios_servicios FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY precios_servicios_update
ON public.precios_servicios FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY precios_servicios_delete
ON public.precios_servicios FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY opciones_shampoo_select
ON public.opciones_shampoo FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY opciones_shampoo_insert
ON public.opciones_shampoo FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY opciones_shampoo_update
ON public.opciones_shampoo FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY opciones_shampoo_delete
ON public.opciones_shampoo FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY precios_shampoo_select
ON public.precios_shampoo FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY precios_shampoo_insert
ON public.precios_shampoo FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY precios_shampoo_update
ON public.precios_shampoo FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY precios_shampoo_delete
ON public.precios_shampoo FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY metodos_pago_select
ON public.metodos_pago FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY metodos_pago_insert
ON public.metodos_pago FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY metodos_pago_update
ON public.metodos_pago FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY metodos_pago_delete
ON public.metodos_pago FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- configuracion_sistema
CREATE POLICY configuracion_sistema_select
ON public.configuracion_sistema FOR SELECT TO authenticated
USING ((SELECT petstore_private.usuario_activo()));

CREATE POLICY configuracion_sistema_insert
ON public.configuracion_sistema FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY configuracion_sistema_update
ON public.configuracion_sistema FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY configuracion_sistema_delete
ON public.configuracion_sistema FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- cupones: staff can read all coupon states; only privileged roles write.
CREATE POLICY cupones_select
ON public.cupones FOR SELECT TO authenticated
USING ((SELECT petstore_private.usuario_activo()));

CREATE POLICY cupones_insert
ON public.cupones FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY cupones_update
ON public.cupones FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY cupones_delete
ON public.cupones FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- citas
CREATE POLICY citas_select
ON public.citas FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY citas_insert
ON public.citas FOR INSERT TO authenticated
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
);

CREATE POLICY citas_update
ON public.citas FOR UPDATE TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
)
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
);

CREATE POLICY citas_delete
ON public.citas FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- registros_servicio
CREATE POLICY registros_servicio_select
ON public.registros_servicio FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY registros_servicio_insert
ON public.registros_servicio FOR INSERT TO authenticated
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
);

CREATE POLICY registros_servicio_update
ON public.registros_servicio FOR UPDATE TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
    AND (
        (SELECT petstore_private.es_admin_propietario())
        OR (
            activo = TRUE
            AND (
                estado = 'en_progreso'
                OR COALESCE(CURRENT_SETTING('app.flujo_registro_servicio', TRUE), '') = 'eliminar'
            )
        )
    )
)
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
    AND (
        (SELECT petstore_private.es_admin_propietario())
        OR estado = 'en_progreso'
        OR COALESCE(CURRENT_SETTING('app.flujo_registro_servicio', TRUE), '') IN ('completar', 'eliminar')
    )
);

CREATE POLICY registros_servicio_delete
ON public.registros_servicio FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- pagos
CREATE POLICY pagos_select
ON public.pagos FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_registro(registro_servicio_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY pagos_insert
ON public.pagos FOR INSERT TO authenticated
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_editar_pagos(registro_servicio_id))
);

CREATE POLICY pagos_update
ON public.pagos FOR UPDATE TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_editar_pagos(registro_servicio_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
)
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_editar_pagos(registro_servicio_id))
);

CREATE POLICY pagos_delete
ON public.pagos FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- recordatorios_citas
CREATE POLICY recordatorios_citas_select
ON public.recordatorios_citas FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

CREATE POLICY recordatorios_citas_insert
ON public.recordatorios_citas FOR INSERT TO authenticated
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
);

CREATE POLICY recordatorios_citas_update
ON public.recordatorios_citas FOR UPDATE TO authenticated
USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
)
WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(cita_id))
);

CREATE POLICY recordatorios_citas_delete
ON public.recordatorios_citas FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

-- auditorias: read only for authenticated users.
CREATE POLICY auditorias_select
ON public.auditorias FOR SELECT TO authenticated
USING (
    (SELECT petstore_private.es_admin_propietario())
    OR (
        sucursal_id IS NOT NULL
        AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
    )
);

-- =============================================================================
-- 4. Direct table privileges under RLS
-- =============================================================================

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
    public.opciones_shampoo,
    public.precios_shampoo,
    public.metodos_pago,
    public.configuracion_sistema,
    public.cupones,
    public.citas,
    public.registros_servicio,
    public.pagos,
    public.recordatorios_citas,
    public.auditorias
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.usuarios,
    public.sucursales,
    public.usuarios_sucursales,
    public.clientes,
    public.tamanos,
    public.mascotas,
    public.peluqueros,
    public.servicios,
    public.precios_servicios,
    public.opciones_shampoo,
    public.precios_shampoo,
    public.metodos_pago,
    public.configuracion_sistema,
    public.cupones,
    public.citas,
    public.registros_servicio,
    public.pagos,
    public.recordatorios_citas
TO authenticated;

GRANT SELECT ON TABLE public.auditorias TO authenticated;

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
    public.opciones_shampoo,
    public.precios_shampoo,
    public.metodos_pago,
    public.configuracion_sistema,
    public.cupones,
    public.citas,
    public.registros_servicio,
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
    public.opciones_shampoo_id_seq,
    public.metodos_pago_id_seq,
    public.citas_id_seq,
    public.registros_servicio_id_seq,
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
    public.opciones_shampoo_id_seq,
    public.metodos_pago_id_seq,
    public.citas_id_seq,
    public.registros_servicio_id_seq,
    public.pagos_id_seq,
    public.recordatorios_citas_id_seq,
    public.auditorias_id_seq
TO authenticated, service_role;

GRANT USAGE ON SCHEMA petstore_private TO authenticated, service_role;

-- =============================================================================
-- 5. Standard CRUD functions
-- =============================================================================

-- sucursales: standard CRUD
CREATE FUNCTION public.sucursales_insertar(
    p_nombre TEXT,
    p_direccion TEXT,
    p_telefono TEXT,
    p_activo BOOLEAN
)
RETURNS public.sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.sucursales (
        nombre,
        direccion,
        telefono,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        BTRIM(p_direccion),
        BTRIM(p_telefono),
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.sucursales_obtener_por_id(p_id BIGINT)
RETURNS public.sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.sucursales;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.sucursales t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.sucursales_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.sucursales t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.sucursales_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.sucursales t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.sucursales_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_direccion TEXT,
    p_telefono TEXT,
    p_activo BOOLEAN
)
RETURNS public.sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.sucursales;
    v_fila public.sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.sucursales t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.sucursales
    SET
        nombre = BTRIM(p_nombre),
        direccion = BTRIM(p_direccion),
        telefono = BTRIM(p_telefono),
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.sucursales_eliminar(p_id BIGINT)
RETURNS public.sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.sucursales;
    v_fila public.sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.sucursales t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.sucursales
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- clientes: standard CRUD
CREATE FUNCTION public.clientes_insertar(
    p_nombre TEXT,
    p_telefono TEXT,
    p_whatsapp_opt_in BOOLEAN,
    p_sms_opt_in BOOLEAN,
    p_notas TEXT,
    p_activo BOOLEAN
)
RETURNS public.clientes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.clientes;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.clientes (
        nombre,
        telefono,
        whatsapp_opt_in,
        sms_opt_in,
        notas,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        BTRIM(p_telefono),
        p_whatsapp_opt_in,
        p_sms_opt_in,
        p_notas,
        p_activo
    )
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('clientes', v_fila.id::TEXT, 'insertar', NULL, TO_JSONB(v_fila), NULL, NULL);
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.clientes_obtener_por_id(p_id BIGINT)
RETURNS public.clientes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.clientes;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.clientes t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.clientes_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.clientes t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.clientes_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.clientes t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.clientes_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_telefono TEXT,
    p_whatsapp_opt_in BOOLEAN,
    p_sms_opt_in BOOLEAN,
    p_notas TEXT,
    p_activo BOOLEAN
)
RETURNS public.clientes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.clientes;
    v_fila public.clientes;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.clientes t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.clientes
    SET
        nombre = BTRIM(p_nombre),
        telefono = BTRIM(p_telefono),
        whatsapp_opt_in = p_whatsapp_opt_in,
        sms_opt_in = p_sms_opt_in,
        notas = p_notas,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('clientes', v_fila.id::TEXT, 'actualizar', TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL);
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.clientes_eliminar(p_id BIGINT)
RETURNS public.clientes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.clientes;
    v_fila public.clientes;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.clientes t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.clientes
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('clientes', v_fila.id::TEXT, 'eliminar_logico', TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL);
    RETURN v_fila;
END;
$$;

-- tamanos: standard CRUD
CREATE FUNCTION public.tamanos_insertar(
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.tamanos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.tamanos;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.tamanos (
        nombre,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.tamanos_obtener_por_id(p_id BIGINT)
RETURNS public.tamanos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.tamanos;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.tamanos t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.tamanos_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.tamanos t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.tamanos_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.tamanos t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.tamanos_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.tamanos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.tamanos;
    v_fila public.tamanos;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.tamanos t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.tamanos
    SET
        nombre = BTRIM(p_nombre),
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.tamanos_eliminar(p_id BIGINT)
RETURNS public.tamanos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.tamanos;
    v_fila public.tamanos;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.tamanos t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.tamanos
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- mascotas: standard CRUD
CREATE FUNCTION public.mascotas_insertar(
    p_cliente_id BIGINT,
    p_nombre TEXT,
    p_especie public.especie_mascota,
    p_raza TEXT,
    p_tamano_id BIGINT,
    p_foto_perfil_url TEXT,
    p_fecha_nacimiento DATE,
    p_notas_salud TEXT,
    p_notas_comportamiento TEXT,
    p_intervalo_preferido_dias INTEGER,
    p_activo BOOLEAN
)
RETURNS public.mascotas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.mascotas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.mascotas (
        cliente_id,
        nombre,
        especie,
        raza,
        tamano_id,
        foto_perfil_url,
        fecha_nacimiento,
        notas_salud,
        notas_comportamiento,
        intervalo_preferido_dias,
        activo
    )
    VALUES (
        p_cliente_id,
        BTRIM(p_nombre),
        p_especie,
        p_raza,
        p_tamano_id,
        p_foto_perfil_url,
        p_fecha_nacimiento,
        p_notas_salud,
        p_notas_comportamiento,
        p_intervalo_preferido_dias,
        p_activo
    )
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('mascotas', v_fila.id::TEXT, 'insertar', NULL, TO_JSONB(v_fila), NULL, NULL);
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.mascotas_obtener_por_id(p_id BIGINT)
RETURNS public.mascotas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.mascotas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.mascotas t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.mascotas_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.mascotas t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.mascotas_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.mascotas t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.mascotas_actualizar(
    p_id BIGINT,
    p_cliente_id BIGINT,
    p_nombre TEXT,
    p_especie public.especie_mascota,
    p_raza TEXT,
    p_tamano_id BIGINT,
    p_foto_perfil_url TEXT,
    p_fecha_nacimiento DATE,
    p_notas_salud TEXT,
    p_notas_comportamiento TEXT,
    p_intervalo_preferido_dias INTEGER,
    p_activo BOOLEAN
)
RETURNS public.mascotas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.mascotas;
    v_fila public.mascotas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.mascotas t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.mascotas
    SET
        cliente_id = p_cliente_id,
        nombre = BTRIM(p_nombre),
        especie = p_especie,
        raza = p_raza,
        tamano_id = p_tamano_id,
        foto_perfil_url = p_foto_perfil_url,
        fecha_nacimiento = p_fecha_nacimiento,
        notas_salud = p_notas_salud,
        notas_comportamiento = p_notas_comportamiento,
        intervalo_preferido_dias = p_intervalo_preferido_dias,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('mascotas', v_fila.id::TEXT, 'actualizar', TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL);
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.mascotas_eliminar(p_id BIGINT)
RETURNS public.mascotas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.mascotas;
    v_fila public.mascotas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.mascotas t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.mascotas
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('mascotas', v_fila.id::TEXT, 'eliminar_logico', TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL);
    RETURN v_fila;
END;
$$;

-- peluqueros: standard CRUD
CREATE FUNCTION public.peluqueros_insertar(
    p_nombre TEXT,
    p_telefono TEXT,
    p_color_calendario TEXT,
    p_activo BOOLEAN
)
RETURNS public.peluqueros
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.peluqueros;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.peluqueros (
        nombre,
        telefono,
        color_calendario,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        BTRIM(p_telefono),
        BTRIM(p_color_calendario),
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.peluqueros_obtener_por_id(p_id BIGINT)
RETURNS public.peluqueros
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.peluqueros;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.peluqueros t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.peluqueros_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.peluqueros t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.peluqueros_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.peluqueros t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.peluqueros_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_telefono TEXT,
    p_color_calendario TEXT,
    p_activo BOOLEAN
)
RETURNS public.peluqueros
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.peluqueros;
    v_fila public.peluqueros;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.peluqueros t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.peluqueros
    SET
        nombre = BTRIM(p_nombre),
        telefono = BTRIM(p_telefono),
        color_calendario = BTRIM(p_color_calendario),
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.peluqueros_eliminar(p_id BIGINT)
RETURNS public.peluqueros
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.peluqueros;
    v_fila public.peluqueros;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.peluqueros t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.peluqueros
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- servicios: standard CRUD
CREATE FUNCTION public.servicios_insertar(
    p_nombre TEXT,
    p_intervalo_recordatorio_dias INTEGER,
    p_activo BOOLEAN
)
RETURNS public.servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.servicios (
        nombre,
        intervalo_recordatorio_dias,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        p_intervalo_recordatorio_dias,
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.servicios_obtener_por_id(p_id BIGINT)
RETURNS public.servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.servicios;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.servicios t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.servicios_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.servicios t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.servicios_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.servicios t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.servicios_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_intervalo_recordatorio_dias INTEGER,
    p_activo BOOLEAN
)
RETURNS public.servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.servicios;
    v_fila public.servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.servicios t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.servicios
    SET
        nombre = BTRIM(p_nombre),
        intervalo_recordatorio_dias = p_intervalo_recordatorio_dias,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.servicios_eliminar(p_id BIGINT)
RETURNS public.servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.servicios;
    v_fila public.servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.servicios t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.servicios
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- opciones_shampoo: standard CRUD
CREATE FUNCTION public.opciones_shampoo_insertar(
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.opciones_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.opciones_shampoo;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.opciones_shampoo (
        nombre,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.opciones_shampoo_obtener_por_id(p_id BIGINT)
RETURNS public.opciones_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.opciones_shampoo;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.opciones_shampoo t
    WHERE t.id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.opciones_shampoo_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.opciones_shampoo t
        WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.opciones_shampoo_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.*
        FROM public.opciones_shampoo t
    ),
    pagina AS (
        SELECT * FROM base
        ORDER BY id ASC
        LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    )
    INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.opciones_shampoo_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.opciones_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.opciones_shampoo;
    v_fila public.opciones_shampoo;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.opciones_shampoo t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.opciones_shampoo
    SET
        nombre = BTRIM(p_nombre),
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.opciones_shampoo_eliminar(p_id BIGINT)
RETURNS public.opciones_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.opciones_shampoo;
    v_fila public.opciones_shampoo;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.opciones_shampoo t
    WHERE t.id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.opciones_shampoo
    SET activo = FALSE
    WHERE id = p_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- usuarios_sucursales: composite-key CRUD
CREATE FUNCTION public.usuarios_sucursales_insertar(
    p_usuario_id UUID,
    p_sucursal_id BIGINT,
    p_activo BOOLEAN
)
RETURNS public.usuarios_sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.usuarios_sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.usuarios_sucursales (
        usuario_id,
        sucursal_id,
        activo
    )
    VALUES (
        p_usuario_id,
        p_sucursal_id,
        p_activo
    )
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('usuarios_sucursales', p_usuario_id::TEXT || ':' || p_sucursal_id::TEXT, 'insertar', NULL, TO_JSONB(v_fila), p_sucursal_id, NULL);
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.usuarios_sucursales_obtener_por_id(
    p_usuario_id UUID,
    p_sucursal_id BIGINT
)
RETURNS public.usuarios_sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.usuarios_sucursales;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.usuarios_sucursales t
    WHERE t.usuario_id = p_usuario_id AND t.sucursal_id = p_sucursal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.usuarios_sucursales_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.* FROM public.usuarios_sucursales t WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base ORDER BY usuario_id, sucursal_id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.usuario_id, p.sucursal_id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.usuarios_sucursales_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.* FROM public.usuarios_sucursales t
    ),
    pagina AS (
        SELECT * FROM base ORDER BY usuario_id, sucursal_id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.usuario_id, p.sucursal_id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.usuarios_sucursales_actualizar(
    p_usuario_id UUID,
    p_sucursal_id BIGINT,
    p_activo BOOLEAN
)
RETURNS public.usuarios_sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.usuarios_sucursales;
    v_fila public.usuarios_sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.usuarios_sucursales t
    WHERE t.usuario_id = p_usuario_id AND t.sucursal_id = p_sucursal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.usuarios_sucursales
    SET
        activo = p_activo
    WHERE usuario_id = p_usuario_id AND sucursal_id = p_sucursal_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('usuarios_sucursales', p_usuario_id::TEXT || ':' || p_sucursal_id::TEXT, 'actualizar', TO_JSONB(v_anterior), TO_JSONB(v_fila), p_sucursal_id, NULL);
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.usuarios_sucursales_eliminar(
    p_usuario_id UUID,
    p_sucursal_id BIGINT
)
RETURNS public.usuarios_sucursales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.usuarios_sucursales;
    v_fila public.usuarios_sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.usuarios_sucursales t
    WHERE t.usuario_id = p_usuario_id AND t.sucursal_id = p_sucursal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.usuarios_sucursales
    SET activo = FALSE
    WHERE usuario_id = p_usuario_id AND sucursal_id = p_sucursal_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio('usuarios_sucursales', p_usuario_id::TEXT || ':' || p_sucursal_id::TEXT, 'eliminar_logico', TO_JSONB(v_anterior), TO_JSONB(v_fila), p_sucursal_id, NULL);
    RETURN v_fila;
END;
$$;

-- precios_servicios: composite-key CRUD
CREATE FUNCTION public.precios_servicios_insertar(
    p_servicio_id BIGINT,
    p_tamano_id BIGINT,
    p_precio NUMERIC(10, 2),
    p_duracion_minutos INTEGER,
    p_activo BOOLEAN
)
RETURNS public.precios_servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.precios_servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.precios_servicios (
        servicio_id,
        tamano_id,
        precio,
        duracion_minutos,
        activo
    )
    VALUES (
        p_servicio_id,
        p_tamano_id,
        p_precio,
        p_duracion_minutos,
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.precios_servicios_obtener_por_id(
    p_servicio_id BIGINT,
    p_tamano_id BIGINT
)
RETURNS public.precios_servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.precios_servicios;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.precios_servicios t
    WHERE t.servicio_id = p_servicio_id AND t.tamano_id = p_tamano_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.precios_servicios_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.* FROM public.precios_servicios t WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base ORDER BY servicio_id, tamano_id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.servicio_id, p.tamano_id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.precios_servicios_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.* FROM public.precios_servicios t
    ),
    pagina AS (
        SELECT * FROM base ORDER BY servicio_id, tamano_id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.servicio_id, p.tamano_id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.precios_servicios_actualizar(
    p_servicio_id BIGINT,
    p_tamano_id BIGINT,
    p_precio NUMERIC(10, 2),
    p_duracion_minutos INTEGER,
    p_activo BOOLEAN
)
RETURNS public.precios_servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.precios_servicios;
    v_fila public.precios_servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.precios_servicios t
    WHERE t.servicio_id = p_servicio_id AND t.tamano_id = p_tamano_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.precios_servicios
    SET
        precio = p_precio,
        duracion_minutos = p_duracion_minutos,
        activo = p_activo
    WHERE servicio_id = p_servicio_id AND tamano_id = p_tamano_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.precios_servicios_eliminar(
    p_servicio_id BIGINT,
    p_tamano_id BIGINT
)
RETURNS public.precios_servicios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.precios_servicios;
    v_fila public.precios_servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.precios_servicios t
    WHERE t.servicio_id = p_servicio_id AND t.tamano_id = p_tamano_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.precios_servicios
    SET activo = FALSE
    WHERE servicio_id = p_servicio_id AND tamano_id = p_tamano_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- precios_shampoo: composite-key CRUD
CREATE FUNCTION public.precios_shampoo_insertar(
    p_shampoo_id BIGINT,
    p_tamano_id BIGINT,
    p_recargo NUMERIC(10, 2),
    p_activo BOOLEAN
)
RETURNS public.precios_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.precios_shampoo;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.precios_shampoo (
        shampoo_id,
        tamano_id,
        recargo,
        activo
    )
    VALUES (
        p_shampoo_id,
        p_tamano_id,
        p_recargo,
        p_activo
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.precios_shampoo_obtener_por_id(
    p_shampoo_id BIGINT,
    p_tamano_id BIGINT
)
RETURNS public.precios_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fila public.precios_shampoo;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT t.* INTO v_fila
    FROM public.precios_shampoo t
    WHERE t.shampoo_id = p_shampoo_id AND t.tamano_id = p_tamano_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.precios_shampoo_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.* FROM public.precios_shampoo t WHERE t.activo = TRUE
    ),
    pagina AS (
        SELECT * FROM base ORDER BY shampoo_id, tamano_id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.shampoo_id, p.tamano_id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.precios_shampoo_listar_todos(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);

    WITH base AS (
        SELECT t.* FROM public.precios_shampoo t
    ),
    pagina AS (
        SELECT * FROM base ORDER BY shampoo_id, tamano_id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.shampoo_id, p.tamano_id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.precios_shampoo_actualizar(
    p_shampoo_id BIGINT,
    p_tamano_id BIGINT,
    p_recargo NUMERIC(10, 2),
    p_activo BOOLEAN
)
RETURNS public.precios_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.precios_shampoo;
    v_fila public.precios_shampoo;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.precios_shampoo t
    WHERE t.shampoo_id = p_shampoo_id AND t.tamano_id = p_tamano_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.precios_shampoo
    SET
        recargo = p_recargo,
        activo = p_activo
    WHERE shampoo_id = p_shampoo_id AND tamano_id = p_tamano_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.precios_shampoo_eliminar(
    p_shampoo_id BIGINT,
    p_tamano_id BIGINT
)
RETURNS public.precios_shampoo
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.precios_shampoo;
    v_fila public.precios_shampoo;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT t.* INTO v_anterior
    FROM public.precios_shampoo t
    WHERE t.shampoo_id = p_shampoo_id AND t.tamano_id = p_tamano_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.precios_shampoo
    SET activo = FALSE
    WHERE shampoo_id = p_shampoo_id AND tamano_id = p_tamano_id
    RETURNING * INTO v_fila;

    RETURN v_fila;
END;
$$;

-- metodos_pago
CREATE FUNCTION public.metodos_pago_insertar(
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.metodos_pago
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_fila public.metodos_pago;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    INSERT INTO public.metodos_pago(nombre, activo)
    VALUES (BTRIM(p_nombre), p_activo)
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'METODO_PAGO_DUPLICADO';
    WHEN check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.metodos_pago_obtener_por_id(p_id BIGINT)
RETURNS public.metodos_pago
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.metodos_pago;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.metodos_pago WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.metodos_pago_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.metodos_pago WHERE activo = TRUE),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.metodos_pago_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.metodos_pago),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.metodos_pago_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.metodos_pago
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.metodos_pago;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    IF p_activo = FALSE AND EXISTS (
        SELECT 1 FROM public.configuracion_sistema cs
        WHERE cs.id = 1 AND cs.metodo_pago_cupon_id = p_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'METODO_PAGO_CUPON_NO_PUEDE_DESACTIVARSE';
    END IF;

    UPDATE public.metodos_pago
    SET nombre = BTRIM(p_nombre), activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'METODO_PAGO_DUPLICADO';
END;
$$;

CREATE FUNCTION public.metodos_pago_eliminar(p_id BIGINT)
RETURNS public.metodos_pago
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.metodos_pago;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    IF EXISTS (
        SELECT 1 FROM public.configuracion_sistema cs
        WHERE cs.id = 1 AND cs.metodo_pago_cupon_id = p_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'METODO_PAGO_CUPON_NO_PUEDE_DESACTIVARSE';
    END IF;

    UPDATE public.metodos_pago SET activo = FALSE WHERE id = p_id RETURNING * INTO v_fila;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;
    RETURN v_fila;
END;
$$;

-- =============================================================================
-- 6. Users and assignments
-- =============================================================================

CREATE FUNCTION public.usuarios_insertar(
    p_id UUID,
    p_nombre TEXT,
    p_nombre_usuario TEXT,
    p_telefono TEXT,
    p_rol public.rol_usuario,
    p_alcance_acceso public.alcance_acceso,
    p_activo BOOLEAN,
    p_sucursal_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS public.usuarios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_usuario public.usuarios;
    v_sucursal_id BIGINT;
    v_asignacion public.usuarios_sucursales;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'USUARIO_AUTH_NO_ENCONTRADO';
    END IF;

    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'PERFIL_USUARIO_YA_EXISTE';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE LOWER(u.nombre_usuario) = LOWER(BTRIM(p_nombre_usuario))
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'NOMBRE_USUARIO_YA_EXISTE';
    END IF;

    IF p_alcance_acceso = 'sucursales_asignadas'
       AND COALESCE(CARDINALITY(p_sucursal_ids), 0) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_REQUERIDA';
    END IF;

    IF p_alcance_acceso = 'sucursales_asignadas' AND EXISTS (
        SELECT 1
        FROM UNNEST(p_sucursal_ids) s(id)
        LEFT JOIN public.sucursales su ON su.id = s.id AND su.activo = TRUE
        WHERE su.id IS NULL
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_INVALIDA_O_INACTIVA';
    END IF;

    INSERT INTO public.usuarios (
        id, nombre, nombre_usuario, telefono, rol, alcance_acceso, activo
    )
    VALUES (
        p_id, BTRIM(p_nombre), LOWER(BTRIM(p_nombre_usuario)),
        CASE WHEN p_telefono IS NULL THEN NULL ELSE BTRIM(p_telefono) END,
        p_rol, p_alcance_acceso, p_activo
    )
    RETURNING * INTO v_usuario;

    PERFORM petstore_private.auditar_cambio(
        'usuarios', v_usuario.id::TEXT, 'insertar', NULL, TO_JSONB(v_usuario), NULL, NULL
    );

    IF p_alcance_acceso = 'sucursales_asignadas' THEN
        FOREACH v_sucursal_id IN ARRAY p_sucursal_ids
        LOOP
            INSERT INTO public.usuarios_sucursales(usuario_id, sucursal_id, activo)
            VALUES (p_id, v_sucursal_id, TRUE)
            RETURNING * INTO v_asignacion;

            PERFORM petstore_private.auditar_cambio(
                'usuarios_sucursales',
                p_id::TEXT || ':' || v_sucursal_id::TEXT,
                'insertar',
                NULL,
                TO_JSONB(v_asignacion),
                v_sucursal_id,
                NULL
            );
        END LOOP;
    END IF;

    RETURN v_usuario;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.usuarios_obtener_por_id(p_id UUID)
RETURNS public.usuarios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_usuario public.usuarios;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_usuario FROM public.usuarios WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;
    RETURN v_usuario;
END;
$$;

CREATE FUNCTION public.usuarios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (
        SELECT u.* FROM public.usuarios u WHERE u.activo = TRUE
    ), pagina AS (
        SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.usuarios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT u.* FROM public.usuarios u),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.usuarios_actualizar(
    p_id UUID,
    p_nombre TEXT,
    p_telefono TEXT,
    p_rol public.rol_usuario,
    p_alcance_acceso public.alcance_acceso,
    p_activo BOOLEAN,
    p_sucursal_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS public.usuarios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_anterior public.usuarios;
    v_usuario public.usuarios;
    v_asignacion_anterior public.usuarios_sucursales;
    v_asignacion_nueva public.usuarios_sucursales;
    v_sucursal_id BIGINT;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior
    FROM public.usuarios
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    IF p_alcance_acceso = 'sucursales_asignadas'
       AND COALESCE(CARDINALITY(p_sucursal_ids), 0) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_REQUERIDA';
    END IF;

    IF p_alcance_acceso = 'sucursales_asignadas' AND EXISTS (
        SELECT 1
        FROM UNNEST(p_sucursal_ids) s(id)
        LEFT JOIN public.sucursales su ON su.id = s.id AND su.activo = TRUE
        WHERE su.id IS NULL
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_INVALIDA_O_INACTIVA';
    END IF;

    UPDATE public.usuarios
    SET
        nombre = BTRIM(p_nombre),
        telefono = CASE WHEN p_telefono IS NULL THEN NULL ELSE BTRIM(p_telefono) END,
        rol = p_rol,
        alcance_acceso = p_alcance_acceso,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_usuario;

    PERFORM petstore_private.auditar_cambio(
        'usuarios', p_id::TEXT, 'actualizar', TO_JSONB(v_anterior), TO_JSONB(v_usuario), NULL, NULL
    );

    FOR v_asignacion_anterior IN
        SELECT * FROM public.usuarios_sucursales
        WHERE usuario_id = p_id AND activo = TRUE
        FOR UPDATE
    LOOP
        IF p_alcance_acceso = 'todas_las_sucursales'
           OR NOT (v_asignacion_anterior.sucursal_id = ANY(p_sucursal_ids)) THEN
            UPDATE public.usuarios_sucursales
            SET activo = FALSE
            WHERE usuario_id = p_id
              AND sucursal_id = v_asignacion_anterior.sucursal_id
            RETURNING * INTO v_asignacion_nueva;

            PERFORM petstore_private.auditar_cambio(
                'usuarios_sucursales',
                p_id::TEXT || ':' || v_asignacion_anterior.sucursal_id::TEXT,
                'actualizar',
                TO_JSONB(v_asignacion_anterior),
                TO_JSONB(v_asignacion_nueva),
                v_asignacion_anterior.sucursal_id,
                NULL
            );
        END IF;
    END LOOP;

    IF p_alcance_acceso = 'sucursales_asignadas' THEN
        FOREACH v_sucursal_id IN ARRAY p_sucursal_ids
        LOOP
            SELECT * INTO v_asignacion_anterior
            FROM public.usuarios_sucursales
            WHERE usuario_id = p_id AND sucursal_id = v_sucursal_id
            FOR UPDATE;

            IF FOUND THEN
                UPDATE public.usuarios_sucursales
                SET activo = TRUE
                WHERE usuario_id = p_id AND sucursal_id = v_sucursal_id
                RETURNING * INTO v_asignacion_nueva;

                PERFORM petstore_private.auditar_cambio(
                    'usuarios_sucursales',
                    p_id::TEXT || ':' || v_sucursal_id::TEXT,
                    'actualizar',
                    TO_JSONB(v_asignacion_anterior),
                    TO_JSONB(v_asignacion_nueva),
                    v_sucursal_id,
                    NULL
                );
            ELSE
                INSERT INTO public.usuarios_sucursales(usuario_id, sucursal_id, activo)
                VALUES (p_id, v_sucursal_id, TRUE)
                RETURNING * INTO v_asignacion_nueva;

                PERFORM petstore_private.auditar_cambio(
                    'usuarios_sucursales',
                    p_id::TEXT || ':' || v_sucursal_id::TEXT,
                    'insertar',
                    NULL,
                    TO_JSONB(v_asignacion_nueva),
                    v_sucursal_id,
                    NULL
                );
            END IF;
        END LOOP;
    END IF;

    RETURN v_usuario;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.usuarios_eliminar(p_id UUID)
RETURNS public.usuarios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.usuarios;
    v_usuario public.usuarios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior FROM public.usuarios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    UPDATE public.usuarios SET activo = FALSE WHERE id = p_id RETURNING * INTO v_usuario;
    PERFORM petstore_private.auditar_cambio(
        'usuarios', p_id::TEXT, 'eliminar_logico', TO_JSONB(v_anterior), TO_JSONB(v_usuario), NULL, NULL
    );
    RETURN v_usuario;
END;
$$;

CREATE FUNCTION public.usuarios_obtener_perfil_actual()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID;
    v_resultado JSONB;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_NO_AUTENTICADO';
    END IF;

    SELECT TO_JSONB(u) || JSONB_BUILD_OBJECT(
        'sucursales', COALESCE((
            SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'usuario_id', us.usuario_id,
                    'sucursal_id', us.sucursal_id,
                    'sucursal', TO_JSONB(s)
                ) ORDER BY s.id
            )
            FROM public.usuarios_sucursales us
            INNER JOIN public.sucursales s ON s.id = us.sucursal_id
            WHERE us.usuario_id = u.id
              AND us.activo = TRUE
              AND s.activo = TRUE
        ), '[]'::JSONB)
    )
    INTO v_resultado
    FROM public.usuarios u
    WHERE u.id = v_usuario_id
      AND u.activo = TRUE;

    IF v_resultado IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_INACTIVO';
    END IF;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.usuarios_listar_disponibles_para_asignacion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();

    SELECT COALESCE(JSONB_AGG(TO_JSONB(u) ORDER BY u.nombre, u.id), '[]'::JSONB)
    INTO v_resultado
    FROM public.usuarios u
    WHERE u.activo = TRUE
      AND u.alcance_acceso = 'sucursales_asignadas';

    RETURN v_resultado;
END;
$$;

-- =============================================================================
-- 7. System configuration and coupons
-- =============================================================================

CREATE FUNCTION public.configuracion_sistema_obtener()
RETURNS public.configuracion_sistema
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.configuracion_sistema;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.configuracion_sistema WHERE id = 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_SISTEMA_NO_ENCONTRADA';
    END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.configuracion_sistema_actualizar(
    p_foto_antes_requerida BOOLEAN,
    p_foto_despues_requerida BOOLEAN,
    p_dias_anticipacion_recordatorio INTEGER,
    p_metodo_pago_cupon_id BIGINT
)
RETURNS public.configuracion_sistema
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.configuracion_sistema;
    v_fila public.configuracion_sistema;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    IF NOT EXISTS (
        SELECT 1 FROM public.metodos_pago mp
        WHERE mp.id = p_metodo_pago_cupon_id AND mp.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'METODO_PAGO_CUPON_INVALIDO';
    END IF;

    SELECT * INTO v_anterior
    FROM public.configuracion_sistema
    WHERE id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_SISTEMA_NO_ENCONTRADA';
    END IF;

    UPDATE public.configuracion_sistema
    SET
        foto_antes_requerida = p_foto_antes_requerida,
        foto_despues_requerida = p_foto_despues_requerida,
        dias_anticipacion_recordatorio = p_dias_anticipacion_recordatorio,
        metodo_pago_cupon_id = p_metodo_pago_cupon_id
    WHERE id = 1
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'configuracion_sistema', '1', 'actualizar',
        TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL
    );

    RETURN v_fila;
EXCEPTION
    WHEN check_violation OR not_null_violation OR foreign_key_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.cupones_insertar(
    p_id UUID,
    p_cliente_id BIGINT,
    p_servicio_id BIGINT,
    p_tipo_descuento public.tipo_descuento_cupon,
    p_valor NUMERIC(10, 2),
    p_fecha_expiracion DATE,
    p_activo BOOLEAN
)
RETURNS public.cupones
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_fila public.cupones;
BEGIN
    v_actor := petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_REQUERIDO';
    END IF;

    IF p_fecha_expiracion < (CLOCK_TIMESTAMP() AT TIME ZONE 'America/Guatemala')::DATE THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'FECHA_EXPIRACION_INVALIDA';
    END IF;

    INSERT INTO public.cupones (
        id, cliente_id, servicio_id, tipo_descuento, valor,
        fecha_expiracion, activo, creado_por_usuario_id
    )
    VALUES (
        p_id, p_cliente_id, p_servicio_id, p_tipo_descuento, p_valor,
        p_fecha_expiracion, p_activo, v_actor
    )
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'cupones', v_fila.id::TEXT, 'insertar', NULL, TO_JSONB(v_fila), NULL, NULL
    );

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CUPON_YA_EXISTE';
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.cupones_obtener_por_id(p_id UUID)
RETURNS public.cupones
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.cupones;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.cupones WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.cupones_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.cupones WHERE activo = TRUE),
    pagina AS (SELECT * FROM base ORDER BY creado_en DESC, id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en DESC, p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.cupones_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.cupones),
    pagina AS (SELECT * FROM base ORDER BY creado_en DESC, id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en DESC, p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.cupones_actualizar(
    p_id UUID,
    p_cliente_id BIGINT,
    p_servicio_id BIGINT,
    p_tipo_descuento public.tipo_descuento_cupon,
    p_valor NUMERIC(10, 2),
    p_fecha_expiracion DATE,
    p_activo BOOLEAN
)
RETURNS public.cupones
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.cupones;
    v_fila public.cupones;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior FROM public.cupones WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    IF v_anterior.canjeado_en IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'CUPON_CANJEADO_INMUTABLE';
    END IF;

    IF p_fecha_expiracion < (CLOCK_TIMESTAMP() AT TIME ZONE 'America/Guatemala')::DATE THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'FECHA_EXPIRACION_INVALIDA';
    END IF;

    UPDATE public.cupones
    SET
        cliente_id = p_cliente_id,
        servicio_id = p_servicio_id,
        tipo_descuento = p_tipo_descuento,
        valor = p_valor,
        fecha_expiracion = p_fecha_expiracion,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'cupones', p_id::TEXT, 'actualizar', TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL
    );

    RETURN v_fila;
EXCEPTION
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.cupones_eliminar(p_id UUID)
RETURNS public.cupones
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_anterior public.cupones; v_fila public.cupones;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    SELECT * INTO v_anterior FROM public.cupones WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    UPDATE public.cupones SET activo = FALSE WHERE id = p_id RETURNING * INTO v_fila;
    PERFORM petstore_private.auditar_cambio(
        'cupones', p_id::TEXT, 'eliminar_logico', TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.cupones_listar_por_cliente(p_cliente_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_cliente public.clientes;
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CLIENTE_NO_ENCONTRADO';
    END IF;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(c) ORDER BY c.creado_en DESC, c.id), '[]'::JSONB)
    INTO v_resultado
    FROM public.cupones c
    WHERE c.cliente_id = p_cliente_id;

    RETURN v_resultado;
END;
$$;

-- =============================================================================
-- 8. Appointments
-- =============================================================================

CREATE FUNCTION public.citas_insertar(
    p_mascota_id BIGINT,
    p_sucursal_id BIGINT,
    p_peluquero_id BIGINT,
    p_servicio_id BIGINT,
    p_inicio_programado TIMESTAMPTZ,
    p_origen public.origen_cita
)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_tamano_id BIGINT;
    v_duracion INTEGER;
    v_fila public.citas;
BEGIN
    v_actor := petstore_private.requerir_acceso_sucursal(p_sucursal_id);
    PERFORM petstore_private.establecer_actor();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_REQUERIDO';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sucursales s WHERE s.id = p_sucursal_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_INACTIVA_O_INVALIDA';
    END IF;

    SELECT m.tamano_id INTO v_tamano_id
    FROM public.mascotas m
    INNER JOIN public.clientes c ON c.id = m.cliente_id
    WHERE m.id = p_mascota_id AND m.activo = TRUE AND c.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MASCOTA_INACTIVA_O_INVALIDA';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;

    IF p_peluquero_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;

    SELECT ps.duracion_minutos INTO v_duracion
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = p_servicio_id
      AND ps.tamano_id = v_tamano_id
      AND ps.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA';
    END IF;

    INSERT INTO public.citas (
        mascota_id, sucursal_id, peluquero_id, servicio_id,
        creada_por_usuario_id, inicio_programado, fin_programado,
        estado, origen, activo
    )
    VALUES (
        p_mascota_id, p_sucursal_id, p_peluquero_id, p_servicio_id,
        v_actor, p_inicio_programado,
        p_inicio_programado + MAKE_INTERVAL(mins => v_duracion),
        'programada', p_origen, TRUE
    )
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'citas', v_fila.id::TEXT, 'insertar', NULL, TO_JSONB(v_fila), v_fila.sucursal_id, NULL
    );
    RETURN v_fila;
EXCEPTION
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.citas_obtener_por_id(p_id BIGINT)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.citas WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.citas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.citas WHERE activo = TRUE),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.citas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.citas),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.citas_actualizar(
    p_id BIGINT,
    p_mascota_id BIGINT,
    p_sucursal_id BIGINT,
    p_peluquero_id BIGINT,
    p_servicio_id BIGINT,
    p_inicio_programado TIMESTAMPTZ,
    p_fin_programado TIMESTAMPTZ,
    p_estado public.estado_cita,
    p_origen public.origen_cita,
    p_activo BOOLEAN
)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.citas;
    v_fila public.citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior FROM public.citas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;

    PERFORM petstore_private.requerir_acceso_sucursal(v_anterior.sucursal_id);
    PERFORM petstore_private.requerir_acceso_sucursal(p_sucursal_id);

    UPDATE public.citas
    SET
        mascota_id = p_mascota_id,
        sucursal_id = p_sucursal_id,
        peluquero_id = p_peluquero_id,
        servicio_id = p_servicio_id,
        inicio_programado = p_inicio_programado,
        fin_programado = p_fin_programado,
        estado = p_estado,
        origen = p_origen,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'citas', p_id::TEXT, 'actualizar', TO_JSONB(v_anterior), TO_JSONB(v_fila), v_fila.sucursal_id, NULL
    );
    RETURN v_fila;
EXCEPTION
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.citas_eliminar(p_id BIGINT)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_anterior public.citas; v_fila public.citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    SELECT * INTO v_anterior FROM public.citas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    PERFORM petstore_private.requerir_acceso_sucursal(v_anterior.sucursal_id);
    UPDATE public.citas SET activo = FALSE WHERE id = p_id RETURNING * INTO v_fila;
    PERFORM petstore_private.auditar_cambio(
        'citas', p_id::TEXT, 'eliminar_logico', TO_JSONB(v_anterior), TO_JSONB(v_fila), v_fila.sucursal_id, NULL
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.citas_reprogramar(
    p_cita_id BIGINT,
    p_inicio_programado TIMESTAMPTZ,
    p_servicio_id BIGINT,
    p_peluquero_id BIGINT
)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.citas;
    v_fila public.citas;
    v_tamano_id BIGINT;
    v_duracion INTEGER;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior FROM public.citas WHERE id = p_cita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    PERFORM petstore_private.requerir_acceso_sucursal(v_anterior.sucursal_id);

    SELECT m.tamano_id INTO v_tamano_id FROM public.mascotas m WHERE m.id = v_anterior.mascota_id AND m.activo = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MASCOTA_INACTIVA_O_INVALIDA'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;
    IF p_peluquero_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;

    SELECT ps.duracion_minutos INTO v_duracion
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = p_servicio_id AND ps.tamano_id = v_tamano_id AND ps.activo = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA'; END IF;

    UPDATE public.citas
    SET
        inicio_programado = p_inicio_programado,
        fin_programado = p_inicio_programado + MAKE_INTERVAL(mins => v_duracion),
        servicio_id = p_servicio_id,
        peluquero_id = p_peluquero_id
    WHERE id = p_cita_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'citas', p_cita_id::TEXT, 'reprogramar', TO_JSONB(v_anterior), TO_JSONB(v_fila), v_fila.sucursal_id, NULL
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.citas_cancelar(p_cita_id BIGINT, p_motivo TEXT)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_anterior public.citas; v_fila public.citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MOTIVO_REQUERIDO';
    END IF;
    SELECT * INTO v_anterior FROM public.citas WHERE id = p_cita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    PERFORM petstore_private.requerir_acceso_sucursal(v_anterior.sucursal_id);
    UPDATE public.citas SET estado = 'cancelada' WHERE id = p_cita_id RETURNING * INTO v_fila;
    PERFORM petstore_private.auditar_cambio(
        'citas', p_cita_id::TEXT, 'cancelar', TO_JSONB(v_anterior), TO_JSONB(v_fila), v_fila.sucursal_id, BTRIM(p_motivo)
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.citas_marcar_no_asistio(p_cita_id BIGINT, p_motivo TEXT)
RETURNS public.citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_anterior public.citas; v_fila public.citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MOTIVO_REQUERIDO';
    END IF;
    SELECT * INTO v_anterior FROM public.citas WHERE id = p_cita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    PERFORM petstore_private.requerir_acceso_sucursal(v_anterior.sucursal_id);
    UPDATE public.citas SET estado = 'no_asistio' WHERE id = p_cita_id RETURNING * INTO v_fila;
    PERFORM petstore_private.auditar_cambio(
        'citas', p_cita_id::TEXT, 'marcar_no_asistio', TO_JSONB(v_anterior), TO_JSONB(v_fila), v_fila.sucursal_id, BTRIM(p_motivo)
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.citas_obtener_agenda(
    p_sucursal_id BIGINT,
    p_fecha_desde TIMESTAMPTZ,
    p_fecha_hasta TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    IF p_fecha_desde IS NULL OR p_fecha_hasta IS NULL OR p_fecha_hasta <= p_fecha_desde THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'RANGO_FECHAS_INVALIDO';
    END IF;
    IF p_sucursal_id IS NOT NULL THEN
        PERFORM petstore_private.requerir_acceso_sucursal(p_sucursal_id);
    END IF;

    SELECT COALESCE(JSONB_AGG(fila ORDER BY inicio_programado, id), '[]'::JSONB)
    INTO v_resultado
    FROM (
        SELECT
            c.id,
            c.inicio_programado,
            c.fin_programado,
            c.estado,
            c.origen,
            c.activo,
            JSONB_BUILD_OBJECT(
                'id', m.id,
                'nombre', m.nombre,
                'especie', m.especie,
                'tamano', TO_JSONB(t),
                'cliente', JSONB_BUILD_OBJECT('id', cl.id, 'nombre', cl.nombre, 'telefono', cl.telefono)
            ) AS mascota,
            TO_JSONB(s) AS sucursal,
            CASE WHEN p.id IS NULL THEN NULL ELSE TO_JSONB(p) END AS peluquero,
            TO_JSONB(se) AS servicio,
            CASE WHEN rs.id IS NULL THEN NULL ELSE JSONB_BUILD_OBJECT(
                'id', rs.id, 'estado', rs.estado, 'activo', rs.activo,
                'inicio_real', rs.inicio_real, 'fin_real', rs.fin_real,
                'monto_final', rs.monto_final, 'monto_pagado', rs.monto_pagado
            ) END AS registro_servicio
        FROM public.citas c
        INNER JOIN public.mascotas m ON m.id = c.mascota_id
        INNER JOIN public.clientes cl ON cl.id = m.cliente_id
        INNER JOIN public.tamanos t ON t.id = m.tamano_id
        INNER JOIN public.sucursales s ON s.id = c.sucursal_id
        LEFT JOIN public.peluqueros p ON p.id = c.peluquero_id
        INNER JOIN public.servicios se ON se.id = c.servicio_id
        LEFT JOIN public.registros_servicio rs ON rs.cita_id = c.id
        WHERE c.activo = TRUE
          AND c.inicio_programado >= p_fecha_desde
          AND c.inicio_programado < p_fecha_hasta
          AND (p_sucursal_id IS NULL OR c.sucursal_id = p_sucursal_id)
    ) fila;

    RETURN v_resultado;
END;
$$;

-- =============================================================================
-- 9. Service records and payments
-- =============================================================================

CREATE FUNCTION public.registros_servicio_insertar(
    p_cita_id BIGINT,
    p_servicio_id BIGINT,
    p_peluquero_id BIGINT,
    p_tamano_id BIGINT,
    p_shampoo_id BIGINT,
    p_heridas_visibles BOOLEAN,
    p_raspones BOOLEAN,
    p_piel_irritada BOOLEAN,
    p_costras BOOLEAN,
    p_inflamacion BOOLEAN,
    p_cojera BOOLEAN,
    p_dolor_al_tocar BOOLEAN,
    p_pulgas BOOLEAN,
    p_garrapatas BOOLEAN,
    p_piojos BOOLEAN,
    p_observaciones_ingreso TEXT,
    p_firma_ingreso_url TEXT,
    p_foto_antes_url TEXT,
    p_notas_servicio TEXT
)
RETURNS public.registros_servicio
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_cita_anterior public.citas;
    v_cita_nueva public.citas;
    v_mascota_anterior public.mascotas;
    v_mascota_nueva public.mascotas;
    v_registro public.registros_servicio;
    v_duracion INTEGER;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_cita_anterior
    FROM public.citas
    WHERE id = p_cita_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CITA_NO_ENCONTRADA';
    END IF;

    PERFORM petstore_private.requerir_acceso_sucursal(v_cita_anterior.sucursal_id);

    IF NOT EXISTS (
        SELECT 1 FROM public.sucursales s
        WHERE s.id = v_cita_anterior.sucursal_id AND s.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_INACTIVA_O_INVALIDA';
    END IF;

    SELECT * INTO v_mascota_anterior
    FROM public.mascotas m
    WHERE m.id = v_cita_anterior.mascota_id
      AND m.activo = TRUE
      AND EXISTS (
          SELECT 1 FROM public.clientes c
          WHERE c.id = m.cliente_id AND c.activo = TRUE
      )
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MASCOTA_INACTIVA_O_INVALIDA';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tamanos t WHERE t.id = p_tamano_id AND t.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TAMANO_INACTIVO_O_INVALIDO';
    END IF;
    IF p_shampoo_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.opciones_shampoo os WHERE os.id = p_shampoo_id AND os.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SHAMPOO_INACTIVO_O_INVALIDO';
    END IF;

    SELECT ps.duracion_minutos INTO v_duracion
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = p_servicio_id
      AND ps.tamano_id = p_tamano_id
      AND ps.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA';
    END IF;

    UPDATE public.mascotas
    SET tamano_id = p_tamano_id
    WHERE id = v_mascota_anterior.id
    RETURNING * INTO v_mascota_nueva;

    UPDATE public.citas
    SET
        servicio_id = p_servicio_id,
        peluquero_id = p_peluquero_id,
        fin_programado = inicio_programado + MAKE_INTERVAL(mins => v_duracion),
        estado = 'atendida'
    WHERE id = p_cita_id
    RETURNING * INTO v_cita_nueva;

    INSERT INTO public.registros_servicio (
        cita_id, servicio_id, peluquero_id, tamano_id, shampoo_id,
        heridas_visibles, raspones, piel_irritada, costras, inflamacion,
        cojera, dolor_al_tocar, pulgas, garrapatas, piojos,
        observaciones_ingreso, firma_ingreso_url, foto_antes_url,
        notas_servicio, estado, activo
    )
    VALUES (
        p_cita_id, p_servicio_id, p_peluquero_id, p_tamano_id, p_shampoo_id,
        p_heridas_visibles, p_raspones, p_piel_irritada, p_costras, p_inflamacion,
        p_cojera, p_dolor_al_tocar, p_pulgas, p_garrapatas, p_piojos,
        COALESCE(p_observaciones_ingreso, ''), p_firma_ingreso_url, p_foto_antes_url,
        p_notas_servicio, 'en_progreso', TRUE
    )
    RETURNING * INTO v_registro;

    PERFORM petstore_private.auditar_cambio(
        'mascotas', v_mascota_nueva.id::TEXT, 'actualizar',
        TO_JSONB(v_mascota_anterior), TO_JSONB(v_mascota_nueva), NULL, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'citas', v_cita_nueva.id::TEXT, 'iniciar_atencion',
        TO_JSONB(v_cita_anterior), TO_JSONB(v_cita_nueva), v_cita_nueva.sucursal_id, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'registros_servicio', v_registro.id::TEXT, 'insertar',
        NULL, TO_JSONB(v_registro), v_cita_nueva.sucursal_id, NULL
    );

    RETURN v_registro;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CITA_YA_TIENE_REGISTRO_SERVICIO';
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.registros_servicio_iniciar(
    p_cita_id BIGINT,
    p_servicio_id BIGINT,
    p_peluquero_id BIGINT,
    p_tamano_id BIGINT,
    p_shampoo_id BIGINT,
    p_heridas_visibles BOOLEAN,
    p_raspones BOOLEAN,
    p_piel_irritada BOOLEAN,
    p_costras BOOLEAN,
    p_inflamacion BOOLEAN,
    p_cojera BOOLEAN,
    p_dolor_al_tocar BOOLEAN,
    p_pulgas BOOLEAN,
    p_garrapatas BOOLEAN,
    p_piojos BOOLEAN,
    p_observaciones_ingreso TEXT,
    p_firma_ingreso_url TEXT,
    p_foto_antes_url TEXT,
    p_notas_servicio TEXT
)
RETURNS public.registros_servicio
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_cita_anterior public.citas;
    v_cita_nueva public.citas;
    v_mascota_anterior public.mascotas;
    v_mascota_nueva public.mascotas;
    v_registro public.registros_servicio;
    v_duracion INTEGER;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_cita_anterior
    FROM public.citas
    WHERE id = p_cita_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CITA_NO_ENCONTRADA';
    END IF;

    PERFORM petstore_private.requerir_acceso_sucursal(v_cita_anterior.sucursal_id);

    IF NOT EXISTS (
        SELECT 1 FROM public.sucursales s
        WHERE s.id = v_cita_anterior.sucursal_id AND s.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SUCURSAL_INACTIVA_O_INVALIDA';
    END IF;

    SELECT * INTO v_mascota_anterior
    FROM public.mascotas m
    WHERE m.id = v_cita_anterior.mascota_id
      AND m.activo = TRUE
      AND EXISTS (
          SELECT 1 FROM public.clientes c
          WHERE c.id = m.cliente_id AND c.activo = TRUE
      )
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MASCOTA_INACTIVA_O_INVALIDA';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tamanos t WHERE t.id = p_tamano_id AND t.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TAMANO_INACTIVO_O_INVALIDO';
    END IF;
    IF p_shampoo_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.opciones_shampoo os WHERE os.id = p_shampoo_id AND os.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SHAMPOO_INACTIVO_O_INVALIDO';
    END IF;

    SELECT ps.duracion_minutos INTO v_duracion
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = p_servicio_id
      AND ps.tamano_id = p_tamano_id
      AND ps.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA';
    END IF;

    UPDATE public.mascotas
    SET tamano_id = p_tamano_id
    WHERE id = v_mascota_anterior.id
    RETURNING * INTO v_mascota_nueva;

    UPDATE public.citas
    SET
        servicio_id = p_servicio_id,
        peluquero_id = p_peluquero_id,
        fin_programado = inicio_programado + MAKE_INTERVAL(mins => v_duracion),
        estado = 'atendida'
    WHERE id = p_cita_id
    RETURNING * INTO v_cita_nueva;

    INSERT INTO public.registros_servicio (
        cita_id, servicio_id, peluquero_id, tamano_id, shampoo_id,
        heridas_visibles, raspones, piel_irritada, costras, inflamacion,
        cojera, dolor_al_tocar, pulgas, garrapatas, piojos,
        observaciones_ingreso, firma_ingreso_url, foto_antes_url,
        notas_servicio, estado, activo
    )
    VALUES (
        p_cita_id, p_servicio_id, p_peluquero_id, p_tamano_id, p_shampoo_id,
        p_heridas_visibles, p_raspones, p_piel_irritada, p_costras, p_inflamacion,
        p_cojera, p_dolor_al_tocar, p_pulgas, p_garrapatas, p_piojos,
        COALESCE(p_observaciones_ingreso, ''), p_firma_ingreso_url, p_foto_antes_url,
        p_notas_servicio, 'en_progreso', TRUE
    )
    RETURNING * INTO v_registro;

    PERFORM petstore_private.auditar_cambio(
        'mascotas', v_mascota_nueva.id::TEXT, 'actualizar',
        TO_JSONB(v_mascota_anterior), TO_JSONB(v_mascota_nueva), NULL, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'citas', v_cita_nueva.id::TEXT, 'iniciar_atencion',
        TO_JSONB(v_cita_anterior), TO_JSONB(v_cita_nueva), v_cita_nueva.sucursal_id, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'registros_servicio', v_registro.id::TEXT, 'insertar',
        NULL, TO_JSONB(v_registro), v_cita_nueva.sucursal_id, NULL
    );

    RETURN v_registro;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CITA_YA_TIENE_REGISTRO_SERVICIO';
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.registros_servicio_obtener_por_id(p_id BIGINT)
RETURNS public.registros_servicio
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.registros_servicio;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.registros_servicio WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.registros_servicio_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.registros_servicio WHERE activo = TRUE),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.registros_servicio_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.registros_servicio),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.registros_servicio_actualizar(
    p_id BIGINT,
    p_servicio_id BIGINT,
    p_peluquero_id BIGINT,
    p_tamano_id BIGINT,
    p_shampoo_id BIGINT,
    p_cupon_id UUID,
    p_heridas_visibles BOOLEAN,
    p_raspones BOOLEAN,
    p_piel_irritada BOOLEAN,
    p_costras BOOLEAN,
    p_inflamacion BOOLEAN,
    p_cojera BOOLEAN,
    p_dolor_al_tocar BOOLEAN,
    p_pulgas BOOLEAN,
    p_garrapatas BOOLEAN,
    p_piojos BOOLEAN,
    p_observaciones_ingreso TEXT,
    p_firma_ingreso_url TEXT,
    p_firma_entrega_url TEXT,
    p_foto_antes_url TEXT,
    p_foto_despues_url TEXT,
    p_notas_servicio TEXT,
    p_calificacion_satisfaccion SMALLINT,
    p_comentario_satisfaccion TEXT,
    p_precio_base NUMERIC(10, 2),
    p_recargo_shampoo NUMERIC(10, 2),
    p_descuento_cupon NUMERIC(10, 2),
    p_monto_final NUMERIC(10, 2),
    p_monto_pagado NUMERIC(10, 2),
    p_activo BOOLEAN,
    p_pagos JSONB DEFAULT NULL,
    p_motivo TEXT DEFAULT NULL
)
RETURNS public.registros_servicio
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_anterior public.registros_servicio;
    v_fila public.registros_servicio;
    v_cita_anterior public.citas;
    v_cita_nueva public.citas;
    v_mascota_anterior public.mascotas;
    v_mascota_nueva public.mascotas;
    v_precio NUMERIC(10, 2);
    v_recargo NUMERIC(10, 2);
    v_suma NUMERIC(10, 2) := 0;
    v_pago RECORD;
    v_pagos_anteriores JSONB;
    v_pagos_nuevos JSONB;
    v_metodo_cupon_id BIGINT;
BEGIN
    v_actor := petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT rs.* INTO v_anterior
    FROM public.registros_servicio rs
    WHERE rs.id = p_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;

    SELECT * INTO v_cita_anterior FROM public.citas WHERE id = v_anterior.cita_id FOR UPDATE;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita_anterior.sucursal_id);

    IF v_anterior.estado = 'completado' AND NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SOLO_ADMIN_PUEDE_EDITAR_COMPLETADO';
    END IF;
    IF v_anterior.estado = 'completado' AND p_pagos IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_REQUERIDOS_PARA_COMPLETADO';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tamanos t WHERE t.id = p_tamano_id AND t.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TAMANO_INACTIVO_O_INVALIDO';
    END IF;

    IF p_precio_base IS NOT NULL THEN
        SELECT ps.precio INTO v_precio
        FROM public.precios_servicios ps
        WHERE ps.servicio_id = p_servicio_id AND ps.tamano_id = p_tamano_id AND ps.activo = TRUE;
        IF NOT FOUND OR v_precio IS DISTINCT FROM p_precio_base THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PRECIO_BASE_NO_COINCIDE';
        END IF;
    ELSIF v_anterior.estado = 'completado' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PRECIO_BASE_REQUERIDO';
    END IF;

    IF p_shampoo_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.opciones_shampoo os WHERE os.id = p_shampoo_id AND os.activo = TRUE) THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SHAMPOO_INACTIVO_O_INVALIDO';
        END IF;
        SELECT ps.recargo INTO v_recargo
        FROM public.precios_shampoo ps
        WHERE ps.shampoo_id = p_shampoo_id AND ps.tamano_id = p_tamano_id AND ps.activo = TRUE;
        IF NOT FOUND OR v_recargo IS DISTINCT FROM p_recargo_shampoo THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'RECARGO_SHAMPOO_NO_COINCIDE';
        END IF;
    END IF;

    IF p_descuento_cupon > p_precio_base + p_recargo_shampoo THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DESCUENTO_EXCEDE_SUBTOTAL';
    END IF;
    IF p_cupon_id IS NULL AND p_descuento_cupon <> 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DESCUENTO_REQUIERE_CUPON';
    END IF;
    IF p_monto_final <> p_precio_base + p_recargo_shampoo - p_descuento_cupon THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MONTO_FINAL_INVALIDO';
    END IF;

    SELECT * INTO v_mascota_anterior
    FROM public.mascotas WHERE id = v_cita_anterior.mascota_id FOR UPDATE;

    UPDATE public.registros_servicio
    SET
        servicio_id = p_servicio_id,
        peluquero_id = p_peluquero_id,
        tamano_id = p_tamano_id,
        shampoo_id = p_shampoo_id,
        cupon_id = p_cupon_id,
        heridas_visibles = p_heridas_visibles,
        raspones = p_raspones,
        piel_irritada = p_piel_irritada,
        costras = p_costras,
        inflamacion = p_inflamacion,
        cojera = p_cojera,
        dolor_al_tocar = p_dolor_al_tocar,
        pulgas = p_pulgas,
        garrapatas = p_garrapatas,
        piojos = p_piojos,
        observaciones_ingreso = COALESCE(p_observaciones_ingreso, ''),
        firma_ingreso_url = p_firma_ingreso_url,
        firma_entrega_url = p_firma_entrega_url,
        foto_antes_url = p_foto_antes_url,
        foto_despues_url = p_foto_despues_url,
        notas_servicio = p_notas_servicio,
        calificacion_satisfaccion = p_calificacion_satisfaccion,
        comentario_satisfaccion = p_comentario_satisfaccion,
        precio_base = p_precio_base,
        recargo_shampoo = p_recargo_shampoo,
        descuento_cupon = p_descuento_cupon,
        monto_final = p_monto_final,
        monto_pagado = p_monto_pagado,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    UPDATE public.citas
    SET servicio_id = p_servicio_id, peluquero_id = p_peluquero_id
    WHERE id = v_cita_anterior.id
    RETURNING * INTO v_cita_nueva;

    UPDATE public.mascotas
    SET tamano_id = p_tamano_id
    WHERE id = v_mascota_anterior.id
    RETURNING * INTO v_mascota_nueva;

    IF p_pagos IS NOT NULL THEN
        IF JSONB_TYPEOF(p_pagos) <> 'array' THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_DEBE_SER_ARREGLO';
        END IF;
        IF v_actor IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_REQUERIDO';
        END IF;

        SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB)
        INTO v_pagos_anteriores
        FROM public.pagos p
        WHERE p.registro_servicio_id = p_id AND p.activo = TRUE;

        UPDATE public.pagos SET activo = FALSE
        WHERE registro_servicio_id = p_id AND activo = TRUE;

        IF p_monto_final = 0 THEN
            SELECT cs.metodo_pago_cupon_id INTO v_metodo_cupon_id
            FROM public.configuracion_sistema cs
            INNER JOIN public.metodos_pago mp ON mp.id = cs.metodo_pago_cupon_id AND mp.activo = TRUE
            WHERE cs.id = 1;
            IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'METODO_PAGO_CUPON_NO_ENCONTRADO'; END IF;
            INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
            VALUES (p_id, v_metodo_cupon_id, 0.00, v_actor, TRUE);
            v_suma := 0.00;
        ELSE
            FOR v_pago IN
                SELECT * FROM JSONB_TO_RECORDSET(p_pagos)
                AS x(metodo_pago_id BIGINT, monto NUMERIC(10, 2))
            LOOP
                IF v_pago.metodo_pago_id IS NULL OR v_pago.monto IS NULL OR v_pago.monto < 0 THEN
                    RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGO_INVALIDO';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM public.metodos_pago mp
                    WHERE mp.id = v_pago.metodo_pago_id AND mp.activo = TRUE
                ) THEN
                    RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'METODO_PAGO_INACTIVO_O_INVALIDO';
                END IF;
                INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
                VALUES (p_id, v_pago.metodo_pago_id, v_pago.monto, v_actor, TRUE);
                v_suma := v_suma + v_pago.monto;
            END LOOP;
        END IF;

        IF v_suma <> p_monto_pagado THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MONTO_PAGADO_NO_COINCIDE';
        END IF;
        IF v_anterior.estado = 'completado' AND v_suma <> p_monto_final THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TOTAL_PAGOS_INVALIDO';
        END IF;

        SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB)
        INTO v_pagos_nuevos
        FROM public.pagos p
        WHERE p.registro_servicio_id = p_id AND p.activo = TRUE;

        PERFORM petstore_private.auditar_cambio(
            'pagos', p_id::TEXT, 'reemplazar_lista',
            JSONB_BUILD_OBJECT('pagos', v_pagos_anteriores),
            JSONB_BUILD_OBJECT('pagos', v_pagos_nuevos),
            v_cita_anterior.sucursal_id,
            p_motivo
        );
    END IF;

    PERFORM petstore_private.auditar_cambio(
        'registros_servicio', p_id::TEXT, 'actualizar',
        TO_JSONB(v_anterior), TO_JSONB(v_fila), v_cita_anterior.sucursal_id, p_motivo
    );
    PERFORM petstore_private.auditar_cambio(
        'citas', v_cita_nueva.id::TEXT, 'sincronizar_registro_servicio',
        TO_JSONB(v_cita_anterior), TO_JSONB(v_cita_nueva), v_cita_nueva.sucursal_id, p_motivo
    );
    PERFORM petstore_private.auditar_cambio(
        'mascotas', v_mascota_nueva.id::TEXT, 'actualizar',
        TO_JSONB(v_mascota_anterior), TO_JSONB(v_mascota_nueva), NULL, p_motivo
    );

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.registros_servicio_eliminar(p_id BIGINT)
RETURNS public.registros_servicio
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.registros_servicio;
    v_fila public.registros_servicio;
    v_sucursal_id BIGINT;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    PERFORM SET_CONFIG('app.flujo_registro_servicio', 'eliminar', TRUE);
    SELECT rs.* INTO v_anterior
    FROM public.registros_servicio rs
    WHERE rs.id = p_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;

    SELECT c.sucursal_id INTO v_sucursal_id
    FROM public.citas c
    WHERE c.id = v_anterior.cita_id;
    PERFORM petstore_private.requerir_acceso_sucursal(v_sucursal_id);
    UPDATE public.registros_servicio SET activo = FALSE WHERE id = p_id RETURNING * INTO v_fila;
    PERFORM petstore_private.auditar_cambio(
        'registros_servicio', p_id::TEXT, 'eliminar_logico',
        TO_JSONB(v_anterior), TO_JSONB(v_fila), v_sucursal_id, NULL
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.registros_servicio_completar(
    p_registro_servicio_id BIGINT,
    p_servicio_id BIGINT,
    p_peluquero_id BIGINT,
    p_tamano_id BIGINT,
    p_shampoo_id BIGINT,
    p_cupon_id UUID,
    p_firma_entrega_url TEXT,
    p_foto_antes_url TEXT,
    p_foto_despues_url TEXT,
    p_notas_servicio TEXT,
    p_calificacion_satisfaccion SMALLINT,
    p_comentario_satisfaccion TEXT,
    p_precio_base NUMERIC(10, 2),
    p_recargo_shampoo NUMERIC(10, 2),
    p_descuento_cupon NUMERIC(10, 2),
    p_monto_final NUMERIC(10, 2),
    p_monto_pagado NUMERIC(10, 2),
    p_pagos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_anterior public.registros_servicio;
    v_fila public.registros_servicio;
    v_cita_anterior public.citas;
    v_cita_nueva public.citas;
    v_mascota_anterior public.mascotas;
    v_mascota_nueva public.mascotas;
    v_precio NUMERIC(10, 2);
    v_recargo NUMERIC(10, 2);
    v_pago RECORD;
    v_suma NUMERIC(10, 2) := 0;
    v_metodo_cupon_id BIGINT;
    v_pagos_anteriores JSONB;
    v_pagos_nuevos JSONB;
BEGIN
    v_actor := petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    PERFORM SET_CONFIG('app.flujo_registro_servicio', 'completar', TRUE);
    IF v_actor IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_REQUERIDO';
    END IF;

    SELECT * INTO v_anterior
    FROM public.registros_servicio
    WHERE id = p_registro_servicio_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    IF v_anterior.estado <> 'en_progreso' THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'REGISTRO_NO_ESTA_EN_PROGRESO';
    END IF;

    SELECT * INTO v_cita_anterior FROM public.citas WHERE id = v_anterior.cita_id FOR UPDATE;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita_anterior.sucursal_id);
    SELECT * INTO v_mascota_anterior FROM public.mascotas WHERE id = v_cita_anterior.mascota_id FOR UPDATE;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tamanos t WHERE t.id = p_tamano_id AND t.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TAMANO_INACTIVO_O_INVALIDO';
    END IF;

    SELECT ps.precio INTO v_precio
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = p_servicio_id AND ps.tamano_id = p_tamano_id AND ps.activo = TRUE;
    IF NOT FOUND OR v_precio IS DISTINCT FROM p_precio_base THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PRECIO_BASE_NO_COINCIDE';
    END IF;

    IF p_shampoo_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.opciones_shampoo os WHERE os.id = p_shampoo_id AND os.activo = TRUE) THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SHAMPOO_INACTIVO_O_INVALIDO';
        END IF;
        SELECT ps.recargo INTO v_recargo
        FROM public.precios_shampoo ps
        WHERE ps.shampoo_id = p_shampoo_id AND ps.tamano_id = p_tamano_id AND ps.activo = TRUE;
        IF NOT FOUND OR v_recargo IS DISTINCT FROM p_recargo_shampoo THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'RECARGO_SHAMPOO_NO_COINCIDE';
        END IF;
    END IF;

    IF p_descuento_cupon > p_precio_base + p_recargo_shampoo THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DESCUENTO_EXCEDE_SUBTOTAL';
    END IF;
    IF p_cupon_id IS NULL AND p_descuento_cupon <> 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DESCUENTO_REQUIERE_CUPON';
    END IF;
    IF p_monto_final <> p_precio_base + p_recargo_shampoo - p_descuento_cupon THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MONTO_FINAL_INVALIDO';
    END IF;
    IF p_monto_pagado <> p_monto_final THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MONTO_PAGADO_NO_COINCIDE';
    END IF;
    IF p_pagos IS NULL OR JSONB_TYPEOF(p_pagos) <> 'array' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_DEBE_SER_ARREGLO';
    END IF;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB)
    INTO v_pagos_anteriores
    FROM public.pagos p
    WHERE p.registro_servicio_id = p_registro_servicio_id AND p.activo = TRUE;

    UPDATE public.pagos SET activo = FALSE
    WHERE registro_servicio_id = p_registro_servicio_id AND activo = TRUE;

    IF p_monto_final = 0 THEN
        SELECT cs.metodo_pago_cupon_id INTO v_metodo_cupon_id
        FROM public.configuracion_sistema cs
        INNER JOIN public.metodos_pago mp ON mp.id = cs.metodo_pago_cupon_id AND mp.activo = TRUE
        WHERE cs.id = 1;
        IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'METODO_PAGO_CUPON_NO_ENCONTRADO'; END IF;
        INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
        VALUES (p_registro_servicio_id, v_metodo_cupon_id, 0.00, v_actor, TRUE);
        v_suma := 0.00;
    ELSE
        FOR v_pago IN
            SELECT * FROM JSONB_TO_RECORDSET(p_pagos)
            AS x(metodo_pago_id BIGINT, monto NUMERIC(10, 2))
        LOOP
            IF v_pago.metodo_pago_id IS NULL OR v_pago.monto IS NULL OR v_pago.monto < 0 THEN
                RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGO_INVALIDO';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.metodos_pago mp
                WHERE mp.id = v_pago.metodo_pago_id AND mp.activo = TRUE
            ) THEN
                RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'METODO_PAGO_INACTIVO_O_INVALIDO';
            END IF;
            INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
            VALUES (p_registro_servicio_id, v_pago.metodo_pago_id, v_pago.monto, v_actor, TRUE);
            v_suma := v_suma + v_pago.monto;
        END LOOP;
    END IF;

    IF v_suma <> p_monto_final OR v_suma <> p_monto_pagado THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TOTAL_PAGOS_INVALIDO';
    END IF;

    UPDATE public.registros_servicio
    SET
        servicio_id = p_servicio_id,
        peluquero_id = p_peluquero_id,
        tamano_id = p_tamano_id,
        shampoo_id = p_shampoo_id,
        cupon_id = p_cupon_id,
        firma_entrega_url = p_firma_entrega_url,
        foto_antes_url = p_foto_antes_url,
        foto_despues_url = p_foto_despues_url,
        notas_servicio = p_notas_servicio,
        calificacion_satisfaccion = p_calificacion_satisfaccion,
        comentario_satisfaccion = p_comentario_satisfaccion,
        precio_base = p_precio_base,
        recargo_shampoo = p_recargo_shampoo,
        descuento_cupon = p_descuento_cupon,
        monto_final = p_monto_final,
        monto_pagado = p_monto_pagado,
        estado = 'completado'
    WHERE id = p_registro_servicio_id
    RETURNING * INTO v_fila;

    UPDATE public.citas
    SET servicio_id = p_servicio_id, peluquero_id = p_peluquero_id
    WHERE id = v_cita_anterior.id
    RETURNING * INTO v_cita_nueva;

    UPDATE public.mascotas
    SET tamano_id = p_tamano_id
    WHERE id = v_mascota_anterior.id
    RETURNING * INTO v_mascota_nueva;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB)
    INTO v_pagos_nuevos
    FROM public.pagos p
    WHERE p.registro_servicio_id = p_registro_servicio_id AND p.activo = TRUE;

    PERFORM petstore_private.auditar_cambio(
        'registros_servicio', p_registro_servicio_id::TEXT, 'completar',
        TO_JSONB(v_anterior), TO_JSONB(v_fila), v_cita_anterior.sucursal_id, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'pagos', p_registro_servicio_id::TEXT, 'reemplazar_lista',
        JSONB_BUILD_OBJECT('pagos', v_pagos_anteriores),
        JSONB_BUILD_OBJECT('pagos', v_pagos_nuevos),
        v_cita_anterior.sucursal_id, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'citas', v_cita_nueva.id::TEXT, 'sincronizar_registro_servicio',
        TO_JSONB(v_cita_anterior), TO_JSONB(v_cita_nueva), v_cita_nueva.sucursal_id, NULL
    );
    PERFORM petstore_private.auditar_cambio(
        'mascotas', v_mascota_nueva.id::TEXT, 'actualizar',
        TO_JSONB(v_mascota_anterior), TO_JSONB(v_mascota_nueva), NULL, NULL
    );

    RETURN JSONB_BUILD_OBJECT(
        'registro_servicio', TO_JSONB(v_fila),
        'cita', TO_JSONB(v_cita_nueva),
        'mascota', TO_JSONB(v_mascota_nueva),
        'pagos', v_pagos_nuevos
    );
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.pagos_reemplazar_lista(
    p_registro_servicio_id BIGINT,
    p_pagos JSONB,
    p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_registro public.registros_servicio;
    v_cita public.citas;
    v_pago RECORD;
    v_suma NUMERIC(10, 2) := 0;
    v_metodo_cupon_id BIGINT;
    v_anteriores JSONB;
    v_nuevos JSONB;
BEGIN
    v_actor := petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_REQUERIDO'; END IF;

    SELECT * INTO v_registro
    FROM public.registros_servicio
    WHERE id = p_registro_servicio_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;

    SELECT * INTO v_cita FROM public.citas WHERE id = v_registro.cita_id;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);

    IF v_registro.estado = 'completado' AND NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SOLO_ADMIN_PUEDE_EDITAR_COMPLETADO';
    END IF;
    IF p_pagos IS NULL OR JSONB_TYPEOF(p_pagos) <> 'array' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_DEBE_SER_ARREGLO';
    END IF;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB)
    INTO v_anteriores
    FROM public.pagos p
    WHERE p.registro_servicio_id = p_registro_servicio_id AND p.activo = TRUE;

    UPDATE public.pagos SET activo = FALSE
    WHERE registro_servicio_id = p_registro_servicio_id AND activo = TRUE;

    IF v_registro.monto_final = 0 THEN
        SELECT cs.metodo_pago_cupon_id INTO v_metodo_cupon_id
        FROM public.configuracion_sistema cs
        INNER JOIN public.metodos_pago mp ON mp.id = cs.metodo_pago_cupon_id AND mp.activo = TRUE
        WHERE cs.id = 1;
        IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'METODO_PAGO_CUPON_NO_ENCONTRADO'; END IF;
        INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
        VALUES (p_registro_servicio_id, v_metodo_cupon_id, 0.00, v_actor, TRUE);
        v_suma := 0.00;
    ELSE
        FOR v_pago IN
            SELECT * FROM JSONB_TO_RECORDSET(p_pagos)
            AS x(metodo_pago_id BIGINT, monto NUMERIC(10, 2))
        LOOP
            IF v_pago.metodo_pago_id IS NULL OR v_pago.monto IS NULL OR v_pago.monto < 0 THEN
                RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGO_INVALIDO';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.metodos_pago mp WHERE mp.id = v_pago.metodo_pago_id AND mp.activo = TRUE) THEN
                RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'METODO_PAGO_INACTIVO_O_INVALIDO';
            END IF;
            INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
            VALUES (p_registro_servicio_id, v_pago.metodo_pago_id, v_pago.monto, v_actor, TRUE);
            v_suma := v_suma + v_pago.monto;
        END LOOP;
    END IF;

    IF v_registro.estado = 'completado' AND v_suma <> v_registro.monto_final THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TOTAL_PAGOS_INVALIDO';
    END IF;
    IF v_registro.estado = 'en_progreso'
       AND v_registro.monto_final IS NOT NULL
       AND v_suma > v_registro.monto_final THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_EXCEDEN_MONTO_FINAL';
    END IF;

    IF v_registro.estado = 'en_progreso'
       AND v_registro.firma_entrega_url IS NOT NULL
        AND v_registro.monto_final IS NOT NULL
       AND v_suma = v_registro.monto_final THEN
        UPDATE public.registros_servicio
        SET estado = 'completado', monto_pagado = v_suma
        WHERE id = p_registro_servicio_id
        RETURNING * INTO v_registro;
    END IF;

    UPDATE public.registros_servicio
    SET monto_pagado = v_suma
    WHERE id = p_registro_servicio_id
    RETURNING * INTO v_registro;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB)
    INTO v_nuevos
    FROM public.pagos p
    WHERE p.registro_servicio_id = p_registro_servicio_id AND p.activo = TRUE;

    PERFORM petstore_private.auditar_cambio(
        'pagos', p_registro_servicio_id::TEXT, 'reemplazar_lista',
        JSONB_BUILD_OBJECT('pagos', v_anteriores),
        JSONB_BUILD_OBJECT('pagos', v_nuevos),
        v_cita.sucursal_id,
        p_motivo
    );

    RETURN JSONB_BUILD_OBJECT(
        'registro_servicio', TO_JSONB(v_registro),
        'pagos', v_nuevos
    );
END;
$$;

CREATE FUNCTION public.pagos_obtener_por_id(p_id BIGINT)
RETURNS public.pagos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.pagos;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.pagos WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.pagos_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.pagos WHERE activo = TRUE),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.pagos_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.pagos),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.registros_servicio_obtener_detalle(p_registro_servicio_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT JSONB_BUILD_OBJECT(
        'registro_servicio', TO_JSONB(rs),
        'cita', TO_JSONB(c),
        'mascota', TO_JSONB(m),
        'cliente', TO_JSONB(cl),
        'sucursal', TO_JSONB(su),
        'servicio', TO_JSONB(se),
        'peluquero', CASE WHEN p.id IS NULL THEN NULL ELSE TO_JSONB(p) END,
        'tamano', TO_JSONB(t),
        'shampoo', CASE WHEN os.id IS NULL THEN NULL ELSE TO_JSONB(os) END,
        'cupon', CASE WHEN cu.id IS NULL THEN NULL ELSE TO_JSONB(cu) END,
        'pagos', COALESCE((
            SELECT JSONB_AGG(TO_JSONB(pa) ORDER BY pa.creado_en ASC, pa.id ASC)
            FROM public.pagos pa
            WHERE pa.registro_servicio_id = rs.id
        ), '[]'::JSONB)
    )
    INTO v_resultado
    FROM public.registros_servicio rs
    INNER JOIN public.citas c ON c.id = rs.cita_id
    INNER JOIN public.mascotas m ON m.id = c.mascota_id
    INNER JOIN public.clientes cl ON cl.id = m.cliente_id
    INNER JOIN public.sucursales su ON su.id = c.sucursal_id
    INNER JOIN public.servicios se ON se.id = rs.servicio_id
    INNER JOIN public.peluqueros p ON p.id = rs.peluquero_id
    INNER JOIN public.tamanos t ON t.id = rs.tamano_id
    LEFT JOIN public.opciones_shampoo os ON os.id = rs.shampoo_id
    LEFT JOIN public.cupones cu ON cu.id = rs.cupon_id
    WHERE rs.id = p_registro_servicio_id;

    IF v_resultado IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    RETURN v_resultado;
END;
$$;

-- =============================================================================
-- 10. Appointment reminders
-- =============================================================================

CREATE FUNCTION public.recordatorios_citas_insertar(
    p_cita_id BIGINT,
    p_canal public.canal_recordatorio,
    p_numero_destino TEXT,
    p_mensaje TEXT
)
RETURNS public.recordatorios_citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_cita public.citas;
    v_fila public.recordatorios_citas;
BEGIN
    IF NOT petstore_private.es_service_role() THEN
        PERFORM petstore_private.requerir_usuario_activo();
    END IF;
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_cita FROM public.citas WHERE id = p_cita_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CITA_NO_ENCONTRADA';
    END IF;

    IF NOT petstore_private.es_service_role() THEN
        PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);
    END IF;

    INSERT INTO public.recordatorios_citas(
        cita_id, canal, numero_destino, mensaje, activo
    )
    VALUES (
        p_cita_id, p_canal, BTRIM(p_numero_destino), p_mensaje, TRUE
    )
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.recordatorios_citas_obtener_por_id(p_id BIGINT)
RETURNS public.recordatorios_citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.recordatorios_citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.recordatorios_citas WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.recordatorios_citas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.recordatorios_citas WHERE activo = TRUE),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.recordatorios_citas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.recordatorios_citas),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.recordatorios_citas_eliminar(p_id BIGINT)
RETURNS public.recordatorios_citas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_cita public.citas;
    v_fila public.recordatorios_citas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT c.* INTO v_cita
    FROM public.recordatorios_citas rc
    INNER JOIN public.citas c ON c.id = rc.cita_id
    WHERE rc.id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);

    UPDATE public.recordatorios_citas SET activo = FALSE WHERE id = p_id RETURNING * INTO v_fila;
    RETURN v_fila;
END;
$$;

-- =============================================================================
-- 11. Audit read RPCs
-- =============================================================================

CREATE FUNCTION public.auditorias_obtener_por_id(p_id BIGINT)
RETURNS public.auditorias
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.auditorias;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    SELECT * INTO v_fila FROM public.auditorias WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.auditorias_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.auditorias),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.auditorias_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (SELECT * FROM public.auditorias),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

-- =============================================================================
-- 12. Complex customer and pet reads
-- =============================================================================

CREATE FUNCTION public.mascotas_transferir_cliente(
    p_mascota_id BIGINT,
    p_nuevo_cliente_id BIGINT,
    p_motivo TEXT
)
RETURNS public.mascotas
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_anterior public.mascotas;
    v_fila public.mascotas;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MOTIVO_REQUERIDO';
    END IF;

    SELECT * INTO v_anterior FROM public.mascotas WHERE id = p_mascota_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'MASCOTA_NO_ENCONTRADA'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p_nuevo_cliente_id AND c.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CLIENTE_NUEVO_INACTIVO_O_INVALIDO';
    END IF;

    UPDATE public.mascotas SET cliente_id = p_nuevo_cliente_id WHERE id = p_mascota_id RETURNING * INTO v_fila;
    PERFORM petstore_private.auditar_cambio(
        'mascotas', p_mascota_id::TEXT, 'transferir_cliente',
        TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, BTRIM(p_motivo)
    );
    RETURN v_fila;
END;
$$;

CREATE FUNCTION public.mascotas_obtener_historial(p_mascota_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_mascota public.mascotas;
    v_cliente public.clientes;
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT m.* INTO v_mascota
    FROM public.mascotas m
    INNER JOIN public.clientes c ON c.id = m.cliente_id
    WHERE m.id = p_mascota_id
      AND m.activo = TRUE
      AND c.activo = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'MASCOTA_NO_ENCONTRADA'; END IF;

    SELECT c.* INTO v_cliente
    FROM public.clientes c
    WHERE c.id = v_mascota.cliente_id;

    SELECT JSONB_BUILD_OBJECT(
        'mascota', TO_JSONB(v_mascota),
        'cliente', TO_JSONB(v_cliente),
        'citas', COALESCE((
            SELECT JSONB_AGG(
                TO_JSONB(c) || JSONB_BUILD_OBJECT(
                    'sucursal', TO_JSONB(su),
                    'servicio', TO_JSONB(se),
                    'peluquero', CASE WHEN pe.id IS NULL THEN NULL ELSE TO_JSONB(pe) END,
                    'registro_servicio', CASE WHEN rs.id IS NULL THEN NULL ELSE
                        TO_JSONB(rs) || JSONB_BUILD_OBJECT(
                            'pagos', COALESCE((
                                SELECT JSONB_AGG(TO_JSONB(pa) ORDER BY pa.creado_en, pa.id)
                                FROM public.pagos pa
                                WHERE pa.registro_servicio_id = rs.id AND pa.activo = TRUE
                            ), '[]'::JSONB),
                            'cupon', CASE WHEN cu.id IS NULL THEN NULL ELSE TO_JSONB(cu) END
                        ) END
                ) ORDER BY c.inicio_programado DESC, c.id DESC
            )
            FROM public.citas c
            INNER JOIN public.sucursales su ON su.id = c.sucursal_id
            INNER JOIN public.servicios se ON se.id = c.servicio_id
            LEFT JOIN public.peluqueros pe ON pe.id = c.peluquero_id
            LEFT JOIN public.registros_servicio rs ON rs.cita_id = c.id AND rs.activo = TRUE
            LEFT JOIN public.cupones cu ON cu.id = rs.cupon_id
            WHERE c.mascota_id = p_mascota_id AND c.activo = TRUE
        ), '[]'::JSONB)
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.mascotas_obtener_historial_completo(p_mascota_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_mascota public.mascotas;
    v_cliente public.clientes;
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();

    SELECT m.* INTO v_mascota
    FROM public.mascotas m
    INNER JOIN public.clientes c ON c.id = m.cliente_id
    WHERE m.id = p_mascota_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'MASCOTA_NO_ENCONTRADA'; END IF;

    SELECT c.* INTO v_cliente
    FROM public.clientes c
    WHERE c.id = v_mascota.cliente_id;

    SELECT JSONB_BUILD_OBJECT(
        'mascota', TO_JSONB(v_mascota),
        'cliente', TO_JSONB(v_cliente),
        'citas', COALESCE((
            SELECT JSONB_AGG(
                TO_JSONB(c) || JSONB_BUILD_OBJECT(
                    'sucursal', TO_JSONB(su),
                    'servicio', TO_JSONB(se),
                    'peluquero', CASE WHEN pe.id IS NULL THEN NULL ELSE TO_JSONB(pe) END,
                    'registro_servicio', CASE WHEN rs.id IS NULL THEN NULL ELSE
                        TO_JSONB(rs) || JSONB_BUILD_OBJECT(
                            'pagos', COALESCE((
                                SELECT JSONB_AGG(TO_JSONB(pa) ORDER BY pa.creado_en, pa.id)
                                FROM public.pagos pa
                                WHERE pa.registro_servicio_id = rs.id
                            ), '[]'::JSONB),
                            'cupon', CASE WHEN cu.id IS NULL THEN NULL ELSE TO_JSONB(cu) END
                        ) END
                ) ORDER BY c.inicio_programado DESC, c.id DESC
            )
            FROM public.citas c
            INNER JOIN public.sucursales su ON su.id = c.sucursal_id
            INNER JOIN public.servicios se ON se.id = c.servicio_id
            LEFT JOIN public.peluqueros pe ON pe.id = c.peluquero_id
            LEFT JOIN public.registros_servicio rs ON rs.cita_id = c.id
            LEFT JOIN public.cupones cu ON cu.id = rs.cupon_id
            WHERE c.mascota_id = p_mascota_id
        ), '[]'::JSONB)
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.clientes_obtener_detalle(p_cliente_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_cliente public.clientes;
    v_es_admin BOOLEAN;
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    v_es_admin := petstore_private.es_admin_propietario();

    SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
    IF NOT FOUND OR (NOT v_es_admin AND v_cliente.activo = FALSE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CLIENTE_NO_ENCONTRADO';
    END IF;

    SELECT JSONB_BUILD_OBJECT(
        'cliente', TO_JSONB(v_cliente),
        'mascotas', COALESCE((
            SELECT JSONB_AGG(TO_JSONB(m) ORDER BY m.nombre, m.id)
            FROM public.mascotas m
            WHERE m.cliente_id = p_cliente_id
              AND (v_es_admin OR m.activo = TRUE)
        ), '[]'::JSONB),
        'ultimas_citas', COALESCE((
            SELECT JSONB_AGG(fila ORDER BY inicio_programado DESC, id DESC)
            FROM (
                SELECT
                    c.id,
                    c.mascota_id,
                    m.nombre AS mascota_nombre,
                    c.sucursal_id,
                    su.nombre AS sucursal_nombre,
                    c.servicio_id,
                    se.nombre AS servicio_nombre,
                    c.inicio_programado,
                    c.fin_programado,
                    c.estado,
                    c.activo,
                    CASE WHEN rs.id IS NULL THEN NULL ELSE JSONB_BUILD_OBJECT(
                        'id', rs.id,
                        'estado', rs.estado,
                        'servicio_id', rs.servicio_id,
                        'peluquero_id', rs.peluquero_id,
                        'inicio_real', rs.inicio_real,
                        'fin_real', rs.fin_real,
                        'monto_final', rs.monto_final,
                        'monto_pagado', rs.monto_pagado,
                        'activo', rs.activo,
                        'pagos', COALESCE((
                            SELECT JSONB_AGG(TO_JSONB(pa) ORDER BY pa.creado_en, pa.id)
                            FROM public.pagos pa
                            WHERE pa.registro_servicio_id = rs.id AND pa.activo = TRUE
                        ), '[]'::JSONB)
                    ) END AS registro_servicio
                FROM public.citas c
                INNER JOIN public.mascotas m ON m.id = c.mascota_id
                INNER JOIN public.sucursales su ON su.id = c.sucursal_id
                INNER JOIN public.servicios se ON se.id = c.servicio_id
                LEFT JOIN public.registros_servicio rs ON rs.cita_id = c.id
                WHERE m.cliente_id = p_cliente_id
                ORDER BY c.inicio_programado DESC, c.id DESC
                LIMIT 10
            ) fila
        ), '[]'::JSONB)
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

-- =============================================================================
-- 13. Function execution permissions
-- =============================================================================

REVOKE ALL ON SCHEMA petstore_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA petstore_private TO authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA petstore_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA petstore_private TO authenticated, service_role;

DO $$
DECLARE
    v_funcion RECORD;
BEGIN
    FOR v_funcion IN
        SELECT
            n.nspname AS esquema,
            p.proname AS nombre,
            PG_GET_FUNCTION_IDENTITY_ARGUMENTS(p.oid) AS argumentos
        FROM pg_proc p
        INNER JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname ~ '^(usuarios|sucursales|usuarios_sucursales|clientes|tamanos|mascotas|peluqueros|servicios|precios_servicios|opciones_shampoo|precios_shampoo|metodos_pago|configuracion_sistema|cupones|citas|registros_servicio|pagos|recordatorios_citas|auditorias)_'
    LOOP
        EXECUTE FORMAT(
            'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
            v_funcion.esquema,
            v_funcion.nombre,
            v_funcion.argumentos
        );
        EXECUTE FORMAT(
            'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
            v_funcion.esquema,
            v_funcion.nombre,
            v_funcion.argumentos
        );
    END LOOP;
END;
$$;

-- Structural trigger helpers are not public RPC endpoints.
REVOKE ALL ON FUNCTION public.establecer_actualizado_en() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.obtener_usuario_actual() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_citas_por_sucursal_desactivada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_citas_por_cliente_desactivado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_citas_por_mascota_desactivada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.desasignar_peluquero_desactivado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_registro_servicio() FROM PUBLIC, anon, authenticated;
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
GRANT EXECUTE ON FUNCTION public.validar_consistencia_cita_registro_id(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_cita_registro_id(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_desde_cita() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_consistencia_desde_registro() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_total_pagos_registro(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_total_pagos_desde_registro() TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_total_pagos_desde_pago() TO service_role;

COMMIT;
