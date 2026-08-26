CREATE OR REPLACE FUNCTION public.reportes_peluqueros_obtener()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    WITH registros_completados AS (
        SELECT rs.*
        FROM public.registros_servicio rs
        INNER JOIN public.citas c ON c.id = rs.cita_id
        WHERE rs.activo = TRUE
          AND rs.estado = 'completado'
          AND c.activo = TRUE
          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
    ),
    peluqueros_visibles AS (
        SELECT p.*
        FROM public.peluqueros p
        WHERE p.activo = TRUE
    )
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((
            SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'peluquero_id', p.id,
                    'peluquero_nombre', p.nombre,
                    'servicios_completados', COALESCE((
                        SELECT COUNT(*)
                        FROM registros_completados rs
                        WHERE rs.peluquero_id = p.id
                    ), 0),
                    'adicionales_realizados', COALESCE((
                        SELECT SUM(rsa.cantidad)
                        FROM registros_completados rs
                        INNER JOIN public.registros_servicio_adicionales rsa
                            ON rsa.registro_servicio_id = rs.id
                        WHERE rs.peluquero_id = p.id
                          AND rsa.activo = TRUE
                    ), 0),
                    'duracion_promedio_minutos', COALESCE((
                        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (rs.fin_real - rs.inicio_real)) / 60))
                        FROM registros_completados rs
                        WHERE rs.peluquero_id = p.id
                          AND rs.fin_real IS NOT NULL
                    ), 0),
                    'monto_servicios', COALESCE((
                        SELECT SUM(rs.precio_base)
                        FROM registros_completados rs
                        WHERE rs.peluquero_id = p.id
                    ), 0),
                    'monto_adicionales', COALESCE((
                        SELECT SUM(rsa.precio * rsa.cantidad)
                        FROM registros_completados rs
                        INNER JOIN public.registros_servicio_adicionales rsa
                            ON rsa.registro_servicio_id = rs.id
                        WHERE rs.peluquero_id = p.id
                          AND rsa.activo = TRUE
                    ), 0),
                    'monto_total_generado', COALESCE((
                        SELECT SUM(rs.precio_base)
                        FROM registros_completados rs
                        WHERE rs.peluquero_id = p.id
                    ), 0) + COALESCE((
                        SELECT SUM(rsa.precio * rsa.cantidad)
                        FROM registros_completados rs
                        INNER JOIN public.registros_servicio_adicionales rsa
                            ON rsa.registro_servicio_id = rs.id
                        WHERE rs.peluquero_id = p.id
                          AND rsa.activo = TRUE
                    ), 0),
                    'calificacion_promedio', (
                        SELECT ROUND(AVG(cg.calificacion), 2)
                        FROM public.calificaciones_groomer cg
                        INNER JOIN public.registros_servicio rs ON rs.id = cg.registro_servicio_id
                        INNER JOIN public.citas c ON c.id = rs.cita_id
                        WHERE cg.peluquero_id = p.id
                          AND rs.activo = TRUE
                          AND c.activo = TRUE
                          AND petstore_private.tiene_acceso_sucursal(c.sucursal_id)
                    ),
                    'servicios', COALESCE((
                        SELECT JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'servicio_id', stats.servicio_id,
                                'servicio_nombre', stats.servicio_nombre,
                                'cantidad', stats.cantidad,
                                'monto_total', stats.monto_total
                            ) ORDER BY stats.servicio_nombre
                        )
                        FROM LATERAL (
                            SELECT rs.servicio_id, s.nombre AS servicio_nombre,
                                   COUNT(*) AS cantidad, SUM(rs.precio_base) AS monto_total
                            FROM registros_completados rs
                            INNER JOIN public.servicios s ON s.id = rs.servicio_id
                            WHERE rs.peluquero_id = p.id
                            GROUP BY rs.servicio_id, s.nombre
                        ) stats
                    ), '[]'::JSONB),
                    'subservicios', COALESCE((
                        SELECT JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'servicio_id', stats.servicio_id,
                                'servicio_nombre', stats.servicio_nombre,
                                'cantidad', stats.cantidad,
                                'monto_total', stats.monto_total
                            ) ORDER BY stats.servicio_nombre
                        )
                        FROM LATERAL (
                            SELECT rsa.servicio_id, s.nombre AS servicio_nombre,
                                   SUM(rsa.cantidad) AS cantidad,
                                   SUM(rsa.precio * rsa.cantidad) AS monto_total
                            FROM registros_completados rs
                            INNER JOIN public.registros_servicio_adicionales rsa
                                ON rsa.registro_servicio_id = rs.id
                            INNER JOIN public.servicios s ON s.id = rsa.servicio_id
                            WHERE rs.peluquero_id = p.id
                              AND rsa.activo = TRUE
                            GROUP BY rsa.servicio_id, s.nombre
                        ) stats
                    ), '[]'::JSONB)
                ) ORDER BY p.nombre
            )
            FROM peluqueros_visibles p
        ), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM peluqueros_visibles)
    ) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

