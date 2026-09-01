import { NextResponse } from "next/server";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export async function GET() {
  const result = await usuariosObtenerPerfilActual();
  if (result.error || !result.data) return NextResponse.json({ id: null, rol: null, nombre: null }, { status: 403 });
  return NextResponse.json({ id: result.data.id ?? null, rol: result.data.rol ?? null, nombre: result.data.nombre ?? null });
}
