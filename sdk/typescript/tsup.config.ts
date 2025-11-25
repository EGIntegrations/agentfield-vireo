import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'examples/simulation.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true
});
