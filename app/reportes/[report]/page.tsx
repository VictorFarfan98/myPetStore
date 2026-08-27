import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { reportesPeluquerosObtener, reportesSucursalesObtener } from "@/lib/rpc/reportes";
import type { ReportePeluqueroRow, ReporteSucursalRow } from "@/lib/rpc/types";

const money = (value: number) => value.toLocaleString("es-GT", { style: "currency", currency: "GTQ" });

function ReportError() {
  return <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">No se pudo cargar este reporte.</p>;
}

function GroomerReport({ rows }: { rows: ReportePeluqueroRow[] }) {
  return (
    <div className="mt-6 space-y-4">
      {rows.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">No hay groomers activos para mostrar.</p>}
      {rows.map((row) => (
        <article key={row.peluquero_id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">{row.peluquero_nombre}</h2>
              <p className="mt-1 text-sm text-slate-500">Detalle de servicios completados</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <p><span className="block text-slate-500">Servicios</span><strong className="text-lg text-ink">{row.servicios_completados}</strong></p>
              <p><span className="block text-slate-500">Adicionales</span><strong className="text-lg text-ink">{row.adicionales_realizados}</strong></p>
              <p><span className="block text-slate-500">Duración promedio</span><strong className="text-lg text-ink">{row.duracion_promedio_minutos || "-"} min</strong></p>
              <p><span className="block text-slate-500">Generado</span><strong className="text-lg text-jade">{money(row.monto_total_generado)}</strong></p>
              <p><span className="block text-slate-500">Calificación</span><strong className="text-lg text-ink">{row.calificacion_promedio === null ? "-" : `${row.calificacion_promedio}/5`}</strong></p>
            </div>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ReportTable title="Servicios principales" rows={row.servicios} />
            <ReportTable title="Servicios adicionales" rows={row.subservicios} />
          </div>
          <div className="mt-5 grid gap-2 rounded-lg bg-cloud p-4 text-sm sm:grid-cols-3">
            <p>Servicios principales: <strong>{money(row.monto_servicios)}</strong></p>
            <p>Servicios adicionales: <strong>{money(row.monto_adicionales)}</strong></p>
            <p>Total generado: <strong className="text-jade">{money(row.monto_total_generado)}</strong></p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: ReportePeluqueroRow["servicios"] }) {
  return (
    <section>
      <h3 className="mb-2 font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500">Sin registros.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-medium">Servicio</th><th className="px-3 py-2 text-right font-medium">Cantidad</th><th className="px-3 py-2 text-right font-medium">Generado</th></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.servicio_id} className="border-t border-slate-200"><th className="px-3 py-2 font-medium text-ink">{item.servicio_nombre}</th><td className="px-3 py-2 text-right text-slate-600">{item.cantidad}</td><td className="px-3 py-2 text-right text-slate-600">{money(item.monto_total)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BranchReport({ rows }: { rows: ReporteSucursalRow[] }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {rows.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">No hay sucursales disponibles para mostrar.</p>}
      {rows.map((row) => <article key={row.sucursal_id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-ink">{row.sucursal_nombre}</h2><p className="mt-1 text-sm text-slate-500">{row.direccion}</p></div><MapPin className="h-5 w-5 text-jade" aria-hidden="true" /></div><p className="mt-2 text-sm text-slate-500">{row.telefono}</p><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><p className="rounded-lg bg-cloud p-3"><span className="block text-slate-500">Completadas</span><strong className="text-2xl text-ink">{row.completadas}</strong></p><p className="rounded-lg bg-cloud p-3"><span className="block text-slate-500">Próximas</span><strong className="text-2xl text-ink">{row.proximas}</strong></p></div></article>)}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function ReportePage({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (report !== "groomers" && report !== "sucursales") notFound();

  const action = <Link href="/reportes" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-jade"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Todos los reportes</Link>;

  if (report === "groomers") {
    const result = await reportesPeluquerosObtener();
    return <AppShell><PageContainer><PageHeader eyebrow="Medición operativa" title="Reporte de groomers" description="Servicios, ingresos por tipo y promedio de calificaciones por groomer." action={action} />{result.error || !result.data ? <ReportError /> : <GroomerReport rows={result.data.datos} />}</PageContainer></AppShell>;
  }

  const result = await reportesSucursalesObtener();
  return <AppShell><PageContainer><PageHeader eyebrow="Medición operativa" title="Reporte de sucursales" description="Servicios completados y próximas citas por sucursal." action={action} />{result.error || !result.data ? <ReportError /> : <BranchReport rows={result.data.datos} />}</PageContainer></AppShell>;
}
