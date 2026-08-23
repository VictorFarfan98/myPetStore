-- Species-specific classifications and optional service add-ons.

ALTER TABLE public.tamanos
    ADD COLUMN IF NOT EXISTS especie public.especie_mascota NOT NULL DEFAULT 'perro';

DROP INDEX IF EXISTS public.uq_tamanos_nombre_lower;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tamanos_especie_nombre_lower
    ON public.tamanos (especie, LOWER(nombre));

ALTER TABLE public.precios_servicios
    ADD COLUMN IF NOT EXISTS especie public.especie_mascota NOT NULL DEFAULT 'perro';
ALTER TABLE public.precios_servicios DROP CONSTRAINT IF EXISTS precios_servicios_pkey;
ALTER TABLE public.precios_servicios ADD PRIMARY KEY (servicio_id, especie, tamano_id);

INSERT INTO public.tamanos (especie, nombre, activo)
SELECT x.especie, x.nombre, x.activo
FROM (VALUES
    ('gato'::public.especie_mascota, 'Pelo corto'::TEXT, TRUE),
    ('gato'::public.especie_mascota, 'Pelo largo'::TEXT, TRUE)
) AS x(especie, nombre, activo)
WHERE NOT EXISTS (
    SELECT 1 FROM public.tamanos t
    WHERE t.especie = x.especie AND LOWER(t.nombre) = LOWER(x.nombre)
);

DROP FUNCTION IF EXISTS public.validar_clasificacion_mascota() CASCADE;
CREATE FUNCTION public.validar_clasificacion_mascota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.tamanos t
        WHERE t.id = NEW.tamano_id AND t.especie = NEW.especie AND t.activo = TRUE
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CLASIFICACION_MASCOTA_INVALIDA';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_clasificacion_mascota ON public.mascotas;
CREATE TRIGGER trg_validar_clasificacion_mascota
BEFORE INSERT OR UPDATE OF especie, tamano_id ON public.mascotas
FOR EACH ROW EXECUTE FUNCTION public.validar_clasificacion_mascota();

