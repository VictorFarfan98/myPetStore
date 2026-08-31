"use server";

import { revalidatePath } from "next/cache";
import { pagosReemplazarLista } from "@/lib/rpc/pagos";
import { cuponesListarPorCliente, cuponesObtenerPorId } from "@/lib/rpc/cupones";
import { registrosServicioObtenerPorId } from "@/lib/rpc/registros_servicio";

function cents(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export async function getCouponName(couponId: string) {
  const id = couponId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { name: "Cupón aplicado" };
  }
  const result = await cuponesObtenerPorId(id);
  return { name: result.data?.nombre ?? "Cupón aplicado" };
}

export async function applyCoupon(formData: FormData) {
  const clientId = Number(formData.get("cliente_id"));
  const serviceId = Number(formData.get("servicio_id"));
  const baseAmount = Number(formData.get("monto_base"));
  if (!Number.isInteger(clientId) || !Number.isInteger(serviceId) || !Number.isFinite(baseAmount) || baseAmount < 0) {
    return { error: "No se pudo calcular el cupón." };
  }

  const result = await cuponesListarPorCliente(clientId);
  if (result.error) return { error: "No se pudieron consultar los cupones del cliente." };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date());
  const requestedCouponId = String(formData.get("cupon_id") ?? "").trim();
  const coupon = (result.data ?? []).find((item) =>
    (!requestedCouponId || String(item.id) === requestedCouponId)
    && (item.servicio_id === null || item.servicio_id === serviceId)
    && item.activo === true
    && (!item.uso_unico || item.canjeado_en === null)
    && (item.fecha_expiracion === null || String(item.fecha_expiracion) >= today)
  );
  if (!coupon) return { error: "El cliente no tiene un cupón válido para este servicio." };

  const value = Number(coupon.valor);
  const baseCents = Math.round(baseAmount * 100);
  const discountCents = coupon.tipo_descuento === "porcentaje"
    ? Math.round(baseCents * value / 100)
    : Math.round(value * 100);
  return { couponId: String(coupon.id), discount: (Math.min(baseCents, discountCents) / 100).toFixed(2) };
}

export async function listClientCoupons(formData: FormData) {
  const clientId = Number(formData.get("cliente_id"));
  const serviceId = Number(formData.get("servicio_id"));
  if (!Number.isInteger(clientId) || !Number.isInteger(serviceId)) return { error: "No se pudieron consultar los cupones." };
  const result = await cuponesListarPorCliente(clientId);
  if (result.error) return { error: "No se pudieron consultar los cupones del cliente." };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date());
  return { coupons: (result.data ?? []).filter((item) =>
    (item.servicio_id === null || item.servicio_id === serviceId)
    && item.activo === true
    && (!item.uso_unico || item.canjeado_en === null)
    && (item.fecha_expiracion === null || String(item.fecha_expiracion) >= today)
  ) };
}

export async function savePayments(formData: FormData) {
  const recordId = Number(formData.get("registro_servicio_id"));
  if (!Number.isInteger(recordId) || recordId <= 0) return { error: "La hoja seleccionada no es válida." };

  const payments = [...formData.entries()]
    .filter(([name]) => name.startsWith("pago_"))
    .map(([name, value]) => ({ metodo_pago_id: Number(name.slice(5)), monto: String(value).trim() }))
    .filter((payment) => payment.monto !== "");
  console.log("savePayments formData", { recordId, payments });
  if (payments.some((payment) => !Number.isInteger(payment.metodo_pago_id) || !Number.isFinite(Number(payment.monto)) || Number(payment.monto) < 0)) {
    return { error: "Revisa los montos de pago." };
  }

  const record = await registrosServicioObtenerPorId(recordId);
  const totalAmount = record.data?.monto_final;
  if (record.error || totalAmount === null || totalAmount === undefined || String(totalAmount).trim() === "" || cents(totalAmount) === null) {
    return { error: "No se pudo validar el total de la hoja de servicio." };
  }
  const total = cents(totalAmount)!;
  const entered = payments.reduce((sum, payment) => sum + cents(payment.monto)!, 0);
  if (entered !== total) return { error: "La suma de los pagos debe coincidir con el total a pagar." };

  const result = await pagosReemplazarLista({ p_registro_servicio_id: recordId, p_pagos: payments.filter((payment) => Number(payment.monto) > 0), p_motivo: null });
  console.log("savePayments RPC result", result);
  if (result.error) {
    if (result.error.code === "PA001") return { error: "No tienes permiso para modificar los pagos." };
    if (result.error.code === "PN001") return { error: "La hoja de servicio no existe." };
    return { error: "No se pudieron guardar los pagos." };
  }
  revalidatePath("/hojas");
  return { ok: true };
}
