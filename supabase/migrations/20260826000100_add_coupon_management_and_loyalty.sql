ALTER TABLE public.configuracion_sistema
    ADD COLUMN servicios_requeridos_cupon INTEGER NOT NULL DEFAULT 5
        CHECK (servicios_requeridos_cupon > 0),
    ADD COLUMN vigencia_cupon_automatico_dias INTEGER NOT NULL DEFAULT 90
        CHECK (vigencia_cupon_automatico_dias > 0),
    ADD COLUMN fidelidad_inicia_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.cupones
    ADD COLUMN nombre TEXT,
    ADD COLUMN origen TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN uso_unico BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN registro_origen_id BIGINT NULL
        REFERENCES public.registros_servicio(id) ON DELETE RESTRICT;

UPDATE public.cupones
SET nombre = 'Cupón ' || LEFT(id::TEXT, 8)
WHERE nombre IS NULL;

ALTER TABLE public.cupones
    ALTER COLUMN nombre SET NOT NULL,
    ALTER COLUMN cliente_id DROP NOT NULL,
    ALTER COLUMN servicio_id DROP NOT NULL,
    ALTER COLUMN fecha_expiracion DROP NOT NULL,
    ALTER COLUMN creado_por_usuario_id DROP NOT NULL,
    ADD CONSTRAINT cupones_nombre_valido CHECK (BTRIM(nombre) <> ''),
    ADD CONSTRAINT cupones_origen_valido CHECK (origen IN ('manual', 'automatico')),
    ADD CONSTRAINT cupones_automaticos_validos CHECK (
        origen <> 'automatico'
        OR (
            cliente_id IS NOT NULL
            AND servicio_id IS NULL
            AND tipo_descuento = 'porcentaje'
            AND valor = 100
            AND fecha_expiracion IS NOT NULL
            AND uso_unico = TRUE
            AND registro_origen_id IS NOT NULL
        )
    );

ALTER TABLE public.registros_servicio
    DROP CONSTRAINT IF EXISTS registros_servicio_cupon_id_key;

CREATE UNIQUE INDEX uq_cupones_registro_origen
    ON public.cupones (registro_origen_id)
    WHERE registro_origen_id IS NOT NULL;

