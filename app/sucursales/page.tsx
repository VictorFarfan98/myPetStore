import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { sucursalesListarTodos } from "@/lib/rpc/sucursales";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";
import nextDynamic from "next/dynamic";

const SucursalesBrowser = nextDynamic(() => import("@/components/sucursales-browser").then((module) => module.SucursalesBrowser), { loading: () => <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" /> });

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");
  const result = await sucursalesListarTodos();
  if (result.error || !result.data) throw new Error("No se pudieron cargar las sucursales.");

  return <AppShell><PageContainer><PageHeader eyebrow="Administración" title="Sucursales" description="Administra las sucursales disponibles para la operación de grooming." /><SucursalesBrowser rows={result.data.datos} /></PageContainer></AppShell>;
}
