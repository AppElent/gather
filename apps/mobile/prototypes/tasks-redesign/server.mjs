// Throwaway prototype server. Never imported by the app or its production build.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

const files = { '/': 'index.html', '/prototype/tasks': 'index.html', '/prototype/tasks/app.js': 'app.js', '/prototype/tasks/style.css': 'style.css' }
createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname]
  if (!file) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8')
  res.end(await readFile(new URL(file, import.meta.url)))
}).listen(4311, '127.0.0.1', () => console.log('Tasks prototype: http://localhost:4311/prototype/tasks?variant=A'))
