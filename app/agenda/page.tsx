import { AppShell } from "@/components/app-shell";
import { getAppData } from "@/lib/app-data";
import nextDynamic from "next/dynamic";

const AgendaCalendar = nextDynamic(() => import("@/components/agenda-calendar").then((module) => module.AgendaCalendar), { loading: () => <div className="h-[42rem] animate-pulse rounded-lg bg-slate-100" /> });

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const data = await getAppData();

  return (
    <AppShell>
      <AgendaCalendar data={data} />
    </AppShell>
  );
}
