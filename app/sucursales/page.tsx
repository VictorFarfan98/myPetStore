import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SucursalesBrowser } from "@/components/sucursales-browser";
import { sucursalesListarTodos } from "@/lib/rpc/sucursales";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");
  const result = await sucursalesListarTodos();
  if (result.error || !result.data) throw new Error("No se pudieron cargar las sucursales.");

  return <AppShell><PageContainer><PageHeader eyebrow="Administración" title="Sucursales" description="Administra las sucursales disponibles para la operación de grooming." /><SucursalesBrowser rows={result.data.datos} /></PageContainer></AppShell>;
}
