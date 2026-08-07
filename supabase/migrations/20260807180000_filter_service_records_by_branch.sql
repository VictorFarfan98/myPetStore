DROP FUNCTION IF EXISTS public.registros_servicio_listar(BIGINT, BIGINT);

CREATE FUNCTION public.registros_servicio_listar(
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0,
    p_sucursal_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (
        SELECT rs.*
        FROM public.registros_servicio rs
        INNER JOIN public.citas c ON c.id = rs.cita_id
        WHERE rs.activo = TRUE
          AND (p_sucursal_id IS NULL OR c.sucursal_id = p_sucursal_id)
    ),
    pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base),
        'limite', p_limite,
        'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.registros_servicio_listar(BIGINT, BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registros_servicio_listar(BIGINT, BIGINT, BIGINT) TO authenticated, service_role;
