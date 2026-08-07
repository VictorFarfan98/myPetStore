CREATE OR REPLACE FUNCTION public.validar_total_pagos_registro(p_registro_servicio_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_estado public.estado_registro_servicio;
    v_monto_final NUMERIC(10, 2);
    v_monto_pagado NUMERIC(10, 2);
    v_suma_pagos NUMERIC(10, 2);
BEGIN
    IF p_registro_servicio_id IS NULL THEN
        RETURN;
    END IF;

    SELECT rs.estado, rs.monto_final, rs.monto_pagado
    INTO v_estado, v_monto_final, v_monto_pagado
    FROM public.registros_servicio rs
    WHERE rs.id = p_registro_servicio_id;

    IF NOT FOUND OR v_estado <> 'completado' THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(p.monto), 0)::NUMERIC(10, 2)
    INTO v_suma_pagos
    FROM public.pagos p
    WHERE p.registro_servicio_id = p_registro_servicio_id
      AND p.activo = TRUE;

    IF v_monto_final IS NULL OR v_monto_pagado IS NULL THEN
        RAISE EXCEPTION 'El registro de servicio % completado debe tener montos finales', p_registro_servicio_id;
    END IF;
    IF v_monto_pagado <> v_monto_final THEN
        RAISE EXCEPTION 'El monto pagado debe ser igual al monto final en el registro de servicio %', p_registro_servicio_id;
    END IF;
    IF v_suma_pagos <> v_monto_pagado THEN
        RAISE EXCEPTION
            'La suma de pagos (%) no coincide con monto_pagado (%) en el registro de servicio %',
            v_suma_pagos, v_monto_pagado, p_registro_servicio_id;
    END IF;
END;
$$;
