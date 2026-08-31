CREATE POLICY fidelidad_clientes_insert
ON public.fidelidad_clientes FOR INSERT TO authenticated
WITH CHECK ((SELECT petstore_private.es_admin_propietario()));

GRANT INSERT ON TABLE public.fidelidad_clientes TO authenticated;