DROP FUNCTION IF EXISTS public.tamanos_insertar(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.tamanos_actualizar(BIGINT, TEXT, BOOLEAN);

CREATE FUNCTION public.tamanos_insertar(
    p_especie public.especie_mascota,
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.tamanos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.tamanos;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    INSERT INTO public.tamanos(especie, nombre, activo)
    VALUES (p_especie, BTRIM(p_nombre), p_activo)
    RETURNING * INTO v_fila;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation
        THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

DROP FUNCTION IF EXISTS public.precios_servicios_insertar(BIGINT, public.especie_mascota, BIGINT, NUMERIC, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.precios_servicios_actualizar(BIGINT, public.especie_mascota, BIGINT, NUMERIC, INTEGER, BOOLEAN);

CREATE FUNCTION public.precios_servicios_insertar(
    p_servicio_id BIGINT, p_especie public.especie_mascota, p_tamano_id BIGINT,
    p_precio NUMERIC(10, 2), p_precio_promocional NUMERIC(10, 2),
    p_duracion_minutos INTEGER, p_activo BOOLEAN
)
RETURNS public.precios_servicios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.precios_servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    INSERT INTO public.precios_servicios(servicio_id, especie, tamano_id, precio, precio_promocional, duracion_minutos, activo)
    VALUES (p_servicio_id, p_especie, p_tamano_id, p_precio, p_precio_promocional, p_duracion_minutos, p_activo)
    RETURNING * INTO v_fila;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation
        THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.precios_servicios_actualizar(
    p_servicio_id BIGINT, p_especie public.especie_mascota, p_tamano_id BIGINT,
    p_precio NUMERIC(10, 2), p_precio_promocional NUMERIC(10, 2),
    p_duracion_minutos INTEGER, p_activo BOOLEAN
)
RETURNS public.precios_servicios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.precios_servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    UPDATE public.precios_servicios
    SET precio = p_precio, precio_promocional = p_precio_promocional,
        duracion_minutos = p_duracion_minutos, activo = p_activo
    WHERE servicio_id = p_servicio_id AND especie = p_especie AND tamano_id = p_tamano_id
    RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation
        THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.tamanos_actualizar(
    p_id BIGINT,
    p_especie public.especie_mascota,
    p_nombre TEXT,
    p_activo BOOLEAN
)
RETURNS public.tamanos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.tamanos;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    IF EXISTS (SELECT 1 FROM public.mascotas m WHERE m.tamano_id = p_id AND m.especie <> p_especie) THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'CLASIFICACION_EN_USO_POR_OTRA_ESPECIE';
    END IF;
    UPDATE public.tamanos
    SET especie = p_especie, nombre = BTRIM(p_nombre), activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation
        THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

ALTER TABLE public.servicios
    ADD COLUMN IF NOT EXISTS es_adicional BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.precios_servicios
    ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10, 2) NULL
        CHECK (precio_promocional IS NULL OR precio_promocional >= 0);
ALTER TABLE public.precios_servicios
    DROP COLUMN IF EXISTS promocion_activa;

ALTER TABLE public.registros_servicio
    ADD COLUMN IF NOT EXISTS usar_promocion BOOLEAN NOT NULL DEFAULT FALSE;

CREATE FUNCTION public.registros_servicio_promocion_aplicar(
    p_registro_servicio_id BIGINT,
    p_usar_promocion BOOLEAN
)
RETURNS public.registros_servicio
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_registro public.registros_servicio;
    v_cita public.citas;
    v_fila public.registros_servicio;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();
    SELECT * INTO v_registro FROM public.registros_servicio WHERE id = p_registro_servicio_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    SELECT * INTO v_cita FROM public.citas WHERE id = v_registro.cita_id;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);
    IF v_registro.estado = 'completado' AND NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SOLO_ADMIN_PUEDE_EDITAR_COMPLETADO';
    END IF;
    UPDATE public.registros_servicio SET usar_promocion = p_usar_promocion
    WHERE id = p_registro_servicio_id RETURNING * INTO v_fila;
    RETURN v_fila;
END;
$$;

-- Move values from the earlier service-level implementation before removing it.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'servicios' AND column_name = 'precio_promocional') THEN
        UPDATE public.precios_servicios ps
        SET precio_promocional = s.precio_promocional
        FROM public.servicios s
        WHERE s.id = ps.servicio_id
          AND ps.precio_promocional IS NULL
          AND s.precio_promocional IS NOT NULL;
        ALTER TABLE public.servicios DROP COLUMN precio_promocional;
        ALTER TABLE public.servicios DROP COLUMN promocion_activa;
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.servicios_insertar(TEXT, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.servicios_insertar(TEXT, INTEGER, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.servicios_insertar(TEXT, INTEGER, BOOLEAN, NUMERIC, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.servicios_actualizar(BIGINT, TEXT, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.servicios_actualizar(BIGINT, TEXT, INTEGER, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.servicios_actualizar(BIGINT, TEXT, INTEGER, BOOLEAN, NUMERIC, BOOLEAN, BOOLEAN);

CREATE FUNCTION public.servicios_insertar(
    p_nombre TEXT,
    p_intervalo_recordatorio_dias INTEGER,
    p_es_adicional BOOLEAN,
    p_activo BOOLEAN
)
RETURNS public.servicios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    INSERT INTO public.servicios(nombre, intervalo_recordatorio_dias, es_adicional, activo)
    VALUES (BTRIM(p_nombre), p_intervalo_recordatorio_dias, p_es_adicional, p_activo)
    RETURNING * INTO v_fila;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation
        THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE FUNCTION public.servicios_actualizar(
    p_id BIGINT,
    p_nombre TEXT,
    p_intervalo_recordatorio_dias INTEGER,
    p_es_adicional BOOLEAN,
    p_activo BOOLEAN
)
RETURNS public.servicios
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_fila public.servicios;
BEGIN
    PERFORM petstore_private.requerir_admin_propietario();
    PERFORM petstore_private.establecer_actor();
    UPDATE public.servicios
    SET nombre = BTRIM(p_nombre), intervalo_recordatorio_dias = p_intervalo_recordatorio_dias,
        es_adicional = p_es_adicional, activo = p_activo
    WHERE id = p_id
    RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO'; END IF;
    RETURN v_fila;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE = 'PC001', MESSAGE = 'CONFLICTO_DE_DATOS';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation
        THEN RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'DATOS_INVALIDOS';
END;
$$;

CREATE TABLE IF NOT EXISTS public.registros_servicio_adicionales (
    registro_servicio_id BIGINT NOT NULL
        REFERENCES public.registros_servicio(id) ON DELETE RESTRICT,
    servicio_id BIGINT NOT NULL
        REFERENCES public.servicios(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    duracion_minutos INTEGER NOT NULL DEFAULT 0 CHECK (duracion_minutos >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (registro_servicio_id, servicio_id)
);

CREATE INDEX IF NOT EXISTS ix_registros_servicio_adicionales_servicio
    ON public.registros_servicio_adicionales (servicio_id);

CREATE OR REPLACE FUNCTION public.sincronizar_montos_registro_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_precio NUMERIC(10, 2);
    v_recargo NUMERIC(10, 2) := 0;
BEGIN
    SELECT CASE WHEN NEW.usar_promocion THEN COALESCE(ps.precio_promocional, ps.precio) ELSE ps.precio END INTO v_precio
    FROM public.precios_servicios ps
    INNER JOIN public.citas c ON c.id = NEW.cita_id
    INNER JOIN public.mascotas m ON m.id = c.mascota_id
    WHERE ps.servicio_id = NEW.servicio_id AND ps.especie = m.especie
      AND ps.tamano_id = NEW.tamano_id AND ps.activo = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA'; END IF;

    IF NEW.shampoo_id IS NOT NULL THEN
        SELECT ps.recargo INTO v_recargo FROM public.precios_shampoo ps
        WHERE ps.shampoo_id = NEW.shampoo_id AND ps.tamano_id = NEW.tamano_id AND ps.activo = TRUE;
        IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SHAMPOO_NO_ENCONTRADA'; END IF;
    END IF;

    NEW.precio_base := v_precio;
    NEW.recargo_shampoo := v_recargo;
    NEW.monto_final := v_precio + v_recargo
        + COALESCE((SELECT SUM(a.precio * a.cantidad) FROM public.registros_servicio_adicionales a
                    WHERE a.registro_servicio_id = NEW.id AND a.activo = TRUE), 0)
        - NEW.descuento_cupon;
    RETURN NEW;
END;
$$;

ALTER TABLE public.registros_servicio_adicionales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registros_servicio_adicionales FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registros_servicio_adicionales_reemplazar(
    p_registro_servicio_id BIGINT,
    p_adicionales JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    v_registro public.registros_servicio;
    v_cita public.citas;
    v_mascota public.mascotas;
    v_item RECORD;
    v_precio public.precios_servicios%ROWTYPE;
    v_resultado JSONB;
BEGIN
    PERFORM petstore_private.requerir_usuario_activo();
    PERFORM petstore_private.establecer_actor();

    IF JSONB_TYPEOF(p_adicionales) <> 'array' THEN
        RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'ADICIONALES_DEBE_SER_ARREGLO';
    END IF;

    SELECT * INTO v_registro
    FROM public.registros_servicio
    WHERE id = p_registro_servicio_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'REGISTRO_NO_ENCONTRADO';
    END IF;

    SELECT * INTO v_cita FROM public.citas WHERE id = v_registro.cita_id FOR UPDATE;
    PERFORM petstore_private.requerir_acceso_sucursal(v_cita.sucursal_id);
    SELECT * INTO v_mascota FROM public.mascotas WHERE id = v_cita.mascota_id;

    IF v_registro.estado = 'completado' AND NOT petstore_private.es_admin_propietario() THEN
        RAISE EXCEPTION USING ERRCODE = 'PA001', MESSAGE = 'SOLO_ADMIN_PUEDE_EDITAR_COMPLETADO';
    END IF;

    DELETE FROM public.registros_servicio_adicionales
    WHERE registro_servicio_id = p_registro_servicio_id;

    FOR v_item IN
        SELECT * FROM JSONB_TO_RECORDSET(p_adicionales)
        AS x(servicio_id BIGINT, cantidad INTEGER)
    LOOP
        IF v_item.servicio_id IS NULL OR COALESCE(v_item.cantidad, 0) < 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'ADICIONAL_INVALIDO';
        END IF;

        SELECT ps.* INTO v_precio
        FROM public.precios_servicios ps
        INNER JOIN public.servicios s ON s.id = ps.servicio_id
        WHERE ps.servicio_id = v_item.servicio_id
          AND ps.especie = v_mascota.especie
          AND ps.tamano_id = v_registro.tamano_id
          AND ps.activo = TRUE
          AND s.activo = TRUE
          AND s.es_adicional = TRUE;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'PRECIO_ADICIONAL_NO_ENCONTRADO';
        END IF;
        SELECT CASE WHEN v_registro.usar_promocion THEN COALESCE(ps.precio_promocional, v_precio.precio) ELSE v_precio.precio END
        INTO v_precio.precio FROM public.precios_servicios ps
        WHERE ps.servicio_id = v_item.servicio_id AND ps.especie = v_mascota.especie AND ps.tamano_id = v_registro.tamano_id;

        INSERT INTO public.registros_servicio_adicionales (
            registro_servicio_id, servicio_id, cantidad, precio, duracion_minutos
        ) VALUES (
            p_registro_servicio_id, v_item.servicio_id, v_item.cantidad,
            v_precio.precio, v_precio.duracion_minutos
        );
    END LOOP;

    SELECT COALESCE(JSONB_AGG(TO_JSONB(a) ORDER BY a.servicio_id), '[]'::JSONB)
    INTO v_resultado
    FROM public.registros_servicio_adicionales a
    WHERE a.registro_servicio_id = p_registro_servicio_id
      AND a.activo = TRUE;

    UPDATE public.registros_servicio
    SET monto_final = precio_base
        + recargo_shampoo
        + COALESCE((SELECT SUM(a.precio * a.cantidad)
                   FROM public.registros_servicio_adicionales a
                   WHERE a.registro_servicio_id = p_registro_servicio_id
                     AND a.activo = TRUE), 0)
        - descuento_cupon
    WHERE id = p_registro_servicio_id;

    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.registros_servicio_adicionales_reemplazar(BIGINT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registros_servicio_adicionales_reemplazar(BIGINT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.servicios_insertar(TEXT, INTEGER, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.servicios_actualizar(BIGINT, TEXT, INTEGER, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tamanos_insertar(public.especie_mascota, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tamanos_actualizar(BIGINT, public.especie_mascota, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.precios_servicios_insertar(BIGINT, public.especie_mascota, BIGINT, NUMERIC, NUMERIC, INTEGER, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.precios_servicios_actualizar(BIGINT, public.especie_mascota, BIGINT, NUMERIC, NUMERIC, INTEGER, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registros_servicio_promocion_aplicar(BIGINT, BOOLEAN) TO authenticated, service_role;
