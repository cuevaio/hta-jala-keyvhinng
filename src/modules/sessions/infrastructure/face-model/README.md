# Bundled face-presence model

BlazeFace model and weights copied unchanged from `@vladmandic/human@3.3.6`:

- https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/blazeface.json
- https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/blazeface.bin

The package MIT license is included in `LICENSE`. Model metadata credits Google MediaPipe and the conversion by Vladimir Mandic. Upstream reference implementation: https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/src/face/blazeface.ts

Inputs are 256×256 RGB values normalized to [-1, 1]. We inspect the maximum sigmoid confidence across classification heads `Identity` and `Identity_1`; presence requires 0.75 confidence. We do not compute identities, embeddings, landmarks, or liveness. No image leaves the app server and model loading needs no network connection.

Both files must be bundled in deployment functions; see `outputFileTracingIncludes` in `next.config.ts`. Do not upgrade weights independently of the model manifest or inference contract. The portrait and no-face tests run actual inference to detect incompatible changes.
