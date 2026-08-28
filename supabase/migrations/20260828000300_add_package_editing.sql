ALTER TABLE public.paquetes_asignaciones
    ADD COLUMN servicios_incluidos JSONB;

UPDATE public.paquetes_asignaciones pa
SET servicios_incluidos = COALESCE((
    SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'servicio_id', ps.servicio_id,
        'servicio_nombre', s.nombre,
        'cantidad', ps.cantidad
    ) ORDER BY s.nombre)
    FROM public.paquetes_servicios ps
    INNER JOIN public.servicios s ON s.id = ps.servicio_id
    WHERE ps.paquete_id = pa.paquete_id
), '[]'::JSONB);

ALTER TABLE public.paquetes_asignaciones
    ALTER COLUMN servicios_incluidos SET NOT NULL,
    ADD CONSTRAINT paquetes_asignaciones_servicios_validos
        CHECK (JSONB_TYPEOF(servicios_incluidos) = 'array');

CREATE POLICY paquetes_servicios_delete
ON public.paquetes_servicios FOR DELETE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()));

CREATE OR REPLACE FUNCTION public.paquetes_listar()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();

    SELECT COALESCE(JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'id', p.id,
            'nombre', p.nombre,
            'precio', p.precio,
            'vigencia_dias', p.vigencia_dias,
            'activo', p.activo,
            'creado_por_usuario_id', p.creado_por_usuario_id,
            'creado_en', p.creado_en,
            'servicios', COALESCE((
                SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                    'servicio_id', ps.servicio_id,
                    'servicio_nombre', s.nombre,
                    'cantidad', ps.cantidad
                ) ORDER BY s.nombre)
                FROM public.paquetes_servicios ps
                INNER JOIN public.servicios s ON s.id = ps.servicio_id
                WHERE ps.paquete_id = p.id
            ), '[]'::JSONB),
            'asignaciones', COALESCE((
                SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                    'id', pa.id,
                    'cliente_id', pa.cliente_id,
                    'cliente_nombre', c.nombre,
                    'precio_pagado', pa.precio_pagado,
                    'fecha_expiracion', pa.fecha_expiracion,
                    'servicios_incluidos', pa.servicios_incluidos,
                    'asignado_por_usuario_id', pa.asignado_por_usuario_id,
                    'asignado_en', pa.asignado_en
                ) ORDER BY pa.asignado_en DESC, pa.id DESC)
                FROM public.paquetes_asignaciones pa
                INNER JOIN public.clientes c ON c.id = pa.cliente_id
                WHERE pa.paquete_id = p.id
            ), '[]'::JSONB)
        ) ORDER BY p.activo DESC, p.creado_en DESC, p.id DESC
    ), '[]'::JSONB)
    INTO v_resultado
    FROM public.paquetes p;

    RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.paquetes_asignar(
    p_paquete_id BIGINT,
    p_cliente_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_paquete public.paquetes;
    v_cliente public.clientes;
    v_asignacion public.paquetes_asignaciones;
    v_servicios_incluidos JSONB;
    v_item RECORD;
    v_coupon_index INTEGER;
    v_coupon_id UUID;
    v_fecha_expiracion DATE;
    v_cupones_generados INTEGER := 0;
BEGIN
    v_actor := petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_paquete
    FROM public.paquetes
    WHERE id = p_paquete_id
    FOR UPDATE;
    IF NOT FOUND OR NOT v_paquete.activo THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'PAQUETE_NO_ENCONTRADO';
    END IF;

    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id AND activo = TRUE
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CLIENTE_NO_ENCONTRADO';
    END IF;

    SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'servicio_id', ps.servicio_id,
        'servicio_nombre', s.nombre,
        'cantidad', ps.cantidad
    ) ORDER BY s.nombre), '[]'::JSONB)
    INTO v_servicios_incluidos
    FROM public.paquetes_servicios ps
    INNER JOIN public.servicios s ON s.id = ps.servicio_id
    WHERE ps.paquete_id = v_paquete.id;

    v_fecha_expiracion := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')::DATE + v_paquete.vigencia_dias;

    INSERT INTO public.paquetes_asignaciones (
        paquete_id, cliente_id, precio_pagado, fecha_expiracion,
        servicios_incluidos, asignado_por_usuario_id
    )
    VALUES (
        v_paquete.id, v_cliente.id, v_paquete.precio, v_fecha_expiracion,
        v_servicios_incluidos, v_actor
    )
    RETURNING * INTO v_asignacion;

    FOR v_item IN
        SELECT x.servicio_id, x.cantidad, x.servicio_nombre
        FROM JSONB_TO_RECORDSET(v_servicios_incluidos)
            AS x(servicio_id BIGINT, servicio_nombre TEXT, cantidad INTEGER)
    LOOP
        FOR v_coupon_index IN 1..v_item.cantidad
        LOOP
            v_coupon_id := GEN_RANDOM_UUID();
            INSERT INTO public.cupones (
                id, nombre, cliente_id, servicio_id, tipo_descuento, valor,
                fecha_expiracion, activo, uso_unico, origen,
                paquete_asignacion_id, creado_por_usuario_id
            )
            VALUES (
                v_coupon_id, v_paquete.nombre || ' · ' || v_item.servicio_nombre,
                v_cliente.id, v_item.servicio_id, 'porcentaje', 100,
                v_fecha_expiracion, TRUE, TRUE, 'paquete', v_asignacion.id, v_actor
            );
            v_cupones_generados := v_cupones_generados + 1;
        END LOOP;
    END LOOP;

    PERFORM petstore_private.auditar_cambio(
        'paquete_asignacion', v_asignacion.id::TEXT, 'asignar', NULL,
        TO_JSONB(v_asignacion) || JSONB_BUILD_OBJECT(
            'paquete_nombre', v_paquete.nombre,
            'cliente_nombre', v_cliente.nombre,
            'cupones_generados', v_cupones_generados
        ), NULL, NULL
    );

    RETURN JSONB_BUILD_OBJECT('asignacion', TO_JSONB(v_asignacion), 'cupones_generados', v_cupones_generados);
