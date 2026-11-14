// Builds the hosted (Claude artifact) version into artifact/dist/job-portal.html
import { build } from 'esbuild';
import fs from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const out = await build({ entryPoints: [dir + 'app.js'], bundle: true, format: 'iife', target: 'chrome110', minify: true, write: false });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
fs.mkdirSync(dir + 'dist', { recursive: true });
fs.writeFileSync(dir + 'dist/job-portal.html', fs.readFileSync(dir + 'page.html', 'utf8').replace('/*BUNDLE*/', () => js));
console.log('built', (js.length / 1024).toFixed(1) + 'kb');
