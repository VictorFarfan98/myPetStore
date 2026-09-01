-- Allow the protected profile-creation RPC to validate auth.users.
-- Authorization remains enforced by requerir_admin_propietario().
ALTER FUNCTION public.usuarios_insertar(
    UUID,
    TEXT,
    TEXT,
    TEXT,
    public.rol_usuario,
    public.alcance_acceso,
    BOOLEAN,
    BIGINT[]
)
SECURITY DEFINER;
