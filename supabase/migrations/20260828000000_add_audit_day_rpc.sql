CREATE INDEX IF NOT EXISTS ix_auditorias_creado_en
    ON public.auditorias (creado_en);

CREATE FUNCTION public.auditorias_listar_por_dia(p_fecha DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    IF p_fecha IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
    END IF;

    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE(JSONB_AGG(TO_JSONB(a) ORDER BY a.id DESC), '[]'::JSONB),
        'total', COUNT(*)
    )
    INTO v_resultado
    FROM public.auditorias a
    WHERE a.creado_en >= (p_fecha::TIMESTAMP AT TIME ZONE 'America/Guatemala')
      AND a.creado_en < ((p_fecha + 1)::TIMESTAMP AT TIME ZONE 'America/Guatemala');

    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.auditorias_listar_por_dia(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditorias_listar_por_dia(DATE) TO authenticated, service_role;
