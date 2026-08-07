export function toE164(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) return `+502${digits}`;
  if (digits.length === 11 && digits.startsWith("502")) return `+${digits}`;
  const normalized = value.replace(/[\s()-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(normalized)) return normalized;
  throw new Error("Ingresa un teléfono guatemalteco de 8 dígitos o un número E.164 válido.");
}

export function optionalE164(value: string) {
  return value.trim() ? toE164(value) : null;
}
