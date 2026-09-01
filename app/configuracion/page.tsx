import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { configuracionSistemaObtener } from "@/lib/rpc/configuracion_sistema";
import { createMetodoPago, deleteMetodoPago, updateMetodoPago } from "@/lib/metodos-pago-actions";
import { metodosPagoListarTodos } from "@/lib/rpc/metodos_pago";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";
import nextDynamic from "next/dynamic";

const ConfiguracionSistemaBrowser = nextDynamic(() => import("@/components/configuracion-sistema-browser").then((module) => module.ConfiguracionSistemaBrowser), { loading: () => <div className="mt-6 h-72 animate-pulse rounded-lg bg-slate-100" /> });
const CatalogBrowser = nextDynamic(() => import("@/components/catalog-browser").then((module) => module.CatalogBrowser), { loading: () => <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" /> });

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");
  const [config, paymentMethods] = await Promise.all([configuracionSistemaObtener(), metodosPagoListarTodos()]);
  if (config.error || !config.data || paymentMethods.error || !paymentMethods.data) throw new Error("No se pudo cargar la configuración del sistema.");

  const activePaymentMethods = paymentMethods.data.datos.filter((method) => method.activo);
  return <AppShell><PageContainer><PageHeader eyebrow="Administración" title="Configuración" description="Administra las reglas generales de la operación y los recordatorios." /><ConfiguracionSistemaBrowser config={config.data} paymentMethods={activePaymentMethods} /><CatalogBrowser rows={paymentMethods.data.datos} title="Métodos de pago" singular="Método de pago" create={createMetodoPago} update={updateMetodoPago} remove={deleteMetodoPago} /></PageContainer></AppShell>;
}
