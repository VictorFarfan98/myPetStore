ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'groomer';
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'driver';

ALTER TABLE public.peluqueros
    ADD COLUMN IF NOT EXISTS usuario_id UUID NULL
        REFERENCES public.usuarios(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_peluqueros_usuario_id
    ON public.peluqueros(usuario_id)
    WHERE usuario_id IS NOT NULL;

CREATE OR REPLACE FUNCTION petstore_private.validar_asignacion_trabajador()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_usuario_id UUID; v_rol TEXT; v_alcance TEXT; v_sucursales INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'usuarios' THEN
        v_usuario_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    ELSE
        v_usuario_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.usuario_id ELSE NEW.usuario_id END;
    END IF;
    SELECT u.rol::TEXT, u.alcance_acceso::TEXT INTO v_rol, v_alcance FROM public.usuarios u WHERE u.id = v_usuario_id AND u.activo = TRUE;
    IF v_rol IN ('groomer', 'driver') THEN
        SELECT COUNT(*) INTO v_sucursales FROM public.usuarios_sucursales us WHERE us.usuario_id = v_usuario_id AND us.activo = TRUE;
        IF v_alcance <> 'sucursales_asignadas' OR v_sucursales <> 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'TRABAJADOR_REQUIERE_UNA_SUCURSAL';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_usuario_trabajador ON public.usuarios;
CREATE CONSTRAINT TRIGGER trg_validar_usuario_trabajador
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION petstore_private.validar_asignacion_trabajador();

DROP TRIGGER IF EXISTS trg_validar_sucursal_trabajador ON public.usuarios_sucursales;
CREATE CONSTRAINT TRIGGER trg_validar_sucursal_trabajador
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios_sucursales
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION petstore_private.validar_asignacion_trabajador();

CREATE OR REPLACE FUNCTION petstore_private.es_encargado_o_superior()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT petstore_private.es_service_role()
        OR EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
              AND u.activo = TRUE
              AND u.rol::TEXT IN ('administrador', 'propietario', 'encargado')
        );
$$;

CREATE OR REPLACE FUNCTION petstore_private.es_trabajador_operativo()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = auth.uid()
          AND u.activo = TRUE
          AND u.rol::TEXT IN ('groomer', 'driver')
    );
$$;

CREATE OR REPLACE FUNCTION petstore_private.requerir_encargado_o_superior()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_usuario_id UUID;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();
    IF NOT petstore_private.es_encargado_o_superior() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'ROL_NO_AUTORIZADO';
    END IF;
    RETURN v_usuario_id;
END;
$$;

CREATE OR REPLACE FUNCTION petstore_private.requerir_reportes()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_usuario_id UUID;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();
    IF NOT petstore_private.es_encargado_o_superior() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'REPORTES_NO_AUTORIZADOS';
    END IF;
    RETURN v_usuario_id;
END;
$$;

CREATE OR REPLACE FUNCTION petstore_private.peluquero_actual_id()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p.id
    FROM public.peluqueros p
    INNER JOIN public.usuarios u ON u.id = p.usuario_id
    WHERE p.usuario_id = auth.uid()
      AND p.activo = TRUE
      AND u.activo = TRUE
      AND u.rol::TEXT = 'groomer'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION petstore_private.puede_acceder_cita(p_cita_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.citas c
        WHERE c.id = p_cita_id
          AND (
              petstore_private.tiene_acceso_sucursal(c.sucursal_id)
              OR c.peluquero_id = petstore_private.peluquero_actual_id()
          )
    );
$$;

CREATE OR REPLACE FUNCTION petstore_private.puede_acceder_registro(p_registro_servicio_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.registros_servicio rs
        WHERE rs.id = p_registro_servicio_id
          AND petstore_private.puede_acceder_cita(rs.cita_id)
    );
$$;

