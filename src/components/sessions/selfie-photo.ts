import { sessionApi } from "./session-api";
import { MAX_SELFIE_DATA_URL_LENGTH } from "@/modules/sessions/domain/selfie";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Turns a photo (a picked file or a camera frame) into the small JPEG the server
 * stores, and checks with the server that a face is visible. Throws an Error with a
 * Spanish message the person can act on.
 */
export async function prepareSelfie(photo: Blob): Promise<string> {
  if (!ACCEPTED_TYPES.includes(photo.type))
    throw new Error("Elige una foto JPG, PNG o WebP.");
  if (photo.size > 10_000_000)
    throw new Error("La foto debe pesar menos de 10 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "No pudimos leer tu foto. Elige otra foto JPG, PNG o WebP.",
    );
  }
  let dataUrl: string;
  try {
    const scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("No pudimos preparar tu foto. Intenta con otra.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    bitmap.close();
  }
  if (dataUrl.length > MAX_SELFIE_DATA_URL_LENGTH)
    throw new Error("Elige una foto más pequeña.");
  await sessionApi(
    "/api/selfies/validate",
    { selfieDataUrl: dataUrl },
    AbortSignal.timeout(20_000),
  );
  return dataUrl;
}
