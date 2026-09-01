ALTER TABLE public.cupones
    DROP CONSTRAINT cupones_automaticos_validos;

UPDATE public.cupones c
SET servicio_id = rs.servicio_id
FROM public.registros_servicio rs
WHERE c.origen = 'automatico'
  AND c.servicio_id IS NULL
  AND c.registro_origen_id = rs.id;

ALTER TABLE public.cupones
    ADD CONSTRAINT cupones_automaticos_validos CHECK (
        origen <> 'automatico'
        OR (
            cliente_id IS NOT NULL
            AND servicio_id IS NOT NULL
            AND tipo_descuento = 'porcentaje'
            AND valor = 100
            AND fecha_expiracion IS NOT NULL
            AND uso_unico = TRUE
            AND registro_origen_id IS NOT NULL
        )
    );

ALTER TABLE public.fidelidad_ajustes
    ADD COLUMN servicio_id BIGINT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT;

CREATE TABLE public.fidelidad_clientes_servicios (
    cliente_id BIGINT NOT NULL
        REFERENCES public.clientes(id) ON DELETE RESTRICT,
    servicio_id BIGINT NOT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT,
    completados INTEGER NOT NULL DEFAULT 0
        CHECK (completados >= 0),
    primer_progreso_en TIMESTAMPTZ NULL,
    ultimo_progreso_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cliente_id, servicio_id),
    CHECK (
        (completados = 0 AND primer_progreso_en IS NULL AND ultimo_progreso_en IS NULL)
        OR (completados > 0 AND primer_progreso_en IS NOT NULL AND ultimo_progreso_en IS NOT NULL)
    )
);

ALTER TABLE public.fidelidad_clientes_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY fidelidad_clientes_servicios_select
ON public.fidelidad_clientes_servicios FOR SELECT TO authenticated
USING ((SELECT petstore_private.usuario_activo()));

CREATE POLICY fidelidad_clientes_servicios_insert
ON public.fidelidad_clientes_servicios FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

CREATE POLICY fidelidad_clientes_servicios_update
ON public.fidelidad_clientes_servicios FOR UPDATE TO authenticated
USING ((SELECT petstore_private.es_admin_propietario()))
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

GRANT SELECT, INSERT, UPDATE ON TABLE public.fidelidad_clientes_servicios TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.fidelidad_clientes_servicios TO service_role;

CREATE TRIGGER trg_fidelidad_clientes_servicios_actualizado_en
BEFORE UPDATE ON public.fidelidad_clientes_servicios
FOR EACH ROW EXECUTE FUNCTION public.establecer_actualizado_en();

