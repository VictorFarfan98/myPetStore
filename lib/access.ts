import { redirect } from "next/navigation";
import { usuariosObtenerPerfilActual } from "@/lib/rpc/usuarios";

const OPERATIONAL_WORKER_ROLES = ["groomer", "driver"];

export async function requireBackOfficeAccess() {
  const profile = await usuariosObtenerPerfilActual();
  if (profile.error || OPERATIONAL_WORKER_ROLES.includes(String(profile.data?.rol))) redirect("/hojas");
  return profile;
}
