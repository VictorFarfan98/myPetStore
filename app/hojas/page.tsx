import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getAppData } from "@/lib/app-data";
import { todayInGuatemala } from "@/lib/business-rules";
import { isMatch } from "date-fns";
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LazyHojasBrowser = nextDynamic(() => import("@/components/hojas-browser").then((module) => module.HojasBrowser), { loading: () => <div className="h-[32rem] animate-pulse rounded-lg bg-slate-100" /> });

export default async function HojasPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string; sucursal_id?: string; fecha?: string }> }) {
  const params = await searchParams;
  const history = params.view === "history";
  const today = todayInGuatemala();
  const selectedDate = params.fecha && isMatch(params.fecha, "yyyy-MM-dd") && params.fecha >= today ? params.fecha : today;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const branchId = Number.parseInt(params.sucursal_id ?? "", 10);
  const selectedBranchId = Number.isInteger(branchId) && branchId > 0 ? branchId : null;
  const pageSize = 20;
  const data = await getAppData(history ? { recordsLimit: pageSize, recordsOffset: (page - 1) * pageSize, recordsBranchId: selectedBranchId, includeReminderLogs: false, paymentsForRecords: true } : { includeReminderLogs: false });
  return <AppShell><PageContainer><PageHeader eyebrow="Operacion diaria" title="Hojas de servicio" description="Gestiona las hojas programadas por fecha y consulta el historial de servicios." /><div className="mt-6"><LazyHojasBrowser data={data} initialView={history ? "history" : "today"} initialDate={selectedDate} initialBranchId={selectedBranchId} historyPage={page} historyPageSize={pageSize} /></div></PageContainer></AppShell>;
}
