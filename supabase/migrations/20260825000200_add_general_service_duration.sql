ALTER TABLE public.servicios
ADD COLUMN duracion_minutos INTEGER NULL CHECK (duracion_minutos > 0);

UPDATE public.servicios s
SET duracion_minutos = (
    SELECT MIN(ps.duracion_minutos)
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = s.id AND ps.activo = TRUE
)
WHERE s.es_adicional = FALSE;

DROP FUNCTION public.servicios_insertar(TEXT, INTEGER, BOOLEAN, NUMERIC, BOOLEAN);

CREATE FUNCTION public.servicios_insertar(
    p_nombre TEXT,
    p_intervalo_recordatorio_dias INTEGER,
    p_duracion_minutos INTEGER,
    p_es_adicional BOOLEAN,
    p_precio NUMERIC(10, 2),
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

    IF p_es_adicional AND (p_precio IS NULL OR p_precio < 0) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PRECIO_ADICIONAL_REQUERIDO';
    END IF;
    IF NOT p_es_adicional AND (p_duracion_minutos IS NULL OR p_duracion_minutos < 1) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DURACION_SERVICIO_REQUERIDA';
    END IF;

    INSERT INTO public.servicios (
        nombre,
        intervalo_recordatorio_dias,
        duracion_minutos,
        es_adicional,
        precio,
        activo
    )
    VALUES (
        BTRIM(p_nombre),
        p_intervalo_recordatorio_dias,
        CASE WHEN p_es_adicional THEN NULL ELSE p_duracion_minutos END,
        p_es_adicional,
        CASE WHEN p_es_adicional THEN p_precio ELSE NULL END,
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

DROP FUNCTION public.servicios_actualizar(BIGINT, TEXT, INTEGER, BOOLEAN, NUMERIC, BOOLEAN);

CREATE FUNCTION public.servicios_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_intervalo_recordatorio_dias INTEGER,
    p_duracion_minutos INTEGER,
    p_es_adicional BOOLEAN,
    p_precio NUMERIC(10, 2),
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

    IF p_es_adicional AND (p_precio IS NULL OR p_precio < 0) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PRECIO_ADICIONAL_REQUERIDO';
    END IF;
    IF NOT p_es_adicional AND (p_duracion_minutos IS NULL OR p_duracion_minutos < 1) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DURACION_SERVICIO_REQUERIDA';
    END IF;

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
        duracion_minutos = CASE WHEN p_es_adicional THEN NULL ELSE p_duracion_minutos END,
        es_adicional = p_es_adicional,
        precio = CASE WHEN p_es_adicional THEN p_precio ELSE NULL END,
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

CREATE OR REPLACE FUNCTION public.citas_insertar(
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
    v_especie public.especie_mascota;
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

    SELECT m.tamano_id, m.especie INTO v_tamano_id, v_especie
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

    SELECT COALESCE(
        s.duracion_minutos,
        (
            SELECT ps.duracion_minutos
            FROM public.precios_servicios ps
            WHERE ps.servicio_id = s.id
              AND ps.especie = v_especie
              AND ps.tamano_id = v_tamano_id
              AND ps.activo = TRUE
        )
    )
    INTO v_duracion
    FROM public.servicios s
    WHERE s.id = p_servicio_id;

    IF v_duracion IS NULL THEN
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

CREATE OR REPLACE FUNCTION public.citas_reprogramar(
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
    v_especie public.especie_mascota;
    v_duracion INTEGER;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    SELECT * INTO v_anterior FROM public.citas WHERE id = p_cita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    PERFORM petstore_private.requerir_acceso_sucursal(v_anterior.sucursal_id);

    SELECT m.tamano_id, m.especie INTO v_tamano_id, v_especie FROM public.mascotas m WHERE m.id = v_anterior.mascota_id AND m.activo = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MASCOTA_INACTIVA_O_INVALIDA'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = p_servicio_id AND s.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'SERVICIO_INACTIVO_O_INVALIDO';
    END IF;
    IF p_peluquero_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = p_peluquero_id AND p.activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PELUQUERO_INACTIVO_O_INVALIDO';
    END IF;

    SELECT COALESCE(
        s.duracion_minutos,
        (
            SELECT ps.duracion_minutos
            FROM public.precios_servicios ps
            WHERE ps.servicio_id = s.id
              AND ps.especie = v_especie
              AND ps.tamano_id = v_tamano_id
              AND ps.activo = TRUE
        )
    )
    INTO v_duracion
    FROM public.servicios s
    WHERE s.id = p_servicio_id;

    IF v_duracion IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA';
    END IF;

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

REVOKE ALL ON FUNCTION public.servicios_insertar(TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.servicios_actualizar(BIGINT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.servicios_insertar(TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.servicios_actualizar(BIGINT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, BOOLEAN) TO authenticated, service_role;
