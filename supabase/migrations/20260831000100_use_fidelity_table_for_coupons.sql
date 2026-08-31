CREATE OR REPLACE FUNCTION petstore_private.generar_cupon_fidelidad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_cliente_id BIGINT;
    v_config public.configuracion_sistema%ROWTYPE;
    v_creditos_acumulados BIGINT;
    v_cupon public.cupones;
BEGIN
    IF NEW.estado <> 'completado' OR OLD.estado IS NOT DISTINCT FROM 'completado' THEN
        RETURN NEW;
    END IF;

    SELECT m.cliente_id
    INTO v_cliente_id
    FROM public.citas c
    INNER JOIN public.mascotas m ON m.id = c.mascota_id
    WHERE c.id = NEW.cita_id;

    PERFORM 1 FROM public.clientes WHERE id = v_cliente_id FOR UPDATE;
    SELECT * INTO STRICT v_config FROM public.configuracion_sistema WHERE id = 1;

    IF NEW.fin_real < v_config.fidelidad_inicia_en
       OR EXISTS (
            SELECT 1 FROM public.cupones c
            WHERE c.id = NEW.cupon_id AND c.uso_unico = TRUE
       ) THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(fc.creditos_acumulados, 0)
    INTO v_creditos_acumulados
    FROM public.fidelidad_clientes fc
    WHERE fc.cliente_id = v_cliente_id
    FOR UPDATE;
    v_creditos_acumulados := COALESCE(v_creditos_acumulados, 0);

    IF MOD(v_creditos_acumulados, v_config.servicios_requeridos_cupon) <> 0 THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.cupones (
        id, nombre, cliente_id, servicio_id, tipo_descuento, valor,
        fecha_expiracion, activo, uso_unico, origen,
        registro_origen_id, creado_por_usuario_id
    )
    VALUES (
        gen_random_uuid(), 'Recompensa de fidelidad', v_cliente_id, NULL,
        'porcentaje', 100,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')::DATE
            + v_config.vigencia_cupon_automatico_dias,
        TRUE, TRUE, 'automatico', NEW.id, v_actor
    )
    ON CONFLICT (registro_origen_id) WHERE registro_origen_id IS NOT NULL DO NOTHING
    RETURNING * INTO v_cupon;

    IF v_cupon.id IS NOT NULL THEN
        PERFORM petstore_private.auditar_cambio(
            'cupones', v_cupon.id::TEXT, 'insertar_automatico',
            NULL, TO_JSONB(v_cupon), NULL, NULL
        );
    END IF;

    RETURN NEW;
END;
$$;
