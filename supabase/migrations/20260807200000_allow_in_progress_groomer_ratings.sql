CREATE OR REPLACE FUNCTION public.calificaciones_groomer_insertar(
    p_registro_servicio_id BIGINT,
    p_calificacion SMALLINT,
    p_calificacion_notas TEXT DEFAULT NULL
)
RETURNS public.calificaciones_groomer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_registro public.registros_servicio;
    v_cita public.citas;
    v_config public.configuracion_sistema;
    v_fila public.calificaciones_groomer;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    IF p_calificacion IS NULL OR p_calificacion NOT BETWEEN 0 AND 5 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CALIFICACION_INVALIDA';
    END IF;

    SELECT * INTO v_config FROM public.configuracion_sistema WHERE id = 1;
    IF NOT FOUND OR NOT v_config.habilitar_calificaciones THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CALIFICACIONES_DESHABILITADAS';
    END IF;

    SELECT * INTO v_registro
    FROM public.registros_servicio
    WHERE id = p_registro_servicio_id
      AND activo = TRUE
      AND firma_entrega_url IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'SERVICIO_SIN_FIRMA_DE_ENTREGA';
    END IF;

    SELECT * INTO v_cita FROM public.citas WHERE id = v_registro.cita_id;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);

    INSERT INTO public.calificaciones_groomer (peluquero_id, mascota_id, registro_servicio_id, calificacion, calificacion_notas)
    VALUES (v_registro.peluquero_id, v_cita.mascota_id, p_registro_servicio_id, p_calificacion, NULLIF(BTRIM(p_calificacion_notas), ''))
    RETURNING * INTO v_fila;

    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'SERVICIO_YA_CALIFICADO';
    WHEN check_violation OR not_null_violation OR foreign_key_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;
