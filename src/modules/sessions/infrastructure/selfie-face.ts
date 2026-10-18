import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import { ApiError } from "@/lib/http";
import { describeError, logger } from "@/lib/logger";

let model: Promise<GraphModel> | undefined;
function detector() {
  model ??= (async () => {
    await tf.setBackend("cpu");
    await tf.ready();
    const directory = join(
      process.cwd(),
      "src/modules/sessions/infrastructure/face-model",
    );
    const [manifest, weights] = await Promise.all([
      readFile(join(directory, "model.json"), "utf8"),
      readFile(join(directory, "blazeface.bin")),
    ]);
    const json = JSON.parse(manifest);
    return loadGraphModel(
      tf.io.fromMemory({
        modelTopology: json.modelTopology,
        weightSpecs: json.weightsManifest.flatMap(
          (group: { weights: tf.io.WeightsManifestEntry[] }) => group.weights,
        ),
        weightData: weights.buffer.slice(
          weights.byteOffset,
          weights.byteOffset + weights.byteLength,
        ),
      }),
    );
  })().catch((error) => {
    model = undefined;
    throw error;
  });
  return model;
}

// Only hashes and results are retained, never photos. Bounded, short-lived cache
// avoids repeating inference when upload validation is followed by joining.
const results = new Map<string, { expiresAt: number; result: Promise<void> }>();
export function assertSelfieHasFace(dataUrl: string): Promise<void> {
  const key = createHash("sha256").update(dataUrl).digest("hex");
  const cached = results.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug("selfie.face_check", { cacheHit: true });
    return cached.result;
  }
  if (results.size >= 64) results.delete(results.keys().next().value!);
  const started = performance.now();
  // Outcome and timing only: never the image, its hash or the face score.
  const result = inspect(dataUrl).then(
    () =>
      logger.info("selfie.face_check", {
        cacheHit: false,
        outcome: "face_found",
        durationMs: Math.round(performance.now() - started),
      }),
    (error) => {
      results.delete(key);
      logger.info("selfie.face_check", {
        cacheHit: false,
        outcome: error instanceof ApiError ? error.code : "error",
        durationMs: Math.round(performance.now() - started),
      });
      throw error;
    },
  );
  results.set(key, { result, expiresAt: Date.now() + 5 * 60_000 });
  return result;
}

async function inspect(dataUrl: string) {
  let pixels: Buffer;
  try {
    pixels = await sharp(Buffer.from(dataUrl.split(",")[1], "base64"), {
      limitInputPixels: 16_000_000,
    })
      .rotate()
      .resize(256, 256, { fit: "contain", background: "white" })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer();
  } catch {
    throw new ApiError(
      400,
      "invalid_selfie",
      "No pudimos leer tu foto. Sube otra foto JPG.",
    );
  }
  let confidence: number;
  try {
    const network = await detector();
    confidence = tf.tidy(() => {
      const image = tf.tensor4d(
        new Uint8Array(pixels),
        [1, 256, 256, 3],
        "float32",
      );
      const normalized = tf.sub(tf.div(image, 127.5), 1);
      // This pinned BlazeFace model has two classification heads (512 + 384 anchors).
      // Presence needs only the highest score, not landmarks or face embeddings.
      const scores = network.execute(normalized, [
        "Identity",
        "Identity_1",
      ]) as tf.Tensor[];
      return Math.max(
        ...scores.map((score) => tf.sigmoid(tf.max(score)).dataSync()[0]),
      );
    });
  } catch (error) {
    logger.error("selfie.detector_unavailable", describeError(error));
    throw new ApiError(
      503,
      "selfie_check_unavailable",
      "No pudimos comprobar tu selfie ahora. Intenta de nuevo en un momento.",
    );
  }
  if (!Number.isFinite(confidence) || confidence < 0.75)
    throw new ApiError(
      400,
      "face_required",
      "No detectamos un rostro. Sube una selfie de frente, con buena luz y sin cubrir tu cara.",
    );
}
