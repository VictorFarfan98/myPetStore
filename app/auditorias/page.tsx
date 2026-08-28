import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuditoriasBrowser } from "@/components/auditorias-browser";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { todayInGuatemala } from "@/lib/business-rules";
import { auditoriasListarPorDia } from "@/lib/rpc/auditorias";
import { sucursalesListarTodos } from "@/lib/rpc/sucursales";
import { usuariosListarTodos, usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export const dynamic = "force-dynamic";

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

export default async function AuditoriasPage({ searchParams }: { searchParams: Promise<{ fecha?: string; hoy?: string; q?: string }> }) {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || !["administrador", "propietario"].includes(String(profile.data?.rol))) redirect("/");

  const params = await searchParams;
  const today = todayInGuatemala();
  const date = params.hoy === "1" ? today : validDate(params.fecha) ?? today;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const [audits, users, branches] = await Promise.all([auditoriasListarPorDia(date), usuariosListarTodos(), sucursalesListarTodos()]);
  if (audits.error || !audits.data || users.error || !users.data || branches.error || !branches.data) {
    throw new Error("No se pudieron cargar las auditorías.");
  }

  return <AppShell><PageContainer><PageHeader eyebrow="Administración" title="Auditoría" description="Consulta los cambios registrados en un día específico y busca por entidad, acción, usuario o motivo." /><AuditoriasBrowser key={`${date}:${query}`} rows={audits.data.datos} users={users.data.datos} branches={branches.data.datos} date={date} today={today} query={query} /></PageContainer></AppShell>;
}
