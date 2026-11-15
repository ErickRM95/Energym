import { createClient } from "@/lib/supabase/browser";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function fittedJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("No se pudo preparar la imagen.");
  return blob;
}

export async function uploadNewsImage(file: File) {
  if (!allowedTypes.has(file.type)) throw new Error("Usa una imagen JPG, PNG o WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen no puede pasar de 8 MB.");
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Inicia sesión para publicar la imagen.");
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", auth.user.id).single();
  if (!profile?.organization_id) throw new Error("No se pudo subir la imagen.");
  const blob = await fittedJpeg(file);
  const path = `${profile.organization_id}/news/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("org-assets").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("No se pudo subir la imagen.");
  return supabase.storage.from("org-assets").getPublicUrl(path).data.publicUrl;
}
