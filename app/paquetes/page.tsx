import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PaquetesBrowser } from "@/components/paquetes-browser";
import { clientesListarTodos } from "@/lib/rpc/clientes";
import { paquetesListar } from "@/lib/rpc/paquetes";
import { serviciosListarTodos } from "@/lib/rpc/servicios";
import { usuariosListarTodos, usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export const dynamic = "force-dynamic";

export default async function PaquetesPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");

  const [packages, customers, services, users] = await Promise.all([
    paquetesListar(),
    clientesListarTodos(),
    serviciosListarTodos(),
    usuariosListarTodos()
  ]);
  if (packages.error || !packages.data || customers.error || !customers.data || services.error || !services.data || users.error || !users.data) {
    throw new Error("No se pudo cargar la administración de paquetes.");
  }

  return <AppShell><PageContainer><PageHeader eyebrow="Ventas y beneficios" title="Paquetes" description="Crea combos de servicios y asígnalos a clientes para generar sus cupones de consumo." /><PaquetesBrowser packages={packages.data} customers={customers.data.datos} services={services.data.datos.filter((service) => service.activo && !service.es_adicional)} users={users.data.datos} /></PageContainer></AppShell>;
}
