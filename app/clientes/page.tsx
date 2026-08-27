import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getClientes } from "@/lib/clientes-actions";
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const ClientesBrowser = nextDynamic(() => import("@/components/clientes-browser").then((module) => module.ClientesBrowser), { loading: () => <div className="mt-6 h-96 animate-pulse rounded-lg bg-slate-100" /> });

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const params = await searchParams;
  const pageSize = 20;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const query = params.q?.trim().slice(0, 100) ?? "";
  const data = await getClientes(page, pageSize, query);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Relacion con clientes"
          title="Clientes"
          description="Busca clientes por nombre, telefono o por sus mascotas asociadas para reutilizarlos al agendar."
        />
        <ClientesBrowser key={`${page}:${query}`} data={data} page={page} initialQuery={query} />
      </PageContainer>
    </AppShell>
  );
}
