import { AppShell } from "@/components/app-shell";
import { ClientesBrowser } from "@/components/clientes-browser";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getAppData } from "@/lib/app-data";

export default async function ClientesPage() {
  const data = await getAppData();

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Relacion con clientes"
          title="Clientes"
          description="Busca clientes por nombre, telefono o por sus mascotas asociadas para reutilizarlos al agendar."
        />
        <ClientesBrowser data={data} />
      </PageContainer>
    </AppShell>
  );
}
