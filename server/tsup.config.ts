import { defineConfig } from "tsup";

// Bundle the server into ESM. @flowcap/shared is bundled in (noExternal) so the
// dist is self-contained except for native/generated deps (Prisma client).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  noExternal: [/@flowcap\/shared/],
  external: ["@prisma/client", ".prisma/client"],
});
