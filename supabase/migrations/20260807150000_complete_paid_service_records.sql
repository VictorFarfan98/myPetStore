CREATE OR REPLACE FUNCTION public.pagos_reemplazar_lista(
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

    SELECT * INTO v_registro FROM public.registros_servicio WHERE id = p_registro_servicio_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    SELECT * INTO v_cita FROM public.citas WHERE id = v_registro.cita_id;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);
    IF v_registro.estado = 'completado' AND NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SOLO_ADMIN_PUEDE_EDITAR_COMPLETADO';
    END IF;
    IF p_pagos IS NULL OR JSONB_TYPEOF(p_pagos) <> 'array' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_DEBE_SER_ARREGLO';
    END IF;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB) INTO v_anteriores
    FROM public.pagos p WHERE p.registro_servicio_id = p_registro_servicio_id AND p.activo = TRUE;
    UPDATE public.pagos SET activo = FALSE WHERE registro_servicio_id = p_registro_servicio_id AND activo = TRUE;

    IF v_registro.monto_final = 0 THEN
        SELECT cs.metodo_pago_cupon_id INTO v_metodo_cupon_id
        FROM public.configuracion_sistema cs
        INNER JOIN public.metodos_pago mp ON mp.id = cs.metodo_pago_cupon_id AND mp.activo = TRUE
        WHERE cs.id = 1;
        IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'METODO_PAGO_CUPON_NO_ENCONTRADO'; END IF;
        INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
        VALUES (p_registro_servicio_id, v_metodo_cupon_id, 0.00, v_actor, TRUE);
    ELSE
        FOR v_pago IN SELECT * FROM JSONB_TO_RECORDSET(p_pagos) AS x(metodo_pago_id BIGINT, monto NUMERIC(10, 2)) LOOP
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
    IF v_registro.estado = 'en_progreso' AND v_registro.monto_final IS NOT NULL AND v_suma > v_registro.monto_final THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGOS_EXCEDEN_MONTO_FINAL';
    END IF;
    IF v_registro.estado = 'en_progreso' AND v_registro.firma_entrega_url IS NOT NULL
       AND v_registro.monto_final IS NOT NULL AND v_suma = v_registro.monto_final THEN
        UPDATE public.registros_servicio SET estado = 'completado', monto_pagado = v_suma
        WHERE id = p_registro_servicio_id RETURNING * INTO v_registro;
    END IF;
    UPDATE public.registros_servicio SET monto_pagado = v_suma WHERE id = p_registro_servicio_id RETURNING * INTO v_registro;
    SELECT COALESCE(JSONB_AGG(TO_JSONB(p) ORDER BY p.creado_en, p.id), '[]'::JSONB) INTO v_nuevos
    FROM public.pagos p WHERE p.registro_servicio_id = p_registro_servicio_id AND p.activo = TRUE;
    PERFORM petstore_private.auditar_cambio('pagos', p_registro_servicio_id::TEXT, 'reemplazar_lista', JSONB_BUILD_OBJECT('pagos', v_anteriores), JSONB_BUILD_OBJECT('pagos', v_nuevos), v_cita.sucursal_id, p_motivo);
    RETURN JSONB_BUILD_OBJECT('registro_servicio', TO_JSONB(v_registro), 'pagos', v_nuevos);
END;
$$;
