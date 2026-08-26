ALTER TABLE public.configuracion_sistema
    ALTER COLUMN foto_antes_requerida SET DEFAULT FALSE,
    ALTER COLUMN foto_despues_requerida SET DEFAULT FALSE;

UPDATE public.configuracion_sistema
SET foto_antes_requerida = FALSE,
    foto_despues_requerida = FALSE
WHERE id = 1;
