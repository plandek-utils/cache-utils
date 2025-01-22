import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  clean: true,
  format: ["cjs", "esm"],
  dts: false, // we will use `tsc` directly for it to prevent issues with `dayjs` plugin imports in the d.ts file
  sourcemap: true,
});
