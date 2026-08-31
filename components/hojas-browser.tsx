"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, LoaderCircle, Save, Star, Trash2, X } from "lucide-react";
import type { AppData, GroomingRecord } from "@/lib/types";
import type { AppointmentStatus } from "@/lib/types";
import { todayInGuatemala } from "@/lib/business-rules";
import { cancelCita } from "@/lib/citas-actions";
import { applyCoupon, getCouponName, listClientCoupons, savePayments } from "@/lib/pagos-actions";
import { deleteHoja, saveHoja } from "@/lib/registros-servicio-actions";
import { saveCalificacionGroomer } from "@/lib/calificaciones-groomer-actions";
import { uploadServicePhotos } from "@/lib/service-photo-upload";
import type { CuponRow } from "@/lib/rpc/types";

const conditions = ["Heridas visibles", "Raspones", "Piel irritada / enrojecida", "Costras", "Inflamacion", "Cojera", "Dolor al tocar"];
const parasites = ["Pulgas", "Garrapatas", "Piojos"];

function hojaState(value?: string) {
  switch (value) {
    case "completado": return { label: "Completada", className: "bg-emerald-50 text-emerald-700" };
    case "en_progreso": return { label: "En progreso", className: "bg-amber-50 text-amber-800" };
    case "cancelado": return { label: "Cancelada", className: "bg-rose-50 text-rose-700" };
    default: return { label: value || "Sin estado", className: "bg-slate-100 text-slate-700" };
  }
}

function SignaturePad({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !defaultValue) return;
    const image = new Image();
    image.onload = () => canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = defaultValue;
  }, [defaultValue]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    const context = canvasRef.current!.getContext("2d")!;
    context.beginPath(); context.moveTo(x, y); context.lineTo(x, y); context.stroke();
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const { x, y } = point(event);
    const context = canvasRef.current!.getContext("2d")!;
    context.lineTo(x, y); context.stroke();
    setValue(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setValue("");
  }

  return <div className="grid gap-1 text-sm font-medium text-slate-700">
    <label htmlFor={name}>{label}</label>
    <canvas id={name} ref={canvasRef} width={800} height={240} onPointerDown={start} onPointerMove={draw} onPointerUp={() => { drawing.current = false; setValue(canvasRef.current?.toDataURL("image/png") ?? ""); }} onPointerCancel={() => { drawing.current = false; }} className="h-32 w-full touch-none rounded-lg border border-slate-300 bg-white" aria-label={label} />
    <input name={name} type="hidden" value={value} required={required} readOnly />
    <button type="button" onClick={clear} className="focus-ring w-fit text-xs font-semibold text-slate-600">Limpiar firma</button>
  </div>;
}