CREATE OR REPLACE FUNCTION petstore_private.puede_editar_pagos(p_registro_servicio_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT petstore_private.es_encargado_o_superior()
       AND petstore_private.puede_acceder_registro(p_registro_servicio_id);
$$;

CREATE OR REPLACE FUNCTION petstore_private.requerir_acceso_registro(p_registro_servicio_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_usuario_id UUID;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();
    IF NOT petstore_private.puede_acceder_registro(p_registro_servicio_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'REGISTRO_NO_AUTORIZADO';
    END IF;
    RETURN v_usuario_id;
END;
$$;

CREATE OR REPLACE FUNCTION petstore_private.tiene_acceso_sucursal(p_sucursal_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT petstore_private.es_service_role()
        OR EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
              AND u.activo = TRUE
              AND (
                  u.rol::TEXT IN ('administrador', 'propietario')
                  OR u.alcance_acceso = 'todas_las_sucursales'
                  OR EXISTS (
                      SELECT 1 FROM public.usuarios_sucursales us
                      WHERE us.usuario_id = u.id
                        AND us.sucursal_id = p_sucursal_id
                        AND us.activo = TRUE
                  )
              )
        );
$$;

CREATE OR REPLACE FUNCTION petstore_private.requerir_acceso_sucursal(p_sucursal_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_usuario_id UUID;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();
    IF NOT petstore_private.tiene_acceso_sucursal(p_sucursal_id)
       AND NOT EXISTS (
           SELECT 1 FROM public.citas c
           WHERE c.sucursal_id = p_sucursal_id
             AND c.peluquero_id = petstore_private.peluquero_actual_id()
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SUCURSAL_NO_AUTORIZADA';
    END IF;
    RETURN v_usuario_id;
END;
$$;

ALTER FUNCTION public.citas_insertar(BIGINT, BIGINT, BIGINT, BIGINT, TIMESTAMPTZ, public.origen_cita) RENAME TO citas_insertar_base;
ALTER FUNCTION public.citas_actualizar(BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, public.estado_cita, public.origen_cita, BOOLEAN) RENAME TO citas_actualizar_base;
ALTER FUNCTION public.citas_reprogramar(BIGINT, TIMESTAMPTZ, BIGINT, BIGINT) RENAME TO citas_reprogramar_base;
ALTER FUNCTION public.citas_cancelar(BIGINT, TEXT) RENAME TO citas_cancelar_base;
ALTER FUNCTION public.citas_marcar_no_asistio(BIGINT, TEXT) RENAME TO citas_marcar_no_asistio_base;

CREATE FUNCTION public.citas_insertar(p_mascota_id BIGINT, p_sucursal_id BIGINT, p_peluquero_id BIGINT, p_servicio_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_origen public.origen_cita)
RETURNS public.citas LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_encargado_o_superior(); RETURN public.citas_insertar_base($1, $2, $3, $4, $5, $6); END; $$;
CREATE FUNCTION public.citas_actualizar(p_id BIGINT, p_mascota_id BIGINT, p_sucursal_id BIGINT, p_peluquero_id BIGINT, p_servicio_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_fin_programado TIMESTAMPTZ, p_estado public.estado_cita, p_origen public.origen_cita, p_activo BOOLEAN)
RETURNS public.citas LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_encargado_o_superior(); RETURN public.citas_actualizar_base($1, $2, $3, $4, $5, $6, $7, $8, $9, $10); END; $$;
CREATE FUNCTION public.citas_reprogramar(p_cita_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_servicio_id BIGINT, p_peluquero_id BIGINT)
RETURNS public.citas LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_encargado_o_superior(); RETURN public.citas_reprogramar_base($1, $2, $3, $4); END; $$;
CREATE FUNCTION public.citas_cancelar(p_cita_id BIGINT, p_motivo TEXT)
RETURNS public.citas LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_encargado_o_superior(); RETURN public.citas_cancelar_base($1, $2); END; $$;
CREATE FUNCTION public.citas_marcar_no_asistio(p_cita_id BIGINT, p_motivo TEXT)
RETURNS public.citas LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_encargado_o_superior(); RETURN public.citas_marcar_no_asistio_base($1, $2); END; $$;

REVOKE ALL ON FUNCTION public.citas_insertar_base(BIGINT, BIGINT, BIGINT, BIGINT, TIMESTAMPTZ, public.origen_cita) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.citas_actualizar_base(BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, public.estado_cita, public.origen_cita, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.citas_reprogramar_base(BIGINT, TIMESTAMPTZ, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.citas_cancelar_base(BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.citas_marcar_no_asistio_base(BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citas_insertar(BIGINT, BIGINT, BIGINT, BIGINT, TIMESTAMPTZ, public.origen_cita) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.citas_actualizar(BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, public.estado_cita, public.origen_cita, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.citas_reprogramar(BIGINT, TIMESTAMPTZ, BIGINT, BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.citas_cancelar(BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.citas_marcar_no_asistio(BIGINT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.usuarios_obtener_perfil_actual()
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_usuario_id UUID; v_resultado JSONB;
BEGIN
    v_usuario_id := petstore_private.requerir_usuario_activo();
    SELECT TO_JSONB(u) || JSONB_BUILD_OBJECT(
        'peluquero_id', (SELECT p.id FROM public.peluqueros p WHERE p.usuario_id = u.id AND p.activo = TRUE LIMIT 1),
        'sucursales', COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                'usuario_id', us.usuario_id, 'sucursal_id', us.sucursal_id, 'sucursal', TO_JSONB(s)
            ) ORDER BY s.id)
            FROM public.usuarios_sucursales us
            INNER JOIN public.sucursales s ON s.id = us.sucursal_id
            WHERE us.usuario_id = u.id AND us.activo = TRUE AND s.activo = TRUE
        ), '[]'::JSONB)
    ) INTO v_resultado
    FROM public.usuarios u
    WHERE u.id = v_usuario_id AND u.activo = TRUE;
    IF v_resultado IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'USUARIO_INACTIVO';
    END IF;
    RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.registros_servicio_listar(
    p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0, p_sucursal_id BIGINT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.validar_paginacion(p_limite, p_offset);
    WITH base AS (
        SELECT rs.* FROM public.registros_servicio rs
        INNER JOIN public.citas c ON c.id = rs.cita_id
        WHERE rs.activo = TRUE
          AND (p_sucursal_id IS NULL OR c.sucursal_id = p_sucursal_id)
          AND petstore_private.puede_acceder_cita(c.id)
    ), pagina AS (SELECT * FROM base ORDER BY id ASC LIMIT p_limite OFFSET p_offset)
    SELECT JSONB_BUILD_OBJECT(
        'datos', COALESCE((
            SELECT JSONB_AGG(
                TO_JSONB(p) || JSONB_BUILD_OBJECT(
                    'adicionales', COALESCE((
                        SELECT JSONB_AGG(TO_JSONB(a) ORDER BY a.servicio_id)
                        FROM public.registros_servicio_adicionales a
                        WHERE a.registro_servicio_id = p.id AND a.activo = TRUE
                    ), '[]'::JSONB),
                    'fotos', COALESCE((
                        SELECT JSONB_AGG(TO_JSONB(f) ORDER BY f.momento, f.id)
                        FROM public.registros_servicio_fotos f
                        WHERE f.registro_servicio_id = p.id
                    ), '[]'::JSONB)
                ) ORDER BY p.id
            ) FROM pagina p
        ), '[]'::JSONB),
        'total', (SELECT COUNT(*) FROM base), 'limite', p_limite, 'offset', p_offset
    ) INTO v_resultado;
    RETURN v_resultado;
END;
$$;

CREATE FUNCTION public.peluqueros_vincular_usuario(p_peluquero_id BIGINT, p_usuario_id UUID)
RETURNS public.peluqueros
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.peluqueros;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    IF p_usuario_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = p_usuario_id AND u.rol::TEXT = 'groomer'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'USUARIO_DEBE_SER_GROOMER';
    END IF;
    UPDATE public.peluqueros
    SET usuario_id = p_usuario_id
    WHERE id = p_peluquero_id
    RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'GROOMER_YA_VINCULADO';
END;
$$;

DROP POLICY IF EXISTS sucursales_select ON public.sucursales;
CREATE POLICY sucursales_select ON public.sucursales FOR SELECT TO authenticated USING (
    (SELECT petstore_private.es_admin_propietario())
    OR (activo = TRUE AND (
        (SELECT petstore_private.tiene_acceso_sucursal(id))
        OR EXISTS (
            SELECT 1 FROM public.citas c
            WHERE c.sucursal_id = id AND c.peluquero_id = petstore_private.peluquero_actual_id()
        )
    ))
);

DROP POLICY IF EXISTS citas_select ON public.citas;
CREATE POLICY citas_select ON public.citas FOR SELECT TO authenticated USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_cita(id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

DROP POLICY IF EXISTS citas_insert ON public.citas;
CREATE POLICY citas_insert ON public.citas FOR INSERT TO authenticated WITH CHECK (
    (SELECT petstore_private.es_encargado_o_superior())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
);

DROP POLICY IF EXISTS citas_update ON public.citas;
CREATE POLICY citas_update ON public.citas FOR UPDATE TO authenticated USING (
    (SELECT petstore_private.es_encargado_o_superior())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
) WITH CHECK (
    (SELECT petstore_private.es_encargado_o_superior())
    AND (SELECT petstore_private.tiene_acceso_sucursal(sucursal_id))
);

DROP POLICY IF EXISTS registros_servicio_select ON public.registros_servicio;
CREATE POLICY registros_servicio_select ON public.registros_servicio FOR SELECT TO authenticated USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_registro(id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
);

DROP POLICY IF EXISTS registros_servicio_insert ON public.registros_servicio;
CREATE POLICY registros_servicio_insert ON public.registros_servicio FOR INSERT TO authenticated WITH CHECK (
    (SELECT petstore_private.usuario_activo()) AND (SELECT petstore_private.puede_acceder_cita(cita_id))
);

DROP POLICY IF EXISTS registros_servicio_update ON public.registros_servicio;
CREATE POLICY registros_servicio_update ON public.registros_servicio FOR UPDATE TO authenticated USING (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_registro(id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR (activo = TRUE AND estado = 'en_progreso'))
) WITH CHECK (
    (SELECT petstore_private.usuario_activo())
    AND (SELECT petstore_private.puede_acceder_registro(id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR estado = 'en_progreso')
);

CREATE OR REPLACE FUNCTION petstore_private.proteger_hoja_de_trabajador()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF petstore_private.es_trabajador_operativo()
       AND COALESCE(CURRENT_SETTING('app.flujo_registro_servicio', TRUE), '') <> 'pago_automatico' THEN
        NEW.estado := OLD.estado;
        NEW.monto_pagado := OLD.monto_pagado;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_hoja_de_trabajador ON public.registros_servicio;
CREATE TRIGGER trg_proteger_hoja_de_trabajador
BEFORE UPDATE ON public.registros_servicio
FOR EACH ROW EXECUTE FUNCTION petstore_private.proteger_hoja_de_trabajador();

CREATE OR REPLACE FUNCTION public.registros_servicio_fotos_agregar(
    p_registro_servicio_id BIGINT,
    p_fotos_ingreso TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_fotos_egreso TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_registro public.registros_servicio; v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_acceso_registro(p_registro_servicio_id);
    PERFORM petstore_private.establecer_actor();
    SELECT * INTO v_registro FROM public.registros_servicio WHERE id = p_registro_servicio_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    IF v_registro.estado = 'completado' AND NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SOLO_ADMIN_PUEDE_EDITAR_COMPLETADO';
    END IF;
    IF EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(p_fotos_ingreso, ARRAY[]::TEXT[]) || COALESCE(p_fotos_egreso, ARRAY[]::TEXT[])) ruta
        WHERE ruta IS NULL OR BTRIM(ruta) = '' OR ruta NOT LIKE 'services/%'
    ) THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'RUTA_FOTO_INVALIDA'; END IF;
    INSERT INTO public.registros_servicio_fotos(registro_servicio_id, momento, ruta_storage)
    SELECT p_registro_servicio_id, foto.momento, BTRIM(foto.ruta)
    FROM (
        SELECT 'ingreso'::TEXT AS momento, UNNEST(COALESCE(p_fotos_ingreso, ARRAY[]::TEXT[])) AS ruta
        UNION ALL
        SELECT 'egreso'::TEXT, UNNEST(COALESCE(p_fotos_egreso, ARRAY[]::TEXT[]))
    ) foto
    ON CONFLICT (registro_servicio_id, ruta_storage) DO NOTHING;
    SELECT COALESCE(JSONB_AGG(TO_JSONB(f) ORDER BY f.momento, f.id), '[]'::JSONB)
    INTO v_resultado FROM public.registros_servicio_fotos f WHERE f.registro_servicio_id = p_registro_servicio_id;
    RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.registros_servicio_fotos_listar(
    p_registro_servicio_id BIGINT, p_momento TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_acceso_registro(p_registro_servicio_id);
    IF p_momento IS NOT NULL AND p_momento NOT IN ('ingreso', 'egreso') THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'MOMENTO_FOTO_INVALIDO';
    END IF;
    SELECT COALESCE(JSONB_AGG(TO_JSONB(f) ORDER BY f.id), '[]'::JSONB)
    INTO v_resultado
    FROM public.registros_servicio_fotos f
    WHERE f.registro_servicio_id = p_registro_servicio_id
      AND (p_momento IS NULL OR f.momento = p_momento);
    RETURN v_resultado;
END;
$$;

DROP POLICY IF EXISTS pagos_insert ON public.pagos;
CREATE POLICY pagos_insert ON public.pagos FOR INSERT TO authenticated WITH CHECK (
    (SELECT petstore_private.puede_editar_pagos(registro_servicio_id))
);
DROP POLICY IF EXISTS pagos_update ON public.pagos;
CREATE POLICY pagos_update ON public.pagos FOR UPDATE TO authenticated USING (
    (SELECT petstore_private.puede_editar_pagos(registro_servicio_id))
    AND ((SELECT petstore_private.es_admin_propietario()) OR activo = TRUE)
) WITH CHECK ((SELECT petstore_private.puede_editar_pagos(registro_servicio_id)));

CREATE OR REPLACE FUNCTION public.pagos_registro_cero_automatico(p_registro_servicio_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_actor UUID; v_registro public.registros_servicio; v_cupon public.cupones;
    v_metodo BIGINT; v_pago public.pagos;
BEGIN
    v_actor := petstore_private.requerir_usuario_activo();
    IF NOT (petstore_private.es_trabajador_operativo() OR petstore_private.es_encargado_o_superior()) THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'ROL_NO_AUTORIZADO';
    END IF;
    PERFORM petstore_private.requerir_acceso_registro(p_registro_servicio_id);
    SELECT * INTO v_registro FROM public.registros_servicio WHERE id = p_registro_servicio_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    IF v_registro.estado <> 'en_progreso' OR v_registro.monto_final <> 0 OR v_registro.firma_entrega_url IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PAGO_AUTOMATICO_NO_APLICA';
    END IF;
    SELECT * INTO v_cupon FROM public.cupones WHERE id = v_registro.cupon_id;
    IF v_cupon.origen <> 'automatico' OR v_cupon.tipo_descuento <> 'porcentaje' OR v_cupon.valor <> 100 THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CUPON_AUTOMATICO_INVALIDO';
    END IF;
    SELECT cs.metodo_pago_cupon_id INTO v_metodo
    FROM public.configuracion_sistema cs
    INNER JOIN public.metodos_pago mp ON mp.id = cs.metodo_pago_cupon_id AND mp.activo = TRUE
    WHERE cs.id = 1;
    IF v_metodo IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'METODO_PAGO_CUPON_NO_ENCONTRADO'; END IF;
    UPDATE public.pagos SET activo = FALSE WHERE registro_servicio_id = p_registro_servicio_id AND activo = TRUE;
    INSERT INTO public.pagos(registro_servicio_id, metodo_pago_id, monto, creado_por_usuario_id, activo)
    VALUES (p_registro_servicio_id, v_metodo, 0, v_actor, TRUE) RETURNING * INTO v_pago;
    PERFORM SET_CONFIG('app.flujo_registro_servicio', 'pago_automatico', TRUE);
    UPDATE public.registros_servicio
    SET estado = 'completado', fin_real = COALESCE(fin_real, CURRENT_TIMESTAMP), monto_pagado = 0
    WHERE id = p_registro_servicio_id;
    RETURN JSONB_BUILD_OBJECT('pago', TO_JSONB(v_pago), 'registro_servicio_id', p_registro_servicio_id);
END;
$$;

REVOKE ALL ON FUNCTION public.peluqueros_vincular_usuario(BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peluqueros_vincular_usuario(BIGINT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pagos_registro_cero_automatico(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagos_registro_cero_automatico(BIGINT) TO authenticated, service_role;

ALTER FUNCTION public.reportes_peluqueros_obtener() RENAME TO reportes_peluqueros_obtener_base;
ALTER FUNCTION public.reportes_sucursales_obtener() RENAME TO reportes_sucursales_obtener_base;

CREATE FUNCTION public.reportes_peluqueros_obtener() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_reportes(); RETURN public.reportes_peluqueros_obtener_base(); END; $$;
CREATE FUNCTION public.reportes_sucursales_obtener() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN PERFORM petstore_private.requerir_reportes(); RETURN public.reportes_sucursales_obtener_base(); END; $$;

REVOKE ALL ON FUNCTION public.reportes_peluqueros_obtener_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reportes_sucursales_obtener_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reportes_peluqueros_obtener() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reportes_sucursales_obtener() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reportes_peluqueros_obtener() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reportes_sucursales_obtener() TO authenticated, service_role;
