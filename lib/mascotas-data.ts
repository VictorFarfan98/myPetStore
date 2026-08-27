import "server-only";

import { unwrapRpcResult } from "@/lib/rpc/core";
import { clientesListar } from "@/lib/rpc/clientes";
import { mascotasBuscarListar, mascotasListar } from "@/lib/rpc/mascotas";
import { tamanosListar } from "@/lib/rpc/tamanos";
import { createUserSupabaseClient } from "@/lib/supabase/server";
import type { MascotasPageData, Customer, Pet, PetSizeOption } from "@/lib/types";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function mapCustomer(row: { id: number; nombre: string; telefono: string; email: string | null; whatsapp_opt_in: boolean; sms_opt_in: boolean; notas: string | null }): Customer {
  return {
    id: row.id,
    name: row.nombre,
    phone: row.telefono,
    email: text(row.email),
    whatsappOptIn: row.whatsapp_opt_in,
    smsOptIn: row.sms_opt_in,
    notes: text(row.notas)
  };
}

export async function getMascotasPageData(page = 1, pageSize = 20, query = ""): Promise<MascotasPageData> {
  const normalizedQuery = query.trim().slice(0, 100);
  const [petsResult, customersResult, sizesResult] = await Promise.all([
    normalizedQuery ? mascotasBuscarListar(normalizedQuery, pageSize, (page - 1) * pageSize) : mascotasListar(pageSize, (page - 1) * pageSize),
    clientesListar(100, 0),
    tamanosListar(null, 0)
  ]);
  const pets = unwrapRpcResult(petsResult);
  const customers = unwrapRpcResult(customersResult).datos;
  const sizes = unwrapRpcResult(sizesResult).datos;
  const displayedCustomerIds = [...new Set(pets.datos.map((pet) => pet.cliente_id))];
  const supabase = await createUserSupabaseClient();
  const displayedCustomers = displayedCustomerIds.length
    ? await supabase.from("clientes").select("id, nombre, telefono, email, whatsapp_opt_in, sms_opt_in, notas, activo").in("id", displayedCustomerIds).eq("activo", true)
    : { data: [], error: null };
  if (displayedCustomers.error) throw new Error("No se pudieron cargar los clientes de las mascotas.");
  const customerById = new Map([...customers, ...(displayedCustomers.data ?? [])].map((customer) => [customer.id, customer]));
  const sizeById = new Map(sizes.map((size) => [size.id, size.nombre]));

  return {
    pets: pets.datos.filter((pet) => pet.activo).map((pet): Pet => ({
      id: pet.id,
      customerId: pet.cliente_id,
      name: pet.nombre,
      species: pet.especie === "perro" || pet.especie === "gato" ? pet.especie : "otro",
      breed: text(pet.raza),
      size: text(sizeById.get(pet.tamano_id)).toLowerCase().includes("pelo corto") ? "pelo_corto" : text(sizeById.get(pet.tamano_id)).toLowerCase().includes("pelo largo") ? "pelo_largo" : text(sizeById.get(pet.tamano_id)).toLowerCase().includes("pequ") ? "pequeno" : text(sizeById.get(pet.tamano_id)).toLowerCase().includes("med") ? "mediano" : text(sizeById.get(pet.tamano_id)).toLowerCase().includes("gig") ? "gigante" : "grande",
      profilePhotoUrl: pet.foto_perfil_url ?? undefined,
      birthdate: pet.fecha_nacimiento ?? undefined,
      healthNotes: text(pet.notas_salud),
      behaviorNotes: text(pet.notas_comportamiento)
    })),
    customers: [...customerById.values()].filter((customer) => customer.activo).map(mapCustomer),
    sizes: sizes.filter((size) => size.activo).map((size): PetSizeOption => ({ id: size.id, name: size.nombre, species: size.especie })),
    total: pets.total,
    pageSize
  };
}
