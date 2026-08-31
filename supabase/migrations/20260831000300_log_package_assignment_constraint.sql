BEGIN;

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
    v_constraint TEXT;
    v_table TEXT;
    v_column TEXT;
    v_detail TEXT;
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
        GET STACKED DIAGNOSTICS
            v_constraint = CONSTRAINT_NAME,
            v_table = TABLE_NAME,
            v_column = COLUMN_NAME,
            v_detail = PG_EXCEPTION_DETAIL;
        RAISE LOG 'paquetes_asignar DATOS_INVALIDOS: paquete_id=%, cliente_id=%, tabla=%, columna=%, constraint=%, detalle=%',
            p_paquete_id, p_cliente_id, v_table, v_column, v_constraint, v_detail;
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

COMMIT;