function PhotoPreviews({ label, urls }: { label: string; urls: string[] }) {
  if (urls.length === 0) return null;
  return <section aria-label={label}><p className="mb-2 text-sm font-semibold text-ink">{label}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{urls.map((src, index) => <figure key={src} className="space-y-1"><img src={src} alt={`${label} ${index + 1}`} className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-slate-100 object-contain" /><figcaption className="text-xs text-slate-500">Foto {index + 1}</figcaption></figure>)}</div></section>;
}

function PaymentEditor({ data, record, totalAmount, methods, payments, onClose, onRefresh }: { data: AppData; record: GroomingRecord; totalAmount?: string; methods: NonNullable<AppData["paymentMethods"]>; payments: NonNullable<AppData["payments"]>; onClose: () => void; onRefresh: () => void }) {
  const [message, setMessage] = useState("");
  const [couponName, setCouponName] = useState(record.couponId ? "Consultando..." : "Sin cupón");
  const [pending, setPending] = useState(false);
  const existing = new Map(payments.filter((payment) => payment.recordId === record.id).map((payment) => [payment.methodId, payment.amount]));
  const [amounts, setAmounts] = useState<Record<number, string>>(() => Object.fromEntries(existing));
  const entered = Object.values(amounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const total = Number(totalAmount);
  const chargeTotal = Number.isFinite(total) ? Math.max(0, total) : NaN;
  const remaining = Number.isFinite(chargeTotal) ? chargeTotal - entered : null;
  const canSave = Number.isFinite(chargeTotal) && Math.round(entered * 100) === Math.round(chargeTotal * 100);
  const discount = Math.max(0, Number(record.discountAmount) || 0);
  const totalBeforeCoupon = Number.isFinite(chargeTotal) ? chargeTotal + discount : NaN;
  const serviceItems = record.serviceItems?.length ? record.serviceItems : (() => {
    const primary = data.services.find((item) => item.id === record.serviceId);
    const additional = data.services.filter((item) => item.additional && record.additionalServiceIds?.includes(item.id));
    const additionalTotal = additional.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
    return [{ name: primary?.name ?? "Servicio", price: Math.max(0, totalBeforeCoupon - additionalTotal).toFixed(2), quantity: undefined }, ...additional.map((item) => ({ name: item.name, price: Number(item.price ?? 0).toFixed(2), quantity: undefined }))];
  })();
  const money = (amount: number) => amount.toLocaleString("es-GT", { style: "currency", currency: "GTQ" });

  useEffect(() => {
    if (!record.couponId) return;
    let active = true;
    void getCouponName(record.couponId).then((result) => { if (active) setCouponName(result.name); });
    return () => { active = false; };
  }, [record.couponId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return setMessage("La suma de los pagos debe coincidir con el total a pagar.");
    setPending(true); setMessage("");
    const result = await savePayments(new FormData(event.currentTarget));
    setPending(false);
    if (result.error) return setMessage(result.error);
    onClose();
    onRefresh();
  }

  return <form className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={submit}><input name="registro_servicio_id" type="hidden" value={record.id} readOnly /><div className="mb-3"><h3 className="font-semibold text-ink">Pagos del servicio</h3><p className="text-sm text-slate-500">Ingresa el monto recibido por cada método de pago.</p></div><div className="mb-4 grid gap-2 rounded-lg bg-white p-3 text-sm sm:grid-cols-2 lg:grid-cols-5"><p>Total requerido: <strong>{Number.isFinite(chargeTotal) ? money(chargeTotal) : "Pendiente de definir"}</strong></p><p>Total sin cupón: <strong>{Number.isFinite(totalBeforeCoupon) ? money(totalBeforeCoupon) : "Pendiente de definir"}</strong></p><p>Descuento del cupón: <strong>{money(discount)}</strong></p><p>Ingresado: <strong>{money(entered)}</strong></p><p className={remaining !== null && remaining < 0 ? "text-rose-700" : "text-slate-700"}>{remaining === null ? "Saldo: pendiente de definir" : remaining >= 0 ? <span>Saldo restante: <strong>{money(remaining)}</strong></span> : <span>Excedente: <strong>{money(Math.abs(remaining))}</strong></span>}</p></div><div className="mb-4 rounded-lg bg-white p-3 text-sm"><p className="font-semibold text-ink">Servicios solicitados</p><ul className="mt-2 space-y-1 text-slate-600">{serviceItems.map((item) => <li key={item.name} className="flex justify-between gap-3"><span>{item.name}{item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}</span><strong className="shrink-0 text-slate-700">{money(Number(item.price))}</strong></li>)}</ul></div><label className="mb-4 grid gap-1 text-sm font-medium text-slate-700">Cupón aplicado<input type="text" value={couponName} readOnly className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600" /></label><div className="grid gap-3 sm:grid-cols-2">{methods.filter((method) => method.name.toLowerCase() !== "cupón").map((method) => <label key={method.id} className="grid gap-1 text-sm font-medium text-slate-700">{method.name}<input name={`pago_${method.id}`} type="number" min="0" step="0.01" value={amounts[method.id] ?? ""} onChange={(event) => setAmounts({ ...amounts, [method.id]: event.target.value })} className="focus-ring rounded-lg border border-slate-300 px-3 py-2" placeholder="0.00" /></label>)}</div>{message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}<div className="mt-4 flex gap-2"><button disabled={pending || !canSave} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{pending ? "Guardando..." : "Guardar pagos"}</button><button type="button" disabled={pending} onClick={onClose} className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cerrar pagos</button></div></form>;
}

function SheetForm({ data, appointmentId, record, onClose, onSaved, onRefresh }: { data: AppData; appointmentId: number; record?: GroomingRecord; onClose: () => void; onSaved: (result: { completed?: boolean; recordId?: number; groomerId?: number }) => void; onRefresh: () => void }) {
  const appointment = data.appointments.find((item) => item.id === appointmentId)!;
  const pet = data.pets.find((item) => item.id === appointment.petId)!;
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [clientSigning, setClientSigning] = useState(false);
  const [serviceId, setServiceId] = useState(String(record?.serviceId ?? appointment.serviceIds[0]));
  const [usePromotion, setUsePromotion] = useState(Boolean(record?.usesPromotion));
  const [additionalIds, setAdditionalIds] = useState<number[]>(record?.additionalServiceIds ?? []);
  const [additionalTouched, setAdditionalTouched] = useState(false);
  const [selected, setSelected] = useState([...(record?.conditions ?? []), ...(record?.parasites ?? [])]);
  const primaryServices = data.services.filter((service) => !service.additional);
  const additionalServices = data.services.filter((service) => service.additional && service.active && service.price);
  const selectedPrice = data.serviceDurations?.find((item) => item.serviceId === Number(serviceId) && item.species === pet.species && item.size === pet.size);
  const toggle = (value: string) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const toggleAdditional = (id: number) => { setAdditionalTouched(true); setAdditionalIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("adicionales_configurados", String(additionalTouched));
    form.set("usar_promocion", usePromotion && Boolean(selectedPrice?.promotionalPrice) ? "on" : "off");
    if (clientSigning && !String(form.get("firma_ingreso_url") ?? "").trim()) {
      setPending(false);
      return setMessage("El cliente debe firmar antes de confirmar el ingreso.");
    }
    [...conditions, ...parasites].forEach((value) => { if (selected.includes(value)) form.set(value === "Piel irritada / enrojecida" ? "piel_irritada" : value.toLowerCase().replaceAll(" ", "_"), "on"); });
    additionalIds.forEach((id) => form.append("adicional_id", String(id)));
    let result;
    try {
      const intakePaths = await uploadServicePhotos(form.getAll("fotos_ingreso").filter((value): value is File => value instanceof File && value.size > 0), appointmentId, "ingreso");
      form.delete("fotos_ingreso");
      intakePaths.forEach((path) => form.append("foto_ingreso_path", path));
      result = await saveHoja(form);
    } catch (error) {
      setPending(false);
      return setMessage(error instanceof Error ? error.message : "No se pudieron subir las fotos.");
    }
    setPending(false);
    if (result.error) return setMessage(result.error);
    onSaved(result);
    onRefresh();
  }

  async function remove() {
    if (!record || !window.confirm("¿Deseas desactivar esta hoja de servicio?")) return;
    const form = new FormData(); form.set("registro_id", String(record.id));
    setPending(true); const result = await deleteHoja(form); setPending(false);
    if (result.error) return setMessage(result.error); onRefresh();
  }

  return <form className="mt-4 grid gap-4 border-t border-slate-200 pt-4" onSubmit={submit}>
    <input name="cita_id" type="hidden" value={appointmentId} readOnly /><input name="registro_id" type="hidden" value={record?.id ?? ""} readOnly />
    <div inert={clientSigning || undefined} className={clientSigning ? "pointer-events-none select-none opacity-60" : undefined}>
      <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">Servicio<select name="servicio_id" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="focus-ring rounded-lg border border-slate-300 px-3 py-2">{primaryServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Groomer<select name="peluquero_id" defaultValue={record?.groomerId ?? appointment.groomerId} className="focus-ring rounded-lg border border-slate-300 px-3 py-2">{data.users.filter((user) => user.role === "groomer").map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">{pet.species === "gato" ? "Tipo de pelo" : "Tamaño"}<select name="tamano_id" defaultValue={data.sizes?.find((size) => size.id === record?.sizeId)?.id ?? data.sizes?.find((size) => size.species === pet.species && size.name.toLowerCase().includes(pet.size.replace("_", " ").slice(0, 4)))?.id ?? data.sizes?.find((size) => size.species === pet.species)?.id} className="focus-ring rounded-lg border border-slate-300 px-3 py-2">{data.sizes?.filter((size) => size.species === pet.species).map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}</select></label>
        {selectedPrice?.promotionalPrice && <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700"><input name="usar_promocion" type="checkbox" checked={usePromotion} onChange={(event) => setUsePromotion(event.target.checked)} /> Aplicar precio promocional (Q {Number(selectedPrice.promotionalPrice).toFixed(2)})</label>}
      </div>
      <fieldset className="grid gap-2"><legend className="text-sm font-semibold text-ink">Condiciones visibles</legend><div className="grid gap-2 sm:grid-cols-2">{conditions.map((label) => <label key={label} className="flex gap-2 text-sm text-slate-700"><input name={label.toLowerCase().replaceAll(" ", "_")} type="checkbox" checked={selected.includes(label)} onChange={() => toggle(label)} />{label}</label>)}</div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm font-semibold text-ink">Parásitos visibles</legend><div className="grid gap-2 sm:grid-cols-3">{parasites.map((label) => <label key={label} className="flex gap-2 text-sm text-slate-700"><input name={label.toLowerCase()} type="checkbox" checked={selected.includes(label)} onChange={() => toggle(label)} />{label}</label>)}</div></fieldset>
      {additionalServices.length > 0 && <fieldset className="grid gap-2"><legend className="text-sm font-semibold text-ink">Servicios adicionales</legend><div className="grid gap-2 sm:grid-cols-2">{additionalServices.map((service) => <label key={service.id} className="flex gap-2 text-sm text-slate-700"><input name="adicional_id" type="checkbox" checked={additionalIds.includes(service.id)} onChange={() => toggleAdditional(service.id)} value={service.id} />{service.name}</label>)}</div></fieldset>}
      <label className="grid gap-1 text-sm font-medium text-slate-700">Observaciones de ingreso<textarea name="observaciones_ingreso" defaultValue={appointment.notes} className="focus-ring min-h-20 rounded-lg border border-slate-300 px-3 py-2" /></label>
      <PhotoPreviews label="Fotos de ingreso" urls={record?.intakePhotoUrls ?? []} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">Agregar fotos de ingreso<input name="fotos_ingreso" type="file" accept="image/*" capture="environment" multiple className="focus-ring rounded-lg border border-slate-300 px-3 py-2" /></label>
      </div>
    </div>
    <div className={clientSigning ? "rounded-lg border border-amber-300 bg-amber-50 p-4" : undefined}><SignaturePad name="firma_ingreso_url" label={clientSigning ? "Firma del cliente para confirmar ingreso" : "Firma de ingreso"} defaultValue={record?.intakeSignatureImageUrl} required />{clientSigning && <p className="mt-2 text-sm font-semibold text-amber-900" role="status">El formulario está bloqueado. El cliente solo puede firmar y confirmar el ingreso.</p>}</div>
    {message && <p className="text-sm text-rose-700" role="alert">{message}</p>}
    <div className="flex flex-wrap gap-2">{!clientSigning && <button type="button" disabled={pending} onClick={() => { setClientSigning(true); setMessage(""); }} className="focus-ring rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Solicitar firma cliente</button>}<button disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300" aria-busy={pending}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{clientSigning ? "Confirmar ingreso" : record ? "Guardar cambios" : "Crear y guardar hoja"}</button>{!clientSigning && <button type="button" disabled={pending} onClick={onClose} className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cerrar hoja</button>}{record && !clientSigning && <button type="button" disabled={pending} onClick={remove} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" />{pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}Desactivar</button>}</div>
  </form>;
}

function CompletionForm({ data, appointmentId, record, onClose, onSaved, onRefresh }: { data: AppData; appointmentId: number; record: GroomingRecord; onClose: () => void; onSaved: (result: { completed?: boolean; recordId?: number; groomerId?: number }) => void; onRefresh: () => void }) {
  const appointment = data.appointments.find((item) => item.id === appointmentId)!;
  const pet = data.pets.find((item) => item.id === appointment.petId)!;
  const [message, setMessage] = useState("");
  const [couponId, setCouponId] = useState(record.couponId ?? "");
  const [discount, setDiscount] = useState(record.discountAmount ?? "0.00");
  const [coupons, setCoupons] = useState<CuponRow[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [pending, setPending] = useState(false);
  const [clientSigning, setClientSigning] = useState(false);
  const serviceId = record.serviceId ?? appointment.serviceIds[0];
  const additionalIds = record.additionalServiceIds ?? [];
  const usePromotion = Boolean(record.usesPromotion);
  const additionalServices = data.services.filter((service) => service.additional && service.active && service.price);
  const selectedPrice = data.serviceDurations?.find((item) => item.serviceId === serviceId && item.species === pet.species && item.size === pet.size);
  const subtotal = Number(usePromotion && selectedPrice?.promotionalPrice ? selectedPrice.promotionalPrice : selectedPrice?.price ?? 0)
    + additionalServices.filter((service) => additionalIds.includes(service.id)).reduce((sum, service) => sum + Number(service.price), 0);
  const loadCoupons = useCallback(async () => {
    setLoadingCoupons(true); setMessage(""); setCoupons([]);
    const form = new FormData(); form.set("cliente_id", String(pet.customerId)); form.set("servicio_id", String(serviceId));
    const result = await listClientCoupons(form);
    setLoadingCoupons(false);
    if (result.error) return setMessage(result.error);
    setCoupons(result.coupons ?? []);
  }, [pet.customerId, serviceId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadCoupons(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCoupons]);

  async function selectCoupon(id: string) {
    setCouponId(id); setDiscount("0.00");
    if (!id) return;
    setLoadingCoupons(true); setMessage("");
    const form = new FormData(); form.set("cliente_id", String(pet.customerId)); form.set("servicio_id", String(serviceId)); form.set("monto_base", String(subtotal)); form.set("cupon_id", id);
    const result = await applyCoupon(form);
    setLoadingCoupons(false);
    if (result.error) return setMessage(result.error);
    setCouponId(result.couponId ?? id); setDiscount(result.discount ?? "0.00");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("cupon_id", couponId);
    form.set("descuento_cupon", discount);
    form.set("adicionales_configurados", "false");
    form.set("usar_promocion", usePromotion ? "on" : "off");
    if (clientSigning && !String(form.get("firma_entrega_url") ?? "").trim()) {
      setPending(false);
      return setMessage("El cliente debe firmar antes de confirmar la entrega.");
    }
    let result;
    try {
      const completionPaths = await uploadServicePhotos(form.getAll("fotos_egreso").filter((value): value is File => value instanceof File && value.size > 0), appointmentId, "egreso");
      form.delete("fotos_egreso");
      completionPaths.forEach((path) => form.append("foto_egreso_path", path));
      result = await saveHoja(form);
    } catch (error) {
      setPending(false);
      return setMessage(error instanceof Error ? error.message : "No se pudieron subir las fotos.");
    }
    setPending(false);
    if (result.error) return setMessage(result.error);
    onSaved(result);
    onRefresh();
  }

  const fields = [...(record.conditions ?? []), ...(record.parasites ?? [])];
  return <form className="mt-4 grid gap-4 border-t border-slate-200 pt-4" onSubmit={submit}>
    <input name="cita_id" type="hidden" value={appointmentId} readOnly /><input name="registro_id" type="hidden" value={record.id} readOnly /><input name="servicio_id" type="hidden" value={serviceId} readOnly /><input name="peluquero_id" type="hidden" value={record.groomerId ?? appointment.groomerId} readOnly /><input name="tamano_id" type="hidden" value={record.sizeId ?? ""} readOnly /><input name="firma_ingreso_url" type="hidden" value={record.intakeSignatureImageUrl ?? ""} readOnly /><input name="observaciones_ingreso" type="hidden" value={appointment.notes} readOnly />
    {fields.map((value) => <input key={value} name={value === "Piel irritada / enrojecida" ? "piel_irritada" : value.toLowerCase().replaceAll(" ", "_")} type="hidden" value="on" readOnly />)}
    <div inert={clientSigning || undefined} className={clientSigning ? "pointer-events-none select-none opacity-60" : undefined}>
      <div className="grid gap-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4"><div className="flex flex-wrap items-end gap-3"><button type="button" disabled={loadingCoupons} onClick={loadCoupons} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800">{loadingCoupons && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{loadingCoupons ? "Consultando..." : "Actualizar cupones"}</button><label className="grid min-w-56 flex-1 gap-1 text-sm font-medium text-slate-700">Cupón<select value={couponId} disabled={loadingCoupons || coupons.length === 0} onChange={(event) => selectCoupon(event.target.value)} className="focus-ring rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">{loadingCoupons ? "Consultando cupones..." : coupons.length ? "Selecciona un cupón" : "No hay cupones disponibles"}</option>{coupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.nombre} · {coupon.tipo_descuento === "porcentaje" ? `${coupon.valor}%` : `GTQ ${coupon.valor}`}</option>)}</select></label><label className="grid gap-1 text-sm font-medium text-slate-700">Descuento aplicado<input type="number" value={discount} readOnly className="rounded-lg border border-slate-300 bg-white px-3 py-2" /></label></div>{coupons.length === 0 && !loadingCoupons && <p className="mt-2 text-sm text-violet-800" role="status">El cliente no tiene cupones disponibles para este servicio.</p>}{couponId && <p className="mt-2 text-xs text-violet-800">Cupón aplicado a esta hoja.</p>}</div>
      <PhotoPreviews label="Fotos de egreso" urls={record.completionPhotoUrls} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">Notas del servicio<textarea name="notas_servicio" defaultValue={record.groomerNotes} className="focus-ring min-h-20 rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">Agregar fotos de egreso<input name="fotos_egreso" type="file" accept="image/*" capture="environment" multiple className="focus-ring rounded-lg border border-slate-300 px-3 py-2" /></label>
      </div>
    </div>
    <div className={clientSigning ? "rounded-lg border border-amber-300 bg-amber-50 p-4" : undefined}><SignaturePad name="firma_entrega_url" label={clientSigning ? "Firma del cliente para confirmar entrega" : "Firma de entrega"} defaultValue={record.completionSignatureImageUrl} required={clientSigning} />{clientSigning && <p className="mt-2 text-sm font-semibold text-amber-900" role="status">El formulario está bloqueado. El cliente solo puede firmar y confirmar la entrega.</p>}</div>
    {message && <p className="text-sm text-rose-700" role="alert">{message}</p>}
    <div className="flex flex-wrap gap-2">{!clientSigning && <button type="button" disabled={pending} onClick={() => { setClientSigning(true); setMessage(""); }} className="focus-ring rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Solicitar firma cliente</button>}<button disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300" aria-busy={pending}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{clientSigning ? "Confirmar entrega" : "Guardar cambios"}</button>{!clientSigning && <button type="button" disabled={pending} onClick={onClose} className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cerrar</button>}</div>
  </form>;
}

function RatingModal({ recordId, groomerName, onClose }: { recordId: number; groomerName: string; onClose: () => void }) {
  const [step, setStep] = useState<"ask" | "rate">("ask");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) return setMessage("Selecciona una calificación.");
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const result = await saveCalificacionGroomer(form);
    setPending(false);
    if (result.error) return setMessage(result.error);
    onClose();
  }

    return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rating-title">
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      {step === "ask" ? <><h2 id="rating-title" className="text-xl font-semibold text-ink">¿Deseas dejar una reseña?</h2><p className="mt-2 text-sm text-slate-600">Tu opinión ayuda a mejorar el servicio de grooming.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">No, gracias</button><button type="button" onClick={() => setStep("rate")} className="focus-ring rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white">Sí, calificar</button></div></> : <form onSubmit={submit}><input name="registro_servicio_id" type="hidden" value={recordId} readOnly /><h2 id="rating-title" className="text-xl font-semibold text-ink">Calificar a {groomerName}</h2><div className="mt-5 flex items-center justify-center gap-1" aria-label="Calificación de 1 a 5 estrellas">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} estrella${value === 1 ? "" : "s"}`} className="focus-ring rounded p-1"><Star className={`h-9 w-9 ${rating !== null && value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>)}</div><input name="calificacion" type="hidden" value={rating ?? ""} readOnly /><label className="mt-5 grid gap-1 text-sm font-medium text-slate-700">Comentario (opcional)<textarea name="calificacion_notas" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} className="focus-ring min-h-24 rounded-lg border border-slate-300 px-3 py-2" /></label>{message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => setStep("ask")} className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Atrás</button><button type="submit" disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{pending ? "Guardando..." : "Guardar calificación"}</button></div></form>}
    </div>
  </div>;
}

export function HojasBrowser({
  data,
  initialView,
  initialDate,
  initialBranchId,
  historyPage,
  historyPageSize
}: {
  data: AppData;
  initialView: "today" | "history";
  initialDate: string;
  initialBranchId: number | null;
  historyPage: number;
  historyPageSize: number;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [completionOpenId, setCompletionOpenId] = useState<number | null>(null);
  const [paymentOpenId, setPaymentOpenId] = useState<number | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [appointmentActionId, setAppointmentActionId] = useState<number | null>(null);
  const [rating, setRating] = useState<{ recordId: number; groomerName: string } | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [view, setView] = useState<"today" | "history">(initialView);
  const today = todayInGuatemala();
  const [selectedDate, setSelectedDate] = useState(initialDate || today);
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");
  const [query, setQuery] = useState("");
  const onlyBranch = data.branches.length === 1 ? data.branches[0] : undefined;
  const [branchId, setBranchId] = useState<number | "all">(initialBranchId ?? onlyBranch?.id ?? "all");
  const router = useRouter();
  const refreshPage = () => startRefresh(() => router.refresh());
  const appointmentDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const recordsByAppointment = useMemo(() => new Map(data.groomingRecords.map((record) => [record.appointmentId, record])), [data.groomingRecords]);
  const appointments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return data.appointments.filter((appointment) => {
      const record = recordsByAppointment.get(appointment.id);
      const pet = data.pets.find((item) => item.id === appointment.petId);
      const customer = data.customers.find((item) => item.id === pet?.customerId);
      if (view === "today" && appointmentDate(appointment.scheduledStart) !== selectedDate) return false;
      if (view === "history" && !record) return false;
      if (branchId !== "all" && appointment.branchId !== branchId) return false;
      if (status !== "all" && appointment.status !== status) return false;
      return !normalizedQuery || `${pet?.name ?? ""} ${customer?.name ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [branchId, data, query, recordsByAppointment, selectedDate, status, view]);
  const totalPages = Math.max(1, Math.ceil((data.groomingRecordsTotal ?? 0) / historyPageSize));
  const changeView = (nextView: "today" | "history") => {
    setView(nextView);
    setStatus("all");
    setQuery("");
    const branch = branchId === "all" ? "" : `&sucursal_id=${branchId}`;
    router.push(nextView === "history" ? `/hojas?view=history&page=1${branch}` : `/hojas?fecha=${selectedDate}${branch}`);
  };
  const changeBranch = (value: string) => {
    const nextBranchId = value === "all" ? "all" : Number(value);
    setBranchId(nextBranchId);
    router.push(view === "history" ? `/hojas?view=history&page=1${nextBranchId === "all" ? "" : `&sucursal_id=${nextBranchId}`}` : `/hojas?fecha=${selectedDate}${nextBranchId === "all" ? "" : `&sucursal_id=${nextBranchId}`}`);
  };
  const changeDate = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    router.push(`/hojas?fecha=${date}${branchId === "all" ? "" : `&sucursal_id=${branchId}`}`);
  };
  async function cancelAppointment(appointmentId: number) {
    const reason = window.prompt("Indica el motivo de la cancelación:");
    if (reason === null) return;
    if (!reason.trim()) return setActionError("Escribe un motivo para cancelar la cita.");
    const form = new FormData();
    form.set("cita_id", String(appointmentId));
    form.set("motivo", reason);
    setAppointmentActionId(appointmentId); setActionError("");
    setOpenId(null); setCompletionOpenId(null); setPaymentOpenId(null);
    const result = await cancelCita(form);
    setAppointmentActionId(null);
    if (result.error) return setActionError(result.error);
    setSavedMessage("La cita se canceló correctamente.");
    router.refresh();
  }
  return <div>
    {isRefreshing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60" role="status" aria-live="polite"><div className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-lg"><LoaderCircle className="h-5 w-5 animate-spin text-jade" aria-hidden="true" />Actualizando la hoja…</div></div>}
    {rating && <RatingModal recordId={rating.recordId} groomerName={rating.groomerName} onClose={() => { setRating(null); setSavedMessage("La hoja de servicio se guardó correctamente."); }} />}
    {savedMessage && <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm" role="status" aria-live="polite"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p className="flex-1 text-sm font-semibold">{savedMessage}</p><button type="button" onClick={() => setSavedMessage("")} className="focus-ring rounded p-1" aria-label="Cerrar confirmación"><X className="h-4 w-4" aria-hidden="true" /></button></div>}
    {actionError && <div className="mb-5 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-sm" role="alert"><p className="flex-1 text-sm font-semibold">{actionError}</p><button type="button" onClick={() => setActionError("")} className="focus-ring rounded p-1" aria-label="Cerrar error"><X className="h-4 w-4" aria-hidden="true" /></button></div>}
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex flex-wrap gap-2"><button className={`focus-ring rounded-lg px-3 py-2 text-sm font-semibold ${view === "today" ? "bg-jade text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => changeView("today")} type="button">Hojas por fecha</button><button className={`focus-ring rounded-lg px-3 py-2 text-sm font-semibold ${view === "history" ? "bg-jade text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => changeView("history")} type="button">Historial</button></div>
      <div className={`mt-3 grid gap-3 ${view === "today" ? "md:grid-cols-2 xl:grid-cols-[1fr_12rem_12rem_12rem]" : "md:grid-cols-[1fr_12rem_12rem]"}`}><label className="grid gap-1 text-sm font-medium text-slate-700">Buscar mascota o cliente<input className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. Frida" /></label>{view === "today" && <label className="grid gap-1 text-sm font-medium text-slate-700">Fecha<input className="focus-ring rounded-lg border border-slate-300 px-3 py-2" type="date" min={today} value={selectedDate} onChange={(event) => changeDate(event.target.value)} /></label>}<label className="grid gap-1 text-sm font-medium text-slate-700">Sucursal<select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={branchId} disabled={Boolean(onlyBranch)} onChange={(event) => changeBranch(event.target.value)}><option value="all">Todas</option>{data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium text-slate-700">Estado<select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus | "all")}><option value="all">Todos</option><option value="scheduled">Programadas</option><option value="confirmed">Confirmadas</option><option value="checked_in">Recibidas</option><option value="in_progress">En progreso</option><option value="completed">Completadas</option><option value="cancelled">Canceladas</option><option value="no_show">No asistió</option></select></label></div>
      <p className="mt-3 text-sm text-slate-500">{view === "today" ? `${appointments.length} cita${appointments.length === 1 ? "" : "s"} ${selectedDate === today ? "para hoy" : "para la fecha seleccionada"}.` : `Página ${historyPage} de ${totalPages} · ${data.groomingRecordsTotal ?? 0} hojas registradas.`}</p>
    </div>
    <div className="space-y-4">{appointments.map((appointment) => {
      const record = recordsByAppointment.get(appointment.id);
      const pet = data.pets.find((item) => item.id === appointment.petId);
      const customer = data.customers.find((item) => item.id === pet?.customerId);
      const cancelled = appointment.status === "cancelled";
      const state = cancelled ? hojaState("cancelado") : hojaState(record?.outcome);
      const readyForPayment = Boolean(record?.intakeSignatureImageUrl && record.completionSignatureImageUrl);
      const editable = !cancelled && (!record || (record.outcome === "en_progreso" && !readyForPayment));
      const canComplete = !cancelled && Boolean(record && record.outcome === "en_progreso" && !readyForPayment);
      const canRegisterPayment = !cancelled && readyForPayment;
      const canCancel = !["cancelled", "completed", "in_progress", "checked_in", "no_show"].includes(appointment.status);
      const actionPending = appointmentActionId === appointment.id;
      const onSaved = (result: { completed?: boolean; recordId?: number; groomerId?: number }) => {
        setOpenId(null); setCompletionOpenId(null);
        if (result.completed && data.ratingsEnabled !== false && result.recordId) {
          setRating({ recordId: result.recordId, groomerName: data.users.find((user) => user.role === "groomer" && user.id === result.groomerId)?.name ?? "el groomer" });
        } else setSavedMessage("La hoja de servicio se guardó correctamente.");
      };
      return <article key={appointment.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-jade" /><h2 className="text-xl font-semibold text-ink">{pet?.name}</h2></div><p className="mt-1 text-sm text-slate-500">{customer?.name} · {new Date(appointment.scheduledStart).toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guatemala" })}</p><p className="mt-1 text-sm text-slate-600">{record ? `Hoja #${record.id}` : "Hoja pendiente de ingreso"} <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${state.className}`}>{cancelled ? state.label : record ? state.label : "Pendiente"}</span></p></div><div className="flex flex-wrap gap-2">{canRegisterPayment && <button onClick={() => { setPaymentOpenId(paymentOpenId === appointment.id ? null : appointment.id); setOpenId(null); setCompletionOpenId(null); }} className="focus-ring rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" type="button">{paymentOpenId === appointment.id ? "Cerrar pagos" : "Registrar pagos"}</button>}{editable ? <button onClick={() => { setOpenId(openId === appointment.id ? null : appointment.id); setPaymentOpenId(null); setCompletionOpenId(null); }} className="focus-ring rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" type="button">{openId === appointment.id ? "Cerrar" : record ? "Editar hoja" : "Llenar hoja"}</button> : <span className={`rounded-lg px-3 py-2 text-sm font-semibold ${state.className}`}>{state.label}</span>}{canComplete && <button onClick={() => { setCompletionOpenId(completionOpenId === appointment.id ? null : appointment.id); setOpenId(null); setPaymentOpenId(null); }} className="focus-ring rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800" type="button">{completionOpenId === appointment.id ? "Cerrar" : "Completar servicio"}</button>}{canCancel && <button type="button" disabled={actionPending} onClick={() => void cancelAppointment(appointment.id)} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800">{actionPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{actionPending ? "Procesando..." : "Cancelar cita"}</button>}</div></div>{canRegisterPayment && paymentOpenId === appointment.id && record && <PaymentEditor data={data} record={record} totalAmount={record.finalAmount} methods={data.paymentMethods ?? []} payments={data.payments ?? []} onClose={() => setPaymentOpenId(null)} onRefresh={refreshPage} />}{openId === appointment.id && editable && <SheetForm data={data} appointmentId={appointment.id} record={record} onClose={() => setOpenId(null)} onSaved={onSaved} onRefresh={refreshPage} />}{completionOpenId === appointment.id && canComplete && record && <CompletionForm data={data} appointmentId={appointment.id} record={record} onClose={() => setCompletionOpenId(null)} onSaved={onSaved} onRefresh={refreshPage} />}</article>;
    })}</div>
    {!appointments.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No hay hojas para los filtros seleccionados.</div>}
    {view === "history" && totalPages > 1 && <div className="mt-5 flex items-center justify-between"><button className="focus-ring rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={historyPage <= 1} onClick={() => router.push(`/hojas?view=history&page=${historyPage - 1}${branchId === "all" ? "" : `&sucursal_id=${branchId}`}`)} type="button">Anterior</button><span className="text-sm text-slate-500">Página {historyPage} de {totalPages}</span><button className="focus-ring rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={historyPage >= totalPages} onClick={() => router.push(`/hojas?view=history&page=${historyPage + 1}${branchId === "all" ? "" : `&sucursal_id=${branchId}`}`)} type="button">Siguiente</button></div>}
  </div>;
}
