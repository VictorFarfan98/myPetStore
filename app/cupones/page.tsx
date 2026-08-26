import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CuponesBrowser } from "@/components/cupones-browser";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { clientesListarTodos } from "@/lib/rpc/clientes";
import { cuponesListarTodos } from "@/lib/rpc/cupones";
import { serviciosListarTodos } from "@/lib/rpc/servicios";
import { usuariosListarTodos, usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export const dynamic = "force-dynamic";

export default async function CuponesPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");

  const [coupons, customers, services, users] = await Promise.all([
    cuponesListarTodos(),
    clientesListarTodos(),
    serviciosListarTodos(),
    usuariosListarTodos()
  ]);
  if (coupons.error || customers.error || services.error || users.error || !coupons.data || !customers.data || !services.data || !users.data) {
    throw new Error("No se pudo cargar la administración de cupones.");
  }

  return <AppShell><PageContainer><PageHeader eyebrow="Promociones" title="Cupones" description="Administra recompensas y promociones aplicables a los servicios." /><CuponesBrowser coupons={coupons.data.datos} customers={customers.data.datos} services={services.data.datos.filter((service) => !service.es_adicional)} users={users.data.datos} /></PageContainer></AppShell>;
}
