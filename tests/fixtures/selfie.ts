import { readFileSync } from "node:fs";
export const selfieDataUrl = `data:image/jpeg;base64,${readFileSync(new URL("./face.jpg", import.meta.url)).toString("base64")}`;
