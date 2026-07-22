import { AppShell } from "@/components/app-shell";
import { AgendaCalendar } from "@/components/agenda-calendar";
import { getAppData } from "@/lib/app-data";

export default async function AgendaPage() {
  const data = await getAppData();

  return (
    <AppShell>
      <AgendaCalendar data={data} />
    </AppShell>
  );
}