INSERT INTO public.cupones (
    id, nombre, cliente_id, servicio_id, tipo_descuento, valor,
    fecha_expiracion, activo, uso_unico, origen, creado_por_usuario_id
)
VALUES (
    '00000000-0000-4000-8000-0000000000b1', 'Club BI', NULL, NULL,
    'porcentaje', 15, NULL, TRUE, FALSE, 'manual', NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION petstore_private.validar_y_canjear_cupon(
    p_registro_servicio_id BIGINT,
    p_cita_id BIGINT,
    p_servicio_id BIGINT,
    p_cupon_id UUID,
    p_precio_base NUMERIC(10, 2),
    p_descuento_cupon NUMERIC(10, 2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cliente_id BIGINT;
    v_cupon public.cupones%ROWTYPE;
    v_subtotal NUMERIC(10, 2);
    v_descuento_esperado NUMERIC(10, 2);
BEGIN
    SELECT m.cliente_id
    INTO v_cliente_id
    FROM public.citas c
    INNER JOIN public.mascotas m ON m.id = c.mascota_id
    WHERE c.id = p_cita_id;

    SELECT *
    INTO v_cupon
    FROM public.cupones
    WHERE id = p_cupon_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CUPON_NO_ENCONTRADO';
    END IF;
    IF NOT v_cupon.activo THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'CUPON_INACTIVO';
    END IF;
    IF v_cupon.cliente_id IS NOT NULL AND v_cupon.cliente_id <> v_cliente_id THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'CUPON_CLIENTE_INVALIDO';
    END IF;
    IF v_cupon.servicio_id IS NOT NULL AND v_cupon.servicio_id <> p_servicio_id THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'CUPON_SERVICIO_INVALIDO';
    END IF;
    IF v_cupon.fecha_expiracion IS NOT NULL
       AND v_cupon.fecha_expiracion < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guatemala')::DATE THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'CUPON_VENCIDO';
    END IF;
    IF v_cupon.uso_unico AND v_cupon.canjeado_en IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PE001', MESSAGE = 'CUPON_YA_CANJEADO';
    END IF;

    SELECT p_precio_base + COALESCE(SUM(rsa.precio * rsa.cantidad), 0)
    INTO v_subtotal
    FROM public.registros_servicio_adicionales rsa
    WHERE rsa.registro_servicio_id = p_registro_servicio_id
      AND rsa.activo = TRUE;

    v_descuento_esperado := LEAST(
        v_subtotal,
        CASE v_cupon.tipo_descuento
            WHEN 'porcentaje' THEN ROUND(v_subtotal * v_cupon.valor / 100, 2)
            ELSE v_cupon.valor
        END
    );

    IF p_descuento_cupon IS DISTINCT FROM v_descuento_esperado THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DESCUENTO_CUPON_INVALIDO';
    END IF;

    IF v_cupon.uso_unico THEN
        UPDATE public.cupones
        SET canjeado_en = CURRENT_TIMESTAMP,
            activo = FALSE
        WHERE id = p_cupon_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION petstore_private.validar_y_canjear_cupon(BIGINT, BIGINT, BIGINT, UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preparar_registro_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_foto_ingreso_requerida BOOLEAN;
    v_foto_egreso_requerida BOOLEAN;
    v_transicion_a_completado BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.firma_ingreso_en := CASE WHEN NEW.firma_ingreso_url IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END;
        NEW.firma_entrega_en := CASE WHEN NEW.firma_entrega_url IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END;
    ELSE
        NEW.firma_ingreso_en := CASE
            WHEN OLD.firma_ingreso_en IS NOT NULL THEN OLD.firma_ingreso_en
            WHEN NEW.firma_ingreso_url IS NOT NULL THEN CURRENT_TIMESTAMP
            ELSE NULL
        END;
        NEW.firma_entrega_en := CASE
            WHEN OLD.firma_entrega_en IS NOT NULL THEN OLD.firma_entrega_en
            WHEN NEW.firma_entrega_url IS NOT NULL THEN CURRENT_TIMESTAMP
            ELSE NULL
        END;
    END IF;

    v_transicion_a_completado := NEW.estado = 'completado'
        AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'completado');

    IF TG_OP = 'UPDATE' AND OLD.fin_real IS NOT NULL THEN
        NEW.fin_real := OLD.fin_real;
    ELSIF v_transicion_a_completado THEN
        NEW.fin_real := CURRENT_TIMESTAMP;
    END IF;

    IF v_transicion_a_completado THEN
        SELECT foto_antes_requerida, foto_despues_requerida
        INTO STRICT v_foto_ingreso_requerida, v_foto_egreso_requerida
        FROM public.configuracion_sistema
        WHERE id = 1;

        IF v_foto_ingreso_requerida AND NOT EXISTS (
            SELECT 1 FROM public.registros_servicio_fotos
            WHERE registro_servicio_id = NEW.id AND momento = 'ingreso'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'FOTO_INGRESO_REQUERIDA';
        END IF;
        IF v_foto_egreso_requerida AND NOT EXISTS (
            SELECT 1 FROM public.registros_servicio_fotos
            WHERE registro_servicio_id = NEW.id AND momento = 'egreso'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'FOTO_EGRESO_REQUERIDA';
        END IF;

        IF NEW.cupon_id IS NOT NULL THEN
            PERFORM petstore_private.validar_y_canjear_cupon(
                NEW.id, NEW.cita_id, NEW.servicio_id, NEW.cupon_id,
                NEW.precio_base, NEW.descuento_cupon
            );
        ELSIF NEW.descuento_cupon <> 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DESCUENTO_REQUIERE_CUPON';
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_SISTEMA_NO_ENCONTRADA';
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_registro_servicio() FROM PUBLIC, anon, authenticated;

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
    v_servicios_completados BIGINT;
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

    SELECT COUNT(*)
    INTO v_servicios_completados
    FROM public.registros_servicio rs
    INNER JOIN public.citas ci ON ci.id = rs.cita_id
    INNER JOIN public.mascotas m ON m.id = ci.mascota_id
    LEFT JOIN public.cupones cp ON cp.id = rs.cupon_id
    WHERE m.cliente_id = v_cliente_id
      AND rs.estado = 'completado'
      AND rs.activo = TRUE
      AND rs.fin_real >= v_config.fidelidad_inicia_en
      AND (rs.cupon_id IS NULL OR cp.uso_unico = FALSE);

    IF MOD(v_servicios_completados, v_config.servicios_requeridos_cupon) <> 0 THEN
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

REVOKE ALL ON FUNCTION petstore_private.generar_cupon_fidelidad() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generar_cupon_fidelidad ON public.registros_servicio;
CREATE TRIGGER trg_generar_cupon_fidelidad
AFTER UPDATE OF estado ON public.registros_servicio
FOR EACH ROW
EXECUTE FUNCTION petstore_private.generar_cupon_fidelidad();

DROP FUNCTION public.configuracion_sistema_actualizar(BOOLEAN, BOOLEAN, INTEGER, BIGINT, BOOLEAN);

CREATE FUNCTION public.configuracion_sistema_actualizar(
    p_foto_antes_requerida BOOLEAN,
    p_foto_despues_requerida BOOLEAN,
    p_dias_anticipacion_recordatorio INTEGER,
    p_metodo_pago_cupon_id BIGINT,
    p_habilitar_calificaciones BOOLEAN,
    p_servicios_requeridos_cupon INTEGER,
    p_vigencia_cupon_automatico_dias INTEGER
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
        SELECT 1 FROM public.metodos_pago
        WHERE id = p_metodo_pago_cupon_id AND activo = TRUE
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
    SET foto_antes_requerida = p_foto_antes_requerida,
        foto_despues_requerida = p_foto_despues_requerida,
        dias_anticipacion_recordatorio = p_dias_anticipacion_recordatorio,
        metodo_pago_cupon_id = p_metodo_pago_cupon_id,
        habilitar_calificaciones = p_habilitar_calificaciones,
        servicios_requeridos_cupon = p_servicios_requeridos_cupon,
        vigencia_cupon_automatico_dias = p_vigencia_cupon_automatico_dias
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

DROP FUNCTION public.cupones_insertar(UUID, BIGINT, BIGINT, public.tipo_descuento_cupon, NUMERIC, DATE, BOOLEAN);
DROP FUNCTION public.cupones_actualizar(UUID, BIGINT, BIGINT, public.tipo_descuento_cupon, NUMERIC, DATE, BOOLEAN);

CREATE FUNCTION public.cupones_insertar(
    p_id UUID,
    p_nombre TEXT,
    p_cliente_id BIGINT,
    p_servicio_id BIGINT,
    p_tipo_descuento public.tipo_descuento_cupon,
    p_valor NUMERIC(10, 2),
    p_fecha_expiracion DATE,
    p_uso_unico BOOLEAN,
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

    IF p_fecha_expiracion IS NOT NULL
       AND p_fecha_expiracion < (CLOCK_TIMESTAMP() AT TIME ZONE 'America/Guatemala')::DATE THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'FECHA_EXPIRACION_INVALIDA';
    END IF;

    INSERT INTO public.cupones (
        id, nombre, cliente_id, servicio_id, tipo_descuento, valor,
        fecha_expiracion, activo, uso_unico, origen, creado_por_usuario_id
    )
    VALUES (
        p_id, BTRIM(p_nombre), p_cliente_id, p_servicio_id, p_tipo_descuento, p_valor,
        p_fecha_expiracion, p_activo, p_uso_unico, 'manual', v_actor
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

CREATE FUNCTION public.cupones_actualizar(
    p_id UUID,
    p_nombre TEXT,
    p_cliente_id BIGINT,
    p_servicio_id BIGINT,
    p_tipo_descuento public.tipo_descuento_cupon,
    p_valor NUMERIC(10, 2),
    p_fecha_expiracion DATE,
    p_uso_unico BOOLEAN,
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
    IF p_fecha_expiracion IS NOT NULL
       AND p_fecha_expiracion < (CLOCK_TIMESTAMP() AT TIME ZONE 'America/Guatemala')::DATE THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'FECHA_EXPIRACION_INVALIDA';
    END IF;

    UPDATE public.cupones
    SET nombre = BTRIM(p_nombre),
        cliente_id = p_cliente_id,
        servicio_id = p_servicio_id,
        tipo_descuento = p_tipo_descuento,
        valor = p_valor,
        fecha_expiracion = p_fecha_expiracion,
        uso_unico = p_uso_unico,
        activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;

    PERFORM petstore_private.auditar_cambio(
        'cupones', p_id::TEXT, 'actualizar',
        TO_JSONB(v_anterior), TO_JSONB(v_fila), NULL, NULL
    );
    RETURN v_fila;
EXCEPTION
    WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE OR REPLACE FUNCTION public.cupones_listar_por_cliente(p_cliente_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CLIENTE_NO_ENCONTRADO';
    END IF;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(c) ORDER BY c.creado_en DESC, c.id), '[]'::JSONB)
    INTO v_resultado
    FROM public.cupones c
    WHERE c.cliente_id = p_cliente_id OR c.cliente_id IS NULL;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.clientes_progreso_fidelidad_listar()
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    WITH config AS (
        SELECT servicios_requeridos_cupon, fidelidad_inicia_en
        FROM public.configuracion_sistema
        WHERE id = 1
    ), conteos AS (
        SELECT m.cliente_id, COUNT(*)::INTEGER AS completados
        FROM public.registros_servicio rs
        INNER JOIN public.citas ci ON ci.id = rs.cita_id
        INNER JOIN public.mascotas m ON m.id = ci.mascota_id
        LEFT JOIN public.cupones cp ON cp.id = rs.cupon_id
        CROSS JOIN config
        WHERE rs.estado = 'completado'
          AND rs.activo = TRUE
          AND rs.fin_real >= config.fidelidad_inicia_en
          AND (rs.cupon_id IS NULL OR cp.uso_unico = FALSE)
        GROUP BY m.cliente_id
    )
    SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'cliente_id', c.id,
        'completados', MOD(COALESCE(co.completados, 0), config.servicios_requeridos_cupon),
        'requeridos', config.servicios_requeridos_cupon
    ) ORDER BY c.id), '[]'::JSONB)
    INTO v_resultado
    FROM public.clientes c
    CROSS JOIN config
    LEFT JOIN conteos co ON co.cliente_id = c.id
    WHERE c.activo = TRUE;

    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.configuracion_sistema_actualizar(BOOLEAN, BOOLEAN, INTEGER, BIGINT, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cupones_insertar(UUID, TEXT, BIGINT, BIGINT, public.tipo_descuento_cupon, NUMERIC, DATE, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cupones_actualizar(UUID, TEXT, BIGINT, BIGINT, public.tipo_descuento_cupon, NUMERIC, DATE, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clientes_progreso_fidelidad_listar() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.configuracion_sistema_actualizar(BOOLEAN, BOOLEAN, INTEGER, BIGINT, BOOLEAN, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cupones_insertar(UUID, TEXT, BIGINT, BIGINT, public.tipo_descuento_cupon, NUMERIC, DATE, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cupones_actualizar(UUID, TEXT, BIGINT, BIGINT, public.tipo_descuento_cupon, NUMERIC, DATE, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clientes_progreso_fidelidad_listar() TO authenticated, service_role;
