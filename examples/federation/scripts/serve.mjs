// Статический сервер для production-сборок макета (без зависимостей).
// node scripts/serve.mjs <папка> <порт> [--cors] [--spa]
//   --cors — заголовок Access-Control-Allow-Origin: * (нужен remote: шрифты — cross-origin ресурс);
//   --spa  — неизвестные пути отдают index.html (хост).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const [dir, port, ...flags] = process.argv.slice(2)
if (!dir || !port) { console.error('node scripts/serve.mjs <папка> <порт> [--cors] [--spa]'); process.exit(2) }
const root = resolve(dir)
const cors = flags.includes('--cors')
const spa = flags.includes('--spa')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json' }

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '')
  let file = join(root, path || 'index.html')
  if (!file.startsWith(root)) { res.writeHead(403).end(); return }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
  } catch {
    if (!spa) { res.writeHead(404).end(); return }
    file = join(root, 'index.html')
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {}) })
    res.end(body)
  } catch { res.writeHead(404).end() }
}).listen(Number(port), () => console.log(`${root} → http://localhost:${port}${cors ? ' (CORS)' : ''}`))
