import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EquipoBrowser } from "@/components/equipo-browser";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { peluquerosListarTodos } from "@/lib/rpc/peluqueros";
import { sucursalesListarTodos } from "@/lib/rpc/sucursales";
import { usuariosListarTodos } from "@/lib/rpc/usuarios";
import { usuariosSucursalesListarTodos } from "@/lib/rpc/usuarios_sucursales";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");
  const [managers, groomers, branches, assignments] = await Promise.all([usuariosListarTodos(), peluquerosListarTodos(), sucursalesListarTodos(), usuariosSucursalesListarTodos()]);
  if (managers.error || !managers.data || groomers.error || !groomers.data || branches.error || !branches.data || assignments.error || !assignments.data) throw new Error("No se pudo cargar el equipo.");

  return <AppShell><PageContainer><PageHeader eyebrow="Administración" title="Equipo" description="Administra usuarios del sistema y groomistas disponibles para la operación." /><EquipoBrowser managers={managers.data.datos} groomers={groomers.data.datos} branches={branches.data.datos} assignments={assignments.data.datos} /></PageContainer></AppShell>;
}
