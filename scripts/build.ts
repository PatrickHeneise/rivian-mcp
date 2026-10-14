// Bundles the two bin entry points into dist/. Dependencies stay external.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli.ts', 'src/mcp-server.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
})
