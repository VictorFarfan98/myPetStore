import { AppShell } from "@/components/app-shell";
import { MascotasBrowser } from "@/components/mascotas-browser";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getAppData } from "@/lib/app-data";

export default async function MascotasPage() {
  const data = await getAppData();

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Expedientes"
          title="Mascotas"
          description="Busca mascotas por nombre o por su dueño, y abre su expediente con datos de grooming, salud y comportamiento."
        />
        <MascotasBrowser data={data} />
      </PageContainer>
    </AppShell>
  );
}
