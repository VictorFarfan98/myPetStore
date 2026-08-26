import { createUserSupabaseBrowserClient } from "@/lib/supabase/client";

export async function uploadServicePhotos(files: File[], appointmentId: number, moment: "ingreso" | "egreso") {
  const supabase = createUserSupabaseBrowserClient();
  const paths: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      throw new Error("Cada foto debe ser una imagen de máximo 10 MB.");
    }
    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const path = `services/${appointmentId}/${moment}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("petstore").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("No se pudieron subir las fotos.");
    paths.push(path);
  }
  return paths;
}
