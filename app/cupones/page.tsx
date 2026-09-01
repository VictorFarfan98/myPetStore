import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { clientesListarTodos } from "@/lib/rpc/clientes";
import { cuponesListarTodos } from "@/lib/rpc/cupones";
import { serviciosListarTodos } from "@/lib/rpc/servicios";
import { usuariosListarTodos, usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";
import nextDynamic from "next/dynamic";

const CuponesBrowser = nextDynamic(() => import("@/components/cupones-browser").then((module) => module.CuponesBrowser), { loading: () => <div className="mt-6 h-[36rem] animate-pulse rounded-lg bg-slate-100" /> });

export const dynamic = "force-dynamic";

export default async function CuponesPage({ searchParams }: { searchParams: Promise<{ page?: string; cliente_id?: string }> }) {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");

  const params = await searchParams;
  const pageSize = 20;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const parsedCustomerId = Number.parseInt(params.cliente_id ?? "", 10);
  const customerId = Number.isInteger(parsedCustomerId) && parsedCustomerId > 0 ? parsedCustomerId : null;
  const [coupons, customers, services, users] = await Promise.all([
    cuponesListarTodos(customerId ? null : pageSize, customerId ? 0 : (page - 1) * pageSize),
    clientesListarTodos(),
    serviciosListarTodos(),
    usuariosListarTodos()
  ]);
  if (coupons.error || customers.error || services.error || users.error || !coupons.data || !customers.data || !services.data || !users.data) {
    throw new Error("No se pudo cargar la administración de cupones.");
  }

  return <AppShell><PageContainer><PageHeader eyebrow="Promociones" title="Cupones" description="Administra recompensas y promociones aplicables a los servicios." /><CuponesBrowser key={`${page}:${customerId ?? "todos"}`} coupons={coupons.data.datos} customers={customers.data.datos} services={services.data.datos.filter((service) => !service.es_adicional)} users={users.data.datos} page={page} pageSize={pageSize} total={coupons.data.total} initialCustomerId={customerId} /></PageContainer></AppShell>;
}
