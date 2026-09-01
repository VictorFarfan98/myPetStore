"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConfiguracionSistemaRow, MetodoPagoRow } from "@/lib/rpc/types";
import { updateConfiguracionSistema } from "@/lib/configuracion-sistema-actions";

export function ConfiguracionSistemaBrowser({ config, paymentMethods }: { config: ConfiguracionSistemaRow; paymentMethods: MetodoPagoRow[] }) {
  const [form, setForm] = useState(config);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateConfiguracionSistema(data);
      setMessage(result.error ? { text: result.error, error: true } : { text: "Configuración actualizada.", error: false });
      if (!result.error) router.refresh();
    });
  }

  return <form className="mt-6 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
    <h2 className="text-xl font-semibold text-ink">Reglas operativas</h2>
    <p className="mt-1 text-sm text-slate-500">Define los valores generales que usa la operación de grooming.</p>
    <div className="mt-5 space-y-5">
      <label className="flex items-center gap-3 text-sm font-medium text-ink"><input checked={form.foto_antes_requerida} className="h-4 w-4" name="foto_antes_requerida" onChange={(event) => setForm({ ...form, foto_antes_requerida: event.target.checked })} type="checkbox" /> Requerir foto antes del servicio</label>
      <label className="flex items-center gap-3 text-sm font-medium text-ink"><input checked={form.foto_despues_requerida} className="h-4 w-4" name="foto_despues_requerida" onChange={(event) => setForm({ ...form, foto_despues_requerida: event.target.checked })} type="checkbox" /> Requerir foto después del servicio</label>
      <label className="flex items-center gap-3 text-sm font-medium text-ink"><input checked={form.habilitar_calificaciones} className="h-4 w-4" name="habilitar_calificaciones" onChange={(event) => setForm({ ...form, habilitar_calificaciones: event.target.checked })} type="checkbox" /> Habilitar calificaciones de groomers</label>
      <label className="block text-sm font-medium text-ink">Días de anticipación para recordatorios<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="dias_anticipacion_recordatorio" onChange={(event) => setForm({ ...form, dias_anticipacion_recordatorio: Number(event.target.value) })} required type="number" value={form.dias_anticipacion_recordatorio} /></label>
      <label className="block text-sm font-medium text-ink">Servicios requeridos para recompensa<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="servicios_requeridos_cupon" onChange={(event) => setForm({ ...form, servicios_requeridos_cupon: Number(event.target.value) })} required type="number" value={form.servicios_requeridos_cupon} /></label>
      <label className="block text-sm font-medium text-ink">Días para completar la recompensa<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="fidelidad_dias_para_completar" onChange={(event) => setForm({ ...form, fidelidad_dias_para_completar: Number(event.target.value) })} required type="number" value={form.fidelidad_dias_para_completar} /></label>
      <label className="block text-sm font-medium text-ink">Días de inactividad para reiniciar <span className="font-normal text-slate-500">(opcional)</span><input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="fidelidad_dias_inactividad" onChange={(event) => setForm({ ...form, fidelidad_dias_inactividad: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={form.fidelidad_dias_inactividad ?? ""} /></label>
      <label className="block text-sm font-medium text-ink">Días de vigencia de la recompensa<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="vigencia_cupon_automatico_dias" onChange={(event) => setForm({ ...form, vigencia_cupon_automatico_dias: Number(event.target.value) })} required type="number" value={form.vigencia_cupon_automatico_dias} /></label>
      <label className="block text-sm font-medium text-ink">Método de pago para cupones<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="metodo_pago_cupon_id" onChange={(event) => setForm({ ...form, metodo_pago_cupon_id: Number(event.target.value) })} required value={form.metodo_pago_cupon_id}><option value="">Selecciona un método</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.nombre}</option>)}</select></label>
      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
      <button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : "Guardar cambios"}</button>
    </div>
  </form>;
}
