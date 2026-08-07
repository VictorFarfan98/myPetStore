CREATE FUNCTION public.sincronizar_montos_registro_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_precio NUMERIC(10, 2);
    v_recargo NUMERIC(10, 2) := 0;
BEGIN
    SELECT ps.precio INTO v_precio
    FROM public.precios_servicios ps
    WHERE ps.servicio_id = NEW.servicio_id
      AND ps.tamano_id = NEW.tamano_id
      AND ps.activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SERVICIO_NO_ENCONTRADA';
    END IF;

    IF NEW.shampoo_id IS NOT NULL THEN
        SELECT ps.recargo INTO v_recargo
        FROM public.precios_shampoo ps
        WHERE ps.shampoo_id = NEW.shampoo_id
          AND ps.tamano_id = NEW.tamano_id
          AND ps.activo = TRUE;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'PN001', MESSAGE = 'CONFIGURACION_PRECIO_SHAMPOO_NO_ENCONTRADA';
        END IF;
    END IF;

    NEW.precio_base := v_precio;
    NEW.recargo_shampoo := v_recargo;
    NEW.monto_final := v_precio + v_recargo - NEW.descuento_cupon;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sincronizar_montos_registro_servicio
BEFORE INSERT OR UPDATE ON public.registros_servicio
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_montos_registro_servicio();

REVOKE ALL ON FUNCTION public.sincronizar_montos_registro_servicio() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_montos_registro_servicio() TO service_role;

UPDATE public.registros_servicio rs
SET precio_base = ps.precio,
    recargo_shampoo = COALESCE((
        SELECT psh.recargo
        FROM public.precios_shampoo psh
        WHERE psh.shampoo_id = rs.shampoo_id
          AND psh.tamano_id = rs.tamano_id
          AND psh.activo = TRUE
    ), 0),
    monto_final = ps.precio + COALESCE((
        SELECT psh.recargo
        FROM public.precios_shampoo psh
        WHERE psh.shampoo_id = rs.shampoo_id
          AND psh.tamano_id = rs.tamano_id
          AND psh.activo = TRUE
    ), 0) - rs.descuento_cupon
FROM public.precios_servicios ps
WHERE rs.servicio_id = ps.servicio_id
  AND rs.tamano_id = ps.tamano_id
  AND ps.activo = TRUE
  AND rs.monto_final IS NULL;
