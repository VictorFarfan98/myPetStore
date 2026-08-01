import { NextResponse } from "next/server";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

export async function GET() {
  const result = await usuariosObtenerPerfilActual();
  if (result.error || !result.data) return NextResponse.json({ rol: null }, { status: 403 });
  return NextResponse.json({ rol: result.data.rol ?? null });
}
