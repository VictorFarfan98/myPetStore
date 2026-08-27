import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ServiciosBrowser } from "@/components/servicios-browser";
import { PreciosServiciosBrowser } from "@/components/precios-servicios-browser";
import { CatalogBrowser } from "@/components/catalog-browser";
import { preciosServiciosListarTodos } from "@/lib/rpc/precios_servicios";
import { serviciosListarTodos } from "@/lib/rpc/servicios";
import { tamanosListarTodos } from "@/lib/rpc/tamanos";
import { createTamano, deleteTamano, updateTamano } from "@/lib/tamanos-actions";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");
  const [services, prices, sizes] = await Promise.all([serviciosListarTodos(), preciosServiciosListarTodos(), tamanosListarTodos()]);
  if (services.error || !services.data || prices.error || !prices.data || sizes.error || !sizes.data) throw new Error("No se pudo cargar el catálogo de servicios.");

  return (
    <AppShell>
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
    </AppShell>
  );
}