CREATE OR REPLACE FUNCTION petstore_private.calcular_fidelidad_servicio(
    p_cliente_id BIGINT,
    p_servicio_id BIGINT
)
RETURNS TABLE (
    completados INTEGER,
    primer_progreso_en TIMESTAMPTZ,
    ultimo_progreso_en TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requeridos INTEGER;
    v_plazo_dias INTEGER;
    v_inactividad_dias INTEGER;
    v_progreso INTEGER := 0;
    v_primer_progreso TIMESTAMPTZ;
    v_ultimo_progreso TIMESTAMPTZ;
    v_evento RECORD;
BEGIN
    SELECT servicios_requeridos_cupon,
           fidelidad_dias_para_completar,
           fidelidad_dias_inactividad
    INTO STRICT v_requeridos, v_plazo_dias, v_inactividad_dias
    FROM public.configuracion_sistema
    WHERE id = 1;

    FOR v_evento IN
        SELECT rs.fin_real
        FROM public.registros_servicio rs
        INNER JOIN public.citas ci ON ci.id = rs.cita_id
        INNER JOIN public.mascotas m ON m.id = ci.mascota_id
        LEFT JOIN public.cupones cp ON cp.id = rs.cupon_id
        CROSS JOIN public.configuracion_sistema config
        WHERE m.cliente_id = p_cliente_id
          AND rs.servicio_id = p_servicio_id
          AND rs.estado = 'completado'
          AND rs.activo = TRUE
          AND rs.fin_real >= config.fidelidad_inicia_en
          AND (rs.cupon_id IS NULL OR cp.uso_unico = FALSE)
          AND config.id = 1
        ORDER BY rs.fin_real, rs.id
    LOOP
        IF v_primer_progreso IS NULL
           OR v_evento.fin_real > v_primer_progreso + (v_plazo_dias * INTERVAL '1 day')
           OR (
               v_inactividad_dias IS NOT NULL
               AND v_evento.fin_real > v_ultimo_progreso + (v_inactividad_dias * INTERVAL '1 day')
           ) THEN
            v_progreso := 1;
            v_primer_progreso := v_evento.fin_real;
        ELSE
            v_progreso := v_progreso + 1;
        END IF;

        v_ultimo_progreso := v_evento.fin_real;

        IF v_progreso >= v_requeridos THEN
            v_progreso := 0;
            v_primer_progreso := NULL;
            v_ultimo_progreso := NULL;
        END IF;
    END LOOP;

    completados := v_progreso;
    primer_progreso_en := v_primer_progreso;
    ultimo_progreso_en := v_ultimo_progreso;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION petstore_private.sincronizar_fidelidad_servicio(
    p_cliente_id BIGINT,
    p_servicio_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_calculo RECORD;
BEGIN
    SELECT *
    INTO v_calculo
    FROM petstore_private.calcular_fidelidad_servicio(p_cliente_id, p_servicio_id);

    INSERT INTO public.fidelidad_clientes_servicios (
        cliente_id, servicio_id, completados, primer_progreso_en, ultimo_progreso_en
    )
    VALUES (
        p_cliente_id, p_servicio_id,
        COALESCE(v_calculo.completados, 0),
        v_calculo.primer_progreso_en,
        v_calculo.ultimo_progreso_en
    )
    ON CONFLICT (cliente_id, servicio_id) DO UPDATE
    SET completados = EXCLUDED.completados,
        primer_progreso_en = EXCLUDED.primer_progreso_en,
        ultimo_progreso_en = EXCLUDED.ultimo_progreso_en;
END;
$$;

CREATE OR REPLACE FUNCTION petstore_private.aplicar_progreso_fidelidad_servicio(
    p_cliente_id BIGINT,
    p_servicio_id BIGINT,
    p_fecha TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requeridos INTEGER;
    v_plazo_dias INTEGER;
    v_inactividad_dias INTEGER;
    v_progreso INTEGER;
    v_primer_progreso TIMESTAMPTZ;
    v_ultimo_progreso TIMESTAMPTZ;
BEGIN
    PERFORM 1 FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;

    SELECT servicios_requeridos_cupon,
           fidelidad_dias_para_completar,
           fidelidad_dias_inactividad
    INTO STRICT v_requeridos, v_plazo_dias, v_inactividad_dias
    FROM public.configuracion_sistema
    WHERE id = 1;

    SELECT completados, primer_progreso_en, ultimo_progreso_en
    INTO v_progreso, v_primer_progreso, v_ultimo_progreso
    FROM public.fidelidad_clientes_servicios
    WHERE cliente_id = p_cliente_id
      AND servicio_id = p_servicio_id
    FOR UPDATE;

    v_progreso := COALESCE(v_progreso, 0);
    IF v_primer_progreso IS NOT NULL
       AND (
           p_fecha > v_primer_progreso + (v_plazo_dias * INTERVAL '1 day')
           OR (
               v_inactividad_dias IS NOT NULL
               AND p_fecha > v_ultimo_progreso + (v_inactividad_dias * INTERVAL '1 day')
           )
       ) THEN
        v_progreso := 0;
        v_primer_progreso := NULL;
        v_ultimo_progreso := NULL;
    END IF;

    IF v_progreso + 1 >= v_requeridos THEN
        INSERT INTO public.fidelidad_clientes_servicios (
            cliente_id, servicio_id, completados, primer_progreso_en, ultimo_progreso_en
        )
        VALUES (p_cliente_id, p_servicio_id, 0, NULL, NULL)
        ON CONFLICT (cliente_id, servicio_id) DO UPDATE
        SET completados = 0,
            primer_progreso_en = NULL,
            ultimo_progreso_en = NULL;
        RETURN TRUE;
    END IF;

    INSERT INTO public.fidelidad_clientes_servicios (
        cliente_id, servicio_id, completados, primer_progreso_en, ultimo_progreso_en
    )
    VALUES (
        p_cliente_id, p_servicio_id, v_progreso + 1,
        COALESCE(v_primer_progreso, p_fecha), p_fecha
    )
    ON CONFLICT (cliente_id, servicio_id) DO UPDATE
    SET completados = EXCLUDED.completados,
        primer_progreso_en = EXCLUDED.primer_progreso_en,
        ultimo_progreso_en = EXCLUDED.ultimo_progreso_en;
    RETURN FALSE;
END;
$$;

INSERT INTO public.fidelidad_clientes_servicios (
    cliente_id, servicio_id, completados, primer_progreso_en, ultimo_progreso_en
)
SELECT c.id,
       s.id,
       calculo.completados,
       calculo.primer_progreso_en,
       calculo.ultimo_progreso_en
FROM public.clientes c
CROSS JOIN public.servicios s
CROSS JOIN LATERAL petstore_private.calcular_fidelidad_servicio(c.id, s.id) calculo
WHERE s.es_adicional = FALSE
ON CONFLICT (cliente_id, servicio_id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_generar_cupon_fidelidad ON public.registros_servicio;
DROP FUNCTION IF EXISTS petstore_private.generar_cupon_fidelidad();

CREATE OR REPLACE FUNCTION petstore_private.actualizar_fidelidad_desde_registro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cliente_id BIGINT;
    v_cliente_anterior_id BIGINT;
    v_cuenta_nueva BOOLEAN;
    v_cuenta_anterior BOOLEAN := FALSE;
    v_mismo_servicio BOOLEAN := TRUE;
    v_alcanzo_hito BOOLEAN := FALSE;
    v_actor UUID := auth.uid();
    v_config public.configuracion_sistema%ROWTYPE;
    v_cupon public.cupones;
BEGIN
    SELECT m.cliente_id
    INTO v_cliente_id
    FROM public.citas ci
    INNER JOIN public.mascotas m ON m.id = ci.mascota_id
    WHERE ci.id = NEW.cita_id;

    v_cuenta_nueva := petstore_private.registro_servicio_cuenta_fidelidad(
        NEW.estado, NEW.activo, NEW.fin_real, NEW.cupon_id
    );

    IF TG_OP = 'UPDATE' THEN
        SELECT m.cliente_id
        INTO v_cliente_anterior_id
        FROM public.citas ci
        INNER JOIN public.mascotas m ON m.id = ci.mascota_id
        WHERE ci.id = OLD.cita_id;

        v_cuenta_anterior := petstore_private.registro_servicio_cuenta_fidelidad(
            OLD.estado, OLD.activo, OLD.fin_real, OLD.cupon_id
        );
        v_mismo_servicio := v_cliente_id IS NOT DISTINCT FROM v_cliente_anterior_id
            AND NEW.servicio_id IS NOT DISTINCT FROM OLD.servicio_id;

        IF v_cuenta_anterior
           AND (
               NOT v_cuenta_nueva
               OR NOT v_mismo_servicio
           )
           AND v_cliente_anterior_id IS NOT NULL THEN
            PERFORM petstore_private.sincronizar_fidelidad_servicio(v_cliente_anterior_id, OLD.servicio_id);
        END IF;
    END IF;

    IF v_cuenta_nueva
       AND (TG_OP = 'INSERT' OR NOT v_cuenta_anterior OR NOT v_mismo_servicio)
       AND v_cliente_id IS NOT NULL THEN
        v_alcanzo_hito := petstore_private.aplicar_progreso_fidelidad_servicio(
            v_cliente_id, NEW.servicio_id, NEW.fin_real
        );
    ELSIF v_cuenta_nueva
          AND TG_OP = 'UPDATE'
          AND v_mismo_servicio
          AND (
              OLD.fin_real IS DISTINCT FROM NEW.fin_real
              OR OLD.cupon_id IS DISTINCT FROM NEW.cupon_id
          )
          AND v_cliente_id IS NOT NULL THEN
        PERFORM petstore_private.sincronizar_fidelidad_servicio(v_cliente_id, NEW.servicio_id);
    END IF;

    IF v_alcanzo_hito THEN
        SELECT *
        INTO STRICT v_config
        FROM public.configuracion_sistema
        WHERE id = 1;

        INSERT INTO public.cupones (
            id, nombre, cliente_id, servicio_id, tipo_descuento, valor,
            fecha_expiracion, activo, uso_unico, origen,
            registro_origen_id, creado_por_usuario_id
        )
        VALUES (
            gen_random_uuid(), 'Recompensa de fidelidad', v_cliente_id, NEW.servicio_id,
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
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_fidelidad_desde_registro ON public.registros_servicio;
CREATE TRIGGER trg_actualizar_fidelidad_desde_registro
AFTER INSERT OR UPDATE OF cita_id, servicio_id, estado, activo, fin_real, cupon_id ON public.registros_servicio
FOR EACH ROW EXECUTE FUNCTION petstore_private.actualizar_fidelidad_desde_registro();

REVOKE ALL ON FUNCTION petstore_private.calcular_fidelidad_servicio(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION petstore_private.sincronizar_fidelidad_servicio(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION petstore_private.aplicar_progreso_fidelidad_servicio(BIGINT, BIGINT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.clientes_progreso_fidelidad_listar();

CREATE FUNCTION public.clientes_progreso_fidelidad_listar()
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();

    SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'cliente_id', c.id,
        'servicio_id', s.id,
        'servicio_nombre', s.nombre,
        'completados', CASE
            WHEN fc.primer_progreso_en IS NULL
              OR CURRENT_TIMESTAMP > fc.primer_progreso_en + (config.fidelidad_dias_para_completar * INTERVAL '1 day')
              OR (
                  config.fidelidad_dias_inactividad IS NOT NULL
                  AND CURRENT_TIMESTAMP > fc.ultimo_progreso_en + (config.fidelidad_dias_inactividad * INTERVAL '1 day')
              )
            THEN 0
            ELSE COALESCE(fc.completados, 0)
        END,
        'requeridos', config.servicios_requeridos_cupon,
        'primer_progreso_en', fc.primer_progreso_en,
        'ultimo_progreso_en', fc.ultimo_progreso_en
    ) ORDER BY c.id, s.nombre), '[]'::JSONB)
    INTO v_resultado
    FROM public.clientes c
    CROSS JOIN public.configuracion_sistema config
    INNER JOIN public.servicios s ON s.activo = TRUE AND s.es_adicional = FALSE
    LEFT JOIN public.fidelidad_clientes_servicios fc
        ON fc.cliente_id = c.id AND fc.servicio_id = s.id
    WHERE c.activo = TRUE
      AND config.id = 1;

    RETURN v_resultado;
END;
$$;

DROP FUNCTION public.clientes_fidelidad_actualizar(BIGINT, INTEGER, TEXT);

CREATE FUNCTION public.clientes_fidelidad_actualizar(
    p_cliente_id BIGINT,
    p_servicio_id BIGINT,
    p_completados INTEGER,
    p_motivo TEXT
)
RETURNS public.fidelidad_clientes_servicios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_actor UUID;
    v_requeridos INTEGER;
    v_anterior INTEGER;
    v_fila public.fidelidad_clientes_servicios;
BEGIN
    v_actor := petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();

    IF p_motivo IS NULL OR BTRIM(p_motivo) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MOTIVO_REQUERIDO';
    END IF;

    SELECT servicios_requeridos_cupon
    INTO v_requeridos
    FROM public.configuracion_sistema
    WHERE id = 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_SISTEMA_NO_ENCONTRADA';
    END IF;
    IF p_completados IS NULL OR p_completados < 0 OR p_completados >= v_requeridos THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PROGRESO_FIDELIDAD_INVALIDO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND activo = TRUE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CLIENTE_NO_ENCONTRADO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.servicios WHERE id = p_servicio_id AND es_adicional = FALSE) THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'SERVICIO_NO_ENCONTRADO';
    END IF;

    SELECT COALESCE(completados, 0)
    INTO v_anterior
    FROM public.fidelidad_clientes_servicios
    WHERE cliente_id = p_cliente_id
      AND servicio_id = p_servicio_id
    FOR UPDATE;
    v_anterior := COALESCE(v_anterior, 0);

    INSERT INTO public.fidelidad_clientes_servicios (
        cliente_id, servicio_id, completados, primer_progreso_en, ultimo_progreso_en
    )
    VALUES (
        p_cliente_id, p_servicio_id, p_completados,
        CASE WHEN p_completados = 0 THEN NULL ELSE CURRENT_TIMESTAMP END,
        CASE WHEN p_completados = 0 THEN NULL ELSE CURRENT_TIMESTAMP END
    )
    ON CONFLICT (cliente_id, servicio_id) DO UPDATE
    SET completados = EXCLUDED.completados,
        primer_progreso_en = EXCLUDED.primer_progreso_en,
        ultimo_progreso_en = EXCLUDED.ultimo_progreso_en
    RETURNING * INTO v_fila;

    INSERT INTO public.fidelidad_ajustes (
        cliente_id, servicio_id, creditos_anteriores, creditos_nuevos,
        completados_anteriores, completados_nuevos, motivo, usuario_id
    )
    VALUES (
        p_cliente_id, p_servicio_id, v_anterior, p_completados,
        v_anterior, p_completados, BTRIM(p_motivo), v_actor
    );

    PERFORM petstore_private.auditar_cambio(
        'fidelidad_clientes_servicios', p_cliente_id::TEXT || ':' || p_servicio_id::TEXT, 'ajustar',
        JSONB_BUILD_OBJECT('completados', v_anterior, 'servicio_id', p_servicio_id),
        JSONB_BUILD_OBJECT('completados', p_completados, 'servicio_id', p_servicio_id),
        NULL, BTRIM(p_motivo)
    );

    RETURN v_fila;
END;
$$;

DROP FUNCTION public.clientes_fidelidad_reconciliar();

CREATE FUNCTION public.clientes_fidelidad_reconciliar()
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();

    WITH config AS (
        SELECT servicios_requeridos_cupon,
               fidelidad_dias_para_completar,
               fidelidad_dias_inactividad,
               fidelidad_inicia_en
        FROM public.configuracion_sistema
        WHERE id = 1
    ), pares AS (
        SELECT c.id AS cliente_id,
               c.nombre AS cliente_nombre,
               s.id AS servicio_id,
               s.nombre AS servicio_nombre
        FROM public.clientes c
        CROSS JOIN public.servicios s
        WHERE c.activo = TRUE
          AND s.activo = TRUE
          AND s.es_adicional = FALSE
    ), esperados AS (
        SELECT p.*,
               calculo.completados AS esperado,
               COALESCE((
                   SELECT COUNT(*)::INTEGER
                   FROM public.registros_servicio rs
                   INNER JOIN public.citas ci ON ci.id = rs.cita_id
                   INNER JOIN public.mascotas m ON m.id = ci.mascota_id
                   LEFT JOIN public.cupones cp ON cp.id = rs.cupon_id
                   CROSS JOIN config
                   WHERE m.cliente_id = p.cliente_id
                     AND rs.servicio_id = p.servicio_id
                     AND rs.estado = 'completado'
                     AND rs.activo = TRUE
                     AND rs.fin_real >= config.fidelidad_inicia_en
                     AND (rs.cupon_id IS NULL OR cp.uso_unico = FALSE)
               ), 0) AS servicios_completados
        FROM pares p
        CROSS JOIN LATERAL petstore_private.calcular_fidelidad_servicio(p.cliente_id, p.servicio_id) calculo
    ), diferencias AS (
        SELECT e.*,
               CASE
                   WHEN fc.primer_progreso_en IS NULL
                     OR CURRENT_TIMESTAMP > fc.primer_progreso_en + (config.fidelidad_dias_para_completar * INTERVAL '1 day')
                     OR (
                         config.fidelidad_dias_inactividad IS NOT NULL
                         AND CURRENT_TIMESTAMP > fc.ultimo_progreso_en + (config.fidelidad_dias_inactividad * INTERVAL '1 day')
                     )
                   THEN 0
                   ELSE COALESCE(fc.completados, 0)
               END AS actual,
               config.servicios_requeridos_cupon AS requeridos
        FROM esperados e
        CROSS JOIN config
        LEFT JOIN public.fidelidad_clientes_servicios fc
            ON fc.cliente_id = e.cliente_id AND fc.servicio_id = e.servicio_id
    )
    SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'cliente_id', cliente_id,
        'cliente_nombre', cliente_nombre,
        'servicio_id', servicio_id,
        'servicio_nombre', servicio_nombre,
        'actual', actual,
        'esperado', esperado,
        'servicios_completados', servicios_completados,
        'requeridos', requeridos
    ) ORDER BY cliente_nombre, servicio_nombre, servicio_id) FILTER (WHERE actual IS DISTINCT FROM esperado), '[]'::JSONB)
    INTO v_resultado
    FROM diferencias;

    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.clientes_progreso_fidelidad_listar() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clientes_fidelidad_actualizar(BIGINT, BIGINT, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clientes_fidelidad_reconciliar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clientes_progreso_fidelidad_listar() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clientes_fidelidad_actualizar(BIGINT, BIGINT, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clientes_fidelidad_reconciliar() TO authenticated, service_role;
