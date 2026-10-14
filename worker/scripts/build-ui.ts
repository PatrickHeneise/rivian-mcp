// Builds the MCP Apps view into one self-contained HTML file, worker/dist/app.html.
// Hosts render it in a sandboxed iframe, so scripts and styles are inlined.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['worker/ui/app.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  outdir: 'worker/dist',
  write: false,
  legalComments: 'none',
  // Leaflet's stylesheet references a few small control icons.
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
})
const output = (ext: string) => result.outputFiles.find((f) => f.path.endsWith(ext))?.text ?? ''
// `</script` or `</style` inside the inlined code would end the element early.
const inline = (code: string) => code.replace(/<\/(script|style)/gi, '<\\/$1')

const template = await readFile('worker/ui/app.html', 'utf8')
const html = template
  .replace('/* STYLE */', () => inline(output('.css')))
  .replace('/* SCRIPT */', () => inline(output('.js')))
await mkdir('worker/dist', { recursive: true })
await writeFile('worker/dist/app.html', html)
console.log(`worker/dist/app.html ${(html.length / 1024).toFixed(0)} KiB`)
