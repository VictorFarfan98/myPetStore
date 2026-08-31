import { AppShell } from "@/components/app-shell";
import { EmailHistoryBrowser } from "@/components/email-history-browser";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { clientesBuscarListar, clientesListar, clientesObtenerPorId } from "@/lib/rpc/clientes";
import { notificacionesEmailListar } from "@/lib/rpc/notificaciones_email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export default async function CorreosPage({ searchParams }: { searchParams: Promise<{ page?: string; desde?: string; hasta?: string; cliente_id?: string; cliente_q?: string }> }) {
  const params = await searchParams;
  const pageSize = 25;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const desde = validDate(params.desde);
  const hasta = validDate(params.hasta);
  const parsedCustomerId = Number.parseInt(params.cliente_id ?? "", 10);
  const customerId = Number.isInteger(parsedCustomerId) && parsedCustomerId > 0 ? parsedCustomerId : null;
  const customerQuery = params.cliente_q?.trim().slice(0, 100) ?? "";
  const [notifications, customers, selectedCustomer] = await Promise.all([
    notificacionesEmailListar({ p_limite: pageSize, p_offset: (page - 1) * pageSize, p_desde: desde, p_hasta: hasta, p_cliente_id: customerId }),
    customerQuery.length >= 2 ? clientesBuscarListar(customerQuery, 25, 0) : clientesListar(25, 0),
    customerId ? clientesObtenerPorId(customerId) : Promise.resolve({ data: null, error: null })
  ]);
  if (notifications.error || !notifications.data || customers.error || !customers.data) throw new Error("No se pudo cargar el historial de correos.");

  const customerRows = [...customers.data.datos];
  if (selectedCustomer.data && !customerRows.some((customer) => customer.id === selectedCustomer.data?.id)) customerRows.unshift(selectedCustomer.data);

  return <AppShell><PageContainer><PageHeader eyebrow="Comunicación" title="Historial de correos" description="Consulta las notificaciones enviadas al completar servicios y reintenta los envíos fallidos." /><EmailHistoryBrowser rows={notifications.data.datos} customers={customerRows} page={page} pageSize={pageSize} total={notifications.data.total} initialFrom={desde ?? ""} initialTo={hasta ?? ""} initialCustomerId={customerId} initialCustomerQuery={customerQuery} /></PageContainer></AppShell>;
}
