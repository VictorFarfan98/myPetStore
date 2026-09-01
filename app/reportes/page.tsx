import Link from "next/link";
import { ArrowRight, MapPin, Scissors } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";
import { redirect } from "next/navigation";

const reports = [
  {
    href: "/reportes/groomers",
    title: "Reporte de groomers",
    description: "Servicios realizados, ingresos por servicio y subservicio, y promedio de calificaciones.",
    icon: Scissors
  },
  {
    href: "/reportes/sucursales",
    title: "Reporte de sucursales",
    description: "Servicios completados y próximas citas por cada sucursal disponible.",
    icon: MapPin
  }
];

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario", "encargado"].includes(String(profile.data?.rol))) redirect("/");
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Medición operativa"
          title="Reportes"
          description="Selecciona un reporte para consultar sus resultados actualizados."
        />
        <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Reportes disponibles">
          {reports.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="focus-ring group rounded-lg border border-slate-200 bg-white p-5 shadow-panel transition hover:border-jade"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-cloud text-jade">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-jade" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-xl font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-jade">Ver reporte</span>
            </Link>
          ))}
        </section>
      </PageContainer>
    </AppShell>
  );
}
