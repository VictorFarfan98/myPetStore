import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { preciosServiciosListarTodos } from "@/lib/rpc/precios_servicios";
import { serviciosListarTodos } from "@/lib/rpc/servicios";
import { tamanosListarTodos } from "@/lib/rpc/tamanos";
import { createTamano, deleteTamano, updateTamano } from "@/lib/tamanos-actions";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";
import { redirect } from "next/navigation";

import nextDynamic from "next/dynamic";

const ServiciosBrowser = nextDynamic(() => import("@/components/servicios-browser").then((module) => module.ServiciosBrowser), { loading: () => <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" /> });
const PreciosServiciosBrowser = nextDynamic(() => import("@/components/precios-servicios-browser").then((module) => module.PreciosServiciosBrowser), { loading: () => <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" /> });
const CatalogBrowser = nextDynamic(() => import("@/components/catalog-browser").then((module) => module.CatalogBrowser), { loading: () => <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" /> });

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");
  const [services, prices, sizes] = await Promise.all([serviciosListarTodos(), preciosServiciosListarTodos(), tamanosListarTodos()]);
  if (services.error || !services.data || prices.error || !prices.data || sizes.error || !sizes.data) throw new Error("No se pudo cargar el catálogo de servicios.");

  return (
    <PageContainer>
        <PageHeader
          eyebrow="Catalogo operativo"
          title="Servicios"
          description="Administra los servicios de grooming que ofrece la tienda."
        />
        <ServiciosBrowser rows={services.data.datos} />
        <ServiciosBrowser rows={services.data.datos} additional />
        <CatalogBrowser rows={sizes.data.datos} title="Clasificaciones por especie" singular="Clasificación" create={createTamano} update={updateTamano} remove={deleteTamano} speciesCatalog />
        <PreciosServiciosBrowser rows={prices.data.datos} services={services.data.datos} sizes={sizes.data.datos} />
      </PageContainer>
  );
}
