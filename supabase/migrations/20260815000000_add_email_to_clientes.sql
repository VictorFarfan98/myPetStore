BEGIN;

ALTER TABLE public.clientes
ADD COLUMN email TEXT NULL
    CHECK (email IS NULL OR email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

DROP FUNCTION public.clientes_insertar(TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN);
DROP FUNCTION public.clientes_actualizar(BIGINT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN);

CREATE FUNCTION public.clientes_insertar(
    p_nombre TEXT,
    p_telefono TEXT,
    p_email TEXT,
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
        nombre, telefono, email, whatsapp_opt_in, sms_opt_in, notas, activo
    )
    VALUES (
        BTRIM(p_nombre), BTRIM(p_telefono), NULLIF(LOWER(BTRIM(p_email)), ''),
        p_whatsapp_opt_in, p_sms_opt_in, p_notas, p_activo
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

CREATE FUNCTION public.clientes_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_telefono TEXT,
    p_email TEXT,
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
    SET nombre = BTRIM(p_nombre),
        telefono = BTRIM(p_telefono),
        email = NULLIF(LOWER(BTRIM(p_email)), ''),
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

GRANT EXECUTE ON FUNCTION public.clientes_insertar(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clientes_actualizar(BIGINT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) TO authenticated, service_role;

COMMIT;
