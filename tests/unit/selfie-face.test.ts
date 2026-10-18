import { describe, expect, it } from "vitest";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-core";
import { assertSelfieHasFace } from "@/modules/sessions/infrastructure/selfie-face";
import { selfieDataUrl } from "../fixtures/selfie";

describe("bundled selfie face detection", () => {
  it("accepts a portrait with the real bundled model", async () => {
    await expect(assertSelfieHasFace(selfieDataUrl)).resolves.toBeUndefined();
    const tensors = tf.memory().numTensors;
    await assertSelfieHasFace(selfieDataUrl);
    expect(tf.memory().numTensors).toBe(tensors);
  });
  it("rejects a valid image with no face", async () => {
    const image = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "blue" },
    })
      .jpeg()
      .toBuffer();
    await expect(
      assertSelfieHasFace(`data:image/jpeg;base64,${image.toString("base64")}`),
    ).rejects.toMatchObject({ status: 400, code: "face_required" });
  });
  it("rejects JPEG markers with corrupt image contents", async () => {
    await expect(
      assertSelfieHasFace("data:image/jpeg;base64,/9j/4AAQ/9k="),
    ).rejects.toMatchObject({ status: 400, code: "invalid_selfie" });
  });
});
