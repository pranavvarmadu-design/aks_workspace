// Bundles the extension sources into extension/dist (load extension/ unpacked in Chrome).
import { build } from 'esbuild';

await build({
  entryPoints: ['extension/src/background.js', 'extension/src/sidepanel.js', 'extension/src/print.js'],
  outdir: 'extension/dist',
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  minify: process.argv.includes('--minify'),
  logLevel: 'info',
});
