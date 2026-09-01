ALTER TABLE public.configuracion_sistema
    ADD COLUMN fidelidad_dias_para_completar INTEGER NOT NULL DEFAULT 123
        CHECK (fidelidad_dias_para_completar > 0),
    ADD COLUMN fidelidad_dias_inactividad INTEGER NULL DEFAULT 31
        CHECK (fidelidad_dias_inactividad IS NULL OR fidelidad_dias_inactividad > 0);

DROP FUNCTION public.configuracion_sistema_actualizar(BOOLEAN, BOOLEAN, INTEGER, BIGINT, BOOLEAN, INTEGER, INTEGER);

CREATE FUNCTION public.configuracion_sistema_actualizar(
    p_foto_antes_requerida BOOLEAN,
    p_foto_despues_requerida BOOLEAN,
    p_dias_anticipacion_recordatorio INTEGER,
    p_metodo_pago_cupon_id BIGINT,
    p_habilitar_calificaciones BOOLEAN,
    p_servicios_requeridos_cupon INTEGER,
    p_vigencia_cupon_automatico_dias INTEGER,
    p_fidelidad_dias_para_completar INTEGER,
    p_fidelidad_dias_inactividad INTEGER
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
        vigencia_cupon_automatico_dias = p_vigencia_cupon_automatico_dias,
        fidelidad_dias_para_completar = p_fidelidad_dias_para_completar,
        fidelidad_dias_inactividad = p_fidelidad_dias_inactividad
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

REVOKE ALL ON FUNCTION public.configuracion_sistema_actualizar(BOOLEAN, BOOLEAN, INTEGER, BIGINT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configuracion_sistema_actualizar(BOOLEAN, BOOLEAN, INTEGER, BIGINT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated, service_role;
