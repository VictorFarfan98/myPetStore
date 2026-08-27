CREATE FUNCTION public.clientes_buscar_listar(
    p_busqueda TEXT,
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
    v_busqueda TEXT;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    v_busqueda := NULLIF(BTRIM(COALESCE(p_busqueda, '')), '');

    WITH base AS (
        SELECT c.*
        FROM public.clientes c
        WHERE c.activo = TRUE
          AND (
              v_busqueda IS NULL
              OR c.nombre ILIKE '%' || v_busqueda || '%'
              OR c.telefono ILIKE '%' || v_busqueda || '%'
              OR COALESCE(c.email, '') ILIKE '%' || v_busqueda || '%'
              OR COALESCE(c.notas, '') ILIKE '%' || v_busqueda || '%'
              OR EXISTS (
                  SELECT 1
                  FROM public.mascotas m
                  WHERE m.cliente_id = c.id
                    AND m.activo = TRUE
                    AND (m.nombre ILIKE '%' || v_busqueda || '%' OR m.raza ILIKE '%' || v_busqueda || '%')
              )
          )
    ), pagina AS (
        SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.mascotas_buscar_listar(
    p_busqueda TEXT,
    p_limite BIGINT DEFAULT NULL,
    p_offset BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
    v_busqueda TEXT;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    v_busqueda := NULLIF(BTRIM(COALESCE(p_busqueda, '')), '');

    WITH base AS (
        SELECT m.*
        FROM public.mascotas m
        INNER JOIN public.clientes c ON c.id = m.cliente_id
        WHERE m.activo = TRUE
          AND c.activo = TRUE
          AND (
              v_busqueda IS NULL
              OR m.nombre ILIKE '%' || v_busqueda || '%'
              OR m.raza ILIKE '%' || v_busqueda || '%'
              OR m.especie ILIKE '%' || v_busqueda || '%'
              OR c.nombre ILIKE '%' || v_busqueda || '%'
              OR c.telefono ILIKE '%' || v_busqueda || '%'
              OR COALESCE(c.email, '') ILIKE '%' || v_busqueda || '%'
          )
    ), pagina AS (
        SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((SELECT JSONB_AGG(TO_JSONB(p) ORDER BY p.id) FROM pagina p), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.clientes_buscar_listar(TEXT, BIGINT, BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mascotas_buscar_listar(TEXT, BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clientes_buscar_listar(TEXT, BIGINT, BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mascotas_buscar_listar(TEXT, BIGINT, BIGINT) TO authenticated, service_role;