EXCEPTION
    WHEN check_violation OR foreign_key_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.paquetes_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_precio NUMERIC(10, 2),
    p_vigencia_dias INTEGER,
    p_servicios JSONB
)
RETURNS public.paquetes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_anterior public.paquetes;
    v_fila public.paquetes;
    v_servicios_anteriores JSONB;
    v_item RECORD;
BEGIN
    v_actor := petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior FROM public.paquetes WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'PAQUETE_NO_ENCONTRADO';
    END IF;

    IF BTRIM(COALESCE(p_nombre, '')) = ''
       OR p_precio IS NULL
       OR p_precio <= 0
       OR p_vigencia_dias IS NULL
       OR p_vigencia_dias < 1
       OR p_servicios IS NULL
       OR COALESCE(JSONB_TYPEOF(p_servicios), '') <> 'array'
       OR JSONB_ARRAY_LENGTH(CASE WHEN JSONB_TYPEOF(p_servicios) = 'array' THEN p_servicios ELSE '[]'::JSONB END) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM JSONB_TO_RECORDSET(p_servicios) AS x(servicio_id BIGINT, cantidad INTEGER)
        WHERE servicio_id IS NULL OR cantidad IS NULL OR cantidad < 1
    ) OR (
        SELECT COUNT(*) FROM JSONB_TO_RECORDSET(p_servicios) AS x(servicio_id BIGINT, cantidad INTEGER)
    ) <> (
        SELECT COUNT(DISTINCT servicio_id) FROM JSONB_TO_RECORDSET(p_servicios) AS x(servicio_id BIGINT, cantidad INTEGER)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIOS_DEL_PAQUETE_INVALIDOS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM JSONB_TO_RECORDSET(p_servicios) AS x(servicio_id BIGINT, cantidad INTEGER)
        LEFT JOIN public.servicios s ON s.id = x.servicio_id
        WHERE s.id IS NULL OR s.activo = FALSE OR s.es_adicional = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_DEL_PAQUETE_INVALIDO';
    END IF;

    SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'servicio_id', ps.servicio_id,
        'servicio_nombre', s.nombre,
        'cantidad', ps.cantidad
    ) ORDER BY s.nombre), '[]'::JSONB)
    INTO v_servicios_anteriores
    FROM public.paquetes_servicios ps
    INNER JOIN public.servicios s ON s.id = ps.servicio_id
    WHERE ps.paquete_id = p_id;

    UPDATE public.paquetes
    SET nombre = BTRIM(p_nombre), precio = p_precio, vigencia_dias = p_vigencia_dias,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE id = p_id
    RETURNING * INTO v_fila;

    DELETE FROM public.paquetes_servicios WHERE paquete_id = p_id;

    FOR v_item IN
        SELECT * FROM JSONB_TO_RECORDSET(p_servicios) AS x(servicio_id BIGINT, cantidad INTEGER)
    LOOP
        INSERT INTO public.paquetes_servicios (paquete_id, servicio_id, cantidad)
        VALUES (p_id, v_item.servicio_id, v_item.cantidad);
    END LOOP;

    PERFORM petstore_private.auditar_cambio(
        'paquetes', p_id::TEXT, 'actualizar',
        TO_JSONB(v_anterior) || JSONB_BUILD_OBJECT('servicios', v_servicios_anteriores),
        TO_JSONB(v_fila) || JSONB_BUILD_OBJECT('servicios', p_servicios), NULL, NULL
    );
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'PAQUETE_YA_EXISTE';
    WHEN check_violation OR foreign_key_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

REVOKE ALL ON FUNCTION public.paquetes_actualizar(BIGINT, TEXT, NUMERIC, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paquetes_actualizar(BIGINT, TEXT, NUMERIC, INTEGER, JSONB) TO authenticated, service_role;
