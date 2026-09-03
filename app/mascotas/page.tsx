import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getMascotasPageData } from "@/lib/mascotas-data";
import { requireBackOfficeAccess } from "@/lib/access";
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const MascotasBrowser = nextDynamic(() => import("@/components/mascotas-browser").then((module) => module.MascotasBrowser), { loading: () => <div className="mt-6 h-[36rem] animate-pulse rounded-lg bg-slate-100" /> });

export default async function MascotasPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requireBackOfficeAccess();
  const params = await searchParams;
  const pageSize = 20;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const query = params.q?.trim().slice(0, 100) ?? "";
  const data = await getMascotasPageData(page, pageSize, query);

  return (
    <PageContainer>
        <PageHeader
          eyebrow="Expedientes"
          title="Mascotas"
          description="Busca mascotas por nombre o por su dueño, y abre su expediente con datos de grooming, salud y comportamiento."
        />
        <MascotasBrowser key={`${page}:${query}`} data={data} page={page} initialQuery={query} />
      </PageContainer>
  );
}
