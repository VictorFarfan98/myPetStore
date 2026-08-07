import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { HojasBrowser } from "@/components/hojas-browser";
import { getAppData } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function HojasPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string; sucursal_id?: string }> }) {
  const params = await searchParams;
  const history = params.view === "history";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const branchId = Number.parseInt(params.sucursal_id ?? "", 10);
  const selectedBranchId = Number.isInteger(branchId) && branchId > 0 ? branchId : null;
  const pageSize = 20;
  const data = await getAppData(history ? { recordsLimit: pageSize, recordsOffset: (page - 1) * pageSize, recordsBranchId: selectedBranchId } : {});
  return <AppShell><PageContainer><PageHeader eyebrow="Operacion diaria" title="Hojas de servicio" description="Gestiona la cola de hoy y consulta el historial de servicios." /><div className="mt-6"><HojasBrowser data={data} initialView={history ? "history" : "today"} initialBranchId={selectedBranchId} historyPage={page} historyPageSize={pageSize} /></div></PageContainer></AppShell>;
}
